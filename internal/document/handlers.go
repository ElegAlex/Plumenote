package document

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"log"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/meilisearch/meilisearch-go"
)

const (
	fallbackGreenDays  = 90
	fallbackYellowDays = 180
	uploadBasePath     = "/data/uploads"
	maxUploadSize      = 10 << 20 // 10 MB
	meiliIndex         = "documents"
)

var allowedMimeTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/gif":  true,
	"image/webp": true,
}

// SearchDocument is the Meilisearch document structure.
type SearchDocument struct {
	ID         string   `json:"id"`
	Title      string   `json:"title"`
	BodyText   string   `json:"body_text"`
	DomainID   string   `json:"domain_id"`
	TypeID     string   `json:"type_id"`
	Visibility string   `json:"visibility"`
	Tags       []string `json:"tags"`
	AuthorName string   `json:"author_name"`
	ViewCount  int      `json:"view_count"`
	CreatedAt  int64    `json:"created_at"`
	UpdatedAt  int64    `json:"updated_at"`
}

// --- JSON helpers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func readJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func getUserID(ctx context.Context) string {
	c := auth.UserFromContext(ctx)
	if c == nil {
		return ""
	}
	return c.UserID
}

func getUserRole(ctx context.Context) string {
	c := auth.UserFromContext(ctx)
	if c == nil {
		return ""
	}
	return c.Role
}

func getUserDomainID(ctx context.Context) string {
	c := auth.UserFromContext(ctx)
	if c == nil {
		return ""
	}
	return c.DomainID
}

// --- Handlers ---

type handler struct {
	deps *model.Deps
}

