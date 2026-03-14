# Document Versioning Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete version history to documents with automatic snapshots, diff comparison, and restore.

**Architecture:** New `document_versions` table stores snapshots on every save. Version handlers on the existing `handler` struct expose list/detail/diff/restore endpoints. Frontend adds a history side panel in ReaderPage and a dedicated diff page with text/visual toggle.

**Tech Stack:** Go (pgx transactions, go-diff), React (TipTap read-only editors, LCS diff), PostgreSQL (JSONB snapshots).

**Spec:** `docs/superpowers/specs/2026-03-14-document-versioning-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `migrations/000012_document_versions.up.sql` | Create table + config seed |
| `migrations/000012_document_versions.down.sql` | Drop table + config cleanup |
| `internal/document/version_handlers.go` | HTTP handlers: list, detail, diff, restore |
| `internal/document/diff.go` | Text diff using go-diff Myers algorithm |
| `web/src/features/reader/VersionHistory.tsx` | Side panel listing versions with checkboxes |
| `web/src/features/reader/VersionPreview.tsx` | Read-only banner + restore button for old version |
| `web/src/features/reader/DiffPage.tsx` | Diff page with text/visual toggle |
| `web/src/features/reader/DiffTextView.tsx` | Git-style line diff (green/red) |
| `web/src/features/reader/DiffVisualView.tsx` | Side-by-side TipTap diff |
| `web/src/lib/diff.ts` | LCS algorithm for TipTap JSON node arrays |

### Modified files
| File | Change |
|------|--------|
| `internal/document/handlers.go` | Wrap updateDocument in tx, snapshot before UPDATE |
| `internal/document/router.go` | Register version endpoints in OptionalAuth + RequireAuth groups |
| `internal/admin/handler.go` | Add handleGetMaxVersions / handlePutMaxVersions |
| `internal/admin/router.go` | Register retention config routes |
| `web/src/features/reader/ReaderPage.tsx` | Add "Historique" button + VersionHistory panel |
| `web/src/features/admin/AdminPage.tsx` | Add retention config tab |
| `web/src/App.tsx` | Add diff route |
| `go.mod` / `go.sum` | Add github.com/sergi/go-diff |

---

## Chunk 1: Database + Backend Core

### Task 1: Migration

**Files:**
- Create: `migrations/000012_document_versions.up.sql`
- Create: `migrations/000012_document_versions.down.sql`

- [ ] **Step 1: Write up migration**

```sql
-- migrations/000012_document_versions.up.sql
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    title TEXT NOT NULL,
    body JSONB NOT NULL,
    body_text TEXT NOT NULL DEFAULT '',
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(document_id, version_number)
);
CREATE INDEX idx_doc_versions_document_id ON document_versions(document_id);

INSERT INTO config (key, value) VALUES ('max_versions_per_document', '50')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Write down migration**

```sql
-- migrations/000012_document_versions.down.sql
DELETE FROM config WHERE key = 'max_versions_per_document';
DROP TABLE IF EXISTS document_versions;
```

- [ ] **Step 3: Apply migration on running database**

```bash
docker exec -i plumenote-db psql -U plumenote -d plumenote < migrations/000012_document_versions.up.sql
```

Expected: table created, no errors.

- [ ] **Step 4: Verify**

```bash
docker exec plumenote-db psql -U plumenote -d plumenote -c "\d document_versions"
docker exec plumenote-db psql -U plumenote -d plumenote -c "SELECT * FROM config WHERE key = 'max_versions_per_document'"
```

Expected: table schema shown, config row with value '50'.

- [ ] **Step 5: Commit**

```bash
git add migrations/000012_document_versions.up.sql migrations/000012_document_versions.down.sql
git commit -m "feat(db): add document_versions table and retention config"
```

---

### Task 2: Add go-diff dependency

**Files:**
- Modify: `go.mod`

- [ ] **Step 1: Add dependency**

