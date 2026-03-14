package document

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

// --- Snapshot helper (called from updateDocument) ---

// snapshotVersion creates a version snapshot of the current document state.
// Must be called inside a transaction that holds a FOR UPDATE lock on the document row.
// Returns true if a snapshot was created, false if skipped (body unchanged).
func (h *handler) snapshotVersion(ctx context.Context, tx pgx.Tx, docID string, currentTitle string, currentBody json.RawMessage, currentBodyText string, authorID string) (bool, error) {
	// Compare body bytes against last version to skip unchanged saves
	var lastBody json.RawMessage
	err := tx.QueryRow(ctx,
		`SELECT body FROM document_versions
		 WHERE document_id = $1 ORDER BY version_number DESC LIMIT 1`, docID).Scan(&lastBody)
	if err == nil && bytes.Equal(currentBody, lastBody) {
		return false, nil // body unchanged, skip snapshot
	}

	// Get next version number
	var nextVersion int
	err = tx.QueryRow(ctx,
		`SELECT COALESCE(MAX(version_number), 0) + 1
		 FROM document_versions WHERE document_id = $1`, docID).Scan(&nextVersion)
	if err != nil {
		return false, fmt.Errorf("get next version: %w", err)
	}

	// Insert snapshot
	_, err = tx.Exec(ctx,
		`INSERT INTO document_versions (document_id, version_number, title, body, body_text, author_id)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		docID, nextVersion, currentTitle, currentBody, currentBodyText, authorID)
	if err != nil {
		return false, fmt.Errorf("insert version: %w", err)
	}

	// Purge old versions beyond retention limit
	var maxStr string
	err = tx.QueryRow(ctx,
		`SELECT value FROM config WHERE key = 'max_versions_per_document'`).Scan(&maxStr)
	if err != nil {
		maxStr = "50"
	}
	maxVersions, _ := strconv.Atoi(maxStr)
	if maxVersions <= 0 {
		maxVersions = 50
	}
	_, _ = tx.Exec(ctx,
		`DELETE FROM document_versions
		 WHERE document_id = $1
		   AND version_number <= (
		     SELECT MAX(version_number) - $2 FROM document_versions WHERE document_id = $1
		   )`, docID, maxVersions)

	return true, nil
}

// --- Visibility check helper ---

// checkDocumentAccess verifies the caller can access the document (public or authenticated).
// Returns true if accessible, or writes an error response and returns false.
func (h *handler) checkDocumentAccess(w http.ResponseWriter, r *http.Request, docID string) bool {
	var visibility string
	err := h.deps.DB.QueryRow(r.Context(),
		`SELECT visibility FROM documents WHERE id = $1`, docID).Scan(&visibility)
	if err != nil {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "document not found"})
		return false
	}
	if visibility == "dsi" && getUserID(r.Context()) == "" {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "authentication required"})
		return false
	}
	return true
}

// --- HTTP Handlers ---

type versionSummary struct {
	ID            string    `json:"id"`
	VersionNumber int       `json:"version_number"`
	Title         string    `json:"title"`
	AuthorName    string    `json:"author_name"`
	CreatedAt     time.Time `json:"created_at"`
}

// listVersions handles GET /documents/{id}/versions
func (h *handler) listVersions(w http.ResponseWriter, r *http.Request) {
	docID := chi.URLParam(r, "id")
	if !h.checkDocumentAccess(w, r, docID) {
		return
	}

	rows, err := h.deps.DB.Query(r.Context(),
		`SELECT dv.id, dv.version_number, dv.title, u.display_name, dv.created_at
		 FROM document_versions dv
		 JOIN users u ON u.id = dv.author_id
		 WHERE dv.document_id = $1
		 ORDER BY dv.version_number DESC`, docID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list versions"})
		return
	}
	defer rows.Close()

	var versions []versionSummary
	for rows.Next() {
		var v versionSummary
		if err := rows.Scan(&v.ID, &v.VersionNumber, &v.Title, &v.AuthorName, &v.CreatedAt); err != nil {
			continue
		}
		versions = append(versions, v)
	}
	if versions == nil {
		versions = []versionSummary{}
	}
	httputil.WriteJSON(w, http.StatusOK, versions)
}

type versionDetail struct {
	ID            string          `json:"id"`
	VersionNumber int             `json:"version_number"`
	Title         string          `json:"title"`
	Body          json.RawMessage `json:"body"`
	AuthorName    string          `json:"author_name"`
	CreatedAt     time.Time       `json:"created_at"`
}

// getVersion handles GET /documents/{id}/versions/{versionNumber}
func (h *handler) getVersion(w http.ResponseWriter, r *http.Request) {
	docID := chi.URLParam(r, "id")
	if !h.checkDocumentAccess(w, r, docID) {
		return
	}
	vNum, err := strconv.Atoi(chi.URLParam(r, "versionNumber"))
	if err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid version number"})
		return
	}

	var v versionDetail
	err = h.deps.DB.QueryRow(r.Context(),
		`SELECT dv.id, dv.version_number, dv.title, dv.body, u.display_name, dv.created_at
		 FROM document_versions dv
		 JOIN users u ON u.id = dv.author_id
		 WHERE dv.document_id = $1 AND dv.version_number = $2`, docID, vNum,
	).Scan(&v.ID, &v.VersionNumber, &v.Title, &v.Body, &v.AuthorName, &v.CreatedAt)
	if err != nil {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "version not found"})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, v)
}

type diffResponse struct {
	V1          int             `json:"v1"`
	V2          int             `json:"v2"`
	V1CreatedAt time.Time       `json:"v1_created_at"`
	V2CreatedAt time.Time       `json:"v2_created_at"`
	V1Author    string          `json:"v1_author"`
	V2Author    string          `json:"v2_author"`
	V1Body      json.RawMessage `json:"v1_body"`
	V2Body      json.RawMessage `json:"v2_body"`
	Lines       []DiffLine      `json:"lines"`
}

// diffVersions handles GET /documents/{id}/versions/{v1}/diff/{v2}
func (h *handler) diffVersions(w http.ResponseWriter, r *http.Request) {
	docID := chi.URLParam(r, "id")
	if !h.checkDocumentAccess(w, r, docID) {
		return
	}
	v1, err1 := strconv.Atoi(chi.URLParam(r, "v1"))
	v2, err2 := strconv.Atoi(chi.URLParam(r, "v2"))
	if err1 != nil || err2 != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid version numbers"})
		return
	}
	if v1 == v2 {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot diff a version with itself"})
		return
	}
	// Normalize order
	if v1 > v2 {
		v1, v2 = v2, v1
	}

	// Fetch both versions
	var text1, text2 string
	var body1, body2 json.RawMessage
	var created1, created2 time.Time
	var author1, author2 string

	err := h.deps.DB.QueryRow(r.Context(),
		`SELECT dv.body_text, dv.body, dv.created_at, u.display_name
		 FROM document_versions dv JOIN users u ON u.id = dv.author_id
		 WHERE dv.document_id = $1 AND dv.version_number = $2`, docID, v1,
	).Scan(&text1, &body1, &created1, &author1)
	if err != nil {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": fmt.Sprintf("version %d not found", v1)})
		return
	}

	err = h.deps.DB.QueryRow(r.Context(),
		`SELECT dv.body_text, dv.body, dv.created_at, u.display_name
		 FROM document_versions dv JOIN users u ON u.id = dv.author_id
		 WHERE dv.document_id = $1 AND dv.version_number = $2`, docID, v2,
	).Scan(&text2, &body2, &created2, &author2)
	if err != nil {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": fmt.Sprintf("version %d not found", v2)})
		return
	}

	lines := ComputeTextDiff(text1, text2)

	httputil.WriteJSON(w, http.StatusOK, diffResponse{
		V1: v1, V2: v2,
		V1CreatedAt: created1, V2CreatedAt: created2,
		V1Author: author1, V2Author: author2,
		V1Body: body1, V2Body: body2,
		Lines: lines,
	})
}

// restoreVersion handles POST /documents/{id}/versions/{versionNumber}/restore
func (h *handler) restoreVersion(w http.ResponseWriter, r *http.Request) {
	docID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())
	userDomainID := getUserDomainID(r.Context())

	if userID == "" {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}

	vNum, err := strconv.Atoi(chi.URLParam(r, "versionNumber"))
	if err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid version number"})
		return
	}

	ctx := r.Context()
	tx, err := h.deps.DB.Begin(ctx)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to begin transaction"})
		return
	}
	defer tx.Rollback(ctx)

	// Lock doc row + read current state
	var authorID, docDomainID, currentTitle, currentBodyText string
	var currentBody json.RawMessage
	err = tx.QueryRow(ctx,
		`SELECT author_id, domain_id, title, body, body_text
		 FROM documents WHERE id = $1 FOR UPDATE`, docID,
	).Scan(&authorID, &docDomainID, &currentTitle, &currentBody, &currentBodyText)
	if err != nil {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "document not found"})
		return
	}

	// Permission check: author OR same domain OR admin
	if userRole != "admin" && authorID != userID && docDomainID != userDomainID {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "permission denied"})
		return
	}

	// Read target version
	var targetTitle, targetBodyText string
	var targetBody json.RawMessage
	err = tx.QueryRow(ctx,
		`SELECT title, body, body_text FROM document_versions
		 WHERE document_id = $1 AND version_number = $2`, docID, vNum,
	).Scan(&targetTitle, &targetBody, &targetBodyText)
	if err != nil {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "version not found"})
		return
	}

	// Snapshot current state before restore
	h.snapshotVersion(ctx, tx, docID, currentTitle, currentBody, currentBodyText, userID)

	// Update document with restored content
	slug := httputil.GenerateSlug(targetTitle)
	slug, _ = h.ensureUniqueSlug(ctx, slug, docID)
	var doc struct {
		ID        string    `json:"id"`
		Title     string    `json:"title"`
		Slug      string    `json:"slug"`
		UpdatedAt time.Time `json:"updated_at"`
	}
	err = tx.QueryRow(ctx,
		`UPDATE documents
		 SET title = $2, slug = $3, body = $4, body_text = $5, updated_at = now()
		 WHERE id = $1
		 RETURNING id, title, slug, updated_at`,
		docID, targetTitle, slug, targetBody, targetBodyText,
	).Scan(&doc.ID, &doc.Title, &doc.Slug, &doc.UpdatedAt)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to restore"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to commit"})
		return
	}

	// Re-index async
	go h.indexDocument(docID)

	httputil.WriteJSON(w, http.StatusOK, doc)
}