// createDocument handles POST /api/documents
func (h *handler) createDocument(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title      string          `json:"title"`
		Body       json.RawMessage `json:"body"`
		DomainID   string          `json:"domain_id"`
		TypeID     string          `json:"type_id"`
		Tags       []string        `json:"tags"`
		Visibility string          `json:"visibility"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if req.DomainID == "" || req.TypeID == "" {
		writeError(w, http.StatusBadRequest, "domain_id and type_id are required")
		return
	}
	if req.Visibility == "" {
		req.Visibility = "dsi"
	}
	if req.Visibility != "public" && req.Visibility != "dsi" {
		writeError(w, http.StatusBadRequest, "visibility must be 'public' or 'dsi'")
		return
	}

	authorID := getUserID(r.Context())
	if authorID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	bodyText := ExtractBodyText(req.Body)
	slug := GenerateSlug(req.Title)

	// Ensure slug uniqueness
	slug, err := h.ensureUniqueSlug(r.Context(), slug, "")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate slug")
		return
	}

	var doc struct {
		ID             string     `json:"id"`
		Title          string     `json:"title"`
		Slug           string     `json:"slug"`
		Body           json.RawMessage `json:"body"`
		BodyText       string     `json:"body_text"`
		DomainID       string     `json:"domain_id"`
		TypeID         string     `json:"type_id"`
		AuthorID       string     `json:"author_id"`
		Visibility     string     `json:"visibility"`
		ViewCount      int        `json:"view_count"`
		LastVerifiedAt *time.Time `json:"last_verified_at"`
		LastVerifiedBy *string    `json:"last_verified_by"`
		CreatedAt      time.Time  `json:"created_at"`
		UpdatedAt      time.Time  `json:"updated_at"`
	}

	err = h.deps.DB.QueryRow(r.Context(),
		`INSERT INTO documents (title, slug, body, body_text, domain_id, type_id, author_id, visibility)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id, title, slug, body, body_text, domain_id, type_id, author_id, visibility, view_count, last_verified_at, last_verified_by, created_at, updated_at`,
		req.Title, slug, req.Body, bodyText, req.DomainID, req.TypeID, authorID, req.Visibility,
	).Scan(&doc.ID, &doc.Title, &doc.Slug, &doc.Body, &doc.BodyText, &doc.DomainID, &doc.TypeID, &doc.AuthorID, &doc.Visibility, &doc.ViewCount, &doc.LastVerifiedAt, &doc.LastVerifiedBy, &doc.CreatedAt, &doc.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create document")
		return
	}

	// Handle tags
	if len(req.Tags) > 0 {
		h.syncTags(r.Context(), doc.ID, req.Tags)
	}

	// Async Meilisearch indexing (RG-001: < 10s)
	go h.indexDocument(doc.ID)

	writeJSON(w, http.StatusCreated, doc)
}

// listDocuments handles GET /api/documents
func (h *handler) listDocuments(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	domainID := q.Get("domain_id")
	typeID := q.Get("type_id")
	sort := q.Get("sort")
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	orderBy := "d.updated_at DESC"
	if sort == "views" {
		orderBy = "d.view_count DESC"
	}

	// RG-006: anonymous users can only see public documents
	userRole := getUserRole(r.Context())
	query, args := h.buildListQuery(domainID, typeID, orderBy, limit, offset, userRole)

	rows, err := h.deps.DB.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list documents")
		return
	}
	defer rows.Close()

	type docSummary struct {
		ID             string     `json:"id"`
		Title          string     `json:"title"`
		Slug           string     `json:"slug"`
		DomainID       string     `json:"domain_id"`
		TypeID         string     `json:"type_id"`
		AuthorID       string     `json:"author_id"`
		AuthorName     string     `json:"author_name"`
		Visibility     string     `json:"visibility"`
		ViewCount      int        `json:"view_count"`
		LastVerifiedAt *time.Time `json:"last_verified_at"`
		FreshnessBadge string     `json:"freshness_badge"`
		TypeName       *string    `json:"type_name"`
		TypeSlug       *string    `json:"type_slug"`
		DomainName     *string    `json:"domain_name"`
		DomainColor    *string    `json:"domain_color"`
		CreatedAt      time.Time  `json:"created_at"`
		UpdatedAt      time.Time  `json:"updated_at"`
	}

	greenDays, yellowDays := h.freshnessThresholds(r.Context())
	var docs []docSummary
	for rows.Next() {
		var d docSummary
		if err := rows.Scan(&d.ID, &d.Title, &d.Slug, &d.DomainID, &d.TypeID, &d.AuthorID, &d.Visibility, &d.ViewCount, &d.LastVerifiedAt, &d.CreatedAt, &d.UpdatedAt, &d.AuthorName, &d.TypeName, &d.TypeSlug, &d.DomainName, &d.DomainColor); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan document")
			return
		}
		d.FreshnessBadge = ComputeFreshness(d.LastVerifiedAt, greenDays, yellowDays)
		docs = append(docs, d)
	}
	if docs == nil {
		docs = []docSummary{}
	}
	writeJSON(w, http.StatusOK, docs)
}

func (h *handler) buildListQuery(domainID, typeID, orderBy string, limit, offset int, userRole string) (string, []any) {
	var conditions []string
	args := []any{limit, offset}
	paramIdx := 3

	// RG-006: anonymous users can only see public documents
	if userRole != "dsi" && userRole != "admin" {
		conditions = append(conditions, fmt.Sprintf("AND d.visibility = $%d", paramIdx))
		args = append(args, "public")
		paramIdx++
	}

	if domainID != "" {
		conditions = append(conditions, fmt.Sprintf("AND d.domain_id = $%d", paramIdx))
		args = append(args, domainID)
		paramIdx++
	}
	if typeID != "" {
		conditions = append(conditions, fmt.Sprintf("AND d.type_id = $%d", paramIdx))
		args = append(args, typeID)
		paramIdx++
	}

	where := strings.Join(conditions, " ")
	query := fmt.Sprintf(`
		SELECT d.id, d.title, d.slug, d.domain_id, d.type_id, d.author_id, d.visibility,
		       d.view_count, d.last_verified_at, d.created_at, d.updated_at,
		       u.display_name AS author_name,
		       dt.name AS type_name, dt.slug AS type_slug,
		       dom.name AS domain_name, dom.color AS domain_color
		FROM documents d
		JOIN users u ON u.id = d.author_id
		LEFT JOIN document_types dt ON dt.id = d.type_id
		LEFT JOIN domains dom ON dom.id = d.domain_id
		WHERE 1=1 %s
		ORDER BY %s
		LIMIT $1 OFFSET $2`, where, orderBy)
	return query, args
}

// getDocument handles GET /api/documents/{slug}
func (h *handler) getDocument(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	var doc struct {
		ID             string          `json:"id"`
		Title          string          `json:"title"`
		Slug           string          `json:"slug"`
		Body           json.RawMessage `json:"body"`
		BodyText       string          `json:"body_text"`
		DomainID       string          `json:"domain_id"`
		TypeID         string          `json:"type_id"`
		AuthorID       string          `json:"author_id"`
		AuthorName     string          `json:"author_name"`
		Visibility     string          `json:"visibility"`
		ViewCount      int             `json:"view_count"`
		LastVerifiedAt *time.Time      `json:"last_verified_at"`
		LastVerifiedBy *string         `json:"last_verified_by"`
		Freshness      string          `json:"freshness"`
		CreatedAt      time.Time       `json:"created_at"`
		UpdatedAt      time.Time       `json:"updated_at"`
		DomainName     *string         `json:"domain_name"`
		DomainSlug     *string         `json:"domain_slug"`
		DomainColor    *string         `json:"domain_color"`
		TypeName       *string         `json:"type_name"`
		TypeSlug       *string         `json:"type_slug"`
	}
	err := h.deps.DB.QueryRow(r.Context(),
		`SELECT d.id, d.title, d.slug, d.body, d.body_text, d.domain_id, d.type_id,
		        d.author_id, u.display_name, d.visibility, d.view_count,
		        d.last_verified_at, d.last_verified_by, d.created_at, d.updated_at,
		        dom.name, dom.slug, dom.color,
		        dt.name, dt.slug
		 FROM documents d
		 JOIN users u ON u.id = d.author_id
		 LEFT JOIN domains dom ON dom.id = d.domain_id
		 LEFT JOIN document_types dt ON dt.id = d.type_id
		 WHERE d.slug = $1`, slug,
	).Scan(&doc.ID, &doc.Title, &doc.Slug, &doc.Body, &doc.BodyText, &doc.DomainID, &doc.TypeID,
		&doc.AuthorID, &doc.AuthorName, &doc.Visibility, &doc.ViewCount,
		&doc.LastVerifiedAt, &doc.LastVerifiedBy, &doc.CreatedAt, &doc.UpdatedAt,
		&doc.DomainName, &doc.DomainSlug, &doc.DomainColor,
		&doc.TypeName, &doc.TypeSlug)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get document")
		return
	}

	// RG-006: anonymous users can only see public documents
	userRole := getUserRole(r.Context())
	if userRole != "dsi" && userRole != "admin" && doc.Visibility != "public" {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	gd, yd := h.freshnessThresholds(r.Context())
	doc.Freshness = ComputeFreshness(doc.LastVerifiedAt, gd, yd)

	// Fetch tags
	tags, _ := h.getDocumentTags(r.Context(), doc.ID)

	// Increment view count async
	go func() {
		_, _ = h.deps.DB.Exec(context.Background(), "UPDATE documents SET view_count = view_count + 1 WHERE id = $1", doc.ID)
	}()

	// Return flat response with author object, domain info, and tags embedded
	resp := struct {
		ID             string          `json:"id"`
		Title          string          `json:"title"`
		Slug           string          `json:"slug"`
		Body           json.RawMessage `json:"body"`
		BodyText       string          `json:"body_text"`
		DomainID       string          `json:"domain_id"`
		TypeID         string          `json:"type_id"`
		AuthorID       string          `json:"author_id"`
		Author         struct {
			ID          string `json:"id"`
			DisplayName string `json:"display_name"`
		} `json:"author"`
		Visibility     string     `json:"visibility"`
		ViewCount      int        `json:"view_count"`
		LastVerifiedAt *time.Time `json:"last_verified_at"`
		LastVerifiedBy *string    `json:"last_verified_by"`
		FreshnessBadge string     `json:"freshness_badge"`
		Tags           []tagDTO   `json:"tags"`
		DomainName     *string    `json:"domain_name"`
		DomainSlug     *string    `json:"domain_slug"`
		DomainColor    *string    `json:"domain_color"`
		TypeName       *string    `json:"type_name"`
		TypeSlug       *string    `json:"type_slug"`
		CreatedAt      time.Time  `json:"created_at"`
		UpdatedAt      time.Time  `json:"updated_at"`
	}{
		ID: doc.ID, Title: doc.Title, Slug: doc.Slug, Body: doc.Body,
		BodyText: doc.BodyText, DomainID: doc.DomainID, TypeID: doc.TypeID,
		AuthorID: doc.AuthorID,
		Author: struct {
			ID          string `json:"id"`
			DisplayName string `json:"display_name"`
		}{ID: doc.AuthorID, DisplayName: doc.AuthorName},
		Visibility: doc.Visibility, ViewCount: doc.ViewCount,
		LastVerifiedAt: doc.LastVerifiedAt, LastVerifiedBy: doc.LastVerifiedBy,
		FreshnessBadge: doc.Freshness, Tags: tags,
		DomainName: doc.DomainName, DomainSlug: doc.DomainSlug, DomainColor: doc.DomainColor,
		TypeName: doc.TypeName, TypeSlug: doc.TypeSlug,
		CreatedAt: doc.CreatedAt, UpdatedAt: doc.UpdatedAt,
	}
	writeJSON(w, http.StatusOK, resp)
}

type tagDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

func (h *handler) getDocumentTags(ctx context.Context, docID string) ([]tagDTO, error) {
	rows, err := h.deps.DB.Query(ctx,
		`SELECT t.id, t.name, t.slug FROM tags t
		 JOIN document_tags dt ON dt.tag_id = t.id
		 WHERE dt.document_id = $1 ORDER BY t.name`, docID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []tagDTO
	for rows.Next() {
		var t tagDTO
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	if tags == nil {
		tags = []tagDTO{}
	}
	return tags, nil
}

// updateDocument handles PUT /api/documents/{id}
func (h *handler) updateDocument(w http.ResponseWriter, r *http.Request) {
	docID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())
	userDomainID := getUserDomainID(r.Context())

	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	// Fetch existing doc for permission check
	var authorID, docDomainID string
	err := h.deps.DB.QueryRow(r.Context(),
		"SELECT author_id, domain_id FROM documents WHERE id = $1", docID,
	).Scan(&authorID, &docDomainID)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get document")
		return
	}

	// RG-003: author OR same domain OR admin
	if userRole != "admin" && authorID != userID && docDomainID != userDomainID {
		writeError(w, http.StatusForbidden, "you can only edit documents in your domain")
		return
	}

	var req struct {
		Title      string          `json:"title"`
		Body       json.RawMessage `json:"body"`
		DomainID   string          `json:"domain_id"`
		TypeID     string          `json:"type_id"`
		Tags       []string        `json:"tags"`
		Visibility string          `json:"visibility"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	bodyText := ExtractBodyText(req.Body)
	slug := GenerateSlug(req.Title)
	slug, err = h.ensureUniqueSlug(r.Context(), slug, docID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate slug")
		return
	}

	var doc struct {
		ID        string    `json:"id"`
		Title     string    `json:"title"`
		Slug      string    `json:"slug"`
		UpdatedAt time.Time `json:"updated_at"`
	}
	err = h.deps.DB.QueryRow(r.Context(),
		`UPDATE documents
		 SET title = $2, slug = $3, body = $4, body_text = $5, domain_id = $6, type_id = $7, visibility = $8, updated_at = now()
		 WHERE id = $1
		 RETURNING id, title, slug, updated_at`,
		docID, req.Title, slug, req.Body, bodyText, req.DomainID, req.TypeID, req.Visibility,
	).Scan(&doc.ID, &doc.Title, &doc.Slug, &doc.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update document")
		return
	}

	// Sync tags
	h.syncTags(r.Context(), docID, req.Tags)

	// Re-index Meilisearch async
	go h.indexDocument(docID)

	writeJSON(w, http.StatusOK, doc)
}