```bash
cd /home/alex/Documents/REPO/PLUMENOTE_REFONTE && go get github.com/sergi/go-diff@latest
```

- [ ] **Step 2: Verify**

```bash
grep "go-diff" go.mod
```

Expected: `github.com/sergi/go-diff v1.x.x`

- [ ] **Step 3: Commit**

```bash
git add go.mod go.sum
git commit -m "feat(deps): add go-diff for version text diff"
```

---

### Task 3: Text diff utility

**Files:**
- Create: `internal/document/diff.go`

- [ ] **Step 1: Write diff.go**

```go
package document

import (
	"strings"

	difflib "github.com/sergi/go-diff/diffmatchpatch"
)

// DiffLineType represents the type of a diff line.
type DiffLineType string

const (
	DiffEqual  DiffLineType = "equal"
	DiffInsert DiffLineType = "insert"
	DiffDelete DiffLineType = "delete"
)

// DiffLine is a single line in a text diff result.
type DiffLine struct {
	Type DiffLineType `json:"type"`
	Text string       `json:"text"`
}

// ComputeTextDiff computes a line-by-line diff between two texts.
func ComputeTextDiff(oldText, newText string) []DiffLine {
	dmp := difflib.New()
	diffs := dmp.DiffMain(oldText, newText, true)
	diffs = dmp.DiffCleanupSemantic(diffs)

	var lines []DiffLine
	for _, d := range diffs {
		// Split into individual lines to get line-level granularity
		parts := strings.Split(d.Text, "\n")
		for i, part := range parts {
			if part == "" && i == len(parts)-1 {
				continue // skip trailing empty from split
			}
			switch d.Type {
			case difflib.DiffEqual:
				lines = append(lines, DiffLine{Type: DiffEqual, Text: part})
			case difflib.DiffInsert:
				lines = append(lines, DiffLine{Type: DiffInsert, Text: part})
			case difflib.DiffDelete:
				lines = append(lines, DiffLine{Type: DiffDelete, Text: part})
			}
		}
	}
	return lines
}
```

- [ ] **Step 2: Verify it compiles**

```bash
go build ./internal/document/
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add internal/document/diff.go
git commit -m "feat(version): add text diff utility using go-diff Myers"
```

---

### Task 4: Version handlers — list, detail, diff, restore

**Files:**
- Create: `internal/document/version_handlers.go`

- [ ] **Step 1: Write version_handlers.go**

```go
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
// Returns the document ID if accessible, or writes an error response and returns "".
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
	V1          int        `json:"v1"`
	V2          int        `json:"v2"`
	V1CreatedAt time.Time  `json:"v1_created_at"`
	V2CreatedAt time.Time  `json:"v2_created_at"`
	V1Author    string     `json:"v1_author"`
	V2Author    string     `json:"v2_author"`
	V1Body      json.RawMessage `json:"v1_body"`
	V2Body      json.RawMessage `json:"v2_body"`
	Lines       []DiffLine `json:"lines"`
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
```

- [ ] **Step 2: Verify it compiles**

```bash
go build ./internal/document/
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add internal/document/version_handlers.go
git commit -m "feat(version): add version list, detail, diff, restore handlers"
```

---

### Task 5: Modify updateDocument to snapshot before UPDATE

**Files:**
- Modify: `internal/document/handlers.go` — the `updateDocument` method

The key change: wrap the permission check read + snapshot + UPDATE in a single transaction with `FOR UPDATE`.

- [ ] **Step 1: Refactor updateDocument to use transaction**

In `internal/document/handlers.go`, replace the `updateDocument` method body. The changes are:

1. After parsing and validating the request, begin a transaction.
2. Use `SELECT ... FOR UPDATE` to read + lock the current document (replaces the existing permission check query).
3. Call `h.snapshotVersion(ctx, tx, ...)` to snapshot current state before updating.
4. Run the UPDATE inside the transaction.
5. Commit.

Replace the existing permission check query (the first `QueryRow` that reads `author_id, domain_id`) AND the UPDATE query with this transactional flow:

