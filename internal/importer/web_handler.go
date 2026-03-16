package importer

import (
	"context"
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/meilisearch/meilisearch-go"
)

const meiliIndex = "documents"

// WebHandler holds dependencies for web import.
type WebHandler struct {
	deps *model.Deps
}

// NewWebHandler creates a new WebHandler.
func NewWebHandler(deps *model.Deps) *WebHandler {
	return &WebHandler{deps: deps}
}

// importResult represents the outcome of importing a single file.
type importResult struct {
	Filename string      `json:"filename"`
	Status   string      `json:"status"`
	Document *importedID `json:"document,omitempty"`
	Error    string      `json:"error,omitempty"`
}

type importedID struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Slug  string `json:"slug"`
}

// HandleImport handles POST /api/import — single file upload.
func (wh *WebHandler) HandleImport(w http.ResponseWriter, r *http.Request) {
	claims := auth.UserFromContext(r.Context())
	if claims == nil {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]any{"success": false, "error": "authentication required"})
		return
	}
	authorID := claims.UserID

	r.Body = http.MaxBytesReader(w, r.Body, maxFileSize)
	if err := r.ParseMultipartForm(maxFileSize); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "file too large (max 50MB)"})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "missing 'file' field"})
		return
	}
	defer file.Close()

	domainID := r.FormValue("domain_id")
	if domainID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "domain_id is required"})
		return
	}
	typeID := r.FormValue("type_id")
	folderID := r.FormValue("folder_id")

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !isSupportedExtension(ext) {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "unsupported file type; allowed: .doc, .docx, .pptx, .pdf, .txt, .md"})
		return
	}

	// Save to temp file
	tmpFile, err := os.CreateTemp("", "plumenote-import-*"+ext)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "error": "failed to create temp file"})
		return
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.ReadFrom(file); err != nil {
		tmpFile.Close()
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "error": "failed to save uploaded file"})
		return
	}
	tmpFile.Close()

	// Convert file (with media extraction for docx/pptx)
	result, err := convertFileWithMedia(r.Context(), tmpPath, ext)
	if err != nil {
		httputil.WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"success": false, "error": fmt.Sprintf("conversion failed: %v", err)})
		return
	}
	if result.MediaDir != "" {
		defer os.RemoveAll(result.MediaDir)
	}

	// Get default type if not provided
	if typeID == "" {
		typeID, err = getDefaultTypeID(r.Context(), wh.deps.DB)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "error": "failed to determine document type"})
			return
		}
	}

	title := titleFromFilename(header.Filename)
	slug := httputil.GenerateSlug(title)

	// Ensure slug uniqueness
	slug, err = wh.ensureUniqueSlug(r.Context(), slug, "")
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "error": "failed to generate unique slug"})
		return
	}

	// Insert document (folder_id may be NULL when folderID is empty)
	var folderIDParam any
	if folderID != "" {
		folderIDParam = folderID
	}
	var docID string
	err = wh.deps.DB.QueryRow(r.Context(),
		`INSERT INTO documents (title, slug, body, body_text, domain_id, type_id, author_id, visibility, folder_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'dsi', $8)
		 RETURNING id`,
		title, slug, result.TipTap, result.BodyText, domainID, typeID, authorID, folderIDParam,
	).Scan(&docID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "error": "failed to insert document"})
		return
	}

	// Process extracted images (upload + rewrite src in body)
	if result.MediaDir != "" {
		updatedBody, mediaErr := processExtractedMedia(r.Context(), wh.deps.DB, docID, result.MediaDir, result.TipTap)
		if mediaErr != nil {
			log.Printf("WARNING: media processing failed for %s: %v", docID, mediaErr)
		} else {
			wh.deps.DB.Exec(r.Context(), `UPDATE documents SET body = $1 WHERE id = $2`, updatedBody, docID)
		}
	}

	// Index in Meilisearch async
	go wh.indexDocumentAsync(docID)

	httputil.WriteJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"document": importedID{
			ID:    docID,
			Title: title,
			Slug:  slug,
		},
	})
}