// deleteDocument handles DELETE /api/documents/{id}
func (h *handler) deleteDocument(w http.ResponseWriter, r *http.Request) {
	docID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())
	userDomainID := getUserDomainID(r.Context())

	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var authorID, docDomainID string
	err := h.deps.DB.QueryRow(r.Context(),
		"SELECT author_id, domain_id FROM documents WHERE id = $1", docID,
	).Scan(&authorID, &docDomainID)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get document")
		return
	}

	// RG-003: author OR same domain OR admin
	if userRole != "admin" && authorID != userID && docDomainID != userDomainID {
		writeError(w, http.StatusForbidden, "you can only delete documents in your domain")
		return
	}

	_, err = h.deps.DB.Exec(r.Context(), "DELETE FROM documents WHERE id = $1", docID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete document")
		return
	}

	// De-index from Meilisearch async
	go func() {
		if h.deps.Meili != nil {
			idx := h.deps.Meili.Index(meiliIndex)
			_, _ = idx.DeleteDocument(docID, nil)
		}
	}()

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// verifyDocument handles POST /api/documents/{id}/verify
func (h *handler) verifyDocument(w http.ResponseWriter, r *http.Request) {
	docID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req struct {
		Note string `json:"note"`
	}
	_ = readJSON(r, &req)

	// Check doc exists
	var exists bool
	err := h.deps.DB.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM documents WHERE id = $1)", docID).Scan(&exists)
	if err != nil || !exists {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	// Insert verification log
	var logEntry struct {
		ID         string    `json:"id"`
		DocumentID string    `json:"document_id"`
		VerifiedBy string    `json:"verified_by"`
		Note       string    `json:"note"`
		CreatedAt  time.Time `json:"created_at"`
	}
	err = h.deps.DB.QueryRow(r.Context(),
		`INSERT INTO verification_log (document_id, verified_by, note) VALUES ($1, $2, $3)
		 RETURNING id, document_id, verified_by, note, created_at`,
		docID, userID, req.Note,
	).Scan(&logEntry.ID, &logEntry.DocumentID, &logEntry.VerifiedBy, &logEntry.Note, &logEntry.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create verification")
		return
	}

	// Update document last_verified_at/by
	_, err = h.deps.DB.Exec(r.Context(),
		"UPDATE documents SET last_verified_at = now(), last_verified_by = $2, updated_at = now() WHERE id = $1",
		docID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update document verification")
		return
	}

	writeJSON(w, http.StatusCreated, logEntry)
}

