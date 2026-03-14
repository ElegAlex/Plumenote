# Folder Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a folder import feature with two modes (root→domains, domain→folders), browser folder/ZIP upload, interactive preview with exclusion, and real-time SSE progress.

**Architecture:** New backend endpoints handle ZIP analysis, async folder import with SSE progress, and root-documents listing. Frontend adds a "Dossier" tab to ImportPage with a 4-step flow (mode selection → preview tree → progress → results). Migration 14 makes `folder_id` nullable so documents can live at domain root.

**Tech Stack:** Go/Chi/pgx (backend), `archive/zip` (ZIP analysis), SSE (progress), React/Vite/Tailwind/shadcn (frontend), `webkitdirectory` API (browser folder selection)

**Spec:** `docs/superpowers/specs/2026-03-14-folder-import-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `migrations/000014_folder_id_nullable.up.sql` | Make `folder_id` nullable |
| `migrations/000014_folder_id_nullable.down.sql` | Reverse migration |
| `internal/importer/folder_import.go` | Folder import job logic: domain creation, tree building, file processing loop |
| `internal/importer/zip_analyzer.go` | ZIP analysis: read central directory, build tree |
| `internal/importer/sse.go` | SSE progress streaming, job registry |
| `internal/importer/sse_test.go` | Tests for SSE job registry |
| `internal/importer/folder_import_test.go` | Tests for folder import logic |
| `internal/importer/zip_analyzer_test.go` | Tests for ZIP analysis |
| `web/src/features/import/FolderImportTab.tsx` | Tab 2: folder import 4-step flow |
| `web/src/features/import/PreviewTree.tsx` | Interactive tree with checkboxes |
| `web/src/features/import/ImportProgress.tsx` | SSE progress bar + file status |
| `web/src/features/import/ImportResults.tsx` | Results summary with links |
| `web/src/lib/hooks/useFolderImport.ts` | React hooks for folder import API |

### Modified files
| File | Changes |
|------|---------|
| `internal/auth/token.go` | New exported `ParseTokenString` function for SSE auth fallback |
| `internal/importer/web_handler.go` | Mount new handlers, remove General folder fallback |
| `internal/folder/handler.go:131-148` | Fix `filterPublicFolders` for NULL folder_id |
| `internal/document/handlers.go:99-204` | Make folder_id optional in create/update/get/list |
| `internal/server/server.go:246-252` | Mount new import routes |
| `web/src/features/import/ImportPage.tsx` | Add tabs (Fichiers / Dossier) |
| `web/src/lib/api.ts` | Add `upload` method for FormData requests |
| `web/src/components/layout/FolderTree.tsx` | Fetch + display root documents |
| `web/src/features/home/DomainPage.tsx` | Root documents section |
| `web/src/features/editor/EditorPage.tsx:63-64` | Optional folder picker |
| `web/src/features/reader/Breadcrumb.tsx:29-36` | Handle null folderPath |
| `web/src/features/reader/ReaderPage.tsx` | Skip folder path fetch when folder_id is null |

---

## Chunk 1: Data Model & Existing Code Adaptation

### Task 1: Migration — folder_id nullable

**Files:**
- Create: `migrations/000014_folder_id_nullable.up.sql`
- Create: `migrations/000014_folder_id_nullable.down.sql`

- [ ] **Step 1: Create up migration**

```sql
-- migrations/000014_folder_id_nullable.up.sql
ALTER TABLE documents ALTER COLUMN folder_id DROP NOT NULL;
```

- [ ] **Step 2: Create down migration**

```sql
-- migrations/000014_folder_id_nullable.down.sql
UPDATE documents d
SET folder_id = (
  SELECT f.id FROM folders f
  WHERE f.domain_id = d.domain_id AND f.parent_id IS NULL
  ORDER BY f.position LIMIT 1
)
WHERE d.folder_id IS NULL;

