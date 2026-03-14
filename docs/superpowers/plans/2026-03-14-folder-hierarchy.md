# Folder Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hierarchical folders within domains, with role-based permissions (reader/editor/manager) and inheritance.

**Architecture:** New `folders` and `folder_permissions` tables. New `internal/folder` Go package with CRUD handlers and permission resolution. Frontend gets collapsible folder tree in sidebar and a FolderPage. Documents gain a required `folder_id` field.

**Tech Stack:** Go (pgx, Chi), React (Vite, Tailwind, Lucide icons), PostgreSQL (recursive CTEs for tree operations).

**Spec:** `docs/superpowers/specs/2026-03-14-folder-hierarchy-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `migrations/000013_folders.up.sql` | Create tables, backfill existing docs |
| `migrations/000013_folders.down.sql` | Reverse migration |
| `internal/folder/handler.go` | Folder CRUD HTTP handlers |
| `internal/folder/permissions.go` | Permission resolution + helpers |
| `internal/folder/router.go` | Chi router for folder endpoints |
| `web/src/components/layout/FolderTree.tsx` | Sidebar folder tree (recursive) |
| `web/src/features/folder/FolderPage.tsx` | Folder detail page with documents |
| `web/src/features/folder/DeleteFolderModal.tsx` | Cascade delete confirmation |
| `web/src/features/folder/FolderPermissionsModal.tsx` | Permission management modal |
| `web/src/features/folder/CreateFolderModal.tsx` | Create/rename folder modal |

### Modified files
| File | Changes |
|------|---------|
| `internal/server/server.go` | Mount folder router at `/api/folders`, `/api/domains/{id}/folders` |
| `internal/document/handlers.go` | Add `folder_id` to create/update, permission checks |
| `web/src/components/layout/Sidebar.tsx` | Add chevron toggles, render FolderTree |
| `web/src/features/reader/Breadcrumb.tsx` | Support folder path in breadcrumb |
| `web/src/features/editor/EditorPage.tsx` | Add folder picker (required) |
| `web/src/App.tsx` | Add FolderPage route |

---

## Chunk 1: Backend — Migration + Folder Module

### Task 1: Migration

**Files:**
- Create: `migrations/000013_folders.up.sql`
- Create: `migrations/000013_folders.down.sql`

- [ ] **Step 1: Write up migration**

```sql
-- migrations/000013_folders.up.sql

-- 1. Enum type for folder roles
CREATE TYPE folder_role AS ENUM ('reader', 'editor', 'manager');

-- 2. Folders table
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (parent_id != id)
);

-- Slug uniqueness: separate indexes for root vs child (NULL-safe)
CREATE UNIQUE INDEX idx_folders_unique_root
  ON folders(domain_id, slug) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX idx_folders_unique_child
  ON folders(domain_id, parent_id, slug) WHERE parent_id IS NOT NULL;

CREATE INDEX idx_folders_domain ON folders(domain_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);

-- 3. Folder permissions table
CREATE TABLE folder_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role folder_role NOT NULL,
    UNIQUE(folder_id, user_id)
);
CREATE INDEX idx_folder_perms_folder ON folder_permissions(folder_id);
CREATE INDEX idx_folder_perms_user ON folder_permissions(user_id);

-- 4. Add folder_id to documents (nullable initially)
ALTER TABLE documents ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE RESTRICT;

-- 5. Create "General" root folder for each existing domain and backfill
DO $$
DECLARE
    d RECORD;
    folder_uuid UUID;
BEGIN
    FOR d IN SELECT id FROM domains LOOP
        INSERT INTO folders (name, slug, domain_id, position)
        VALUES ('General', 'general', d.id, 0)
        RETURNING id INTO folder_uuid;

        UPDATE documents SET folder_id = folder_uuid WHERE domain_id = d.id;

        -- Grant manager to all authors in this domain
        INSERT INTO folder_permissions (folder_id, user_id, role)
        SELECT DISTINCT folder_uuid, author_id, 'manager'
        FROM documents WHERE domain_id = d.id
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- 6. Make folder_id NOT NULL
ALTER TABLE documents ALTER COLUMN folder_id SET NOT NULL;
CREATE INDEX idx_documents_folder ON documents(folder_id);
```

- [ ] **Step 2: Write down migration**

```sql
-- migrations/000013_folders.down.sql
DROP INDEX IF EXISTS idx_documents_folder;
ALTER TABLE documents DROP COLUMN IF EXISTS folder_id;
DROP TABLE IF EXISTS folder_permissions;
DROP TABLE IF EXISTS folders;
DROP TYPE IF EXISTS folder_role;
```

- [ ] **Step 3: Apply migration**

```bash
docker exec -i plumenote-db psql -U plumenote -d plumenote < migrations/000013_folders.up.sql
```

Expected: no errors.

- [ ] **Step 4: Verify**

```bash
docker exec plumenote-db psql -U plumenote -d plumenote -c "\d folders"
docker exec plumenote-db psql -U plumenote -d plumenote -c "SELECT count(*) FROM folders"
docker exec plumenote-db psql -U plumenote -d plumenote -c "SELECT count(*) FROM documents WHERE folder_id IS NULL"
```

Expected: table exists, one folder per domain, zero null folder_ids.

- [ ] **Step 5: Commit**

```bash
git add migrations/000013_folders.up.sql migrations/000013_folders.down.sql
git commit -m "feat(db): add folders and folder_permissions tables with backfill"
```

---

### Task 2: Folder permission resolution

**Files:**
- Create: `internal/folder/permissions.go`

- [ ] **Step 1: Write permissions.go**

```go
package folder

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxFolderDepth = 10

// FolderRole represents a permission level on a folder.
type FolderRole string

const (
	RoleReader  FolderRole = "reader"
	RoleEditor  FolderRole = "editor"
	RoleManager FolderRole = "manager"
)

// RoleAtLeast checks if role meets the minimum required level.
func RoleAtLeast(role FolderRole, minimum FolderRole) bool {
	levels := map[FolderRole]int{RoleReader: 1, RoleEditor: 2, RoleManager: 3}
	return levels[role] >= levels[minimum]
}

// ResolveUserRole walks from folderID up to root and returns the first explicit permission.
// Returns "" if no permission found. Admins get "manager" automatically.
func ResolveUserRole(ctx context.Context, db *pgxpool.Pool, folderID, userID, userRole string) FolderRole {
	if userRole == "admin" {
		return RoleManager
	}

	// Walk up the tree using a recursive CTE, limited to maxFolderDepth
	rows, err := db.Query(ctx, `
		WITH RECURSIVE ancestors AS (
			SELECT id, parent_id, 1 AS depth FROM folders WHERE id = $1
			UNION ALL
			SELECT f.id, f.parent_id, a.depth + 1
			FROM folders f JOIN ancestors a ON f.id = a.parent_id
			WHERE a.depth < $3
		)
		SELECT fp.role
		FROM ancestors a
		JOIN folder_permissions fp ON fp.folder_id = a.id AND fp.user_id = $2
		ORDER BY a.depth ASC
		LIMIT 1
	`, folderID, userID, maxFolderDepth)
	if err != nil {
		return ""
	}
	defer rows.Close()

	if rows.Next() {
		var role FolderRole
		if err := rows.Scan(&role); err == nil {
			return role
		}
	}
	return ""
}