// listVerifications handles GET /api/documents/{id}/verifications
func (h *handler) listVerifications(w http.ResponseWriter, r *http.Request) {
	docID := chi.URLParam(r, "id")

	rows, err := h.deps.DB.Query(r.Context(),
		`SELECT vl.id, vl.document_id, vl.verified_by, u.display_name, vl.note, vl.created_at
		 FROM verification_log vl
		 JOIN users u ON u.id = vl.verified_by
		 WHERE vl.document_id = $1
		 ORDER BY vl.created_at DESC`, docID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list verifications")
		return
	}
	defer rows.Close()

	type verification struct {
		ID           string    `json:"id"`
		DocumentID   string    `json:"document_id"`
		VerifiedBy   string    `json:"verified_by"`
		VerifierName string    `json:"verifier_name"`
		Note         string    `json:"note"`
		CreatedAt    time.Time `json:"created_at"`
	}
	var verifications []verification
	for rows.Next() {
		var v verification
		if err := rows.Scan(&v.ID, &v.DocumentID, &v.VerifiedBy, &v.VerifierName, &v.Note, &v.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan verification")
			return
		}
		verifications = append(verifications, v)
	}
	if verifications == nil {
		verifications = []verification{}
	}
	writeJSON(w, http.StatusOK, verifications)
}