ALTER TABLE documents ALTER COLUMN folder_id SET NOT NULL;
```

- [ ] **Step 3: Run migration**

```bash
docker exec plumenote-db psql -U plumenote -d plumenote -c "ALTER TABLE documents ALTER COLUMN folder_id DROP NOT NULL;"
docker exec plumenote-db psql -U plumenote -d plumenote -c "INSERT INTO schema_migrations (version, dirty) VALUES (14, false) ON CONFLICT (version) DO UPDATE SET dirty = false;"
```

Expected: `ALTER TABLE` / `INSERT 0 1`

- [ ] **Step 4: Verify**

```bash
docker exec plumenote-db psql -U plumenote -d plumenote -c "\d documents" | grep folder_id
```

Expected: `folder_id | uuid | |` (no NOT NULL)

- [ ] **Step 5: Commit**

```bash
git add migrations/000014_folder_id_nullable.up.sql migrations/000014_folder_id_nullable.down.sql
git commit -m "feat(migration): make folder_id nullable on documents"
```

---

### Task 2: Fix existing backend for nullable folder_id

**Files:**
- Modify: `internal/folder/handler.go:131-148` — filterPublicFolders
- Modify: `internal/document/handlers.go:99-204` — createDocument, updateDocument, getDocument, listDocuments
- Modify: `internal/importer/web_handler.go:75-78` — remove General folder fallback

**Context:** Read these files first:
- `internal/folder/handler.go` — find `filterPublicFolders` function, note the `folder_id::text` cast
- `internal/document/handlers.go` — find createDocument (folder_id required), updateDocument (folder_id handling), getDocument (folder path fetch), listDocuments (query builder)
- `internal/importer/web_handler.go` — find `getDefaultFolderID` calls in HandleImport and HandleImportBatch

- [ ] **Step 1: Fix filterPublicFolders in folder/handler.go**

Find the query in `filterPublicFolders` that does:
```sql
SELECT DISTINCT folder_id FROM documents WHERE domain_id = $1 AND visibility = 'public'
```

Change it to:
```sql
SELECT DISTINCT folder_id FROM documents WHERE domain_id = $1 AND visibility = 'public' AND folder_id IS NOT NULL
```

This prevents NULL folder_ids from appearing in the public folder set.

- [ ] **Step 2: Make folder_id optional in createDocument**

In `internal/document/handlers.go`, in the `createDocument` handler:

a) Change the request struct: `FolderID` field should use `*string` (pointer) instead of `string`:
```go
FolderID *string `json:"folder_id"`
```

b) Update the permission check: if `FolderID` is nil, skip folder permission check (user just needs domain access). If non-nil, check editor+ on the folder as before.

c) Update the INSERT query to use the nullable value:
```go
// Use pgx's nil-to-NULL mapping
var folderID *string
if req.FolderID != nil && *req.FolderID != "" {
    folderID = req.FolderID
}
```

Pass `folderID` (which may be nil → SQL NULL) to the INSERT.

- [ ] **Step 3: Handle nullable folder_id in updateDocument**

In `updateDocument`, allow `folder_id` to be set to `null` in the JSON body. Use `*string` pointer. When moving from a folder to root (folder_id going from non-nil to nil), check editor+ on the source folder.

- [ ] **Step 4: Handle nullable folder_id in getDocument**

In `getDocument`, the response includes folder path for breadcrumb. When `folder_id` is NULL:
- Skip the folder path query
- Return `folder_path: null` in the JSON response

Use `pgtype.UUID` or `*string` to scan the nullable `folder_id` from the database.

- [ ] **Step 5: Handle folder_id=null filter in listDocuments**

In `listDocuments` / `buildListQuery`, add support for a `folder_id=null` query parameter that filters documents where `folder_id IS NULL`. This allows fetching root documents for a domain.

```go
if folderID := r.URL.Query().Get("folder_id"); folderID == "null" {
    query += " AND d.folder_id IS NULL"
} else if folderID != "" {
    query += fmt.Sprintf(" AND d.folder_id = $%d", paramIdx)
    args = append(args, folderID)
    paramIdx++
}
```

- [ ] **Step 6: Remove General folder fallback in web_handler.go**

In `HandleImport` (around line 75-78) and `HandleImportBatch` (around line 176-178):

Remove the `getDefaultFolderID` call when `folderID == ""`. Instead, leave `folderID` as empty string.

Then in the INSERT query, convert empty `folderID` to SQL NULL:
```go
var folderIDParam any
if folderID != "" {
    folderIDParam = folderID
} else {
    folderIDParam = nil
}
```

Also update `processOneFile` to accept `*string` for folderID and pass nil when no folder.

- [ ] **Step 7: Build and test**

```bash
cd /home/alex/Documents/REPO/PLUMENOTE_REFONTE && go build ./...
```

Expected: No compilation errors.

- [ ] **Step 8: Commit**

```bash
git add internal/folder/handler.go internal/document/handlers.go internal/importer/web_handler.go
git commit -m "feat: support nullable folder_id in existing endpoints"
```

---

### Task 3: Root documents endpoint + sidebar/DomainPage integration

**Files:**
- Modify: `internal/document/handlers.go` — add HandleRootDocuments handler (domain-level read, not import)
- Modify: `internal/server/server.go` — mount route
- Modify: `web/src/components/layout/FolderTree.tsx` — fetch and display root documents
- Modify: `web/src/features/home/DomainPage.tsx` — root documents section

**Context:** Read:
- `internal/server/server.go` — find where domain routes are mounted (around line 233)
- `web/src/components/layout/FolderTree.tsx` — understand the component structure
- `web/src/features/home/DomainPage.tsx` — understand current layout

- [ ] **Step 1: Add HandleRootDocuments to document/handlers.go**

Add this handler in `internal/document/handlers.go` (not in importer — it's a domain-level read endpoint):

Note: This function lives in the document handler struct (e.g., `Handler`), not `WebHandler`. Adapt accordingly based on the existing document handler pattern.

```go
// HandleRootDocuments returns documents without a folder for a domain.
func (h *Handler) HandleRootDocuments(w http.ResponseWriter, r *http.Request) {
	domainID := chi.URLParam(r, "domainId")
	if domainID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "domainId is required"})
		return
	}

	// Build visibility filter
	visFilter := "AND d.visibility = 'public'"
	var args []any
	args = append(args, domainID)

	claims := auth.UserFromContext(r.Context())
	if claims != nil {
		visFilter = "" // authenticated users see all
	}

	rows, err := wh.deps.DB.Query(r.Context(), fmt.Sprintf(`
		SELECT d.id, d.title, d.slug, COALESCE(dt.name, '') AS type_name, d.updated_at
		FROM documents d
		LEFT JOIN document_types dt ON dt.id = d.type_id
		WHERE d.domain_id = $1 AND d.folder_id IS NULL %s
		ORDER BY d.title`, visFilter), args...)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "query failed"})
		return
	}
	defer rows.Close()

	type rootDoc struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		Slug      string `json:"slug"`
		TypeName  string `json:"type_name"`
		UpdatedAt string `json:"updated_at"`
	}
	var docs []rootDoc
	for rows.Next() {
		var d rootDoc
		var updatedAt time.Time
		if err := rows.Scan(&d.ID, &d.Title, &d.Slug, &d.TypeName, &updatedAt); err != nil {
			continue
		}
		d.UpdatedAt = updatedAt.Format(time.RFC3339)
		docs = append(docs, d)
	}
	if docs == nil {
		docs = []rootDoc{}
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{"documents": docs})
}
```

- [ ] **Step 2: Mount route in server.go**

In `internal/server/server.go`, find the domain folders route (around line 233-234). Add below:

```go
// Root documents (no folder) for a domain
r.Get("/api/domains/{domainId}/root-documents", importer.NewWebHandler(deps).HandleRootDocuments)
```

Note: This should use OptionalAuth middleware (same as the domain folders endpoint). Check what middleware the domain folders route uses and apply the same.

- [ ] **Step 3: Build and verify**

```bash
go build ./...
```

- [ ] **Step 4: Update FolderTree to show root documents**

In `web/src/components/layout/FolderTree.tsx`, after the folder tree is rendered, fetch and display root documents.

Add a `useQuery` call to fetch root documents:
```tsx
const { data: rootDocs } = useQuery({
  queryKey: ['root-documents', domainId],
  queryFn: () => api.get<{ documents: { id: string; title: string; slug: string }[] }>(
    `/domains/${domainId}/root-documents`
  ),
  enabled: !!domainId,
})
```

After the folder tree items, render root documents:
```tsx
{rootDocs?.documents?.map(doc => (
  <NavLink
    key={doc.id}
    to={`/documents/${doc.slug}`}
    className={({ isActive }) =>
      `flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-accent ${isActive ? 'bg-accent font-medium' : ''}`
    }
    style={{ paddingLeft: `${16}px` }}
  >
    <FileText className="h-4 w-4 shrink-0" />
    <span className="truncate">{doc.title}</span>
  </NavLink>
))}
```

Import `FileText` from `lucide-react`.

- [ ] **Step 5: Add root documents section to DomainPage**

In `web/src/features/home/DomainPage.tsx`, add a query for root documents and display them. Look at how the existing document list is rendered and follow the same pattern. Add a section titled "Documents (racine)" that lists documents without a folder.

- [ ] **Step 6: Commit**

```bash
git add internal/importer/web_handler.go internal/server/server.go web/src/components/layout/FolderTree.tsx web/src/features/home/DomainPage.tsx
git commit -m "feat: root documents endpoint + sidebar and DomainPage integration"
```

---

### Task 4: EditorPage & Breadcrumb — optional folder

**Files:**
- Modify: `web/src/features/editor/EditorPage.tsx:63-64`
- Modify: `web/src/features/reader/Breadcrumb.tsx:29-36`
- Modify: `web/src/features/reader/ReaderPage.tsx`

**Context:** Read:
- `web/src/features/editor/EditorPage.tsx` — find folder picker state and UI
- `web/src/features/reader/Breadcrumb.tsx` — find folderPath rendering
- `web/src/features/reader/ReaderPage.tsx` — find where folderPath is passed to Breadcrumb

- [ ] **Step 1: Make folder picker optional in EditorPage**

In `EditorPage.tsx`, find where `folderId` is validated as required before save. Remove the required validation. Add a "Aucun dossier (racine du domaine)" option at the top of the folder select:

```tsx
<option value="">Aucun dossier (racine du domaine)</option>
```

When saving, if `folderId` is empty, send `folder_id: null` in the API payload instead of omitting it.

- [ ] **Step 2: Handle null folderPath in Breadcrumb**

In `Breadcrumb.tsx`, the `folderPath` prop should be optional (it already is based on the `?` suffix). Verify that when `folderPath` is undefined or null, the folder segments are simply not rendered. The breadcrumb should show: Home > Domain > Document title.

- [ ] **Step 3: Handle null folder_id in ReaderPage**

In `ReaderPage.tsx`, find where the folder path is fetched. When the document's `folder_id` is null, skip the folder path fetch and pass `folderPath={undefined}` to Breadcrumb.

- [ ] **Step 4: Build frontend**

```bash
cd web && npm run build
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/editor/EditorPage.tsx web/src/features/reader/Breadcrumb.tsx web/src/features/reader/ReaderPage.tsx
git commit -m "feat: optional folder in editor and breadcrumb"
```

---

## Chunk 2: Backend — ZIP Analysis & SSE Progress

### Task 5: ZIP analyzer endpoint

**Files:**
- Create: `internal/importer/zip_analyzer.go`
- Create: `internal/importer/zip_analyzer_test.go`
- Modify: `internal/importer/web_handler.go` — add HandleAnalyzeZip
- Modify: `internal/server/server.go` — mount route

**Context:** The spec says to use `archive/zip` to read the central directory without extracting. The tree node structure is: `{name, path, type: "file"|"dir", size?, children?}`.

- [ ] **Step 1: Create zip_analyzer.go with tree types and analyzeZip function**

```go
// internal/importer/zip_analyzer.go
package importer

import (
	"archive/zip"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
)

const (
	maxZipSize  = 200 << 20 // 200 MB
	maxZipFiles = 1000
	maxZipRatio = 10 // zip bomb protection
)

// TreeNode represents a file or directory in the import preview tree.
type TreeNode struct {
	Name     string      `json:"name"`
	Path     string      `json:"path"`
	Type     string      `json:"type"` // "file" or "dir"
	Size     int64       `json:"size,omitempty"`
	Children []*TreeNode `json:"children,omitempty"`
}

type fileEntry struct {
	Path string
	Size int64
}

