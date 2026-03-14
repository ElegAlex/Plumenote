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
	Tags     []string
}

// folderCache maps "domainID:parentID:slug" → folderID to avoid re-creating folders.
type folderCache map[string]string

func (fc folderCache) key(domainID string, parentID *string, slug string) string {
	p := "root"
	if parentID != nil {
		p = *parentID
	}
	return domainID + ":" + p + ":" + slug
}

// resolveFolder creates (or retrieves from cache) a folder hierarchy for the given
// path components within a domain. Returns the leaf folder ID.
func resolveFolder(ctx context.Context, db *pgxpool.Pool, domainID, authorID string, pathParts []string, cache folderCache) (string, error) {
	var parentID *string

	for i, part := range pathParts {
		slug := slugify(part)
		k := cache.key(domainID, parentID, slug)

		if fid, ok := cache[k]; ok {
			pid := fid
			parentID = &pid
			continue
		}

		// Try to find existing folder
		var folderID string
		var err error
		if parentID == nil {
			err = db.QueryRow(ctx,
				`SELECT id FROM folders WHERE domain_id = $1 AND slug = $2 AND parent_id IS NULL`,
				domainID, slug,
			).Scan(&folderID)
		} else {
			err = db.QueryRow(ctx,
				`SELECT id FROM folders WHERE domain_id = $1 AND slug = $2 AND parent_id = $3`,
				domainID, slug, *parentID,
			).Scan(&folderID)
		}

		if err != nil {
			// Folder doesn't exist, create it
			err = db.QueryRow(ctx,
				`INSERT INTO folders (name, slug, domain_id, parent_id, position, created_by)
				 VALUES ($1, $2, $3, $4, $5, $6)
				 RETURNING id`,
				part, slug, domainID, parentID, i, authorID,
			).Scan(&folderID)
			if err != nil {
				return "", fmt.Errorf("create folder %q: %w", part, err)
			}
			// Auto-grant manager to author
			db.Exec(ctx,
				`INSERT INTO folder_permissions (folder_id, user_id, role) VALUES ($1, $2, 'manager'::folder_role) ON CONFLICT DO NOTHING`,
				folderID, authorID,
			)
			log.Printf("  FOLDER %s (depth=%d)", strings.Join(pathParts[:i+1], "/"), i)
		}

		cache[k] = folderID
		pid := folderID
		parentID = &pid
	}

	if parentID == nil {
		return "", fmt.Errorf("no folder resolved for path %v", pathParts)
	}
	return *parentID, nil
}

// resolveFolderPath extracts the folder path components from a file path.
// Given rootFolder="DATA_TEST/CPAM 92" and filePath="DATA_TEST/CPAM 92/GOUVERNANCE/BILATERALE/file.md",
// with the first part being the domain, returns ["BILATERALE"] (sub-folder parts after domain).
// If the file is directly in the domain folder, returns ["General"].
func resolveFolderPath(rootFolder, filePath string) []string {
	rel, err := filepath.Rel(rootFolder, filePath)
	if err != nil {
		return []string{"General"}
	}

	parts := strings.Split(rel, string(filepath.Separator))
	// parts[0] = domain dir, parts[1..n-1] = folder path, parts[n] = filename
	if len(parts) <= 2 {
		// File is directly in domain folder (no sub-folders)
		return []string{"General"}
	}

	// Return the intermediate directories (between domain and file)
	return parts[1 : len(parts)-1]
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

	cache := make(folderCache)
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

		// Resolve folder hierarchy from filesystem path
		folderPath := resolveFolderPath(folder, path)
		folderID, folderErr := resolveFolder(ctx, db, domainID, authorID, folderPath, cache)
		if folderErr != nil {
			report.Failed++
			report.Failures = append(report.Failures, Failure{
				Path:   path,
				Reason: fmt.Sprintf("folder resolve: %v", folderErr),
			})
			return nil
		}

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

		// Determine title (frontmatter title takes precedence for .md files)
		title := titleFromFilename(path)
		var fmTags []string
		if ext == ".md" {
			raw, readErr := os.ReadFile(path)
			if readErr == nil {
				fm, _ := ParseFrontmatter(string(raw))
				if fm.Title != "" {
					title = fm.Title
				}
				fmTags = fm.Tags
			}
		}

		// Generate slug
		slug := slugify(title)

		// Insert into DB with folder_id
		docID, err := insertDocument(ctx, db, title, slug, tiptapJSON, bodyText, domainID, defaultTypeID, authorID, folderID)
		if err != nil {
			report.Failed++
			report.Failures = append(report.Failures, Failure{
				Path:   path,
				Reason: fmt.Sprintf("db insert: %v", err),
			})
			return nil
		}

		// Associate frontmatter tags if present
		if len(fmTags) > 0 {
			if tagErr := associateTags(ctx, db, docID, fmTags); tagErr != nil {
				log.Printf("WARNING: could not associate tags for %s: %v", path, tagErr)
			}
		}

		report.Success++
		report.Documents = append(report.Documents, ImportedDoc{
			Path:     path,
			Title:    title,
			DocID:    docID,
			DomainID: domainID,
			Tags:     fmTags,
		})
		log.Printf("OK %s → %s (domain=%s, folder=%s)", path, title, domainID, strings.Join(folderPath, "/"))
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
	// Read file, strip frontmatter, apply preprocessor, then pipe to Pandoc
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, "", fmt.Errorf("read file: %w", err)
	}

	_, content := ParseFrontmatter(string(raw))
	content = PreprocessMarkdown(content)

	htmlOut, err := runPandocStdin(ctx, content, "markdown-yaml_metadata_block")
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