// HandleImportBatch handles POST /api/import/batch — multiple file upload.
func (wh *WebHandler) HandleImportBatch(w http.ResponseWriter, r *http.Request) {
	claims := auth.UserFromContext(r.Context())
	if claims == nil {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]any{"success": false, "error": "authentication required"})
		return
	}
	authorID := claims.UserID

	r.Body = http.MaxBytesReader(w, r.Body, maxFileSize)
	if err := r.ParseMultipartForm(maxFileSize); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "request too large (max 50MB)"})
		return
	}

	domainID := r.FormValue("domain_id")
	if domainID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "domain_id is required"})
		return
	}
	typeID := r.FormValue("type_id")
	folderID := r.FormValue("folder_id")

	files := r.MultipartForm.File["files[]"]
	if len(files) == 0 {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "no files provided"})
		return
	}
	if len(files) > 20 {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "maximum 20 files per batch"})
		return
	}

	// Get default type if not provided
	if typeID == "" {
		var err error
		typeID, err = getDefaultTypeID(r.Context(), wh.deps.DB)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to determine document type"})
			return
		}
	}

	var results []importResult
	successCount := 0
	failedCount := 0

	for _, fh := range files {
		res := wh.processOneFile(r.Context(), fh, domainID, typeID, authorID, folderID)
		if res.Status == "ok" {
			successCount++
		} else {
			failedCount++
		}
		results = append(results, res)
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"total":   len(files),
		"success": successCount,
		"failed":  failedCount,
		"results": results,
	})
}

// processOneFile handles a single file in a batch import.
func (wh *WebHandler) processOneFile(ctx context.Context, fh *multipart.FileHeader, domainID, typeID, authorID, folderID string) importResult {
	filename := fh.Filename
	ext := strings.ToLower(filepath.Ext(filename))

	if !isSupportedExtension(ext) {
		return importResult{Filename: filename, Status: "error", Error: "unsupported file type"}
	}

	file, err := fh.Open()
	if err != nil {
		return importResult{Filename: filename, Status: "error", Error: "failed to open file"}
	}
	defer file.Close()

	// Save to temp file
	tmpFile, err := os.CreateTemp("", "plumenote-import-*"+ext)
	if err != nil {
		return importResult{Filename: filename, Status: "error", Error: "failed to create temp file"}
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.ReadFrom(file); err != nil {
		tmpFile.Close()
		return importResult{Filename: filename, Status: "error", Error: "failed to save file"}
	}
	tmpFile.Close()

	// Convert (with media extraction)
	result, err := convertFileWithMedia(ctx, tmpPath, ext)
	if err != nil {
		return importResult{Filename: filename, Status: "error", Error: fmt.Sprintf("conversion failed: %v", err)}
	}
	if result.MediaDir != "" {
		defer os.RemoveAll(result.MediaDir)
	}

	title := titleFromFilename(filename)
	slug := httputil.GenerateSlug(title)

	slug, err = wh.ensureUniqueSlug(ctx, slug, "")
	if err != nil {
		return importResult{Filename: filename, Status: "error", Error: "failed to generate unique slug"}
	}

	// folder_id may be NULL when folderID is empty
	var folderIDParam any
	if folderID != "" {
		folderIDParam = folderID
	}
	var docID string
	err = wh.deps.DB.QueryRow(ctx,
		`INSERT INTO documents (title, slug, body, body_text, domain_id, type_id, author_id, visibility, folder_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'dsi', $8)
		 RETURNING id`,
		title, slug, result.TipTap, result.BodyText, domainID, typeID, authorID, folderIDParam,
	).Scan(&docID)
	if err != nil {
		return importResult{Filename: filename, Status: "error", Error: "failed to insert document"}
	}

	// Process extracted images
	if result.MediaDir != "" {
		updatedBody, mediaErr := processExtractedMedia(ctx, wh.deps.DB, docID, result.MediaDir, result.TipTap)
		if mediaErr != nil {
			log.Printf("WARNING: media processing failed for %s: %v", docID, mediaErr)
		} else {
			wh.deps.DB.Exec(ctx, `UPDATE documents SET body = $1 WHERE id = $2`, updatedBody, docID)
		}
	}

	go wh.indexDocumentAsync(docID)

	return importResult{
		Filename: filename,
		Status:   "ok",
		Document: &importedID{ID: docID, Title: title, Slug: slug},
	}
}

// ensureUniqueSlug checks the documents table for slug conflicts.
func (wh *WebHandler) ensureUniqueSlug(ctx context.Context, slug, excludeID string) (string, error) {
	candidate := slug
	for i := 2; i < 100; i++ {
		var exists bool
		var err error
		if excludeID != "" {
			err = wh.deps.DB.QueryRow(ctx,
				"SELECT EXISTS(SELECT 1 FROM documents WHERE slug = $1 AND id != $2)",
				candidate, excludeID).Scan(&exists)
		} else {
			err = wh.deps.DB.QueryRow(ctx,
				"SELECT EXISTS(SELECT 1 FROM documents WHERE slug = $1)",
				candidate).Scan(&exists)
		}
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s-%d", slug, i)
	}
	return "", fmt.Errorf("could not generate unique slug")
}

// searchDocument is a local struct for Meilisearch indexing.
type searchDocument struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Slug        string   `json:"slug"`
	BodyText    string   `json:"body_text"`
	ObjectType  string   `json:"object_type"`
	DomainID    string   `json:"domain_id"`
	TypeID      string   `json:"type_id"`
	Visibility  string   `json:"visibility"`
	Tags        []string `json:"tags"`
	AuthorName  string   `json:"author_name"`
	ViewCount   int      `json:"view_count"`
	NeedsReview bool     `json:"needs_review"`
	CreatedAt   int64    `json:"created_at"`
	UpdatedAt   int64    `json:"updated_at"`
}