// analyzeZip reads the ZIP central directory and returns a tree of supported files.
func analyzeZip(zipPath string, maxSize int64) ([]*TreeNode, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	var entries []fileEntry
	var totalUncompressed uint64
	for _, f := range r.File {
		if f.FileInfo().IsDir() || isHidden(f.Name) {
			continue
		}
		ext := strings.ToLower(filepath.Ext(f.Name))
		if !isSupportedExtension(ext) {
			continue
		}
		entries = append(entries, fileEntry{
			Path: strings.TrimPrefix(f.Name, "/"),
			Size: int64(f.UncompressedSize64),
		})
		totalUncompressed += f.UncompressedSize64
	}
	if len(entries) > maxZipFiles {
		return nil, fmt.Errorf("too many files (%d, max %d)", len(entries), maxZipFiles)
	}
	if maxSize > 0 && totalUncompressed > uint64(maxSize)*uint64(maxZipRatio) {
		return nil, fmt.Errorf("uncompressed size exceeds safety limit")
	}

	return buildTreeFromPaths(entries), nil
}

// isHidden checks if any component of the path starts with '.'
func isHidden(path string) bool {
	for _, part := range strings.Split(path, "/") {
		if strings.HasPrefix(part, ".") {
			return true
		}
	}
	return false
}

```go
// buildTreeFromPaths builds a tree from a list of file paths with sizes.
func buildTreeFromPaths(files []fileEntry) []*TreeNode {
	rootMap := &TreeNode{Type: "dir", Children: []*TreeNode{}}
	for _, f := range files {
		parts := strings.Split(f.Path, "/")
		current := rootMap
		for i, part := range parts {
			if part == "" {
				continue
			}
			fullPath := strings.Join(parts[:i+1], "/")
			if i == len(parts)-1 {
				// Leaf file
				current.Children = append(current.Children, &TreeNode{
					Name: part, Path: fullPath, Type: "file", Size: f.Size,
				})
			} else {
				// Find or create dir
				found := false
				for _, child := range current.Children {
					if child.Type == "dir" && child.Name == part {
						current = child
						found = true
						break
					}
				}
				if !found {
					dir := &TreeNode{Name: part, Path: fullPath, Type: "dir", Children: []*TreeNode{}}
					current.Children = append(current.Children, dir)
					current = dir
				}
			}
		}
	}
	sortTree(rootMap.Children)
	return rootMap.Children
}

type fileEntry struct {
	Path string
	Size int64
}

func sortTree(nodes []*TreeNode) {
	sort.Slice(nodes, func(i, j int) bool {
		// Dirs first, then alphabetical
		if nodes[i].Type != nodes[j].Type {
			return nodes[i].Type == "dir"
		}
		return nodes[i].Name < nodes[j].Name
	})
	for _, n := range nodes {
		if n.Children != nil {
			sortTree(n.Children)
		}
	}
}
```

- [ ] **Step 2: Write test for analyzeZip**

Create `internal/importer/zip_analyzer_test.go`:

```go
package importer

import (
	"archive/zip"
	"os"
	"testing"
)

func TestBuildTreeFromPaths(t *testing.T) {
	files := []fileEntry{
		{Path: "CPAM/GOUV/proc.md", Size: 100},
		{Path: "CPAM/GOUV/guide.docx", Size: 200},
		{Path: "CPAM/tech.txt", Size: 50},
		{Path: "SCI/readme.md", Size: 30},
		{Path: "loose.txt", Size: 10},
	}
	tree := buildTreeFromPaths(files)

	if len(tree) != 3 { // CPAM dir, SCI dir, loose.txt file
		t.Fatalf("expected 3 root nodes, got %d", len(tree))
	}
	// Dirs first
	if tree[0].Name != "CPAM" || tree[0].Type != "dir" {
		t.Errorf("expected CPAM dir first, got %s %s", tree[0].Name, tree[0].Type)
	}
	if tree[1].Name != "SCI" || tree[1].Type != "dir" {
		t.Errorf("expected SCI dir second, got %s %s", tree[1].Name, tree[1].Type)
	}
	if tree[2].Name != "loose.txt" || tree[2].Type != "file" {
		t.Errorf("expected loose.txt file third, got %s %s", tree[2].Name, tree[2].Type)
	}
	// CPAM children: GOUV dir + tech.txt
	cpam := tree[0]
	if len(cpam.Children) != 2 {
		t.Fatalf("CPAM: expected 2 children, got %d", len(cpam.Children))
	}
}

func TestAnalyzeZip(t *testing.T) {
	// Create a test ZIP in temp
	tmpFile, err := os.CreateTemp("", "test-*.zip")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpFile.Name())

	w := zip.NewWriter(tmpFile)
	for _, name := range []string{"domain1/folder1/file.md", "domain1/root.txt", "domain2/doc.pdf", ".hidden/secret.md"} {
		fw, _ := w.Create(name)
		fw.Write([]byte("test content"))
	}
	w.Close()
	tmpFile.Close()

	tree, err := analyzeZip(tmpFile.Name(), maxZipSize)
	if err != nil {
		t.Fatal(err)
	}
	// Should have 2 dirs (domain1, domain2), no .hidden
	if len(tree) != 2 {
		t.Fatalf("expected 2 root nodes, got %d", len(tree))
	}
}
```

- [ ] **Step 3: Run tests**

```bash
cd /home/alex/Documents/REPO/PLUMENOTE_REFONTE && go test ./internal/importer/ -run TestBuildTree -v
go test ./internal/importer/ -run TestAnalyzeZip -v
```

Expected: PASS

- [ ] **Step 4: Add HandleAnalyzeZip to web_handler.go**

```go
// HandleAnalyzeZip handles POST /api/import/analyze-zip.
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

	// Save to temp
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
```

- [ ] **Step 5: Mount route in server.go**

Add to the authenticated import routes:
```go
r.Post("/api/import/analyze-zip", wh.HandleAnalyzeZip)
```

- [ ] **Step 6: Build**

```bash
go build ./...
```

- [ ] **Step 7: Commit**

```bash
git add internal/importer/zip_analyzer.go internal/importer/zip_analyzer_test.go internal/importer/web_handler.go internal/server/server.go
git commit -m "feat: ZIP analyzer endpoint for folder import preview"
```

---

### Task 6: Auth token parser + SSE progress infrastructure

**Files:**
- Create: `internal/auth/token.go` — exported `ParseTokenString` function
- Create: `internal/importer/sse.go`
- Create: `internal/importer/sse_test.go`

**Context:** `EventSource` doesn't support custom headers, so SSE needs JWT via query param. First, create an exported JWT parser in `internal/auth/`. Then create the SSE system: job registry (`sync.Map`), progress event type, handler, concurrency limiter.

- [ ] **Step 0: Create auth/token.go with exported ParseTokenString**

```go
// internal/auth/token.go
package auth

import "github.com/golang-jwt/jwt/v5"

// ParseTokenString parses and validates a JWT token string, returning the claims.
// Used for SSE endpoints where EventSource can't send Authorization headers.
func ParseTokenString(tokenStr, jwtSecret string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, err
	}
	return claims, nil
}
```

- [ ] **Step 1: Create sse.go**