// runPandocStdin runs Pandoc reading from stdin instead of a file.
func runPandocStdin(ctx context.Context, content, fromFormat string) (string, error) {
	cmd := exec.CommandContext(ctx, "pandoc", "-f", fromFormat, "-t", "html")
	cmd.Stdin = strings.NewReader(content)
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

func insertDocument(ctx context.Context, db *pgxpool.Pool, title, slug string, body json.RawMessage, bodyText, domainID, typeID, authorID, folderID string) (string, error) {
	var docID string
	err := db.QueryRow(ctx,
		`INSERT INTO documents (title, slug, body, body_text, domain_id, type_id, author_id, visibility, folder_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'dsi', $8)
		 RETURNING id`,
		title, slug, body, bodyText, domainID, typeID, authorID, folderID,
	).Scan(&docID)
	if err != nil {
		// If slug conflict, try with incrementing suffixes
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			for i := 2; i < 100; i++ {
				candidate := fmt.Sprintf("%s-%d", slug, i)
				err = db.QueryRow(ctx,
					`INSERT INTO documents (title, slug, body, body_text, domain_id, type_id, author_id, visibility, folder_id)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, 'dsi', $8)
					 RETURNING id`,
					title, candidate, body, bodyText, domainID, typeID, authorID, folderID,
				).Scan(&docID)
				if err == nil {
					return docID, nil
				}
				if !strings.Contains(err.Error(), "unique") && !strings.Contains(err.Error(), "duplicate") {
					return "", err
				}
			}
		}
		if err != nil {
			return "", err
		}
	}
	return docID, nil
}

// associateTags creates tags (if they don't exist) and links them to a document.
func associateTags(ctx context.Context, db *pgxpool.Pool, docID string, tags []string) error {
	for _, tagName := range tags {
		tagName = strings.TrimSpace(tagName)
		if tagName == "" {
			continue
		}
		slug := slugify(tagName)

		// Upsert tag
		var tagID string
		err := db.QueryRow(ctx,
			`INSERT INTO tags (name, slug) VALUES ($1, $2)
			 ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
			 RETURNING id`,
			tagName, slug,
		).Scan(&tagID)
		if err != nil {
			return fmt.Errorf("upsert tag %q: %w", tagName, err)
		}

		// Link tag to document
		_, err = db.Exec(ctx,
			`INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2)
			 ON CONFLICT DO NOTHING`,
			docID, tagID,
		)
		if err != nil {
			return fmt.Errorf("link tag %q to document: %w", tagName, err)
		}
	}
	return nil
}