// uploadAttachment handles POST /api/documents/{id}/attachments
func (h *handler) uploadAttachment(w http.ResponseWriter, r *http.Request) {
	docID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	// Check doc exists
	var exists bool
	if err := h.deps.DB.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM documents WHERE id = $1)", docID).Scan(&exists); err != nil || !exists {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "file too large (max 10MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing 'file' field")
		return
	}
	defer file.Close()

	mimeType := header.Header.Get("Content-Type")
	if !allowedMimeTypes[mimeType] {
		writeError(w, http.StatusBadRequest, "only PNG, JPG, GIF, WebP images are allowed")
		return
	}

	// Create upload directory
	uploadDir := filepath.Join(uploadBasePath, docID)
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create upload directory")
		return
	}

	// Sanitize filename
	filename := filepath.Base(header.Filename)
	destPath := filepath.Join(uploadDir, filename)

	dst, err := os.Create(destPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save file")
		return
	}
	defer dst.Close()

	written, err := io.Copy(dst, file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to write file")
		return
	}

	var att struct {
		ID         string    `json:"id"`
		DocumentID string    `json:"document_id"`
		Filename   string    `json:"filename"`
		Filepath   string    `json:"filepath"`
		MimeType   string    `json:"mime_type"`
		SizeBytes  int64     `json:"size_bytes"`
		CreatedAt  time.Time `json:"created_at"`
	}
	err = h.deps.DB.QueryRow(r.Context(),
		`INSERT INTO attachments (document_id, filename, filepath, mime_type, size_bytes)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, document_id, filename, filepath, mime_type, size_bytes, created_at`,
		docID, filename, destPath, mimeType, written,
	).Scan(&att.ID, &att.DocumentID, &att.Filename, &att.Filepath, &att.MimeType, &att.SizeBytes, &att.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save attachment record")
		return
	}

	writeJSON(w, http.StatusCreated, att)
}