```go
// internal/importer/sse.go
package importer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/go-chi/chi/v5"
)

const (
	maxConcurrentJobs = 3
	jobChannelSize    = 64
	jobCleanupDelay   = 60 * time.Second
)

var (
	activeJobs     sync.Map
	activeJobCount atomic.Int32
)

type importJob struct {
	ch       chan progressEvent
	cancel   context.CancelFunc
	authorID string
	done     atomic.Bool
}

type progressEvent struct {
	Type     string `json:"type"`               // "progress" or "done"
	Current  int    `json:"current,omitempty"`
	Total    int    `json:"total"`
	Filename string `json:"filename,omitempty"`
	Status   string `json:"status,omitempty"`    // "ok" or "error"
	Error    string `json:"error,omitempty"`
	// done-only fields
	Success        int      `json:"success,omitempty"`
	Failed         int      `json:"failed,omitempty"`
	DomainsCreated []string `json:"domains_created,omitempty"`
	FoldersCreated int      `json:"folders_created,omitempty"`
}

// registerJob creates a new import job and returns its ID and channel.
// Returns empty string if max concurrent jobs reached.
func registerJob(authorID string, cancel context.CancelFunc) (string, *importJob) {
	if activeJobCount.Load() >= maxConcurrentJobs {
		return "", nil
	}
	activeJobCount.Add(1)

	jobID := fmt.Sprintf("%x", time.Now().UnixNano()) + fmt.Sprintf("%04x", rand.Int31n(0xFFFF))
	job := &importJob{
		ch:       make(chan progressEvent, jobChannelSize),
		cancel:   cancel,
		authorID: authorID,
	}
	activeJobs.Store(jobID, job)
	return jobID, job
}

// sendProgress sends a progress event to the job channel (non-blocking).
func (j *importJob) sendProgress(evt progressEvent) {
	select {
	case j.ch <- evt:
	default:
		// Channel full, drop event (consumer too slow)
		log.Printf("import job: dropped progress event (channel full)")
	}
}

// finish sends the done event and schedules cleanup.
func (j *importJob) finish(evt progressEvent) {
	evt.Type = "done"
	j.sendProgress(evt)
	j.done.Store(true)
}

// cleanupJob removes the job from the registry after a delay.
func cleanupJob(jobID string) {
	time.Sleep(jobCleanupDelay)
	if val, ok := activeJobs.LoadAndDelete(jobID); ok {
		job := val.(*importJob)
		close(job.ch)
		activeJobCount.Add(-1)
	}
}

// HandleImportProgress handles GET /api/import/folder/progress/{jobId} — SSE stream.
func (wh *WebHandler) HandleImportProgress(w http.ResponseWriter, r *http.Request) {
	claims := auth.UserFromContext(r.Context())
	if claims == nil {
		// SSE fallback: EventSource can't send Authorization headers, accept token as query param
		if tokenStr := r.URL.Query().Get("token"); tokenStr != "" {
			claims, _ = auth.ParseTokenString(tokenStr, wh.deps.JWTSecret)
		}
	}
	if claims == nil {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "authentication required"})
		return
	}

	jobID := chi.URLParam(r, "jobId")
	val, ok := activeJobs.Load(jobID)
	if !ok {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "job not found"})
		return
	}
	job := val.(*importJob)

	if job.authorID != claims.UserID {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "not your job"})
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "streaming not supported"})
		return
	}

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			// Client disconnected
			job.cancel()
			return
		case evt, open := <-job.ch:
			if !open {
				return
			}
			data, _ := json.Marshal(evt)
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", evt.Type, data)
			flusher.Flush()
			if evt.Type == "done" {
				return
			}
		}
	}
}
```

- [ ] **Step 2: Write SSE tests (sse_test.go)**

```go
// internal/importer/sse_test.go
package importer

import (
	"context"
	"testing"
	"time"
)

func TestRegisterJob_RespectsLimit(t *testing.T) {
	// Reset state
	activeJobCount.Store(0)

	var cancels []context.CancelFunc
	for i := 0; i < maxConcurrentJobs; i++ {
		_, cancel := context.WithCancel(context.Background())
		cancels = append(cancels, cancel)
		jobID, job := registerJob("user1", cancel)
		if job == nil {
			t.Fatalf("job %d should have been created", i)
		}
		if jobID == "" {
			t.Fatalf("job %d should have a non-empty ID", i)
		}
		// Cleanup: simulate finish
		defer func(id string) {
			activeJobs.Delete(id)
			activeJobCount.Add(-1)
		}(jobID)
	}

	// Next one should be rejected
	_, cancel := context.WithCancel(context.Background())
	defer cancel()
	_, job := registerJob("user1", cancel)
	if job != nil {
		t.Fatal("should have rejected job beyond max concurrent limit")
	}
}

func TestSendProgress_NonBlocking(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	activeJobCount.Store(0)

	_, job := registerJob("user1", cancel)
	if job == nil {
		t.Fatal("job should have been created")
	}

	// Fill the channel
	for i := 0; i < jobChannelSize; i++ {
		job.sendProgress(progressEvent{Type: "progress", Current: i, Total: 100})
	}

	// This should not block (drops the event)
	done := make(chan bool, 1)
	go func() {
		job.sendProgress(progressEvent{Type: "progress", Current: 999, Total: 100})
		done <- true
	}()

	select {
	case <-done:
		// OK — non-blocking
	case <-time.After(time.Second):
		t.Fatal("sendProgress blocked on full channel")
	}

	_ = ctx
}
```

- [ ] **Step 3: Run tests**

```bash
go test ./internal/importer/ -run TestRegisterJob -v
go test ./internal/importer/ -run TestSendProgress -v
```

Expected: PASS

- [ ] **Step 4: Mount SSE route in server.go**

```go
r.Get("/api/import/folder/progress/{jobId}", wh.HandleImportProgress)
```

- [ ] **Step 5: Build**

```bash
go build ./...
```

- [ ] **Step 6: Commit**

```bash
git add internal/auth/token.go internal/importer/sse.go internal/importer/sse_test.go internal/server/server.go
git commit -m "feat: SSE progress infrastructure with auth token parser"
```

---

### Task 7: Folder import endpoint — core logic

**Files:**
- Create: `internal/importer/folder_import.go`
- Create: `internal/importer/folder_import_test.go`
- Modify: `internal/importer/web_handler.go` — add HandleFolderImport handler
- Modify: `internal/server/server.go` — mount route

**Context:** This is the main import endpoint. It:
1. Receives files + paths (directory mode) or ZIP + paths (ZIP mode)
2. Validates auth (admin for root mode, editor+ for domain mode)
3. Creates a job, returns job_id (HTTP 202)
4. In a goroutine: creates domains/folders, converts files, inserts documents, publishes progress

Read these for reference:
- `internal/importer/importer.go` — `resolveFolder`, `convertFile`, `insertDocument`, `slugify`, `titleFromFilename` functions
- `internal/folder/permissions.go` — `MaxFolderDepth`, `ResolveUserRole`

- [ ] **Step 1: Create folder_import.go with domain creation and path resolution**