// ResolveUserRoleTx is like ResolveUserRole but works within a transaction.
func ResolveUserRoleTx(ctx context.Context, tx pgx.Tx, folderID, userID, userRole string) FolderRole {
	if userRole == "admin" {
		return RoleManager
	}

	rows, err := tx.Query(ctx, `
		WITH RECURSIVE ancestors AS (
			SELECT id, parent_id, 1 AS depth FROM folders WHERE id = $1
			UNION ALL
			SELECT f.id, f.parent_id, a.depth + 1
			FROM folders f JOIN ancestors a ON f.id = a.parent_id
			WHERE a.depth < $3
		)
		SELECT fp.role
		FROM ancestors a
		JOIN folder_permissions fp ON fp.folder_id = a.id AND fp.user_id = $2
		ORDER BY a.depth ASC
		LIMIT 1
	`, folderID, userID, maxFolderDepth)
	if err != nil {
		return ""
	}
	defer rows.Close()

	if rows.Next() {
		var role FolderRole
		if err := rows.Scan(&role); err == nil {
			return role
		}
	}
	return ""
}

// BatchResolveRoles fetches all folder_permissions for a user in a domain.
// Returns map[folderID]role for explicit permissions only. Caller resolves inheritance in-memory.
func BatchResolveRoles(ctx context.Context, db *pgxpool.Pool, domainID, userID string) (map[string]FolderRole, error) {
	rows, err := db.Query(ctx, `
		SELECT fp.folder_id, fp.role
		FROM folder_permissions fp
		JOIN folders f ON f.id = fp.folder_id
		WHERE f.domain_id = $1 AND fp.user_id = $2
	`, domainID, userID)
	if err != nil {
		return nil, fmt.Errorf("batch resolve: %w", err)
	}
	defer rows.Close()

	result := make(map[string]FolderRole)
	for rows.Next() {
		var fid string
		var role FolderRole
		if err := rows.Scan(&fid, &role); err != nil {
			continue
		}
		result[fid] = role
	}
	return result, nil
}

// FolderDepth returns the depth of a folder (0 for root).
func FolderDepth(ctx context.Context, db *pgxpool.Pool, folderID string) (int, error) {
	var depth int
	err := db.QueryRow(ctx, `
		WITH RECURSIVE ancestors AS (
			SELECT id, parent_id, 0 AS depth FROM folders WHERE id = $1
			UNION ALL
			SELECT f.id, f.parent_id, a.depth + 1
			FROM folders f JOIN ancestors a ON f.id = a.parent_id
		)
		SELECT MAX(depth) FROM ancestors
	`, folderID).Scan(&depth)
	return depth, err
}

// MaxDescendantDepth returns the max depth in the subtree below a folder.
func MaxDescendantDepth(ctx context.Context, db *pgxpool.Pool, folderID string) (int, error) {
	var depth int
	err := db.QueryRow(ctx, `
		WITH RECURSIVE descendants AS (
			SELECT id, 0 AS depth FROM folders WHERE parent_id = $1
			UNION ALL
			SELECT f.id, d.depth + 1
			FROM folders f JOIN descendants d ON f.parent_id = d.id
		)
		SELECT COALESCE(MAX(depth), -1) FROM descendants
	`, folderID).Scan(&depth)
	return depth + 1, err // +1 because we count the folder itself
}

// IsDescendant checks if candidateAncestorID is an ancestor of folderID.
func IsDescendant(ctx context.Context, db *pgxpool.Pool, folderID, candidateAncestorID string) (bool, error) {
	var found bool
	err := db.QueryRow(ctx, `
		WITH RECURSIVE ancestors AS (
			SELECT parent_id FROM folders WHERE id = $1
			UNION ALL
			SELECT f.parent_id FROM folders f JOIN ancestors a ON f.id = a.parent_id
			WHERE a.parent_id IS NOT NULL
		)
		SELECT EXISTS(SELECT 1 FROM ancestors WHERE parent_id = $2)
	`, folderID, candidateAncestorID).Scan(&found)
	return found, err
}
```

- [ ] **Step 2: Verify it compiles**

```bash
go build ./internal/folder/
```

- [ ] **Step 3: Commit**

```bash
git add internal/folder/permissions.go
git commit -m "feat(folder): add permission resolution with CTE ancestor walk"
```

---

### Task 3: Folder CRUD handlers

**Files:**
- Create: `internal/folder/handler.go`

- [ ] **Step 1: Write handler.go**

```go
package folder

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

type handler struct {
	deps *model.Deps
}

func getUserID(ctx context.Context) string {
	if v, ok := ctx.Value("user_id").(string); ok {
		return v
	}
	return ""
}

func getUserRole(ctx context.Context) string {
	if v, ok := ctx.Value("role").(string); ok {
		return v
	}
	return ""
}

// --- Tree types ---

type folderNode struct {
	ID       string        `json:"id"`
	Name     string        `json:"name"`
	Slug     string        `json:"slug"`
	Position int           `json:"position"`
	ParentID *string       `json:"parent_id"`
	Children []*folderNode `json:"children"`
}

// listFolderTree handles GET /api/domains/{domainId}/folders
func (h *handler) listFolderTree(w http.ResponseWriter, r *http.Request) {
	domainID := chi.URLParam(r, "domainId")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())

	// Fetch all folders in the domain
	rows, err := h.deps.DB.Query(r.Context(), `
		SELECT id, name, slug, parent_id, position
		FROM folders WHERE domain_id = $1
		ORDER BY position, name
	`, domainID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list folders"})
		return
	}
	defer rows.Close()

	type flatFolder struct {
		ID       string
		Name     string
		Slug     string
		ParentID *string
		Position int
	}
	var all []flatFolder
	for rows.Next() {
		var f flatFolder
		if err := rows.Scan(&f.ID, &f.Name, &f.Slug, &f.ParentID, &f.Position); err != nil {
			continue
		}
		all = append(all, f)
	}

	// Build permission map for filtering
	var perms map[string]FolderRole
	if userRole == "admin" {
		perms = nil // admin sees everything
	} else if userID != "" {
		perms, _ = BatchResolveRoles(r.Context(), h.deps.DB, domainID, userID)
	}

	// Build tree with permission filtering
	nodeMap := make(map[string]*folderNode)
	for _, f := range all {
		nodeMap[f.ID] = &folderNode{
			ID: f.ID, Name: f.Name, Slug: f.Slug,
			Position: f.Position, ParentID: f.ParentID,
			Children: []*folderNode{},
		}
	}

	var roots []*folderNode
	for _, f := range all {
		node := nodeMap[f.ID]
		if f.ParentID != nil {
			if parent, ok := nodeMap[*f.ParentID]; ok {
				parent.Children = append(parent.Children, node)
			}
		} else {
			roots = append(roots, node)
		}
	}

	// Filter by permissions (for non-admin authenticated users)
	if perms != nil {
		roots = filterVisibleFolders(roots, perms, nodeMap)
	}

	// For unauthenticated users, show folders with public documents
	if userID == "" {
		roots = filterPublicFolders(r.Context(), h.deps.DB, domainID, roots, nodeMap)
	}

	if roots == nil {
		roots = []*folderNode{}
	}
	httputil.WriteJSON(w, http.StatusOK, roots)
}

// filterVisibleFolders keeps only folders the user can access (via inheritance).
func filterVisibleFolders(nodes []*folderNode, perms map[string]FolderRole, nodeMap map[string]*folderNode) []*folderNode {
	// A folder is visible if:
	// 1. It has an explicit permission, OR
	// 2. Any of its ancestors has a permission (inherited), OR
	// 3. Any of its descendants has a permission (we need to show the path)
	visible := make(map[string]bool)

	// Mark folders with explicit perms and their ancestors
	for fid := range perms {
		markAncestors(fid, nodeMap, visible)
	}

	// Also mark descendants of permitted folders
	for fid := range perms {
		if node, ok := nodeMap[fid]; ok {
			markDescendants(node, visible)
		}
	}

	return filterNodes(nodes, visible)
}

func markAncestors(fid string, nodeMap map[string]*folderNode, visible map[string]bool) {
	visible[fid] = true
	if node, ok := nodeMap[fid]; ok && node.ParentID != nil {
		markAncestors(*node.ParentID, nodeMap, visible)
	}
}