// listAttachments handles GET /api/documents/{id}/attachments
func (h *handler) listAttachments(w http.ResponseWriter, r *http.Request) {
	docID := chi.URLParam(r, "id")
	rows, err := h.deps.DB.Query(r.Context(),
		`SELECT id, document_id, filename, filepath, mime_type, size_bytes, created_at
		 FROM attachments WHERE document_id = $1 ORDER BY created_at`, docID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list attachments")
		return
	}
	defer rows.Close()

	type attachment struct {
		ID         string    `json:"id"`
		DocumentID string    `json:"document_id"`
		Filename   string    `json:"filename"`
		Filepath   string    `json:"filepath"`
		MimeType   string    `json:"mime_type"`
		SizeBytes  int64     `json:"size_bytes"`
		CreatedAt  time.Time `json:"created_at"`
	}
	var attachments []attachment
	for rows.Next() {
		var a attachment
		if err := rows.Scan(&a.ID, &a.DocumentID, &a.Filename, &a.Filepath, &a.MimeType, &a.SizeBytes, &a.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan attachment")
			return
		}
		attachments = append(attachments, a)
	}
	if attachments == nil {
		attachments = []attachment{}
	}
	writeJSON(w, http.StatusOK, attachments)
}

// deleteAttachment handles DELETE /api/documents/{id}/attachments/{att_id}
func (h *handler) deleteAttachment(w http.ResponseWriter, r *http.Request) {
	attID := chi.URLParam(r, "att_id")
	userID := getUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	// Get attachment filepath before deleting
	var filePath string
	err := h.deps.DB.QueryRow(r.Context(),
		"SELECT filepath FROM attachments WHERE id = $1", attID,
	).Scan(&filePath)
	if err == pgx.ErrNoRows {
		writeError(w, http.StatusNotFound, "attachment not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get attachment")
		return
	}

	_, err = h.deps.DB.Exec(r.Context(), "DELETE FROM attachments WHERE id = $1", attID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete attachment")
		return
	}

	// Remove file from disk
	_ = os.Remove(filePath)

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// --- Tag handlers ---

// listTags handles GET /tags (mounted on document router)
func (h *handler) listTags(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	var query string
	var args []any
	if q != "" {
		query = "SELECT id, name, slug FROM tags WHERE name ILIKE $1 || '%' ORDER BY name LIMIT 10"
		args = []any{q}
	} else {
		query = "SELECT id, name, slug FROM tags ORDER BY name"
	}

	rows, err := h.deps.DB.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list tags")
		return
	}
	defer rows.Close()

	var tags []tagDTO
	for rows.Next() {
		var t tagDTO
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan tag")
			return
		}
		tags = append(tags, t)
	}
	if tags == nil {
		tags = []tagDTO{}
	}
	writeJSON(w, http.StatusOK, tags)
}

// createTag handles POST /api/tags
func (h *handler) createTag(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if err := readJSON(r, &req); err != nil || req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	slug := GenerateSlug(req.Name)
	var tag struct {
		ID        string    `json:"id"`
		Name      string    `json:"name"`
		Slug      string    `json:"slug"`
		CreatedAt time.Time `json:"created_at"`
	}
	err := h.deps.DB.QueryRow(r.Context(),
		"INSERT INTO tags (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at",
		req.Name, slug,
	).Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.CreatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			writeError(w, http.StatusConflict, "tag already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create tag")
		return
	}
	writeJSON(w, http.StatusCreated, tag)
}