```go
// internal/importer/folder_import.go
package importer

import (
	"context"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/alexmusic/plumenote/internal/folder"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxDirUploadSize = 500 << 20 // 500 MB
const maxDirFiles = 1000

// createDomainFromName finds or creates a domain by name.
func createDomainFromName(ctx context.Context, db *pgxpool.Pool, name string) (string, error) {
	slug := slugify(name)
	if slug == "" {
		slug = "unnamed"
	}

	// Try to find existing domain by slug
	var domainID string
	err := db.QueryRow(ctx,
		"SELECT id FROM domains WHERE slug = $1", slug,
	).Scan(&domainID)
	if err == nil {
		return domainID, nil
	}

	// Create new domain
	err = db.QueryRow(ctx,
		`INSERT INTO domains (name, slug) VALUES ($1, $2)
		 ON CONFLICT (slug) DO NOTHING RETURNING id`,
		name, slug,
	).Scan(&domainID)
	if err != nil {
		// Conflict — re-fetch
		err = db.QueryRow(ctx,
			"SELECT id FROM domains WHERE slug = $1", slug,
		).Scan(&domainID)
		if err != nil {
			return "", fmt.Errorf("failed to find or create domain %q: %w", name, err)
		}
	}
	return domainID, nil
}

// resolveImportPath determines the domain and folder path for a file path.
// In root mode: first path component is the domain, rest are folders.
// In domain mode: all path components (except filename) are folders.
func resolveImportPath(filePath, mode string) (domainDir string, folderParts []string) {
	dir := filepath.Dir(filePath)
	if dir == "." || dir == "" {
		// File at root level
		if mode == "root" {
			return "", nil // Will go to "Divers" domain
		}
		return "", nil // Domain root, no folder
	}

	parts := strings.Split(filepath.ToSlash(dir), "/")
	// Filter empty parts
	clean := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			clean = append(clean, p)
		}
	}

	if mode == "root" {
		domainDir = clean[0]
		if len(clean) > 1 {
			folderParts = clean[1:]
		}
		return domainDir, folderParts
	}

	// domain mode: all parts are folders
	return "", clean
}

// processImportJob runs the actual import in a goroutine.
func (wh *WebHandler) processImportJob(
	ctx context.Context,
	job *importJob,
	jobID string,
	mode string,
	domainID string, // only for domain mode
	typeID string,
	authorID string,
	files map[string]string, // relativePath → tempFilePath
	selectedPaths []string,
) {
	defer cleanupJob(jobID)

	total := len(selectedPaths)
	success := 0
	failed := 0
	domainsCreated := []string{}
	foldersCreated := 0
	cache := make(folderCache)

	// Domain cache for root mode
	domainCache := make(map[string]string) // dirName → domainID

	// Resolve typeID if empty
	if typeID == "" {
		var err error
		typeID, err = getDefaultTypeID(ctx, wh.deps.DB)
		if err != nil {
			log.Printf("folder import: failed to get default type: %v", err)
		}
	}

	for i, relPath := range selectedPaths {
		if ctx.Err() != nil {
			break // Cancelled
		}

		filename := filepath.Base(relPath)
		tmpPath, ok := files[relPath]
		if !ok {
			job.sendProgress(progressEvent{
				Type: "progress", Current: i + 1, Total: total,
				Filename: filename, Status: "error", Error: "file not found in upload",
			})
			failed++
			continue
		}

		// Determine domain and folder
		domainDir, folderParts := resolveImportPath(relPath, mode)
		fileDomainID := domainID

		if mode == "root" {
			if domainDir == "" {
				// Root-level file → "Divers" domain
				domainDir = "Divers"
			}
			if cached, ok := domainCache[domainDir]; ok {
				fileDomainID = cached
			} else {
				did, err := createDomainFromName(ctx, wh.deps.DB, domainDir)
				if err != nil {
					job.sendProgress(progressEvent{
						Type: "progress", Current: i + 1, Total: total,
						Filename: filename, Status: "error", Error: fmt.Sprintf("domain creation failed: %v", err),
					})
					failed++
					continue
				}
				domainCache[domainDir] = did
				fileDomainID = did
				domainsCreated = append(domainsCreated, domainDir)
			}
		}

		// Resolve folder (if any)
		var folderID *string
		if len(folderParts) > 0 {
			// Enforce max depth
			if len(folderParts) > folder.MaxFolderDepth {
				folderParts = folderParts[:folder.MaxFolderDepth]
			}
			fid, err := resolveFolder(ctx, wh.deps.DB, fileDomainID, authorID, folderParts, cache)
			if err != nil {
				job.sendProgress(progressEvent{
					Type: "progress", Current: i + 1, Total: total,
					Filename: filename, Status: "error", Error: fmt.Sprintf("folder creation failed: %v", err),
				})
				failed++
				continue
			}
			folderID = &fid
			foldersCreated++ // approximate — counts per file, not unique folders
		}

		// Convert file
		ext := strings.ToLower(filepath.Ext(filename))
		tiptapJSON, bodyText, err := convertFile(ctx, tmpPath, ext)
		if err != nil {
			job.sendProgress(progressEvent{
				Type: "progress", Current: i + 1, Total: total,
				Filename: filename, Status: "error", Error: fmt.Sprintf("conversion failed: %v", err),
			})
			failed++
			continue
		}

		// Insert document
		title := titleFromFilename(filename)
		slug := slugify(title)
		slug, err = wh.ensureUniqueSlug(ctx, slug, "")
		if err != nil {
			slug = fmt.Sprintf("%s-%d", slug, time.Now().UnixNano()%10000)
		}

		var docID string
		var folderIDParam any
		if folderID != nil {
			folderIDParam = *folderID
		}
		err = wh.deps.DB.QueryRow(ctx,
			`INSERT INTO documents (title, slug, body, body_text, domain_id, type_id, author_id, visibility, folder_id)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, 'dsi', $8)
			 RETURNING id`,
			title, slug, tiptapJSON, bodyText, fileDomainID, typeID, authorID, folderIDParam,
		).Scan(&docID)
		if err != nil {
			job.sendProgress(progressEvent{
				Type: "progress", Current: i + 1, Total: total,
				Filename: filename, Status: "error", Error: "database insert failed",
			})
			failed++
			continue
		}

		go wh.indexDocumentAsync(docID)
		success++

		job.sendProgress(progressEvent{
			Type: "progress", Current: i + 1, Total: total,
			Filename: filename, Status: "ok",
		})
	}

	// Deduplicate domains created
	seen := make(map[string]bool)
	uniqueDomains := []string{}
	for _, d := range domainsCreated {
		if !seen[d] {
			seen[d] = true
			uniqueDomains = append(uniqueDomains, d)
		}
	}

	job.finish(progressEvent{
		Total:          total,
		Success:        success,
		Failed:         failed,
		DomainsCreated: uniqueDomains,
		FoldersCreated: len(cache),
	})
}
```

Note: You'll need to add `"time"` to the imports.

- [ ] **Step 2: Add HandleFolderImport to web_handler.go**

```go
// HandleFolderImport handles POST /api/import/folder.
func (wh *WebHandler) HandleFolderImport(w http.ResponseWriter, r *http.Request) {
	claims := auth.UserFromContext(r.Context())
	if claims == nil {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "authentication required"})
		return
	}
	authorID := claims.UserID

	mode := r.FormValue("mode")
	if mode != "root" && mode != "domain" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "mode must be 'root' or 'domain'"})
		return
	}

	// Authorization check
	if mode == "root" && claims.Role != "admin" {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "root import requires admin"})
		return
	}

	domainID := r.FormValue("domain_id")
	if mode == "domain" && domainID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "domain_id required for domain mode"})
		return
	}

	typeID := r.FormValue("type_id")
	source := r.FormValue("source")
	if source != "directory" && source != "zip" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "source must be 'directory' or 'zip'"})
		return
	}

	// Parse multipart
	maxSize := int64(maxDirUploadSize)
	if source == "zip" {
		maxSize = maxZipSize
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxSize)
	if err := r.ParseMultipartForm(maxSize); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "request too large"})
		return
	}

	paths := r.Form["paths[]"]
	if len(paths) == 0 {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "no paths provided"})
		return
	}
	if len(paths) > maxDirFiles {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("too many files (%d, max %d)", len(paths), maxDirFiles)})
		return
	}

	// Save files to temp
	tempFiles := make(map[string]string) // relativePath → tmpPath
	var cleanupPaths []string

	if source == "directory" {
		// Match files by path
		fileHeaders := r.MultipartForm.File["files[]"]
		headerByPath := make(map[string]*multipart.FileHeader)
		for _, fh := range fileHeaders {
			// webkitRelativePath is sent as the filename by the browser
			headerByPath[fh.Filename] = fh
		}

		for _, p := range paths {
			fh, ok := headerByPath[p]
			if !ok {
				continue
			}
			ext := strings.ToLower(filepath.Ext(p))
			tmp, err := saveTempFile(fh, ext)
			if err != nil {
				continue
			}
			tempFiles[p] = tmp
			cleanupPaths = append(cleanupPaths, tmp)
		}
	} else {
		// ZIP mode: extract selected files
		zipFile, _, err := r.FormFile("file")
		if err != nil {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "missing ZIP file"})
			return
		}
		defer zipFile.Close()

		tmpZip, err := os.CreateTemp("", "plumenote-zip-*.zip")
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "temp file failed"})
			return
		}
		if _, err := tmpZip.ReadFrom(zipFile); err != nil {
			tmpZip.Close()
			os.Remove(tmpZip.Name())
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "failed to read ZIP"})
			return
		}
		tmpZip.Close()
		cleanupPaths = append(cleanupPaths, tmpZip.Name())

		// Extract selected files
		extracted, err := extractZipFiles(tmpZip.Name(), paths)
		if err != nil {
			httputil.WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"error": fmt.Sprintf("ZIP extraction failed: %v", err)})
			for _, p := range cleanupPaths { os.Remove(p) }
			return
		}
		for k, v := range extracted {
			tempFiles[k] = v
			cleanupPaths = append(cleanupPaths, v)
		}
	}

	// Register job
	ctx, cancel := context.WithCancel(context.Background())
	jobID, job := registerJob(authorID, cancel)
	if job == nil {
		cancel()
		for _, p := range cleanupPaths { os.Remove(p) }
		httputil.WriteJSON(w, http.StatusTooManyRequests, map[string]any{"error": "too many imports in progress, please retry later"})
		return
	}

	// Start processing in goroutine
	go func() {
		defer func() {
			for _, p := range cleanupPaths { os.Remove(p) }
		}()
		wh.processImportJob(ctx, job, jobID, mode, domainID, typeID, authorID, tempFiles, paths)
	}()

	httputil.WriteJSON(w, http.StatusAccepted, map[string]any{"job_id": jobID})
}

// saveTempFile saves a multipart file header to a temp file.
func saveTempFile(fh *multipart.FileHeader, ext string) (string, error) {
	src, err := fh.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	tmp, err := os.CreateTemp("", "plumenote-import-*"+ext)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(tmp, src); err != nil {
		tmp.Close()
		os.Remove(tmp.Name())
		return "", err
	}
	tmp.Close()
	return tmp.Name(), nil
}

// extractZipFiles extracts selected files from a ZIP to temp files.
func extractZipFiles(zipPath string, selectedPaths []string) (map[string]string, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	wanted := make(map[string]bool)
	for _, p := range selectedPaths {
		wanted[p] = true
	}

	result := make(map[string]string)
	for _, f := range r.File {
		path := strings.TrimPrefix(f.Name, "/")
		if !wanted[path] {
			continue
		}
		ext := strings.ToLower(filepath.Ext(path))
		rc, err := f.Open()
		if err != nil {
			continue
		}
		tmp, err := os.CreateTemp("", "plumenote-import-*"+ext)
		if err != nil {
			rc.Close()
			continue
		}
		if _, err := io.Copy(tmp, rc); err != nil {
			tmp.Close()
			rc.Close()
			os.Remove(tmp.Name())
			continue
		}
		tmp.Close()
		rc.Close()
		result[path] = tmp.Name()
	}
	return result, nil
}
```