```go
	// Begin transaction for atomic snapshot + update
	tx, err := h.deps.DB.Begin(r.Context())
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to begin transaction"})
		return
	}
	defer tx.Rollback(r.Context())

	// Lock document row + read current state for permission check AND snapshot
	var authorID, docDomainID, currentTitle, currentBodyText string
	var currentBody json.RawMessage
	err = tx.QueryRow(r.Context(),
		`SELECT author_id, domain_id, title, body, body_text
		 FROM documents WHERE id = $1 FOR UPDATE`, docID,
	).Scan(&authorID, &docDomainID, &currentTitle, &currentBody, &currentBodyText)
	if err == pgx.ErrNoRows {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "document not found"})
		return
	}
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get document"})
		return
	}

	// RG-003: author OR same domain OR admin
	if userRole != "admin" && authorID != userID && docDomainID != userDomainID {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "you can only edit documents in your domain"})
		return
	}
```

Then after the request parsing and slug generation, before the UPDATE:

```go
	// Snapshot current state before update
	h.snapshotVersion(r.Context(), tx, docID, currentTitle, currentBody, currentBodyText, userID)
```

Then change the UPDATE to use `tx.QueryRow` instead of `h.deps.DB.QueryRow`, and add `tx.Commit` after:

```go
	err = tx.QueryRow(r.Context(),
		`UPDATE documents
		 SET title = $2, slug = $3, body = $4, body_text = $5, domain_id = $6, type_id = $7, visibility = $8, updated_at = now()
		 WHERE id = $1
		 RETURNING id, title, slug, updated_at`,
		docID, req.Title, slug, req.Body, bodyText, req.DomainID, req.TypeID, req.Visibility,
	).Scan(&doc.ID, &doc.Title, &doc.Slug, &doc.UpdatedAt)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update document"})
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to commit"})
		return
	}
```

- [ ] **Step 2: Verify it compiles**

```bash
go build ./internal/document/
```

- [ ] **Step 3: Run existing tests**

```bash
go test ./internal/... -count=1
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add internal/document/handlers.go
git commit -m "feat(version): snapshot document state before every update"
```

---

### Task 6: Register version routes

**Files:**
- Modify: `internal/document/router.go`

- [ ] **Step 1: Add version routes to router**

In `internal/document/router.go`, add to the OptionalAuth group (read endpoints):

```go
		r.Get("/{id}/versions", h.listVersions)
		r.Get("/{id}/versions/{versionNumber}", h.getVersion)
		r.Get("/{id}/versions/{v1}/diff/{v2}", h.diffVersions)
```

Add to the RequireAuth group (write endpoints):

```go
		r.Post("/{id}/versions/{versionNumber}/restore", h.restoreVersion)
```

- [ ] **Step 2: Verify it compiles**

```bash
go build ./internal/...
```

- [ ] **Step 3: Commit**

```bash
git add internal/document/router.go
git commit -m "feat(version): register version API routes"
```

---

### Task 7: Admin retention config endpoints

**Files:**
- Modify: `internal/admin/handler.go`
- Modify: `internal/admin/router.go`

- [ ] **Step 1: Add handlers in handler.go**

Add at the end of `internal/admin/handler.go`:

```go
type maxVersionsConfig struct {
	MaxVersions int `json:"max_versions"`
}

func handleGetMaxVersions(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var val string
		err := pool.QueryRow(r.Context(),
			`SELECT value FROM config WHERE key = 'max_versions_per_document'`).Scan(&val)
		if err != nil {
			val = "50"
		}
		n, _ := strconv.Atoi(val)
		if n <= 0 {
			n = 50
		}
		httputil.WriteJSON(w, http.StatusOK, maxVersionsConfig{MaxVersions: n})
	}
}

func handlePutMaxVersions(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req maxVersionsConfig
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if req.MaxVersions <= 0 {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "max_versions must be greater than 0"})
			return
		}

		_, err := pool.Exec(r.Context(),
			`INSERT INTO config (key, value, updated_at) VALUES ('max_versions_per_document', $1, now())
			 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
			strconv.Itoa(req.MaxVersions))
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save config"})
			return
		}

		httputil.WriteJSON(w, http.StatusOK, req)
	}
}
```

- [ ] **Step 2: Register routes in router.go**

Add in `internal/admin/router.go`, in the Config section:

```go
	r.Get("/config/max-versions", handleGetMaxVersions(pool))
	r.Put("/config/max-versions", handlePutMaxVersions(pool))