// deleteTag handles DELETE /api/tags/{id}
func (h *handler) deleteTag(w http.ResponseWriter, r *http.Request) {
	tagID := chi.URLParam(r, "id")
	ct, err := h.deps.DB.Exec(r.Context(), "DELETE FROM tags WHERE id = $1", tagID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete tag")
		return
	}
	if ct.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "tag not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// freshnessThresholds reads green/yellow day thresholds from the config table.
func (h *handler) freshnessThresholds(ctx context.Context) (int, int) {
	greenDays := fallbackGreenDays
	yellowDays := fallbackYellowDays
	var val string
	if err := h.deps.DB.QueryRow(ctx, `SELECT value FROM config WHERE key = 'freshness_green'`).Scan(&val); err == nil {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			greenDays = n
		}
	}
	if err := h.deps.DB.QueryRow(ctx, `SELECT value FROM config WHERE key = 'freshness_yellow'`).Scan(&val); err == nil {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			yellowDays = n
		}
	}
	return greenDays, yellowDays
}

// --- Internal helpers ---

func (h *handler) ensureUniqueSlug(ctx context.Context, slug, excludeID string) (string, error) {
	candidate := slug
	for i := 2; i < 100; i++ {
		var exists bool
		var err error
		if excludeID != "" {
			err = h.deps.DB.QueryRow(ctx,
				"SELECT EXISTS(SELECT 1 FROM documents WHERE slug = $1 AND id != $2)",
				candidate, excludeID).Scan(&exists)
		} else {
			err = h.deps.DB.QueryRow(ctx,
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

func (h *handler) syncTags(ctx context.Context, docID string, tagIDs []string) {
	if _, err := h.deps.DB.Exec(ctx, "DELETE FROM document_tags WHERE document_id = $1", docID); err != nil {
		log.Printf("syncTags: failed to delete tags for doc %s: %v", docID, err)
		return
	}
	for _, tagID := range tagIDs {
		if _, err := h.deps.DB.Exec(ctx,
			"INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
			docID, tagID); err != nil {
			log.Printf("syncTags: failed to insert tag %s for doc %s: %v", tagID, docID, err)
		}
	}
}

func (h *handler) indexDocument(docID string) {
	if h.deps.Meili == nil {
		return
	}
	ctx := context.Background()

	var sd SearchDocument
	var createdAt, updatedAt time.Time
	err := h.deps.DB.QueryRow(ctx,
		`SELECT d.id, d.title, d.body_text, d.domain_id, d.type_id, d.visibility,
		        d.view_count, d.created_at, d.updated_at, u.display_name
		 FROM documents d
		 JOIN users u ON u.id = d.author_id
		 WHERE d.id = $1`, docID,
	).Scan(&sd.ID, &sd.Title, &sd.BodyText, &sd.DomainID, &sd.TypeID, &sd.Visibility,
		&sd.ViewCount, &createdAt, &updatedAt, &sd.AuthorName)
	if err != nil {
		log.Printf("indexDocument: failed to fetch doc %s: %v", docID, err)
		return
	}
	sd.CreatedAt = createdAt.Unix()
	sd.UpdatedAt = updatedAt.Unix()

	// Fetch tags
	rows, err := h.deps.DB.Query(ctx,
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

	idx := h.deps.Meili.Index(meiliIndex)
	pk := "id"
	if _, err := idx.AddDocuments([]SearchDocument{sd}, &meilisearch.DocumentOptions{PrimaryKey: &pk}); err != nil {
		log.Printf("indexDocument: failed to index doc %s in Meilisearch: %v", docID, err)
	}
}

func (h *handler) configureMeiliIndex() {
	if h.deps.Meili == nil {
		return
	}
	idx := h.deps.Meili.Index(meiliIndex)
	_, _ = idx.UpdateFilterableAttributes(&[]interface{}{"domain_id", "type_id", "visibility"})
	_, _ = idx.UpdateSearchableAttributes(&[]string{"title", "body_text", "tags"})
	_, _ = idx.UpdateSortableAttributes(&[]string{"created_at", "updated_at", "view_count"})
}
