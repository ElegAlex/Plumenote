package importer

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/folder"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	maxDirUploadSize = 500 << 20 // 500 MB
	maxFolderFiles   = 1000
)

// createDomainFromName finds or creates a domain by name, returning its ID.
func createDomainFromName(ctx context.Context, db *pgxpool.Pool, name string) (string, error) {
	slug := slugify(name)
	if slug == "" {
		slug = "unnamed"
	}

	// Try SELECT by slug first
	var id string
	err := db.QueryRow(ctx, `SELECT id FROM domains WHERE slug = $1`, slug).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err != pgx.ErrNoRows {
		return "", fmt.Errorf("lookup domain %q: %w", slug, err)
	}

	// Not found — INSERT with ON CONFLICT
	err = db.QueryRow(ctx,
		`INSERT INTO domains (name, slug, color, icon, sort_order)
		 VALUES ($1, $2, '#6366f1', 'folder', (SELECT COALESCE(MAX(sort_order),0)+1 FROM domains))
		 ON CONFLICT (slug) DO NOTHING
		 RETURNING id`,
		name, slug,
	).Scan(&id)
	if err == nil {
		return id, nil
	}

	// RETURNING returned no rows due to conflict — SELECT again
	if err == pgx.ErrNoRows {
		err = db.QueryRow(ctx, `SELECT id FROM domains WHERE slug = $1`, slug).Scan(&id)
		if err != nil {
			return "", fmt.Errorf("re-select domain %q: %w", slug, err)
		}
		return id, nil
	}
	return "", fmt.Errorf("insert domain %q: %w", name, err)
}

// resolveImportPath determines domain dir and folder parts from a file path.
// In root mode, the first path component is the domain directory and the rest are folder parts.
// In domain mode, all directory components are folder parts (domain is provided externally).
func resolveImportPath(filePath, mode string) (domainDir string, folderParts []string) {
	filePath = filepath.ToSlash(filePath)
	dir := filepath.Dir(filePath)
	if dir == "." || dir == "" {
		// File at root level
		return "", nil
	}

	parts := strings.Split(dir, "/")
	// Filter empty parts
	var clean []string
	for _, p := range parts {
		if p != "" {
			clean = append(clean, p)
		}
	}

	if len(clean) == 0 {
		return "", nil
	}

	if mode == "root" {
		domainDir = clean[0]
		if len(clean) > 1 {
			folderParts = clean[1:]
		}
		return domainDir, folderParts
	}

	// domain mode: all dir components are folder parts
	return "", clean
}