Note: Add `"archive/zip"` and `"io"` to imports.

- [ ] **Step 3: Mount route in server.go**

```go
r.Post("/api/import/folder", wh.HandleFolderImport)
```

- [ ] **Step 4: Write test for resolveImportPath**

In `internal/importer/folder_import_test.go`:

```go
package importer

import "testing"

func TestResolveImportPath_RootMode(t *testing.T) {
	tests := []struct {
		path       string
		wantDomain string
		wantParts  []string
	}{
		{"CPAM/GOUV/file.md", "CPAM", []string{"GOUV"}},
		{"CPAM/file.md", "CPAM", nil},
		{"file.md", "", nil},
		{"CPAM/A/B/C/file.md", "CPAM", []string{"A", "B", "C"}},
	}
	for _, tt := range tests {
		domain, parts := resolveImportPath(tt.path, "root")
		if domain != tt.wantDomain {
			t.Errorf("path=%q: domain=%q, want %q", tt.path, domain, tt.wantDomain)
		}
		if len(parts) != len(tt.wantParts) {
			t.Errorf("path=%q: parts=%v, want %v", tt.path, parts, tt.wantParts)
		}
	}
}

func TestResolveImportPath_DomainMode(t *testing.T) {
	tests := []struct {
		path      string
		wantParts []string
	}{
		{"folder/file.md", []string{"folder"}},
		{"file.md", nil},
		{"A/B/file.md", []string{"A", "B"}},
	}
	for _, tt := range tests {
		_, parts := resolveImportPath(tt.path, "domain")
		if len(parts) != len(tt.wantParts) {
			t.Errorf("path=%q: parts=%v, want %v", tt.path, parts, tt.wantParts)
		}
	}
}
```

- [ ] **Step 5: Run tests**

```bash
go test ./internal/importer/ -run TestResolveImportPath -v
```

Expected: PASS

- [ ] **Step 6: Build**

```bash
go build ./...
```

- [ ] **Step 7: Commit**

```bash
git add internal/importer/folder_import.go internal/importer/folder_import_test.go internal/importer/web_handler.go internal/server/server.go
git commit -m "feat: folder import endpoint with domain creation and SSE progress"
```

---

## Chunk 3: Frontend — Folder Import UI

### Task 8: API upload method + React hooks for folder import

**Files:**
- Modify: `web/src/lib/api.ts` — add `upload` method
- Create: `web/src/lib/hooks/useFolderImport.ts`

**Context:** Read `web/src/lib/hooks/useImport.ts` and `web/src/lib/api.ts` to follow existing patterns.

- [ ] **Step 0: Add `upload` method to api.ts**

In `web/src/lib/api.ts`, add an `upload` method to the `api` object. This sends FormData **without** the `Content-Type: application/json` header (the browser sets the correct multipart boundary):

```typescript
upload: <T>(path: string, formData: FormData) => {
  const token = localStorage.getItem('token')
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(async (res) => {
    if (res.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      throw new ApiError(401, 'Non autorise')
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new ApiError(res.status, body.error || res.statusText)
    }
    return res.json() as Promise<T>
  })
},
```

Add it to the existing `api` object alongside `get`, `post`, `put`, `delete`.

- [ ] **Step 1: Create useFolderImport.ts**

```typescript
// web/src/lib/hooks/useFolderImport.ts
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'

interface AnalyzeZipResponse {
  tree: TreeNode[]
}

export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  children?: TreeNode[]
}

interface FolderImportResponse {
  job_id: string
}

export function useAnalyzeZip() {
  return useMutation({
    mutationFn: async (file: File): Promise<AnalyzeZipResponse> => {
      const fd = new FormData()
      fd.append('file', file)
      return api.upload<AnalyzeZipResponse>('/import/analyze-zip', fd)
    },
  })
}

export function useStartFolderImport() {
  return useMutation({
    mutationFn: async (params: {
      mode: 'root' | 'domain'
      domainId?: string
      typeId?: string
      source: 'directory' | 'zip'
      files?: File[]
      paths: string[]
      zipFile?: File
    }): Promise<FolderImportResponse> => {
      const fd = new FormData()
      fd.append('mode', params.mode)
      fd.append('source', params.source)
      if (params.domainId) fd.append('domain_id', params.domainId)
      if (params.typeId) fd.append('type_id', params.typeId)

      params.paths.forEach(p => fd.append('paths[]', p))

      if (params.source === 'directory' && params.files) {
        // Use stripped path (without root folder) as filename so server can match by paths[]
        params.files.forEach(f => {
          const strippedPath = f.webkitRelativePath.split('/').slice(1).join('/')
          fd.append('files[]', f, strippedPath)
        })
      } else if (params.source === 'zip' && params.zipFile) {
        fd.append('file', params.zipFile)
      }

      return api.upload<FolderImportResponse>('/import/folder', fd)
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/lib/api.ts web/src/lib/hooks/useFolderImport.ts
git commit -m "feat: API upload method + React hooks for folder import"
```

---

### Task 9: Preview tree component

**Files:**
- Create: `web/src/features/import/PreviewTree.tsx`

**Context:** This is a recursive tree with checkboxes. Each node can be checked/unchecked. Unchecking a folder unchecks all children. In root mode, first-level dirs are labeled "(Domaine)".

- [ ] **Step 1: Create PreviewTree.tsx**

