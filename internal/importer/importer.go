package importer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

const maxFileSize = 50 * 1024 * 1024 // 50 MB

type Report struct {
	Total     int
	Success   int
	Failed    int
	Failures  []Failure
	Documents []ImportedDoc
}

type Failure struct {
	Path   string
	Reason string
}

type ImportedDoc struct {
	Path     string
	Title    string
	DocID    string
	DomainID string
}

// Import recursively processes a folder and imports documents into the database.
func Import(ctx context.Context, db *pgxpool.Pool, folder string, authorID string) (*Report, error) {
	// Check that pandoc and pdftotext are available
	if _, err := exec.LookPath("pandoc"); err != nil {
		return nil, fmt.Errorf("pandoc is not installed or not in PATH: %w", err)
	}
	if _, err := exec.LookPath("pdftotext"); err != nil {
		return nil, fmt.Errorf("pdftotext is not installed or not in PATH (install poppler-utils): %w", err)
	}

	// Load domains from DB
	domainMap, err := loadDomains(ctx, db)
	if err != nil {
		return nil, fmt.Errorf("load domains: %w", err)
	}

	// Get default domain (first one or "SCI")
	defaultDomainID := findDefaultDomain(domainMap)

	// Get default document type
	defaultTypeID, err := getDefaultTypeID(ctx, db)
	if err != nil {
		return nil, fmt.Errorf("get default document type: %w", err)
	}

	report := &Report{}

	err = filepath.Walk(folder, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if info.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if !isSupportedExtension(ext) {
			return nil
		}

		report.Total++

		if info.Size() > maxFileSize {
			report.Failed++
			report.Failures = append(report.Failures, Failure{
				Path:   path,
				Reason: fmt.Sprintf("file too large: %d bytes (max %d)", info.Size(), maxFileSize),
			})
			return nil
		}

		// Determine domain from subfolder
		domainID := resolveDomain(folder, path, domainMap, defaultDomainID)

		// Convert file to TipTap JSON
		tiptapJSON, bodyText, err := convertFile(ctx, path, ext)
		if err != nil {
			report.Failed++
			report.Failures = append(report.Failures, Failure{
				Path:   path,
				Reason: err.Error(),
			})
			log.Printf("SKIP %s: %v", path, err)
			return nil
		}

		// Determine title
		title := titleFromFilename(path)

		// Generate slug
		slug := slugify(title)

		// Insert into DB
		docID, err := insertDocument(ctx, db, title, slug, tiptapJSON, bodyText, domainID, defaultTypeID, authorID)
		if err != nil {
			report.Failed++
			report.Failures = append(report.Failures, Failure{
				Path:   path,
				Reason: fmt.Sprintf("db insert: %v", err),
			})
			return nil
		}

		report.Success++
		report.Documents = append(report.Documents, ImportedDoc{
			Path:     path,
			Title:    title,
			DocID:    docID,
			DomainID: domainID,
		})
		log.Printf("OK %s → %s (domain=%s)", path, title, domainID)
		return nil
	})

	if err != nil {
		return report, fmt.Errorf("walk folder: %w", err)
	}

	return report, nil
}

func isSupportedExtension(ext string) bool {
	switch ext {
	case ".doc", ".docx", ".pdf", ".txt", ".md":
		return true
	}
	return false
}