// processImportJob is the main processing goroutine for folder imports.
func (wh *WebHandler) processImportJob(ctx context.Context, job *importJob, jobID, mode, domainID, typeID, authorID string, files map[string]string, selectedPaths []string) {
	defer cleanupJob(jobID)

	cache := make(folderCache)
	total := len(selectedPaths)
	success := 0
	failed := 0
	var domainsCreated []string
	domainsCreatedSet := make(map[string]bool)
	foldersCreated := 0

	// Get default type if not provided
	if typeID == "" {
		var err error
		typeID, err = getDefaultTypeID(ctx, wh.deps.DB)
		if err != nil {
			job.finish(progressEvent{
				Total:  total,
				Failed: total,
				Error:  "failed to determine document type",
			})
			return
		}
	}

	// For root mode, we need a "Divers" domain for root-level files
	var diversDomainID string

	for i, path := range selectedPaths {
		if ctx.Err() != nil {
			break
		}

		tmpPath, ok := files[path]
		if !ok {
			failed++
			job.sendProgress(progressEvent{
				Type:     "progress",
				Current:  i + 1,
				Total:    total,
				Filename: filepath.Base(path),
				Status:   "error",
				Error:    "file not found in upload",
			})
			continue
		}

		ext := strings.ToLower(filepath.Ext(path))
		if !isSupportedExtension(ext) {
			failed++
			job.sendProgress(progressEvent{
				Type:     "progress",
				Current:  i + 1,
				Total:    total,
				Filename: filepath.Base(path),
				Status:   "error",
				Error:    "unsupported file type",
			})
			continue
		}

		domDir, folderParts := resolveImportPath(path, mode)

		// Determine effective domain ID
		var effectiveDomainID string
		if mode == "root" {
			if domDir == "" {
				// Root-level file → "Divers" domain
				if diversDomainID == "" {
					var err error
					diversDomainID, err = createDomainFromName(ctx, wh.deps.DB, "Divers")
					if err != nil {
						failed++
						job.sendProgress(progressEvent{
							Type:     "progress",
							Current:  i + 1,
							Total:    total,
							Filename: filepath.Base(path),
							Status:   "error",
							Error:    fmt.Sprintf("failed to create Divers domain: %v", err),
						})
						continue
					}
					if !domainsCreatedSet[diversDomainID] {
						domainsCreatedSet[diversDomainID] = true
						domainsCreated = append(domainsCreated, "Divers")
					}
				}
				effectiveDomainID = diversDomainID
			} else {
				var err error
				effectiveDomainID, err = createDomainFromName(ctx, wh.deps.DB, domDir)
				if err != nil {
					failed++
					job.sendProgress(progressEvent{
						Type:     "progress",
						Current:  i + 1,
						Total:    total,
						Filename: filepath.Base(path),
						Status:   "error",
						Error:    fmt.Sprintf("failed to create domain %q: %v", domDir, err),
					})
					continue
				}
				if !domainsCreatedSet[effectiveDomainID] {
					domainsCreatedSet[effectiveDomainID] = true
					domainsCreated = append(domainsCreated, domDir)
				}
			}
		} else {
			effectiveDomainID = domainID
		}

		// Enforce MaxFolderDepth by truncating
		if len(folderParts) > folder.MaxFolderDepth {
			folderParts = folderParts[:folder.MaxFolderDepth]
		}

		// Resolve folder (nil if no folder parts)
		var folderIDParam any
		if len(folderParts) > 0 {
			prevCacheLen := len(cache)
			fid, err := resolveFolder(ctx, wh.deps.DB, effectiveDomainID, authorID, folderParts, cache)
			if err != nil {
				failed++
				job.sendProgress(progressEvent{
					Type:     "progress",
					Current:  i + 1,
					Total:    total,
					Filename: filepath.Base(path),
					Status:   "error",
					Error:    fmt.Sprintf("folder resolve: %v", err),
				})
				continue
			}
			folderIDParam = fid
			foldersCreated += len(cache) - prevCacheLen
		}

		// Convert file
		tiptapJSON, bodyText, err := convertFile(ctx, tmpPath, ext)
		if err != nil {
			failed++
			job.sendProgress(progressEvent{
				Type:     "progress",
				Current:  i + 1,
				Total:    total,
				Filename: filepath.Base(path),
				Status:   "error",
				Error:    fmt.Sprintf("conversion failed: %v", err),
			})
			continue
		}

		// Generate title and slug
		title := titleFromFilename(path)
		slug := httputil.GenerateSlug(title)
		slug, err = wh.ensureUniqueSlug(ctx, slug, "")
		if err != nil {
			failed++
			job.sendProgress(progressEvent{
				Type:     "progress",
				Current:  i + 1,
				Total:    total,
				Filename: filepath.Base(path),
				Status:   "error",
				Error:    "failed to generate unique slug",
			})
			continue
		}

		// Insert document
		var docID string
		err = wh.deps.DB.QueryRow(ctx,
			`INSERT INTO documents (title, slug, body, body_text, domain_id, type_id, author_id, visibility, folder_id)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, 'dsi', $8)
			 RETURNING id`,
			title, slug, tiptapJSON, bodyText, effectiveDomainID, typeID, authorID, folderIDParam,
		).Scan(&docID)
		if err != nil {
			failed++
			job.sendProgress(progressEvent{
				Type:     "progress",
				Current:  i + 1,
				Total:    total,
				Filename: filepath.Base(path),
				Status:   "error",
				Error:    fmt.Sprintf("db insert: %v", err),
			})
			continue
		}

		// Index in Meilisearch
		go wh.indexDocumentAsync(docID)

		success++
		job.sendProgress(progressEvent{
			Type:     "progress",
			Current:  i + 1,
			Total:    total,
			Filename: filepath.Base(path),
			Status:   "ok",
		})
	}

	// Clean up temp files
	for _, tmpPath := range files {
		os.Remove(tmpPath)
	}

	job.finish(progressEvent{
		Total:          total,
		Success:        success,
		Failed:         failed,
		DomainsCreated: domainsCreated,
		FoldersCreated: foldersCreated,
	})
}