```tsx
// web/src/features/import/PreviewTree.tsx
import { useState, useCallback, useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react'
import type { TreeNode } from '@/lib/hooks/useFolderImport'

interface PreviewTreeProps {
  tree: TreeNode[]
  mode: 'root' | 'domain'
  selected: Set<string>        // set of selected file paths
  onSelectionChange: (selected: Set<string>) => void
}

export default function PreviewTree({ tree, mode, selected, onSelectionChange }: PreviewTreeProps) {
  const stats = useMemo(() => {
    let domains = 0, folders = 0, files = 0
    function count(nodes: TreeNode[], depth: number) {
      for (const n of nodes) {
        if (n.type === 'dir') {
          if (mode === 'root' && depth === 0) domains++
          else folders++
          if (n.children) count(n.children, depth + 1)
        } else if (selected.has(n.path)) {
          files++
        }
      }
    }
    count(tree, 0)
    return { domains, folders, files }
  }, [tree, mode, selected])

  const toggleNode = useCallback((node: TreeNode) => {
    const newSelected = new Set(selected)
    const allFiles = getFilePaths(node)
    const allSelected = allFiles.every(f => newSelected.has(f))

    if (allSelected) {
      allFiles.forEach(f => newSelected.delete(f))
    } else {
      allFiles.forEach(f => newSelected.add(f))
    }
    onSelectionChange(newSelected)
  }, [selected, onSelectionChange])

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        {mode === 'root' && <>{stats.domains} domaine{stats.domains > 1 ? 's' : ''} · </>}
        {stats.folders} dossier{stats.folders > 1 ? 's' : ''} · {stats.files} fichier{stats.files > 1 ? 's' : ''}
      </p>
      <div className="border rounded-md p-2 max-h-96 overflow-y-auto">
        {tree.map(node => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            mode={mode}
            selected={selected}
            onToggle={toggleNode}
          />
        ))}
      </div>
    </div>
  )
}

function TreeItem({
  node, depth, mode, selected, onToggle,
}: {
  node: TreeNode
  depth: number
  mode: 'root' | 'domain'
  selected: Set<string>
  onToggle: (node: TreeNode) => void
}) {
  const [expanded, setExpanded] = useState(true)

  const allFiles = useMemo(() => getFilePaths(node), [node])
  const checkedCount = allFiles.filter(f => selected.has(f)).length
  const isChecked = checkedCount === allFiles.length && allFiles.length > 0
  const isIndeterminate = checkedCount > 0 && checkedCount < allFiles.length

  const isFile = node.type === 'file'
  const isDomain = mode === 'root' && depth === 0 && !isFile

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 hover:bg-accent rounded px-1"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {!isFile && node.children && node.children.length > 0 ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <Checkbox
          checked={isIndeterminate ? 'indeterminate' : isChecked}
          onCheckedChange={() => onToggle(node)}
          className="h-4 w-4"
        />
        {isFile ? (
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : expanded ? (
          <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="text-sm truncate">{node.name}</span>
        {isDomain && <span className="text-xs text-muted-foreground ml-1">(Domaine)</span>}
      </div>
      {!isFile && expanded && node.children?.map(child => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          mode={mode}
          selected={selected}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

function getFilePaths(node: TreeNode): string[] {
  if (node.type === 'file') return [node.path]
  if (!node.children) return []
  return node.children.flatMap(getFilePaths)
}
```

- [ ] **Step 2: Build frontend**

```bash
cd web && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/features/import/PreviewTree.tsx
git commit -m "feat: interactive preview tree component for folder import"
```

---

### Task 10: Progress & results components

**Files:**
- Create: `web/src/features/import/ImportProgress.tsx`
- Create: `web/src/features/import/ImportResults.tsx`

- [ ] **Step 1: Create ImportProgress.tsx**

```tsx
// web/src/features/import/ImportProgress.tsx
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface ProgressEvent {
  type: 'progress' | 'done'
  current?: number
  total: number
  filename?: string
  status?: string
  error?: string
  success?: number
  failed?: number
  domains_created?: string[]
  folders_created?: number
}

interface ImportProgressProps {
  jobId: string
  onDone: (result: ProgressEvent) => void
  onError?: (filename: string, error: string) => void
}

export default function ImportProgress({ jobId, onDone, onError }: ImportProgressProps) {
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const url = `/api/import/folder/progress/${jobId}?token=${token}`
    const source = new EventSource(url)

    source.addEventListener('progress', (e) => {
      const data: ProgressEvent = JSON.parse(e.data)
      setEvents(prev => [...prev, data])
      setCurrent(data.current || 0)
      setTotal(data.total)
      if (data.status === 'error' && data.filename && data.error && onError) {
        onError(data.filename, data.error)
      }
    })

    source.addEventListener('done', (e) => {
      const data: ProgressEvent = JSON.parse(e.data)
      source.close()
      onDone(data)
    })

    source.onerror = () => {
      source.close()
    }

    // Warn before page close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      source.close()
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [jobId, onDone])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [events])

  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Import en cours...</h3>
      <Progress value={pct} className="mb-2" />
      <p className="text-sm text-muted-foreground mb-3">{current}/{total} fichiers</p>
      <div ref={scrollRef} className="border rounded-md p-2 max-h-64 overflow-y-auto space-y-1">
        {events.map((evt, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            {evt.status === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            ) : evt.status === 'error' ? (
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            )}
            <span className="truncate">{evt.filename}</span>
            {evt.error && <span className="text-red-500 text-xs">— {evt.error}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
```

Note: SSE with auth token — `EventSource` doesn't support custom headers. Two options: (a) pass token as query param and handle on server, or (b) use `fetch` with `ReadableStream`. Option (a) is simpler. On the server side, in `HandleImportProgress`, also check `r.URL.Query().Get("token")` as a fallback for the Bearer header. Add this to the SSE handler:

```go
// In HandleImportProgress, at the top:
if claims == nil {
    // Try query param fallback for SSE
    tokenStr := r.URL.Query().Get("token")
    if tokenStr != "" {
        // Parse and validate JWT manually
        claims, _ = auth.ParseToken(tokenStr, wh.deps.JWTSecret)
    }
}
```

- [ ] **Step 2: Create ImportResults.tsx**

```tsx
// web/src/features/import/ImportResults.tsx
import { Link } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImportResultsProps {
  result: {
    total: number
    success?: number
    failed?: number
    domains_created?: string[]
    folders_created?: number
  }
  errors: { filename: string; error: string }[]
  onReset: () => void
}

export default function ImportResults({ result, errors, onReset }: ImportResultsProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        Import terminé
      </h3>
      <p className="text-sm mb-4">
        {result.success} succès · {result.failed} échec{(result.failed || 0) > 1 ? 's' : ''}
      </p>

      {result.domains_created && result.domains_created.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-1">Domaines créés :</p>
          <ul className="text-sm space-y-1">
            {result.domains_created.map(name => (
              <li key={name}>→ {name}</li>
            ))}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-1">Fichiers en erreur :</p>
          <ul className="text-sm space-y-1">
            {errors.map((e, i) => (
              <li key={i} className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <span>{e.filename}</span>
                <span className="text-muted-foreground">— {e.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button onClick={onReset} variant="outline">Nouvel import</Button>
    </div>
  )
}
```

- [ ] **Step 3: Build frontend**

```bash
cd web && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web/src/features/import/ImportProgress.tsx web/src/features/import/ImportResults.tsx
git commit -m "feat: import progress and results components"
```

---

### Task 11: Folder import tab — main flow component

**Files:**
- Create: `web/src/features/import/FolderImportTab.tsx`
- Modify: `web/src/features/import/ImportPage.tsx`

**Context:** Read `web/src/features/import/ImportPage.tsx` to understand the current component structure, how domains/types are fetched, and the existing styling.

The FolderImportTab implements the 4-step flow:
1. Mode & source selection
2. Preview tree with exclusion
3. Progress (SSE)
4. Results

- [ ] **Step 1: Create FolderImportTab.tsx**