func markDescendants(node *folderNode, visible map[string]bool) {
	visible[node.ID] = true
	for _, child := range node.Children {
		markDescendants(child, visible)
	}
}

func filterNodes(nodes []*folderNode, visible map[string]bool) []*folderNode {
	var result []*folderNode
	for _, n := range nodes {
		if !visible[n.ID] {
			continue
		}
		filtered := *n
		filtered.Children = filterNodes(n.Children, visible)
		result = append(result, &filtered)
	}
	return result
}

func filterPublicFolders(ctx context.Context, db *pgxpool.Pool, domainID string, roots []*folderNode, nodeMap map[string]*folderNode) []*folderNode {
	// Find folders that contain public documents
	rows, _ := db.Query(ctx, `
		SELECT DISTINCT folder_id FROM documents
		WHERE domain_id = $1 AND visibility = 'public'
	`, domainID)
	if rows == nil {
		return []*folderNode{}
	}
	defer rows.Close()

	visible := make(map[string]bool)
	for rows.Next() {
		var fid string
		if rows.Scan(&fid) == nil {
			markAncestors(fid, nodeMap, visible)
		}
	}
	return filterNodes(roots, visible)
}

// --- Folder detail ---

type folderPathItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type docByType struct {
	TypeName string    `json:"type_name"`
	TypeSlug string    `json:"type_slug"`
	Docs     []docItem `json:"documents"`
}

type docItem struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Slug      string    `json:"slug"`
	UpdatedAt time.Time `json:"updated_at"`
}

type folderDetail struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Slug       string            `json:"slug"`
	DomainID   string            `json:"domain_id"`
	DomainName string            `json:"domain_name"`
	DomainSlug string            `json:"domain_slug"`
	ParentID   *string           `json:"parent_id"`
	Path       []folderPathItem  `json:"path"`
	Children   []folderPathItem  `json:"children"`
	DocsByType []docByType       `json:"documents_by_type"`
	UserRole   string            `json:"user_role"`
}

// getFolder handles GET /api/folders/{id}
func (h *handler) getFolder(w http.ResponseWriter, r *http.Request) {
	folderID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())

	// Check permission
	role := ResolveUserRole(r.Context(), h.deps.DB, folderID, userID, userRole)
	if role == "" && userID != "" {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "access denied"})
		return
	}

	// Fetch folder + domain
	var fd folderDetail
	err := h.deps.DB.QueryRow(r.Context(), `
		SELECT f.id, f.name, f.slug, f.domain_id, f.parent_id, d.name, d.slug
		FROM folders f JOIN domains d ON d.id = f.domain_id
		WHERE f.id = $1
	`, folderID).Scan(&fd.ID, &fd.Name, &fd.Slug, &fd.DomainID, &fd.ParentID, &fd.DomainName, &fd.DomainSlug)
	if err != nil {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "folder not found"})
		return
	}
	fd.UserRole = string(role)

	// Path (ancestors)
	pathRows, _ := h.deps.DB.Query(r.Context(), `
		WITH RECURSIVE ancestors AS (
			SELECT id, name, slug, parent_id, 0 AS depth FROM folders WHERE id = $1
			UNION ALL
			SELECT f.id, f.name, f.slug, f.parent_id, a.depth + 1
			FROM folders f JOIN ancestors a ON f.id = a.parent_id
		)
		SELECT id, name, slug FROM ancestors ORDER BY depth DESC
	`, folderID)
	if pathRows != nil {
		defer pathRows.Close()
		for pathRows.Next() {
			var p folderPathItem
			if pathRows.Scan(&p.ID, &p.Name, &p.Slug) == nil {
				fd.Path = append(fd.Path, p)
			}
		}
	}

	// Children
	childRows, _ := h.deps.DB.Query(r.Context(), `
		SELECT id, name, slug FROM folders
		WHERE parent_id = $1 ORDER BY position, name
	`, folderID)
	if childRows != nil {
		defer childRows.Close()
		fd.Children = []folderPathItem{}
		for childRows.Next() {
			var c folderPathItem
			if childRows.Scan(&c.ID, &c.Name, &c.Slug) == nil {
				fd.Children = append(fd.Children, c)
			}
		}
	}

	// Documents grouped by type
	docRows, _ := h.deps.DB.Query(r.Context(), `
		SELECT d.id, d.title, d.slug, d.updated_at, dt.name, dt.slug
		FROM documents d
		JOIN document_types dt ON dt.id = d.type_id
		WHERE d.folder_id = $1
		ORDER BY dt.sort_order, dt.name, d.title
	`, folderID)
	if docRows != nil {
		defer docRows.Close()
		typeMap := make(map[string]*docByType)
		var typeOrder []string
		for docRows.Next() {
			var di docItem
			var typeName, typeSlug string
			if docRows.Scan(&di.ID, &di.Title, &di.Slug, &di.UpdatedAt, &typeName, &typeSlug) != nil {
				continue
			}
			if _, ok := typeMap[typeSlug]; !ok {
				typeMap[typeSlug] = &docByType{TypeName: typeName, TypeSlug: typeSlug}
				typeOrder = append(typeOrder, typeSlug)
			}
			typeMap[typeSlug].Docs = append(typeMap[typeSlug].Docs, di)
		}
		fd.DocsByType = []docByType{}
		for _, ts := range typeOrder {
			fd.DocsByType = append(fd.DocsByType, *typeMap[ts])
		}
	}

	httputil.WriteJSON(w, http.StatusOK, fd)
}

// --- Create folder ---