func loadDomains(ctx context.Context, db *pgxpool.Pool) (map[string]string, error) {
	rows, err := db.Query(ctx, "SELECT id, slug, name FROM domains ORDER BY sort_order, name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]string)
	for rows.Next() {
		var id, slug, name string
		if err := rows.Scan(&id, &slug, &name); err != nil {
			return nil, err
		}
		m[strings.ToLower(slug)] = id
		m[strings.ToLower(name)] = id
	}
	return m, rows.Err()
}

func findDefaultDomain(domainMap map[string]string) string {
	if id, ok := domainMap["sci"]; ok {
		return id
	}
	// Return any domain
	for _, id := range domainMap {
		return id
	}
	return ""
}

func getDefaultTypeID(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var id string
	// Try "Guide utilisateur" first
	err := db.QueryRow(ctx,
		"SELECT id FROM document_types WHERE slug = $1 OR name = $1 LIMIT 1",
		"guide-utilisateur",
	).Scan(&id)
	if err == nil {
		return id, nil
	}
	// Fall back to any type
	err = db.QueryRow(ctx, "SELECT id FROM document_types ORDER BY sort_order LIMIT 1").Scan(&id)
	if err != nil {
		return "", fmt.Errorf("no document types found: %w", err)
	}
	return id, nil
}

func resolveDomain(rootFolder, filePath string, domainMap map[string]string, defaultDomainID string) string {
	rel, err := filepath.Rel(rootFolder, filePath)
	if err != nil {
		return defaultDomainID
	}

	parts := strings.Split(rel, string(filepath.Separator))
	if len(parts) < 2 {
		// File is at root of import folder
		return defaultDomainID
	}

	// First subfolder = domain hint
	subdir := strings.ToLower(parts[0])
	if id, ok := domainMap[subdir]; ok {
		return id
	}

	log.Printf("WARNING: subfolder %q does not match any domain, using default", parts[0])
	return defaultDomainID
}

func convertFile(ctx context.Context, path, ext string) (json.RawMessage, string, error) {
	switch ext {
	case ".docx", ".doc":
		return convertWord(ctx, path)
	case ".pdf":
		return convertPDF(ctx, path)
	case ".txt", ".md":
		return convertMarkdown(ctx, path)
	}
	return nil, "", fmt.Errorf("unsupported extension: %s", ext)
}

func convertWord(ctx context.Context, path string) (json.RawMessage, string, error) {
	htmlOut, err := runPandoc(ctx, path, "docx")
	if err != nil {
		return nil, "", fmt.Errorf("pandoc docx: %w", err)
	}
	tiptap, err := HTMLToTipTap(htmlOut)
	if err != nil {
		return nil, "", fmt.Errorf("html to tiptap: %w", err)
	}
	bodyText := stripHTMLTags(htmlOut)
	return tiptap, bodyText, nil
}

func convertPDF(ctx context.Context, path string) (json.RawMessage, string, error) {
	cmd := exec.CommandContext(ctx, "pdftotext", path, "-")
	out, err := cmd.Output()
	if err != nil {
		return nil, "", fmt.Errorf("pdftotext: %w", err)
	}

	text := strings.TrimSpace(string(out))
	if text == "" {
		// Scanned PDF placeholder
		placeholder := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Contenu scann\u00e9 \u2014 transcription manuelle recommand\u00e9e"}]}]}`
		return json.RawMessage(placeholder), "", nil
	}

	// Split text into paragraphs on double newlines
	tiptap := textToTipTap(text)
	j, err := json.Marshal(tiptap)
	if err != nil {
		return nil, "", err
	}
	return j, text, nil
}

func convertMarkdown(ctx context.Context, path string) (json.RawMessage, string, error) {
	htmlOut, err := runPandoc(ctx, path, "markdown")
	if err != nil {
		return nil, "", fmt.Errorf("pandoc markdown: %w", err)
	}
	tiptap, err := HTMLToTipTap(htmlOut)
	if err != nil {
		return nil, "", fmt.Errorf("html to tiptap: %w", err)
	}
	bodyText := stripHTMLTags(htmlOut)
	return tiptap, bodyText, nil
}

func runPandoc(ctx context.Context, path, fromFormat string) (string, error) {
	cmd := exec.CommandContext(ctx, "pandoc", "-f", fromFormat, "-t", "html", path)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func textToTipTap(text string) TipTapNode {
	doc := TipTapNode{Type: "doc"}
	paragraphs := strings.Split(text, "\n\n")
	for _, p := range paragraphs {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		// Replace single newlines with spaces within a paragraph
		p = strings.ReplaceAll(p, "\n", " ")
		doc.Content = append(doc.Content, TipTapNode{
			Type: "paragraph",
			Content: []TipTapNode{
				{Type: "text", Text: p},
			},
		})
	}
	if len(doc.Content) == 0 {
		doc.Content = []TipTapNode{{Type: "paragraph"}}
	}
	return doc
}

func titleFromFilename(path string) string {
	base := filepath.Base(path)
	ext := filepath.Ext(base)
	return strings.TrimSuffix(base, ext)
}

func slugify(title string) string {
	s := strings.ToLower(title)
	s = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		if r == ' ' || r == '_' || r == '-' {
			return '-'
		}
		return -1
	}, s)
	// Collapse multiple dashes
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	s = strings.Trim(s, "-")
	if s == "" {
		s = "untitled"
	}
	return s
}

func stripHTMLTags(htmlStr string) string {
	var sb strings.Builder
	inTag := false
	for _, r := range htmlStr {
		if r == '<' {
			inTag = true
			continue
		}
		if r == '>' {
			inTag = false
			continue
		}
		if !inTag {
			sb.WriteRune(r)
		}
	}
	return strings.TrimSpace(sb.String())
}

func insertDocument(ctx context.Context, db *pgxpool.Pool, title, slug string, body json.RawMessage, bodyText, domainID, typeID, authorID string) (string, error) {
	var docID string
	err := db.QueryRow(ctx,
		`INSERT INTO documents (title, slug, body, body_text, domain_id, type_id, author_id, visibility)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'dsi')
		 RETURNING id`,
		title, slug, body, bodyText, domainID, typeID, authorID,
	).Scan(&docID)
	if err != nil {
		// If slug conflict, try with a suffix
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			slug = slug + "-" + fmt.Sprintf("%d", os.Getpid())
			err = db.QueryRow(ctx,
				`INSERT INTO documents (title, slug, body, body_text, domain_id, type_id, author_id, visibility)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, 'dsi')
				 RETURNING id`,
				title, slug, body, bodyText, domainID, typeID, authorID,
			).Scan(&docID)
		}
		if err != nil {
			return "", err
		}
	}
	return docID, nil
}