```

- [ ] **Step 3: Verify it compiles**

```bash
go build ./internal/...
```

- [ ] **Step 4: Commit**

```bash
git add internal/admin/handler.go internal/admin/router.go
git commit -m "feat(admin): add retention config endpoints for max versions"
```

---

### Task 8: Build and deploy backend, smoke test API

- [ ] **Step 1: Build and deploy**

```bash
cd web && npm run build && cd ../docker && docker compose build plumenote-app && docker compose up -d plumenote-app
```

- [ ] **Step 2: Apply migration**

```bash
docker exec -i plumenote-db psql -U plumenote -d plumenote < migrations/000012_document_versions.up.sql
```

- [ ] **Step 3: Smoke test — save a document and check versions**

```bash
# Login
TOKEN=$(curl -s http://localhost:8080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' | jq -r '.token')

# Pick a document
DOC=$(curl -s http://localhost:8080/api/documents -H "Authorization: Bearer $TOKEN" | jq -r '.[0]')
DOC_ID=$(echo $DOC | jq -r '.id')
DOC_SLUG=$(echo $DOC | jq -r '.slug')

# Save it (triggers snapshot)
curl -s -X PUT "http://localhost:8080/api/documents/$DOC_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(curl -s "http://localhost:8080/api/documents/$DOC_SLUG" -H "Authorization: Bearer $TOKEN" | jq '{title, body, domain_id, type_id, tags: [.tags[]?.id // empty], visibility}')"

# List versions
curl -s "http://localhost:8080/api/documents/$DOC_ID/versions" -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: one version in the list.

- [ ] **Step 4: Smoke test — admin config**

```bash
curl -s http://localhost:8080/api/admin/config/max-versions -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{"max_versions": 50}`

- [ ] **Step 5: Commit (if any fixes needed)**

---

## Chunk 2: Frontend — Version History + Diff

### Task 9: LCS diff utility

**Files:**
- Create: `web/src/lib/diff.ts`

- [ ] **Step 1: Write LCS algorithm for TipTap nodes**

```typescript
// web/src/lib/diff.ts

export type DiffType = 'equal' | 'insert' | 'delete'

export interface DiffNode {
  type: DiffType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: Record<string, any>
}

/**
 * Compute LCS-based diff on two arrays of TipTap top-level nodes.
 * Returns two arrays: left (equal + delete) and right (equal + insert).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function diffTipTapNodes(oldNodes: Record<string, any>[], newNodes: Record<string, any>[]): {
  left: DiffNode[]
  right: DiffNode[]
} {
  const oldHashes = oldNodes.map((n) => JSON.stringify(n))
  const newHashes = newNodes.map((n) => JSON.stringify(n))

  // LCS table
  const m = oldHashes.length
  const n = newHashes.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldHashes[i - 1] === newHashes[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to build diff
  let i = m
  let j = n

  const leftResult: DiffNode[] = []
  const rightResult: DiffNode[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldHashes[i - 1] === newHashes[j - 1]) {
      leftResult.unshift({ type: 'equal', node: oldNodes[i - 1] })
      rightResult.unshift({ type: 'equal', node: newNodes[j - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rightResult.unshift({ type: 'insert', node: newNodes[j - 1] })
      j--
    } else {
      leftResult.unshift({ type: 'delete', node: oldNodes[i - 1] })
      i--
    }
  }

  return { left: leftResult, right: rightResult }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/lib/diff.ts
git commit -m "feat(version): add LCS diff algorithm for TipTap nodes"
```

---

### Task 10: VersionHistory side panel

**Files:**
- Create: `web/src/features/reader/VersionHistory.tsx`

- [ ] **Step 1: Write VersionHistory component**

```tsx
// web/src/features/reader/VersionHistory.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { X } from 'lucide-react'

interface Version {
  id: string
  version_number: number
  title: string
  author_name: string
  created_at: string
}

interface Props {
  documentId: string
  documentSlug: string
  open: boolean
  onClose: () => void
  onSelectVersion: (versionNumber: number) => void
}

export default function VersionHistory({ documentId, documentSlug, open, onClose, onSelectVersion }: Props) {
  const navigate = useNavigate()
  const [versions, setVersions] = useState<Version[]>([])
  const [selected, setSelected] = useState<number[]>([])

  useEffect(() => {
    if (!open || !documentId) return
    api.get<Version[]>(`/documents/${documentId}/versions`).then(setVersions).catch(() => {})
  }, [open, documentId])

  const toggleSelect = (vn: number) => {
    setSelected((prev) => {
      if (prev.includes(vn)) return prev.filter((v) => v !== vn)
      if (prev.length >= 2) return [prev[1], vn]
      return [...prev, vn]
    })
  }

  const canCompare = selected.length === 2

  const handleCompare = () => {
    if (!canCompare) return
    const [v1, v2] = selected.sort((a, b) => a - b)
    navigate(`/documents/${documentSlug}/diff/${v1}/${v2}`)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (!open) return null

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-bg border-l border-ink-10 shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-ink-10">
        <h2 className="text-sm font-semibold text-ink-70">Historique des versions</h2>
        <button onClick={onClose} className="p-1 hover:bg-ink-05 rounded">
          <X size={16} />
        </button>
      </div>

      {canCompare && (
        <div className="p-3 border-b border-ink-10">
          <button
            onClick={handleCompare}
            className="w-full px-3 py-2 bg-blue text-white text-sm rounded-lg hover:bg-blue/90"
          >
            Comparer v{Math.min(...selected)} → v{Math.max(...selected)}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <p className="p-4 text-sm text-ink-45">Aucune version enregistree.</p>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 px-4 py-3 border-b border-ink-05 hover:bg-ink-05 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(v.version_number)}
                onChange={() => toggleSelect(v.version_number)}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0" onClick={() => onSelectVersion(v.version_number)}>
                <div className="text-sm font-medium text-ink">v{v.version_number}</div>
                <div className="text-xs text-ink-45 truncate">
                  {formatDate(v.created_at)} — {v.author_name}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/features/reader/VersionHistory.tsx
git commit -m "feat(version): add VersionHistory side panel component"
```

---

### Task 11: VersionPreview banner

**Files:**
- Create: `web/src/features/reader/VersionPreview.tsx`

- [ ] **Step 1: Write VersionPreview component**

```tsx
// web/src/features/reader/VersionPreview.tsx
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import DocumentContent from './DocumentContent'

interface VersionData {
  version_number: number
  title: string
  body: Record<string, unknown>
  author_name: string
  created_at: string
}

interface Props {
  documentId: string
  versionNumber: number
  onClose: () => void
  onRestore: () => void
}

export default function VersionPreview({ documentId, versionNumber, onClose, onRestore }: Props) {
  const [version, setVersion] = useState<VersionData | null>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    api.get<VersionData>(`/documents/${documentId}/versions/${versionNumber}`).then(setVersion).catch(() => {})
  }, [documentId, versionNumber])

  const handleRestore = async () => {
    setRestoring(true)
    try {
      await api.post(`/documents/${documentId}/versions/${versionNumber}/restore`, {})
      onRestore()
    } catch {
      alert('Erreur lors de la restauration')
    } finally {
      setRestoring(false)
    }
  }

  if (!version) return null

  const date = new Date(version.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center justify-between">
        <span className="text-sm text-amber-800">
          Version {version.version_number} du {date} par {version.author_name}
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="px-3 py-1 text-xs bg-blue text-white rounded hover:bg-blue/90 disabled:opacity-50"
          >
            {restoring ? 'Restauration...' : 'Restaurer'}
          </button>
          <button onClick={onClose} className="px-3 py-1 text-xs border rounded hover:bg-ink-05">
            Fermer
          </button>
        </div>
      </div>
      <DocumentContent content={version.body} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/features/reader/VersionPreview.tsx
git commit -m "feat(version): add VersionPreview banner with restore button"
```

---

### Task 12: Integrate VersionHistory + VersionPreview into ReaderPage

**Files:**
- Modify: `web/src/features/reader/ReaderPage.tsx`

- [ ] **Step 1: Add state and imports**

At the top of ReaderPage, add imports:

```tsx
import VersionHistory from './VersionHistory'
import VersionPreview from './VersionPreview'
```

Add state variables inside the component:

```tsx
const [historyOpen, setHistoryOpen] = useState(false)
const [previewVersion, setPreviewVersion] = useState<number | null>(null)
```

- [ ] **Step 2: Add "Historique" button**

In the MetadataHeader or action buttons area, add:

```tsx
<button
  onClick={() => setHistoryOpen(true)}
  className="px-3 py-1.5 text-sm border rounded-lg hover:bg-ink-05 text-ink-70"
>
  Historique
</button>
```

- [ ] **Step 3: Add VersionHistory and VersionPreview at the bottom of the return**

Before the closing `</div>` of the component:

```tsx
<VersionHistory
  documentId={doc.id}
  documentSlug={slug!}
  open={historyOpen}
  onClose={() => setHistoryOpen(false)}
  onSelectVersion={(vn) => { setPreviewVersion(vn); setHistoryOpen(false) }}
/>

{previewVersion !== null ? (
  <VersionPreview
    documentId={doc.id}
    versionNumber={previewVersion}
    onClose={() => setPreviewVersion(null)}
    onRestore={() => { setPreviewVersion(null); window.location.reload() }}
  />
) : (
  <DocumentContent content={doc.body} onTocExtracted={setTocItems} />
)}
```

This replaces the current `<DocumentContent>` render — when previewing a version, show the VersionPreview; otherwise show normal content.

- [ ] **Step 4: Verify it compiles**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add web/src/features/reader/ReaderPage.tsx
git commit -m "feat(version): integrate history panel and version preview in ReaderPage"
```

---

### Task 13: DiffPage with text and visual views

**Files:**
- Create: `web/src/features/reader/DiffTextView.tsx`
- Create: `web/src/features/reader/DiffVisualView.tsx`
- Create: `web/src/features/reader/DiffPage.tsx`

- [ ] **Step 1: Write DiffTextView**

```tsx
// web/src/features/reader/DiffTextView.tsx

interface DiffLine {
  type: 'equal' | 'insert' | 'delete'
  text: string
}

interface Props {
  lines: DiffLine[]
}

export default function DiffTextView({ lines }: Props) {
  return (
    <div className="font-mono text-sm rounded-lg border border-ink-10 overflow-auto max-h-[70vh]">
      {lines.map((line, i) => (
        <div
          key={i}
          className={`px-4 py-0.5 whitespace-pre-wrap ${
            line.type === 'insert'
              ? 'bg-green-50 text-green-800'
              : line.type === 'delete'
                ? 'bg-red-50 text-red-800 line-through'
                : 'text-ink-70'
          }`}
        >
          <span className="inline-block w-6 text-ink-30 select-none">
            {line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' '}
          </span>
          {line.text || '\u00A0'}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write DiffVisualView**

```tsx
// web/src/features/reader/DiffVisualView.tsx
import { useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Highlight from '@tiptap/extension-highlight'
import { common, createLowlight } from 'lowlight'
import { AlertBlock } from '@/features/editor/AlertBlock'
import { diffTipTapNodes, type DiffNode } from '@/lib/diff'

const lowlight = createLowlight(common)

interface Props {
  oldBody: Record<string, unknown>
  newBody: Record<string, unknown>
}

function DiffColumn({ nodes }: { nodes: DiffNode[] }) {
  const extensions = useMemo(() => [
    StarterKit.configure({ codeBlock: false }),
    CodeBlockLowlight.configure({ lowlight }),
    Highlight,
    AlertBlock,
  ], [])

  return (
    <div className="flex-1 min-w-0 border border-ink-10 rounded-lg overflow-auto max-h-[70vh]">
      <div className="p-4 space-y-1">
        {nodes.map((dn, i) => {
          const bgClass =
            dn.type === 'delete' ? 'bg-red-50 border-l-4 border-red-300' :
            dn.type === 'insert' ? 'bg-green-50 border-l-4 border-green-300' :
            ''
          return (
            <div key={i} className={`rounded px-2 py-1 ${bgClass}`}>
              <MiniRenderer extensions={extensions} content={{ type: 'doc', content: [dn.node] }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MiniRenderer({ extensions, content }: { extensions: any[]; content: Record<string, unknown> }) {
  const editor = useEditor({
    extensions,
    content,
    editable: false,
    editorProps: { attributes: { class: 'prose prose-sm max-w-none' } },
  })
  if (!editor) return null
  return <EditorContent editor={editor} />
}

export default function DiffVisualView({ oldBody, newBody }: Props) {
  const { left, right } = useMemo(() => {
    const oldNodes = (oldBody as any)?.content ?? []
    const newNodes = (newBody as any)?.content ?? []
    return diffTipTapNodes(oldNodes, newNodes)
  }, [oldBody, newBody])

  return (
    <div className="flex gap-4">
      <DiffColumn nodes={left} />
      <DiffColumn nodes={right} />
    </div>
  )
}
```

- [ ] **Step 3: Write DiffPage**

```tsx
// web/src/features/reader/DiffPage.tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import DiffTextView from './DiffTextView'
import DiffVisualView from './DiffVisualView'

interface DiffData {
  v1: number
  v2: number
  v1_created_at: string
  v2_created_at: string
  v1_author: string
  v2_author: string
  v1_body: Record<string, unknown>
  v2_body: Record<string, unknown>
  lines: Array<{ type: 'equal' | 'insert' | 'delete'; text: string }>
}

export default function DiffPage() {
  const { slug, v1, v2 } = useParams<{ slug: string; v1: string; v2: string }>()
  const navigate = useNavigate()

  const [diff, setDiff] = useState<DiffData | null>(null)
  const [mode, setMode] = useState<'text' | 'visual'>('text')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug || !v1 || !v2) return
    // Resolve slug to document ID, then fetch diff
    api.get<{ id: string }>(`/documents/${slug}`)
      .then((doc) => api.get<DiffData>(`/documents/${doc.id}/versions/${v1}/diff/${v2}`))
      .then(setDiff)
      .catch(() => setError('Impossible de charger le diff'))
  }, [slug, v1, v2])

  if (error) {
    return <div className="max-w-4xl mx-auto py-12 text-center text-red-600">{error}</div>
  }
  if (!diff) {
    return <div className="max-w-6xl mx-auto py-12 text-center text-ink-45">Chargement...</div>
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-ink-70">
            Version {diff.v1} → Version {diff.v2}
          </h1>
          <p className="text-xs text-ink-45 mt-1">
            {formatDate(diff.v1_created_at)} ({diff.v1_author}) → {formatDate(diff.v2_created_at)} ({diff.v2_author})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden text-sm">
            <button
              onClick={() => setMode('text')}
              className={`px-3 py-1.5 ${mode === 'text' ? 'bg-ink-10 text-ink font-medium' : 'text-ink-45 hover:bg-ink-05'}`}
            >
              Textuel
            </button>
            <button
              onClick={() => setMode('visual')}
              className={`px-3 py-1.5 ${mode === 'visual' ? 'bg-ink-10 text-ink font-medium' : 'text-ink-45 hover:bg-ink-05'}`}
            >
              Visuel
            </button>
          </div>
          <button
            onClick={() => navigate(`/documents/${slug}`)}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-ink-05 text-ink-70"
          >
            Retour
          </button>
        </div>
      </div>

      {mode === 'text' ? (
        <DiffTextView lines={diff.lines} />
      ) : (
        <DiffVisualView oldBody={diff.v1_body} newBody={diff.v2_body} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add web/src/features/reader/DiffTextView.tsx web/src/features/reader/DiffVisualView.tsx web/src/features/reader/DiffPage.tsx
git commit -m "feat(version): add diff page with text and visual comparison views"
```

---

### Task 14: Add diff route to App.tsx

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add lazy import and route**

Add import at the top:

```tsx
const DiffPage = lazy(() => import('@/features/reader/DiffPage'))
```

Add route inside the authenticated routes (next to the existing document routes):

```tsx
<Route path="/documents/:slug/diff/:v1/:v2" element={<DiffPage />} />
```

- [ ] **Step 2: Verify it compiles**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat(version): add diff route to app router"
```

---

### Task 15: Admin retention config UI

**Files:**
- Modify: `web/src/features/admin/AdminPage.tsx`

- [ ] **Step 1: Add retention config section**

In AdminPage.tsx, add a new tab or section in the config area. Add state:

```tsx
const [maxVersions, setMaxVersions] = useState(50)
const [maxVersionsSaving, setMaxVersionsSaving] = useState(false)
```

In the useEffect that loads config, add:

```tsx
api.get<{ max_versions: number }>('/admin/config/max-versions').then((c) => setMaxVersions(c.max_versions)).catch(() => {})
```

Add a save handler:

```tsx
const saveMaxVersions = async () => {
  setMaxVersionsSaving(true)
  try {
    await api.put('/admin/config/max-versions', { max_versions: maxVersions })
  } catch { /* ignore */ }
  setMaxVersionsSaving(false)
}
```

Add the UI in the config section (near the freshness config):

```tsx
<div className="space-y-2">
  <h3 className="text-sm font-medium text-ink-70">Retention des versions</h3>
  <div className="flex items-center gap-2">
    <input
      type="number"
      min={1}
      value={maxVersions}
      onChange={(e) => setMaxVersions(Number(e.target.value))}
      className="w-24 border rounded px-2 py-1 text-sm"
    />
    <span className="text-sm text-ink-45">versions max par document</span>
    <button
      onClick={saveMaxVersions}
      disabled={maxVersionsSaving}
      className="px-3 py-1 text-sm bg-blue text-white rounded hover:bg-blue/90 disabled:opacity-50"
    >
      {maxVersionsSaving ? '...' : 'Enregistrer'}
    </button>
  </div>
</div>
```

- [ ] **Step 2: Verify it compiles**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/features/admin/AdminPage.tsx
git commit -m "feat(admin): add version retention config to admin panel"
```

---

### Task 16: Final build, deploy, and end-to-end test

- [ ] **Step 1: Build and deploy**

```bash
cd web && npm run build && cd ../docker && docker compose build plumenote-app && docker compose up -d plumenote-app
```

- [ ] **Step 2: End-to-end test**

1. Open a document in the reader
2. Click "Historique" → should show empty list
3. Click "Modifier" → edit the document → save
4. Go back to reader → click "Historique" → should show v1
5. Edit again → save → Historique shows v1 and v2
6. Select v1 and v2 checkboxes → click "Comparer"
7. Verify text diff view shows changes
8. Toggle to visual diff → verify side-by-side works
9. Click a version → verify preview with banner and restore button
10. Click restore → verify document reverts and new version created
11. Admin panel → verify retention config field exists and saves

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: address issues found during e2e testing"
```