// createFolder handles POST /api/folders
func (h *handler) createFolder(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())

	var req struct {
		Name     string  `json:"name"`
		DomainID string  `json:"domain_id"`
		ParentID *string `json:"parent_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if req.Name == "" || req.DomainID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "name and domain_id are required"})
		return
	}

	// Check permission on parent (or domain-level for root folders)
	if req.ParentID != nil {
		role := ResolveUserRole(r.Context(), h.deps.DB, *req.ParentID, userID, userRole)
		if !RoleAtLeast(role, RoleManager) {
			httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "manager role required on parent folder"})
			return
		}
		// Check parent is in same domain
		var parentDomain string
		h.deps.DB.QueryRow(r.Context(), `SELECT domain_id FROM folders WHERE id = $1`, *req.ParentID).Scan(&parentDomain)
		if parentDomain != req.DomainID {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "parent must be in same domain"})
			return
		}
		// Depth check
		depth, _ := FolderDepth(r.Context(), h.deps.DB, *req.ParentID)
		if depth+1 >= maxFolderDepth {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "maximum folder depth exceeded"})
			return
		}
	} else if userRole != "admin" {
		// Creating root folder requires admin
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "only admins can create root folders"})
		return
	}

	slug := httputil.GenerateSlug(req.Name)

	// Get next position
	var nextPos int
	h.deps.DB.QueryRow(r.Context(), `
		SELECT COALESCE(MAX(position), -1) + 1 FROM folders
		WHERE domain_id = $1 AND parent_id IS NOT DISTINCT FROM $2
	`, req.DomainID, req.ParentID).Scan(&nextPos)

	var folder struct {
		ID        string    `json:"id"`
		Name      string    `json:"name"`
		Slug      string    `json:"slug"`
		DomainID  string    `json:"domain_id"`
		ParentID  *string   `json:"parent_id"`
		Position  int       `json:"position"`
		CreatedAt time.Time `json:"created_at"`
	}
	err := h.deps.DB.QueryRow(r.Context(), `
		INSERT INTO folders (name, slug, domain_id, parent_id, position, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, slug, domain_id, parent_id, position, created_at
	`, req.Name, slug, req.DomainID, req.ParentID, nextPos, userID,
	).Scan(&folder.ID, &folder.Name, &folder.Slug, &folder.DomainID, &folder.ParentID, &folder.Position, &folder.CreatedAt)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create folder"})
		return
	}

	// Auto-grant manager to creator
	h.deps.DB.Exec(r.Context(), `
		INSERT INTO folder_permissions (folder_id, user_id, role) VALUES ($1, $2, 'manager')
		ON CONFLICT DO NOTHING
	`, folder.ID, userID)

	httputil.WriteJSON(w, http.StatusCreated, folder)
}

// --- Update folder ---

// updateFolder handles PUT /api/folders/{id}
func (h *handler) updateFolder(w http.ResponseWriter, r *http.Request) {
	folderID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())

	role := ResolveUserRole(r.Context(), h.deps.DB, folderID, userID, userRole)
	if !RoleAtLeast(role, RoleManager) {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "manager role required"})
		return
	}

	var req struct {
		Name     *string `json:"name"`
		ParentID *string `json:"parent_id"`
		Position *int    `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	// Read current folder
	var currentDomainID string
	var currentParentID *string
	h.deps.DB.QueryRow(r.Context(), `SELECT domain_id, parent_id FROM folders WHERE id = $1`, folderID).Scan(&currentDomainID, &currentParentID)

	// Handle move
	if req.ParentID != nil {
		newParent := *req.ParentID
		// Cross-domain check
		if newParent != "" {
			var destDomain string
			h.deps.DB.QueryRow(r.Context(), `SELECT domain_id FROM folders WHERE id = $1`, newParent).Scan(&destDomain)
			if destDomain != currentDomainID {
				httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot move across domains"})
				return
			}
			// Cycle detection
			isDesc, _ := IsDescendant(r.Context(), h.deps.DB, newParent, folderID)
			if isDesc || newParent == folderID {
				httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot move folder into its own descendant"})
				return
			}
			// Depth check
			destDepth, _ := FolderDepth(r.Context(), h.deps.DB, newParent)
			subtreeDepth, _ := MaxDescendantDepth(r.Context(), h.deps.DB, folderID)
			if destDepth+1+subtreeDepth >= maxFolderDepth {
				httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "maximum folder depth exceeded"})
				return
			}
			// Permission on destination
			destRole := ResolveUserRole(r.Context(), h.deps.DB, newParent, userID, userRole)
			if !RoleAtLeast(destRole, RoleManager) {
				httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "manager role required on destination"})
				return
			}
		}
	}

	// Build update query dynamically
	setClauses := []string{"updated_at = now()"}
	args := []any{folderID}
	argIdx := 2

	if req.Name != nil {
		setClauses = append(setClauses, "name = $"+strconv.Itoa(argIdx), "slug = $"+strconv.Itoa(argIdx+1))
		args = append(args, *req.Name, httputil.GenerateSlug(*req.Name))
		argIdx += 2
	}
	if req.ParentID != nil {
		p := *req.ParentID
		if p == "" {
			setClauses = append(setClauses, "parent_id = NULL")
		} else {
			setClauses = append(setClauses, "parent_id = $"+strconv.Itoa(argIdx))
			args = append(args, p)
			argIdx++
		}
	}
	if req.Position != nil {
		setClauses = append(setClauses, "position = $"+strconv.Itoa(argIdx))
		args = append(args, *req.Position)
		argIdx++
	}

	query := "UPDATE folders SET " + joinStrings(setClauses, ", ") + " WHERE id = $1 RETURNING id, name, slug, parent_id, position, updated_at"
	var result struct {
		ID        string    `json:"id"`
		Name      string    `json:"name"`
		Slug      string    `json:"slug"`
		ParentID  *string   `json:"parent_id"`
		Position  int       `json:"position"`
		UpdatedAt time.Time `json:"updated_at"`
	}
	err := h.deps.DB.QueryRow(r.Context(), query, args...).Scan(&result.ID, &result.Name, &result.Slug, &result.ParentID, &result.Position, &result.UpdatedAt)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update folder"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, result)
}

func joinStrings(ss []string, sep string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}

// --- Cascade count ---

// cascadeCount handles GET /api/folders/{id}/cascade-count
func (h *handler) cascadeCount(w http.ResponseWriter, r *http.Request) {
	folderID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())

	role := ResolveUserRole(r.Context(), h.deps.DB, folderID, userID, userRole)
	if !RoleAtLeast(role, RoleManager) {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "manager role required"})
		return
	}

	var folderCount, docCount int
	h.deps.DB.QueryRow(r.Context(), `
		WITH RECURSIVE descendants AS (
			SELECT id FROM folders WHERE id = $1
			UNION ALL
			SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
		)
		SELECT
			(SELECT count(*) - 1 FROM descendants),
			(SELECT count(*) FROM documents WHERE folder_id IN (SELECT id FROM descendants))
	`, folderID).Scan(&folderCount, &docCount)

	httputil.WriteJSON(w, http.StatusOK, map[string]int{
		"folder_count":   folderCount,
		"document_count": docCount,
	})
}

// --- Delete folder ---

// deleteFolder handles DELETE /api/folders/{id}?confirm=true
func (h *handler) deleteFolder(w http.ResponseWriter, r *http.Request) {
	folderID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())

	if r.URL.Query().Get("confirm") != "true" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "confirm=true required"})
		return
	}

	role := ResolveUserRole(r.Context(), h.deps.DB, folderID, userID, userRole)
	if !RoleAtLeast(role, RoleManager) {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "manager role required"})
		return
	}

	ctx := r.Context()
	tx, err := h.deps.DB.Begin(ctx)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to begin transaction"})
		return
	}
	defer tx.Rollback(ctx)

	// Collect all descendant folder IDs
	rows, err := tx.Query(ctx, `
		WITH RECURSIVE descendants AS (
			SELECT id FROM folders WHERE id = $1
			UNION ALL
			SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
		)
		SELECT id FROM descendants
	`, folderID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to collect descendants"})
		return
	}
	var folderIDs []string
	for rows.Next() {
		var id string
		rows.Scan(&id)
		folderIDs = append(folderIDs, id)
	}
	rows.Close()

	// Delete documents in all descendant folders
	for _, fid := range folderIDs {
		tx.Exec(ctx, `DELETE FROM documents WHERE folder_id = $1`, fid)
	}

	// Delete the folder (CASCADE handles sub-folders and permissions)
	_, err = tx.Exec(ctx, `DELETE FROM folders WHERE id = $1`, folderID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete folder"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to commit"})
		return
	}

	// TODO: Remove deleted documents from Meilisearch index

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// --- Permissions endpoints ---

type permissionEntry struct {
	UserID      string `json:"user_id"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
}

// listPermissions handles GET /api/folders/{id}/permissions
func (h *handler) listPermissions(w http.ResponseWriter, r *http.Request) {
	folderID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())

	role := ResolveUserRole(r.Context(), h.deps.DB, folderID, userID, userRole)
	if !RoleAtLeast(role, RoleManager) {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "manager role required"})
		return
	}

	rows, err := h.deps.DB.Query(r.Context(), `
		SELECT fp.user_id, u.display_name, fp.role
		FROM folder_permissions fp
		JOIN users u ON u.id = fp.user_id
		WHERE fp.folder_id = $1
		ORDER BY u.display_name
	`, folderID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list permissions"})
		return
	}
	defer rows.Close()

	var perms []permissionEntry
	for rows.Next() {
		var p permissionEntry
		if rows.Scan(&p.UserID, &p.DisplayName, &p.Role) == nil {
			perms = append(perms, p)
		}
	}
	if perms == nil {
		perms = []permissionEntry{}
	}
	httputil.WriteJSON(w, http.StatusOK, perms)
}

// setPermissions handles PUT /api/folders/{id}/permissions
func (h *handler) setPermissions(w http.ResponseWriter, r *http.Request) {
	folderID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())

	role := ResolveUserRole(r.Context(), h.deps.DB, folderID, userID, userRole)
	if !RoleAtLeast(role, RoleManager) {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "manager role required"})
		return
	}

	var req struct {
		Permissions []struct {
			UserID string `json:"user_id"`
			Role   string `json:"role"`
		} `json:"permissions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	ctx := r.Context()
	tx, err := h.deps.DB.Begin(ctx)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction failed"})
		return
	}
	defer tx.Rollback(ctx)

	// Delete all existing permissions
	tx.Exec(ctx, `DELETE FROM folder_permissions WHERE folder_id = $1`, folderID)

	// Insert new permissions
	for _, p := range req.Permissions {
		if p.Role != "reader" && p.Role != "editor" && p.Role != "manager" {
			continue
		}
		tx.Exec(ctx, `
			INSERT INTO folder_permissions (folder_id, user_id, role)
			VALUES ($1, $2, $3::folder_role)
			ON CONFLICT (folder_id, user_id) DO UPDATE SET role = $3::folder_role
		`, folderID, p.UserID, p.Role)
	}

	if err := tx.Commit(ctx); err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to commit"})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