// HandleFolderImport handles POST /api/import/folder — folder/zip import with SSE progress.
func (wh *WebHandler) HandleFolderImport(w http.ResponseWriter, r *http.Request) {
	claims := auth.UserFromContext(r.Context())
	if claims == nil {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "authentication required"})
		return
	}
	authorID := claims.UserID

	mode := r.FormValue("mode")
	if mode == "" {
		mode = "domain"
	}

	// Root mode requires admin role
	if mode == "root" && claims.Role != "admin" {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "root mode requires admin role"})
		return
	}

	source := r.FormValue("source")
	if source == "" {
		source = "directory"
	}

	// Set size limit based on source
	var maxSize int64
	if source == "zip" {
		maxSize = maxZipSize
	} else {
		maxSize = maxDirUploadSize
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxSize)
	if err := r.ParseMultipartForm(maxSize); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "request too large"})
		return
	}

	domainID := r.FormValue("domain_id")
	typeID := r.FormValue("type_id")

	// domain_id is required in domain mode
	if mode == "domain" && domainID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "domain_id is required in domain mode"})
		return
	}

	// Get selected paths
	selectedPaths := r.MultipartForm.Value["paths[]"]
	if len(selectedPaths) == 0 {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "no paths selected"})
		return
	}
	if len(selectedPaths) > maxFolderFiles {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("too many files (max %d)", maxFolderFiles)})
		return
	}

	// Build file map: path → temp file path
	files := make(map[string]string)

	if source == "zip" {
		// Single ZIP file
		fh := r.MultipartForm.File["file"]
		if len(fh) == 0 {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "missing 'file' field"})
			return
		}
		tmpZip, err := saveTempFile(fh[0], ".zip")
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to save zip file"})
			return
		}
		defer os.Remove(tmpZip)

		files, err = extractZipFiles(tmpZip, selectedPaths)
		if err != nil {
			httputil.WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"error": fmt.Sprintf("zip extraction failed: %v", err)})
			return
		}
	} else {
		// Directory upload: multiple files via files[] field
		uploadedFiles := r.MultipartForm.File["files[]"]
		if len(uploadedFiles) == 0 {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "no files uploaded"})
			return
		}

		// Build a set of selected paths for quick lookup
		selectedSet := make(map[string]bool, len(selectedPaths))
		for _, p := range selectedPaths {
			selectedSet[p] = true
		}

		for _, fh := range uploadedFiles {
			// The Filename for directory uploads includes the webkitRelativePath
			fname := fh.Filename
			if !selectedSet[fname] {
				continue
			}
			ext := filepath.Ext(fname)
			tmpPath, err := saveTempFile(fh, ext)
			if err != nil {
				log.Printf("folder import: failed to save %s: %v", fname, err)
				continue
			}
			files[fname] = tmpPath
		}
	}

	if len(files) == 0 {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "no matching files found"})
		return
	}

	// Register job
	ctx, cancel := context.WithCancel(context.Background())
	jobID, job := registerJob(authorID, cancel)
	if job == nil {
		cancel()
		httputil.WriteJSON(w, http.StatusTooManyRequests, map[string]any{"error": "too many concurrent imports"})
		return
	}

	// Start processing goroutine
	go wh.processImportJob(ctx, job, jobID, mode, domainID, typeID, authorID, files, selectedPaths)

	httputil.WriteJSON(w, http.StatusAccepted, map[string]any{
		"job_id": jobID,
	})
}

// saveTempFile saves a multipart file header to a temp file and returns its path.
func saveTempFile(fh *multipart.FileHeader, ext string) (string, error) {
	src, err := fh.Open()
	if err != nil {
		return "", fmt.Errorf("open upload: %w", err)
	}
	defer src.Close()

	tmp, err := os.CreateTemp("", "plumenote-import-*"+ext)
	if err != nil {
		return "", fmt.Errorf("create temp: %w", err)
	}
	defer tmp.Close()

	if _, err := io.Copy(tmp, src); err != nil {
		os.Remove(tmp.Name())
		return "", fmt.Errorf("copy to temp: %w", err)
	}
	return tmp.Name(), nil
}

// extractZipFiles opens a ZIP archive and extracts only the selected files to temp.
// Returns a map of original path → temp file path.
func extractZipFiles(zipPath string, selectedPaths []string) (map[string]string, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}
	defer r.Close()

	selectedSet := make(map[string]bool, len(selectedPaths))
	for _, p := range selectedPaths {
		selectedSet[p] = true
	}

	files := make(map[string]string)
	for _, f := range r.File {
		name := strings.TrimPrefix(f.Name, "/")
		if !selectedSet[name] {
			continue
		}
		if f.FileInfo().IsDir() {
			continue
		}

		ext := filepath.Ext(name)
		tmp, err := os.CreateTemp("", "plumenote-zip-*"+ext)
		if err != nil {
			// Clean up already extracted files
			for _, p := range files {
				os.Remove(p)
			}
			return nil, fmt.Errorf("create temp for %s: %w", name, err)
		}

		rc, err := f.Open()
		if err != nil {
			tmp.Close()
			os.Remove(tmp.Name())
			for _, p := range files {
				os.Remove(p)
			}
			return nil, fmt.Errorf("open zip entry %s: %w", name, err)
		}

		_, err = io.Copy(tmp, rc)
		rc.Close()
		tmp.Close()
		if err != nil {
			os.Remove(tmp.Name())
			for _, p := range files {
				os.Remove(p)
			}
			return nil, fmt.Errorf("extract %s: %w", name, err)
		}

		files[name] = tmp.Name()
	}

	return files, nil
}