```tsx
// web/src/features/import/FolderImportTab.tsx
import { useState, useCallback, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FolderUp, FileArchive } from 'lucide-react'
import api from '@/lib/api'
import { useAnalyzeZip, useStartFolderImport, type TreeNode } from '@/lib/hooks/useFolderImport'
import PreviewTree from './PreviewTree'
import ImportProgress from './ImportProgress'
import ImportResults from './ImportResults'

const SUPPORTED_EXT = ['.doc', '.docx', '.pdf', '.txt', '.md']

type Step = 'select' | 'preview' | 'progress' | 'results'

export default function FolderImportTab() {
  const [step, setStep] = useState<Step>('select')
  const [mode, setMode] = useState<'root' | 'domain'>('domain')
  const [domainId, setDomainId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [tree, setTree] = useState<TreeNode[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [files, setFiles] = useState<File[]>([])
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [source, setSource] = useState<'directory' | 'zip'>('directory')
  const [jobId, setJobId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [errors, setErrors] = useState<{ filename: string; error: string }[]>([])
  const dirInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  const { data: domains } = useQuery({
    queryKey: ['domains'],
    queryFn: () => api.get<any[]>('/domains'),
  })

  const { data: docTypes } = useQuery({
    queryKey: ['document-types'],
    queryFn: () => api.get<any[]>('/document-types'),
  })

  const analyzeZip = useAnalyzeZip()
  const startImport = useStartFolderImport()

  // Build tree from webkitdirectory files
  const handleDirectorySelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || [])
    const supported = fileList.filter(f => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase()
      return SUPPORTED_EXT.includes(ext) && !f.webkitRelativePath.split('/').some(p => p.startsWith('.'))
    })

    // Build tree from webkitRelativePath
    const entries = supported.map(f => ({
      path: f.webkitRelativePath.split('/').slice(1).join('/'), // Remove root folder name
      size: f.size,
    }))

    const treeNodes = buildClientTree(entries)
    setTree(treeNodes)
    setFiles(supported)
    setSource('directory')
    // Select all by default
    setSelected(new Set(entries.map(e => e.path)))
    setStep('preview')
  }, [])

  const handleZipSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setZipFile(file)
    setSource('zip')
    try {
      const result = await analyzeZip.mutateAsync(file)
      setTree(result.tree)
      // Select all files by default
      const allPaths = getAllFilePaths(result.tree)
      setSelected(new Set(allPaths))
      setStep('preview')
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'analyse du ZIP')
    }
  }, [analyzeZip])

  const handleStartImport = useCallback(async () => {
    const paths = Array.from(selected)
    try {
      const resp = await startImport.mutateAsync({
        mode,
        domainId: mode === 'domain' ? domainId : undefined,
        typeId: typeId || undefined,
        source,
        paths,
        files: source === 'directory' ? files.filter(f => {
          const relPath = f.webkitRelativePath.split('/').slice(1).join('/')
          return selected.has(relPath)
        }) : undefined,
        zipFile: source === 'zip' ? zipFile! : undefined,
      })
      setJobId(resp.job_id)
      setStep('progress')
    } catch (err: any) {
      alert(err.message || 'Erreur lors du lancement de l\'import')
    }
  }, [mode, domainId, typeId, source, files, zipFile, selected, startImport])

  // Collect errors from progress events via a ref (updated by ImportProgress)
  const errorsRef = useRef<{ filename: string; error: string }[]>([])

  const handleProgressError = useCallback((filename: string, error: string) => {
    errorsRef.current.push({ filename, error })
  }, [])

  const handleDone = useCallback((doneEvt: any) => {
    setResult(doneEvt)
    setErrors(errorsRef.current)
    setStep('results')
  }, [])

  const handleReset = useCallback(() => {
    setStep('select')
    setTree([])
    setSelected(new Set())
    setFiles([])
    setZipFile(null)
    setJobId('')
    setResult(null)
    setErrors([])
  }, [])

  return (
    <div className="space-y-6">
      {step === 'select' && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Mode d'import</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="root" id="mode-root" />
                <Label htmlFor="mode-root">Importer des domaines (racine)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="domain" id="mode-domain" />
                <Label htmlFor="mode-domain">Importer dans un domaine existant</Label>
              </div>
            </RadioGroup>
            {mode === 'root' && (
              <p className="text-xs text-muted-foreground mt-1">
                Les sous-dossiers de premier niveau deviendront des domaines.
              </p>
            )}
          </div>

          {mode === 'domain' && (
            <div>
              <Label>Domaine</Label>
              <Select value={domainId} onValueChange={setDomainId}>
                <SelectTrigger><SelectValue placeholder="Choisir un domaine" /></SelectTrigger>
                <SelectContent>
                  {domains?.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Type de document (optionnel)</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger><SelectValue placeholder="Type par défaut" /></SelectTrigger>
              <SelectContent>
                {docTypes?.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <input
              ref={dirInputRef}
              type="file"
              {...{ webkitdirectory: '', directory: '' } as any}
              multiple
              className="hidden"
              onChange={handleDirectorySelect}
            />
            <Button variant="outline" onClick={() => dirInputRef.current?.click()}>
              <FolderUp className="h-4 w-4 mr-2" />
              Sélectionner un dossier
            </Button>

            <input
              ref={zipInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleZipSelect}
            />
            <Button variant="outline" onClick={() => zipInputRef.current?.click()}>
              <FileArchive className="h-4 w-4 mr-2" />
              Uploader un ZIP
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Aperçu de l'import</h3>
          <PreviewTree tree={tree} mode={mode} selected={selected} onSelectionChange={setSelected} />
          <div className="flex gap-3">
            <Button onClick={handleStartImport} disabled={selected.size === 0 || startImport.isPending}>
              Lancer l'import ({selected.size} fichiers)
            </Button>
            <Button variant="outline" onClick={() => setStep('select')}>Retour</Button>
          </div>
        </div>
      )}

      {step === 'progress' && jobId && (
        <ImportProgress jobId={jobId} onDone={handleDone} onError={handleProgressError} />
      )}

      {step === 'results' && result && (
        <ImportResults result={result} errors={errors} onReset={handleReset} />
      )}
    </div>
  )
}

// Build tree from flat file entries (client-side, for webkitdirectory)
function buildClientTree(entries: { path: string; size: number }[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', type: 'dir', children: [] }
  for (const entry of entries) {
    const parts = entry.path.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const fullPath = parts.slice(0, i + 1).join('/')
      if (i === parts.length - 1) {
        current.children!.push({ name: part, path: fullPath, type: 'file', size: entry.size })
      } else {
        let dir = current.children!.find(c => c.type === 'dir' && c.name === part)
        if (!dir) {
          dir = { name: part, path: fullPath, type: 'dir', children: [] }
          current.children!.push(dir)
        }
        current = dir
      }
    }
  }
  sortClientTree(root.children!)
  return root.children!
}

function sortClientTree(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const n of nodes) {
    if (n.children) sortClientTree(n.children)
  }
}

function getAllFilePaths(nodes: TreeNode[]): string[] {
  const paths: string[] = []
  for (const n of nodes) {
    if (n.type === 'file') paths.push(n.path)
    if (n.children) paths.push(...getAllFilePaths(n.children))
  }
  return paths
}
```

- [ ] **Step 2: Add tabs to ImportPage.tsx**

In `web/src/features/import/ImportPage.tsx`, wrap the existing content in a tab structure:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import FolderImportTab from './FolderImportTab'

// In the component body, wrap existing file upload in a Tabs component:
<Tabs defaultValue="files">
  <TabsList>
    <TabsTrigger value="files">Fichiers</TabsTrigger>
    <TabsTrigger value="folder">Dossier</TabsTrigger>
  </TabsList>
  <TabsContent value="files">
    {/* existing ImportPage content goes here */}
  </TabsContent>
  <TabsContent value="folder">
    <FolderImportTab />
  </TabsContent>
</Tabs>
```

Keep all existing file import logic inside the "files" tab.

- [ ] **Step 3: Check that shadcn Tabs component exists**

```bash
ls web/src/components/ui/tabs.tsx
```

If not present, install it:
```bash
cd web && npx shadcn@latest add tabs
```

Also verify that RadioGroup, Checkbox, Select, and Progress components exist. Install any missing ones.

- [ ] **Step 4: Build frontend**

```bash
cd web && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add web/src/features/import/FolderImportTab.tsx web/src/features/import/ImportPage.tsx web/src/components/ui/
git commit -m "feat: folder import tab with 4-step flow (mode, preview, progress, results)"
```

---

## Chunk 4: Final Integration & Polish

### Task 12: End-to-end test

**Files:** No new files — this is a manual/integration test task.

- [ ] **Step 1: Build everything**

```bash
cd /home/alex/Documents/REPO/PLUMENOTE_REFONTE && go build ./... && cd web && npm run build
```

- [ ] **Step 2: Run Go tests**

```bash
cd /home/alex/Documents/REPO/PLUMENOTE_REFONTE && go test ./internal/importer/ -v
```

- [ ] **Step 3: Start the app and test manually**

```bash
make dev
```

Test scenarios:
1. Go to `/import`, verify tabs "Fichiers" and "Dossier" appear
2. In "Dossier" tab, select "Importer dans un domaine existant", pick a domain
3. Click "Sélectionner un dossier", choose a test folder with subdirectories
4. Verify the preview tree shows the correct hierarchy with checkboxes
5. Uncheck some files/folders, verify counters update
6. Click "Lancer l'import", verify progress bar and per-file statuses appear
7. Verify the import completes with correct counts
8. Check the sidebar — root documents should appear below folders
9. Check DomainPage — root documents section should appear
10. Test root mode (admin only): select a folder with multiple subdirs, verify domains are created

- [ ] **Step 4: Fix any issues found during testing**

- [ ] **Step 5: Final commit**

```bash
git add -A && git commit -m "fix: integration fixes for folder import"
```