```

Note: This file needs `"context"` in imports and `"github.com/jackc/pgx/v5/pgxpool"` for `filterPublicFolders`. Add the missing import:

```go
import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)
```

- [ ] **Step 2: Verify it compiles**

```bash
go build ./internal/folder/
```

- [ ] **Step 3: Commit**

```bash
git add internal/folder/handler.go
git commit -m "feat(folder): add CRUD handlers with tree, permissions, cascade delete"
```

---

### Task 4: Folder router + mount in server

**Files:**
- Create: `internal/folder/router.go`
- Modify: `internal/server/server.go`

- [ ] **Step 1: Write router.go**

```go
package folder

import (
	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

// Router creates the folder sub-router mounted at /api/folders
func Router(deps *model.Deps) chi.Router {
	r := chi.NewRouter()
	h := &handler{deps: deps}

	r.Group(func(r chi.Router) {
		r.Use(auth.OptionalAuth(deps.JWTSecret))
		r.Get("/{id}", h.getFolder)
	})

	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth(deps.JWTSecret))
		r.Post("/", h.createFolder)
		r.Put("/{id}", h.updateFolder)
		r.Delete("/{id}", h.deleteFolder)
		r.Get("/{id}/cascade-count", h.cascadeCount)
		r.Get("/{id}/permissions", h.listPermissions)
		r.Put("/{id}/permissions", h.setPermissions)
	})

	return r
}