// getDefaultFolderID finds or creates a "General" root folder for the domain.
func (wh *WebHandler) getDefaultFolderID(ctx context.Context, domainID, authorID string) string {
	var folderID string
	err := wh.deps.DB.QueryRow(ctx,
		`SELECT id FROM folders WHERE domain_id = $1 AND parent_id IS NULL ORDER BY position LIMIT 1`,
		domainID,
	).Scan(&folderID)
	if err == nil {
		return folderID
	}
	// Create a "General" root folder
	err = wh.deps.DB.QueryRow(ctx,
		`INSERT INTO folders (name, slug, domain_id, position, created_by)
		 VALUES ('General', 'general', $1, 0, $2)
		 RETURNING id`,
		domainID, authorID,
	).Scan(&folderID)
	if err != nil {
		log.Printf("WARNING: failed to create default folder for domain %s: %v", domainID, err)
		return ""
	}
	wh.deps.DB.Exec(ctx,
		`INSERT INTO folder_permissions (folder_id, user_id, role) VALUES ($1, $2, 'manager'::folder_role) ON CONFLICT DO NOTHING`,
		folderID, authorID,
	)
	return folderID
}

// HandleAnalyzeZip handles POST /api/import/analyze-zip — reads a ZIP's structure without extracting files.
func (wh *WebHandler) HandleAnalyzeZip(w http.ResponseWriter, r *http.Request) {
	claims := auth.UserFromContext(r.Context())
	if claims == nil {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "authentication required"})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxZipSize)
	file, _, err := r.FormFile("file")
	if err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "missing 'file' field or file too large"})
		return
	}
	defer file.Close()

	tmpFile, err := os.CreateTemp("", "plumenote-zip-*.zip")
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to create temp file"})
		return
	}
	defer os.Remove(tmpFile.Name())
	if _, err := tmpFile.ReadFrom(file); err != nil {
		tmpFile.Close()
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "failed to read uploaded file"})
		return
	}
	tmpFile.Close()

	tree, err := analyzeZip(tmpFile.Name(), maxZipSize)
	if err != nil {
		httputil.WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"error": fmt.Sprintf("ZIP analysis failed: %v", err)})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]any{"tree": tree})
}

// indexDocumentAsync indexes a document in Meilisearch asynchronously.
func (wh *WebHandler) indexDocumentAsync(docID string) {
	if wh.deps.Meili == nil {
		return
	}
	ctx := context.Background()

	var sd searchDocument
	var createdAt, updatedAt time.Time
	err := wh.deps.DB.QueryRow(ctx,
		`SELECT d.id, d.title, d.slug, d.body_text, d.domain_id, d.type_id, d.visibility,
		        d.view_count, d.needs_review, d.created_at, d.updated_at, u.display_name
		 FROM documents d
		 JOIN users u ON u.id = d.author_id
		 WHERE d.id = $1`, docID,
	).Scan(&sd.ID, &sd.Title, &sd.Slug, &sd.BodyText, &sd.DomainID, &sd.TypeID, &sd.Visibility,
		&sd.ViewCount, &sd.NeedsReview, &createdAt, &updatedAt, &sd.AuthorName)
	if err != nil {
		log.Printf("indexDocumentAsync: failed to fetch doc %s: %v", docID, err)
		return
	}
	sd.ObjectType = "document"
	sd.CreatedAt = createdAt.Unix()
	sd.UpdatedAt = updatedAt.Unix()

	// Fetch tags
	rows, err := wh.deps.DB.Query(ctx,
		`SELECT t.name FROM tags t JOIN document_tags dt ON dt.tag_id = t.id WHERE dt.document_id = $1`, docID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var name string
			if rows.Scan(&name) == nil {
				sd.Tags = append(sd.Tags, name)
			}
		}
	}
	if sd.Tags == nil {
		sd.Tags = []string{}
	}

	idx := wh.deps.Meili.Index(meiliIndex)
	pk := "id"
	if _, err := idx.AddDocuments([]searchDocument{sd}, &meilisearch.DocumentOptions{PrimaryKey: &pk}); err != nil {
		log.Printf("indexDocumentAsync: failed to index doc %s in Meilisearch: %v", docID, err)
	}
}