// DomainFoldersRouter creates the router for /api/domains/{domainId}/folders
func DomainFoldersRouter(deps *model.Deps) chi.Router {
	r := chi.NewRouter()
	h := &handler{deps: deps}

	r.Use(auth.OptionalAuth(deps.JWTSecret))
	r.Get("/", h.listFolderTree)

	return r
}
```

- [ ] **Step 2: Mount in server.go**

In `internal/server/server.go`, add after the existing `r.Mount` lines:

```go
r.Mount("/api/folders", folder.Router(deps))
r.Route("/api/domains/{domainId}/folders", func(r chi.Router) {
	r.Mount("/", folder.DomainFoldersRouter(deps))
})
```

And add the import:

```go
"github.com/alexmusic/plumenote/internal/folder"
```

- [ ] **Step 3: Verify it compiles**

```bash
go build ./...
```

- [ ] **Step 4: Commit**

```bash
git add internal/folder/router.go internal/server/server.go
git commit -m "feat(folder): register folder API routes in server"
```

---

### Task 5: Modify document handlers for folder_id

**Files:**
- Modify: `internal/document/handlers.go`

- [ ] **Step 1: Add folder_id to createDocument**

In `createDocument`, add `FolderID` to the request struct:

```go
FolderID   string          `json:"folder_id"`
```

Add validation after the existing `domain_id`/`type_id` check:

```go
if req.FolderID == "" {
    httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "folder_id is required"})
    return
}
```

Add folder permission check (after auth check):

```go
// Check editor+ permission on folder
folderRole := folder.ResolveUserRole(r.Context(), h.deps.DB, req.FolderID, authorID, getUserRole(r.Context()))
if !folder.RoleAtLeast(folderRole, folder.RoleEditor) {
    httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "editor role required on folder"})
    return
}
```

Modify the INSERT query to include `folder_id`:

```sql
INSERT INTO documents (title, slug, body, body_text, domain_id, type_id, author_id, visibility, folder_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING ...
```

Add the import at the top of `handlers.go`:

```go
"github.com/alexmusic/plumenote/internal/folder"
```

- [ ] **Step 2: Add folder_id to updateDocument**

In `updateDocument`, add `FolderID` to the request struct:

```go
FolderID   string          `json:"folder_id"`
```

If `FolderID` is provided and different from current, check editor+ on both source and destination folders. Add this after the permission check block:

```go
// Handle folder move
if req.FolderID != "" {
    var currentFolderID string
    tx.QueryRow(r.Context(), `SELECT folder_id FROM documents WHERE id = $1`, docID).Scan(&currentFolderID)
    if req.FolderID != currentFolderID {
        destRole := folder.ResolveUserRoleTx(r.Context(), tx, req.FolderID, userID, userRole)
        if !folder.RoleAtLeast(destRole, folder.RoleEditor) {
            httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "editor role required on destination folder"})
            return
        }
    }
}
```

Add `folder_id` to the UPDATE query SET clause.

- [ ] **Step 3: Verify it compiles**

```bash
go build ./internal/document/
```

- [ ] **Step 4: Commit**

```bash
git add internal/document/handlers.go
git commit -m "feat(folder): add folder_id to document create/update with permission checks"
```

---

### Task 6: Build, deploy, smoke test backend

- [ ] **Step 1: Build and deploy**

```bash
cd web && npm run build && cd ../docker && docker compose build plumenote-app && docker compose up -d plumenote-app
```

- [ ] **Step 2: Apply migration**

```bash
docker exec -i plumenote-db psql -U plumenote -d plumenote < migrations/000013_folders.up.sql
```

- [ ] **Step 3: Smoke test**

```bash
# Login
TOKEN=$(docker exec plumenote-app wget -qO- 'http://localhost:8080/api/auth/login' --post-data='{"username":"admin","password":"admin"}' --header='Content-Type: application/json' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Get domain ID
DOMAIN_ID=$(docker exec plumenote-app wget -qO- 'http://localhost:8080/api/domains' | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

# List folder tree
curl -s "http://172.19.0.4:8080/api/domains/$DOMAIN_ID/folders" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Get folder detail
FOLDER_ID=$(curl -s "http://172.19.0.4:8080/api/domains/$DOMAIN_ID/folders" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
curl -s "http://172.19.0.4:8080/api/folders/$FOLDER_ID" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: folder tree with "General" root folder, folder detail with documents grouped by type.

- [ ] **Step 4: Commit fixes if needed**

---

## Chunk 2: Frontend — Sidebar + FolderTree

### Task 7: FolderTree component

**Files:**
- Create: `web/src/components/layout/FolderTree.tsx`

- [ ] **Step 1: Write FolderTree.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react'
import { api } from '@/lib/api'

interface FolderNode {
  id: string
  name: string
  slug: string
  position: number
  parent_id: string | null
  children: FolderNode[]
}

interface FolderTreeProps {
  domainId: string
  domainSlug: string
}

const STORAGE_KEY = 'plumenote-folder-expanded'

function getExpandedState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function setExpandedState(state: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export default function FolderTree({ domainId, domainSlug }: FolderTreeProps) {
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>(getExpandedState)

  useEffect(() => {
    api.get<FolderNode[]>(`/domains/${domainId}/folders`).then(setFolders).catch(() => {})
  }, [domainId])

  const toggleExpand = useCallback((folderId: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [folderId]: !prev[folderId] }
      setExpandedState(next)
      return next
    })
  }, [])

  return (
    <div>
      {folders.map((f) => (
        <FolderTreeItem
          key={f.id}
          folder={f}
          depth={1}
          domainSlug={domainSlug}
          expanded={expanded}
          onToggle={toggleExpand}
        />
      ))}
    </div>
  )
}

interface FolderTreeItemProps {
  folder: FolderNode
  depth: number
  domainSlug: string
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
}

function FolderTreeItem({ folder, depth, domainSlug, expanded, onToggle }: FolderTreeItemProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isExpanded = expanded[folder.id] ?? false
  const hasChildren = folder.children.length > 0
  const isActive = location.pathname === `/domains/${domainSlug}/folders/${folder.id}`

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '5px 12px',
          paddingLeft: 12 + depth * 16,
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontWeight: isActive ? 600 : 400,
          color: isActive ? '#1C1C1C' : 'rgba(28,28,28,0.65)',
          background: isActive ? 'rgba(28,28,28,0.06)' : 'transparent',
          borderRadius: 4,
          transition: 'background 0.1s',
          userSelect: 'none' as const,
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(28,28,28,0.03)' }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => { e.stopPropagation(); onToggle(folder.id) }}
            style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            {isExpanded
              ? <ChevronDown size={14} color="rgba(28,28,28,0.4)" />
              : <ChevronRight size={14} color="rgba(28,28,28,0.4)" />
            }
          </span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <span
          onClick={() => navigate(`/domains/${domainSlug}/folders/${folder.id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}
        >
          {isExpanded
            ? <FolderOpen size={14} color="rgba(28,28,28,0.45)" />
            : <Folder size={14} color="rgba(28,28,28,0.45)" />
          }
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {folder.name}
          </span>
        </span>
      </div>
      {isExpanded && hasChildren && folder.children.map((child) => (
        <FolderTreeItem
          key={child.id}
          folder={child}
          depth={depth + 1}
          domainSlug={domainSlug}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/layout/FolderTree.tsx
git commit -m "feat(folder): add FolderTree sidebar component"
```

---

### Task 8: Modify Sidebar to show folder tree

**Files:**
- Modify: `web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add imports and state**

Add at the top:

```tsx
import { ChevronRight, ChevronDown } from 'lucide-react'
import FolderTree from './FolderTree'
```

Add state for expanded domains inside the component:

```tsx
const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({})

const toggleDomain = (domainId: string) => {
  setExpandedDomains((prev) => ({ ...prev, [domainId]: !prev[domainId] }))
}
```

- [ ] **Step 2: Modify the domain list rendering**

Replace the domain item render (the `services.map(s => { ... })` block) to add a chevron toggle and conditionally render FolderTree:

In each domain row, add a chevron on the right side that toggles expansion. When expanded, render `<FolderTree>` below the domain item.

The key changes to the domain item:
1. Clicking the **name** still navigates to DomainPage
2. Clicking the **chevron** (new) toggles folder tree expansion
3. When expanded, render `<FolderTree domainId={s.code} domainSlug={s.slug} />` below

Replace the count span with a chevron + count:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
  <span style={{
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    opacity: 0.5,
  }}>
    {s.count}
  </span>
  <span
    onClick={(e) => { e.stopPropagation(); toggleDomain(s.code) }}
    style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 2 }}
  >
    {expandedDomains[s.code]
      ? <ChevronDown size={14} color={isActive ? 'rgba(250,250,248,0.6)' : 'rgba(28,28,28,0.35)'} />
      : <ChevronRight size={14} color={isActive ? 'rgba(250,250,248,0.6)' : 'rgba(28,28,28,0.35)'} />
    }
  </span>
</div>
```

After the closing `</div>` of each domain item, add:

```tsx
{expandedDomains[s.code] && (
  <FolderTree domainId={s.code} domainSlug={s.slug} />
)}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/layout/Sidebar.tsx
git commit -m "feat(folder): add collapsible folder tree to sidebar domains"
```

---

### Task 9: FolderPage

**Files:**
- Create: `web/src/features/folder/FolderPage.tsx`

- [ ] **Step 1: Write FolderPage.tsx**

```tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Folder, Plus, Trash2, Shield, Pencil } from 'lucide-react'

interface PathItem { id: string; name: string; slug: string }
interface ChildFolder { id: string; name: string; slug: string }
interface DocItem { id: string; title: string; slug: string; updated_at: string }
interface DocsByType { type_name: string; type_slug: string; documents: DocItem[] }

interface FolderData {
  id: string
  name: string
  slug: string
  domain_id: string
  domain_name: string
  domain_slug: string
  parent_id: string | null
  path: PathItem[]
  children: ChildFolder[]
  documents_by_type: DocsByType[]
  user_role: string
}

export default function FolderPage() {
  const { domainSlug, folderId } = useParams<{ domainSlug: string; folderId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [folder, setFolder] = useState<FolderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [showPerms, setShowPerms] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (!folderId) return
    setLoading(true)
    api.get<FolderData>(`/folders/${folderId}`)
      .then(setFolder)
      .catch(() => navigate(`/domains/${domainSlug}`))
      .finally(() => setLoading(false))
  }, [folderId, domainSlug, navigate])

  if (loading || !folder) {
    return <div className="p-6 text-ink-45">Chargement...</div>
  }

  const isEditor = folder.user_role === 'editor' || folder.user_role === 'manager'
  const isManager = folder.user_role === 'manager'

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-ink-45 mb-4 flex-wrap">
        <Link to="/" className="hover:text-blue transition-colors">Accueil</Link>
        <span>&gt;</span>
        <Link to={`/domains/${folder.domain_slug}`} className="hover:text-blue transition-colors">
          {folder.domain_name}
        </Link>
        {folder.path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1">
            <span>&gt;</span>
            {i === folder.path.length - 1 ? (
              <span className="text-ink font-medium">{p.name}</span>
            ) : (
              <Link
                to={`/domains/${folder.domain_slug}/folders/${p.id}`}
                className="hover:text-blue transition-colors"
              >
                {p.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-ink">{folder.name}</h1>
        <div className="flex items-center gap-2">
          {isEditor && (
            <button
              onClick={() => navigate(`/documents/new?folder_id=${folder.id}&domain_id=${folder.domain_id}`)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue/10 text-blue rounded-md hover:bg-blue/20"
            >
              <Plus size={14} /> Document
            </button>
          )}
          {isManager && (
            <>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-ink-05 text-ink-70 rounded-md hover:bg-ink-10"
              >
                <Folder size={14} /> Sous-dossier
              </button>
              <button
                onClick={() => setShowPerms(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-ink-05 text-ink-70 rounded-md hover:bg-ink-10"
              >
                <Shield size={14} /> Permissions
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red/10 text-red rounded-md hover:bg-red/20"
              >
                <Trash2 size={14} /> Supprimer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-folders */}
      {folder.children.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-ink-45 uppercase tracking-wider mb-3">Sous-dossiers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {folder.children.map((child) => (
              <Link
                key={child.id}
                to={`/domains/${domainSlug}/folders/${child.id}`}
                className="flex items-center gap-2 p-3 border border-ink-10 rounded-lg hover:bg-ink-05 transition-colors"
              >
                <Folder size={16} className="text-ink-45 shrink-0" />
                <span className="text-sm font-medium text-ink truncate">{child.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Documents by type */}
      {folder.documents_by_type.length > 0 ? (
        folder.documents_by_type.map((group) => (
          <div key={group.type_slug} className="mb-6">
            <h2 className="text-xs font-semibold text-ink-45 uppercase tracking-wider mb-3">
              {group.type_name}
            </h2>
            <div className="space-y-1">
              {group.documents.map((doc) => (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.slug}`}
                  className="flex items-center justify-between p-3 border border-ink-05 rounded-lg hover:bg-ink-05 transition-colors"
                >
                  <span className="text-sm text-ink font-medium">{doc.title}</span>
                  <span className="text-xs text-ink-45">{formatDate(doc.updated_at)}</span>
                </Link>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-ink-45">Aucun document dans ce dossier.</p>
      )}

      {/* Modals would go here — Tasks 10-11 */}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/features/folder/FolderPage.tsx
git commit -m "feat(folder): add FolderPage with breadcrumb, sub-folders, and grouped docs"
```

---

### Task 10: Add FolderPage route to App.tsx

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add lazy import**

```tsx
const FolderPage = lazy(() => import('@/features/folder/FolderPage'))
```

- [ ] **Step 2: Add route**

Inside the `<Route element={<Shell />}>` group, add:

```tsx
<Route path="/domains/:domainSlug/folders/:folderId" element={<FolderPage />} />
```

- [ ] **Step 3: Verify it compiles**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat(folder): add FolderPage route"
```

---

### Task 11: CreateFolderModal

**Files:**
- Create: `web/src/features/folder/CreateFolderModal.tsx`

- [ ] **Step 1: Write CreateFolderModal.tsx**

```tsx
import { useState } from 'react'
import { api } from '@/lib/api'

interface Props {
  domainId: string
  parentId: string | null
  onCreated: () => void
  onClose: () => void
}

export default function CreateFolderModal({ domainId, parentId, onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      await api.post('/folders', { name: name.trim(), domain_id: domainId, parent_id: parentId })
      onCreated()
    } catch {
      setError('Erreur lors de la creation')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-bg border border-ink-10 rounded-xl shadow-xl p-6 w-96">
        <h2 className="text-lg font-semibold text-ink mb-4">Nouveau dossier</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du dossier"
          className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        {error && <p className="text-red text-sm mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md hover:bg-ink-05">
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-blue text-white rounded-md hover:bg-blue/90 disabled:opacity-50"
          >
            {saving ? '...' : 'Creer'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/features/folder/CreateFolderModal.tsx
git commit -m "feat(folder): add CreateFolderModal component"
```

---

### Task 12: DeleteFolderModal

**Files:**
- Create: `web/src/features/folder/DeleteFolderModal.tsx`

- [ ] **Step 1: Write DeleteFolderModal.tsx**

```tsx
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

interface Props {
  folderId: string
  folderName: string
  onDeleted: () => void
  onClose: () => void
}

export default function DeleteFolderModal({ folderId, folderName, onDeleted, onClose }: Props) {
  const [counts, setCounts] = useState<{ folder_count: number; document_count: number } | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.get<{ folder_count: number; document_count: number }>(`/folders/${folderId}/cascade-count`)
      .then(setCounts)
      .catch(() => {})
  }, [folderId])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/folders/${folderId}?confirm=true`)
      onDeleted()
    } catch {
      setDeleting(false)
    }
  }

  const canDelete = confirmText === folderName

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-bg border border-ink-10 rounded-xl shadow-xl p-6 w-[28rem]">
        <h2 className="text-lg font-semibold text-red mb-2">Supprimer "{folderName}"</h2>
        {counts && (
          <p className="text-sm text-ink-70 mb-4">
            Cette action supprimera <strong>{counts.folder_count} sous-dossier{counts.folder_count !== 1 ? 's' : ''}</strong> et{' '}
            <strong>{counts.document_count} document{counts.document_count !== 1 ? 's' : ''}</strong>.
            Cette action est irreversible.
          </p>
        )}
        <label className="block text-sm text-ink-45 mb-2">
          Tapez <strong>{folderName}</strong> pour confirmer :
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md hover:bg-ink-05">
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            className="px-4 py-2 text-sm bg-red text-white rounded-md hover:bg-red/90 disabled:opacity-50"
          >
            {deleting ? '...' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/features/folder/DeleteFolderModal.tsx
git commit -m "feat(folder): add DeleteFolderModal with cascade count and name confirmation"
```

---

### Task 13: FolderPermissionsModal

**Files:**
- Create: `web/src/features/folder/FolderPermissionsModal.tsx`

- [ ] **Step 1: Write FolderPermissionsModal.tsx**

```tsx
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { X, Plus } from 'lucide-react'

interface Permission { user_id: string; display_name: string; role: string }
interface User { id: string; display_name: string }

interface Props {
  folderId: string
  folderName: string
  onClose: () => void
}

export default function FolderPermissionsModal({ folderId, folderName, onClose }: Props) {
  const [perms, setPerms] = useState<Permission[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole] = useState('reader')

  useEffect(() => {
    api.get<Permission[]>(`/folders/${folderId}/permissions`).then(setPerms).catch(() => {})
    api.get<User[]>('/admin/users').then(setUsers).catch(() => {})
  }, [folderId])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/folders/${folderId}/permissions`, {
        permissions: perms.map((p) => ({ user_id: p.user_id, role: p.role })),
      })
      onClose()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const addUser = () => {
    if (!newUserId) return
    const user = users.find((u) => u.id === newUserId)
    if (!user || perms.some((p) => p.user_id === newUserId)) return
    setPerms([...perms, { user_id: newUserId, display_name: user.display_name, role: newRole }])
    setNewUserId('')
  }

  const removeUser = (userId: string) => {
    setPerms(perms.filter((p) => p.user_id !== userId))
  }

  const changeRole = (userId: string, role: string) => {
    setPerms(perms.map((p) => (p.user_id === userId ? { ...p, role } : p)))
  }

  const availableUsers = users.filter((u) => !perms.some((p) => p.user_id === u.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-bg border border-ink-10 rounded-xl shadow-xl p-6 w-[32rem] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Permissions — {folderName}</h2>
          <button onClick={onClose} className="p-1 hover:bg-ink-05 rounded"><X size={16} /></button>
        </div>

        {/* Current permissions */}
        <div className="space-y-2 mb-4">
          {perms.map((p) => (
            <div key={p.user_id} className="flex items-center gap-3 p-2 border border-ink-05 rounded-lg">
              <span className="flex-1 text-sm text-ink">{p.display_name}</span>
              <select
                value={p.role}
                onChange={(e) => changeRole(p.user_id, e.target.value)}
                className="text-sm border border-ink-10 rounded px-2 py-1"
              >
                <option value="reader">Lecteur</option>
                <option value="editor">Editeur</option>
                <option value="manager">Gestionnaire</option>
              </select>
              <button onClick={() => removeUser(p.user_id)} className="text-red hover:text-red/80">
                <X size={14} />
              </button>
            </div>
          ))}
          {perms.length === 0 && (
            <p className="text-sm text-ink-45">Aucune permission explicite.</p>
          )}
        </div>

        {/* Add user */}
        <div className="flex items-center gap-2 mb-4">
          <select
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            className="flex-1 text-sm border border-ink-10 rounded px-2 py-1.5"
          >
            <option value="">Ajouter un utilisateur...</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.display_name}</option>
            ))}
          </select>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="text-sm border border-ink-10 rounded px-2 py-1.5"
          >
            <option value="reader">Lecteur</option>
            <option value="editor">Editeur</option>
            <option value="manager">Gestionnaire</option>
          </select>
          <button onClick={addUser} disabled={!newUserId} className="p-1.5 bg-blue text-white rounded disabled:opacity-50">
            <Plus size={14} />
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md hover:bg-ink-05">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue text-white rounded-md hover:bg-blue/90 disabled:opacity-50">
            {saving ? '...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/features/folder/FolderPermissionsModal.tsx
git commit -m "feat(folder): add FolderPermissionsModal for role management"
```

---

### Task 14: Wire modals into FolderPage

**Files:**
- Modify: `web/src/features/folder/FolderPage.tsx`

- [ ] **Step 1: Add imports and modal rendering**

Add imports at the top:

```tsx
import CreateFolderModal from './CreateFolderModal'
import DeleteFolderModal from './DeleteFolderModal'
import FolderPermissionsModal from './FolderPermissionsModal'
```

At the bottom of the return (before closing `</div>`), add:

```tsx
{showCreate && (
  <CreateFolderModal
    domainId={folder.domain_id}
    parentId={folder.id}
    onCreated={() => { setShowCreate(false); window.location.reload() }}
    onClose={() => setShowCreate(false)}
  />
)}
{showDelete && (
  <DeleteFolderModal
    folderId={folder.id}
    folderName={folder.name}
    onDeleted={() => navigate(`/domains/${domainSlug}`)}
    onClose={() => setShowDelete(false)}
  />
)}
{showPerms && (
  <FolderPermissionsModal
    folderId={folder.id}
    folderName={folder.name}
    onClose={() => setShowPerms(false)}
  />
)}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/features/folder/FolderPage.tsx
git commit -m "feat(folder): wire create/delete/permissions modals into FolderPage"
```

---

## Chunk 3: Frontend Integration + Deploy

### Task 15: Modify EditorPage to add folder picker

**Files:**
- Modify: `web/src/features/editor/EditorPage.tsx`

- [ ] **Step 1: Add folder state and fetching**

Add state:

```tsx
const [folderId, setFolderId] = useState('')
const [folders, setFolders] = useState<{ id: string; name: string; path: string }[]>([])
```

When `domainId` changes, fetch folder tree and flatten it for the select:

```tsx
useEffect(() => {
  if (!domainId) return
  // Find domain object to get its id
  const domain = domains.find((d) => d.id === domainId)
  if (!domain) return
  api.get<any[]>(`/domains/${domain.id}/folders`).then((tree) => {
    const flat: { id: string; name: string; path: string }[] = []
    const flatten = (nodes: any[], prefix: string) => {
      for (const n of nodes) {
        const path = prefix ? `${prefix} / ${n.name}` : n.name
        flat.push({ id: n.id, name: n.name, path })
        if (n.children) flatten(n.children, path)
      }
    }
    flatten(tree, '')
    setFolders(flat)
  }).catch(() => {})
}, [domainId, domains])
```

Read `folder_id` from URL query params for pre-selection:

```tsx
// In the component, after useParams
const [searchParams] = useSearchParams()
const initialFolderId = searchParams.get('folder_id') || ''
// Set initial folderId state
useEffect(() => { if (initialFolderId) setFolderId(initialFolderId) }, [initialFolderId])
```

Add `useSearchParams` to imports from `react-router-dom`.

- [ ] **Step 2: Add folder select to the form**

After the domain select, add:

```tsx
<div>
  <label className="block text-sm font-medium text-ink-70 mb-1">Dossier *</label>
  <select
    value={folderId}
    onChange={(e) => setFolderId(e.target.value)}
    className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm"
    required
  >
    <option value="">Choisir un dossier...</option>
    {folders.map((f) => (
      <option key={f.id} value={f.id}>{f.path}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 3: Include folder_id in save request**

In the save handler, add `folder_id: folderId` to the request body for both create and update.

- [ ] **Step 4: Load folder_id when editing**

In the edit mode fetch, after setting other fields:

```tsx
setFolderId(doc.folder_id || '')
```

Note: The document API response needs to include `folder_id`. Add it to the `getDocument` handler response or fetch it separately.

- [ ] **Step 5: Verify it compiles**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add web/src/features/editor/EditorPage.tsx
git commit -m "feat(folder): add folder picker to document editor"
```

---

### Task 16: Modify Breadcrumb for folder path

**Files:**
- Modify: `web/src/features/reader/Breadcrumb.tsx`

- [ ] **Step 1: Add folder path support**

```tsx
import { Link } from 'react-router-dom'

interface FolderPathItem {
  id: string
  name: string
}

interface BreadcrumbProps {
  domainName?: string
  domainSlug?: string
  folderPath?: FolderPathItem[]
  title: string
}

export default function Breadcrumb({ domainName, domainSlug, folderPath, title }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-ink-45 mb-4 flex-wrap">
      <Link to="/" className="hover:text-blue transition-colors">
        Accueil
      </Link>
      {domainName && domainSlug && (
        <>
          <span>&gt;</span>
          <Link to={`/domains/${domainSlug}`} className="hover:text-blue transition-colors">
            {domainName}
          </Link>
        </>
      )}
      {folderPath?.map((f) => (
        <span key={f.id} className="flex items-center gap-1">
          <span>&gt;</span>
          <Link
            to={`/domains/${domainSlug}/folders/${f.id}`}
            className="hover:text-blue transition-colors"
          >
            {f.name}
          </Link>
        </span>
      ))}
      <span>&gt;</span>
      <span className="text-ink font-medium truncate max-w-xs">{title}</span>
    </nav>
  )
}
```

- [ ] **Step 2: Update ReaderPage to pass folder path**

In `ReaderPage.tsx`, fetch the folder path when the document loads (from the folder detail endpoint) and pass it to `Breadcrumb`:

```tsx
const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([])

// After doc loads, fetch folder info
useEffect(() => {
  if (!doc?.folder_id) return
  api.get<{ path: { id: string; name: string }[] }>(`/folders/${doc.folder_id}`)
    .then((f) => setFolderPath(f.path))
    .catch(() => {})
}, [doc?.folder_id])
```

And in the Breadcrumb component:

```tsx
<Breadcrumb
  domainName={doc.domain_name}
  domainSlug={doc.domain_slug}
  folderPath={folderPath}
  title={doc.title}
/>
```

Note: The document detail API needs to include `folder_id` in the response. Add it to the `getDocument` handler in `handlers.go`.

- [ ] **Step 3: Commit**

```bash
git add web/src/features/reader/Breadcrumb.tsx web/src/features/reader/ReaderPage.tsx
git commit -m "feat(folder): add folder path to document breadcrumb"
```

---

### Task 17: Add folder_id to document API responses

**Files:**
- Modify: `internal/document/handlers.go`

- [ ] **Step 1: Add folder_id to getDocument response**

In the `getDocument` handler, add `folder_id` to the SELECT query and the response struct.

The current query fetches from `documents d`. Add `d.folder_id` to the SELECT list and scan it into the response.

- [ ] **Step 2: Verify and commit**

```bash
go build ./internal/document/ && git add internal/document/handlers.go && git commit -m "feat(folder): include folder_id in document API responses"
```

---

### Task 18: Final build, deploy, E2E test

- [ ] **Step 1: Build and deploy**

```bash
cd web && npm run build && cd ../docker && docker compose build plumenote-app && docker compose up -d plumenote-app
```

- [ ] **Step 2: Fix dirty migration if needed**

```bash
docker exec plumenote-db psql -U plumenote -d plumenote -c "UPDATE schema_migrations SET dirty = false WHERE version = 13"
```

- [ ] **Step 3: End-to-end test**

1. Open the app — sidebar should show domains with chevrons
2. Click a domain chevron — should expand and show "General" folder
3. Click "General" folder — should navigate to FolderPage with all documents grouped by type
4. Click "Sous-dossier" button — create a new sub-folder
5. Navigate to the new sub-folder — should be empty
6. Create a new document in that folder
7. Verify breadcrumb shows: Accueil > Domain > General > Sub-folder > Document
8. Test permissions modal — add a user with reader role
9. Test delete — create a temp folder, add a doc, delete the folder with confirmation
10. Admin panel — verify retention config still works

- [ ] **Step 4: Commit any fixes**
