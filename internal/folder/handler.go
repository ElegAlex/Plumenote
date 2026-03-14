package folder

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

// handler holds shared dependencies.
type handler struct {
	deps *model.Deps
}

// --- Response types ---

type folderNode struct {
	ID        string        `json:"id"`
	Name      string        `json:"name"`
	Slug      string        `json:"slug"`
	DomainID  string        `json:"domain_id"`
	ParentID  *string       `json:"parent_id"`
	Position  int           `json:"position"`
	CreatedBy *string       `json:"created_by,omitempty"`
	CreatedAt string        `json:"created_at"`
	UpdatedAt string        `json:"updated_at"`
	UserRole  string        `json:"user_role,omitempty"`
	Children  []*folderNode `json:"children"`
}

type folderPathItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type docItem struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Slug      string `json:"slug"`
	TypeID    string `json:"type_id"`
	TypeName  string `json:"type_name"`
	UpdatedAt string `json:"updated_at"`
}

type docByType struct {
	TypeID   string    `json:"type_id"`
	TypeName string    `json:"type_name"`
	Docs     []docItem `json:"docs"`
}

type folderDetail struct {
	ID        string           `json:"id"`
	Name      string           `json:"name"`
	Slug      string           `json:"slug"`
	DomainID  string           `json:"domain_id"`
	ParentID  *string          `json:"parent_id"`
	Position  int              `json:"position"`
	CreatedAt string           `json:"created_at"`
	UpdatedAt string           `json:"updated_at"`
	Path      []folderPathItem `json:"path"`
	Children  []folderNode     `json:"children"`
	DocsByType []docByType     `json:"docs_by_type"`
	UserRole  string           `json:"user_role"`
}

type permissionEntry struct {
	FolderID    string `json:"folder_id"`
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
}

// --- Context helpers ---

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

// --- Tree helpers ---

// markAncestors marks all ancestor IDs of folderID as visible in the set.
func markAncestors(id string, parentMap map[string]*string, visible map[string]bool) {
	pid := parentMap[id]
	for pid != nil {
		visible[*pid] = true
		pid = parentMap[*pid]
	}
}

// markDescendants marks all descendant IDs of folderID as visible in the set.
func markDescendants(id string, childrenMap map[string][]string, visible map[string]bool) {
	for _, childID := range childrenMap[id] {
		visible[childID] = true
		markDescendants(childID, childrenMap, visible)
	}
}

// filterNodes filters a flat list of nodes to only those in the visible set,
// rebuilding parent/child references.
func filterNodes(nodes []*folderNode, visible map[string]bool) []*folderNode {
	var out []*folderNode
	for _, n := range nodes {
		if visible[n.ID] {
			out = append(out, n)
		}
	}
	return out
}

// filterPublicFolders returns folder IDs that contain at least one public document.
func filterPublicFolders(ctx context.Context, h *handler, domainID string) (map[string]bool, error) {
	rows, err := h.deps.DB.Query(ctx,
		`SELECT DISTINCT folder_id::text FROM documents WHERE domain_id = $1 AND visibility = 'public' AND folder_id IS NOT NULL`,
		domainID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]bool)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		result[id] = true
	}
	return result, rows.Err()
}

// filterVisibleFolders determines which folders are accessible to the given user.
func filterVisibleFolders(
	ctx context.Context,
	h *handler,
	nodes []*folderNode,
	domainID, userID, userRole string,
) ([]*folderNode, error) {
	// Build parent/children index
	parentMap := make(map[string]*string, len(nodes))
	childMap := make(map[string][]string, len(nodes))
	for _, n := range nodes {
		parentMap[n.ID] = n.ParentID
		if n.ParentID != nil {
			childMap[*n.ParentID] = append(childMap[*n.ParentID], n.ID)
		}
	}

	visible := make(map[string]bool, len(nodes))

	if userRole == "admin" {
		for _, n := range nodes {
			visible[n.ID] = true
		}
		return nodes, nil
	}

	if userID == "" {
		// Unauthenticated: only folders that contain public documents
		publicFolders, err := filterPublicFolders(ctx, h, domainID)
		if err != nil {
			return nil, err
		}
		for fid := range publicFolders {
			visible[fid] = true
			markAncestors(fid, parentMap, visible)
		}
	} else {
		// Authenticated: folders with an explicit permission (inherited from ancestors)
		explicit, err := BatchResolveRoles(ctx, h.deps.DB, domainID, userID)
		if err != nil {
			return nil, err
		}
		for fid := range explicit {
			visible[fid] = true
			markAncestors(fid, parentMap, visible)
			markDescendants(fid, childMap, visible)
		}
	}

	return filterNodes(nodes, visible), nil
}

// joinStrings joins a slice of strings with a separator.
func joinStrings(parts []string, sep string) string {
	return strings.Join(parts, sep)
}

// buildTree takes a flat list of nodes and builds a tree.
// Returns root nodes.
func buildTree(nodes []*folderNode) []*folderNode {
	byID := make(map[string]*folderNode, len(nodes))
	for _, n := range nodes {
		byID[n.ID] = n
	}
	var roots []*folderNode
	for _, n := range nodes {
		if n.ParentID == nil {
			roots = append(roots, n)
		} else if parent, ok := byID[*n.ParentID]; ok {
			parent.Children = append(parent.Children, n)
		} else {
			// Parent not in visible set — treat as root
			roots = append(roots, n)
		}
	}
	return roots
}

// --- Handlers ---

// listFolderTree handles GET /api/domains/{domainId}/folders
func (h *handler) listFolderTree(w http.ResponseWriter, r *http.Request) {
	domainID := chi.URLParam(r, "domainId")
	if domainID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "domainId is required"})
		return
	}

	ctx := r.Context()
	userID := getUserID(ctx)
	userRole := getUserRole(ctx)

	rows, err := h.deps.DB.Query(ctx,
		`SELECT id::text, name, slug, domain_id::text, parent_id::text, position, created_by::text, created_at, updated_at
		 FROM folders WHERE domain_id = $1 ORDER BY position, name`,
		domainID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list folders"})
		return
	}
	defer rows.Close()

	var nodes []*folderNode
	for rows.Next() {
		n := &folderNode{Children: []*folderNode{}}
		var parentID, createdBy *string
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&n.ID, &n.Name, &n.Slug, &n.DomainID, &parentID, &n.Position, &createdBy, &createdAt, &updatedAt); err != nil {
			continue
		}
		n.ParentID = parentID
		n.CreatedBy = createdBy
		n.CreatedAt = createdAt.Format(time.RFC3339)
		n.UpdatedAt = updatedAt.Format(time.RFC3339)
		nodes = append(nodes, n)
	}
	if err := rows.Err(); err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan folders"})
		return
	}

	// Annotate user_role for authenticated non-admin users
	if userID != "" && userRole != "admin" {
		explicit, _ := BatchResolveRoles(ctx, h.deps.DB, domainID, userID)
		for _, n := range nodes {
			if role, ok := explicit[n.ID]; ok {
				n.UserRole = string(role)
			}
		}
	} else if userRole == "admin" {
		for _, n := range nodes {
			n.UserRole = string(RoleManager)
		}
	}

	visible, err := filterVisibleFolders(ctx, h, nodes, domainID, userID, userRole)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to filter folders"})
		return
	}

	roots := buildTree(visible)
	if roots == nil {
		roots = []*folderNode{}
	}

	httputil.WriteJSON(w, http.StatusOK, roots)
}

// getFolder handles GET /api/folders/{id}
func (h *handler) getFolder(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()
	userID := getUserID(ctx)
	userRole := getUserRole(ctx)

	// Fetch folder base info
	var f folderDetail
	var parentID *string
	var createdAt, updatedAt time.Time
	err := h.deps.DB.QueryRow(ctx,
		`SELECT id::text, name, slug, domain_id::text, parent_id::text, position, created_at, updated_at
		 FROM folders WHERE id = $1`, id,
	).Scan(&f.ID, &f.Name, &f.Slug, &f.DomainID, &parentID, &f.Position, &createdAt, &updatedAt)
	if err != nil {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "folder not found"})
		return
	}
	f.ParentID = parentID
	f.CreatedAt = createdAt.Format(time.RFC3339)
	f.UpdatedAt = updatedAt.Format(time.RFC3339)

	// Resolve user role
	role, err := ResolveUserRole(ctx, h.deps.DB, id, userID, userRole)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to resolve role"})
		return
	}
	if role == "" && userRole != "admin" && userID == "" {
		// Check if folder has any public documents
		var count int
		_ = h.deps.DB.QueryRow(ctx,
			`SELECT COUNT(*) FROM documents WHERE folder_id = $1 AND visibility = 'public'`, id,
		).Scan(&count)
		if count == 0 {
			httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
	}
	f.UserRole = string(role)

	// Fetch path (ancestors)
	pathRows, err := h.deps.DB.Query(ctx, `
WITH RECURSIVE ancestors AS (
    SELECT id, name, slug, parent_id, 0 AS depth
    FROM folders WHERE id = $1
  UNION ALL
    SELECT f.id, f.name, f.slug, f.parent_id, a.depth + 1
    FROM folders f JOIN ancestors a ON f.id = a.parent_id
)
SELECT id::text, name, slug FROM ancestors ORDER BY depth DESC
`, id)
	if err == nil {
		defer pathRows.Close()
		for pathRows.Next() {
			var p folderPathItem
			if err := pathRows.Scan(&p.ID, &p.Name, &p.Slug); err != nil {
				continue
			}
			f.Path = append(f.Path, p)
		}
	}

	// Fetch immediate children
	childRows, err := h.deps.DB.Query(ctx,
		`SELECT id::text, name, slug, domain_id::text, parent_id::text, position, created_at, updated_at
		 FROM folders WHERE parent_id = $1 ORDER BY position, name`, id)
	if err == nil {
		defer childRows.Close()
		for childRows.Next() {
			var child folderNode
			var cParent *string
			var cCreated, cUpdated time.Time
			if err := childRows.Scan(&child.ID, &child.Name, &child.Slug, &child.DomainID, &cParent, &child.Position, &cCreated, &cUpdated); err != nil {
				continue
			}
			child.ParentID = cParent
			child.CreatedAt = cCreated.Format(time.RFC3339)
			child.UpdatedAt = cUpdated.Format(time.RFC3339)
			child.Children = []*folderNode{}
			f.Children = append(f.Children, child)
		}
	}
	if f.Children == nil {
		f.Children = []folderNode{}
	}

	// Fetch documents grouped by type
	docRows, err := h.deps.DB.Query(ctx, `
SELECT d.id::text, d.title, d.slug, d.type_id::text, dt.name, d.updated_at
FROM documents d
JOIN document_types dt ON dt.id = d.type_id
WHERE d.folder_id = $1
ORDER BY dt.sort_order, dt.name, d.title
`, id)
	if err == nil {
		defer docRows.Close()
		byTypeMap := make(map[string]*docByType)
		var typeOrder []string
		for docRows.Next() {
			var doc docItem
			var updAt time.Time
			if err := docRows.Scan(&doc.ID, &doc.Title, &doc.Slug, &doc.TypeID, &doc.TypeName, &updAt); err != nil {
				continue
			}
			doc.UpdatedAt = updAt.Format(time.RFC3339)
			if _, ok := byTypeMap[doc.TypeID]; !ok {
				byTypeMap[doc.TypeID] = &docByType{TypeID: doc.TypeID, TypeName: doc.TypeName}
				typeOrder = append(typeOrder, doc.TypeID)
			}
			byTypeMap[doc.TypeID].Docs = append(byTypeMap[doc.TypeID].Docs, doc)
		}
		for _, tid := range typeOrder {
			f.DocsByType = append(f.DocsByType, *byTypeMap[tid])
		}
	}
	if f.DocsByType == nil {
		f.DocsByType = []docByType{}
	}

	httputil.WriteJSON(w, http.StatusOK, f)
}

// createFolder handles POST /api/folders
func (h *handler) createFolder(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string  `json:"name"`
		DomainID string  `json:"domain_id"`
		ParentID *string `json:"parent_id"`
		Position int     `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if req.Name == "" || req.DomainID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "name and domain_id are required"})
		return
	}

	ctx := r.Context()
	userID := getUserID(ctx)
	userRole := getUserRole(ctx)

	// Check permission: admin can create root; others need manager on parent
	if req.ParentID == nil {
		if userRole != "admin" {
			httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "only admins can create root folders"})
			return
		}
	} else {
		role, err := ResolveUserRole(ctx, h.deps.DB, *req.ParentID, userID, userRole)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to resolve permissions"})
			return
		}
		if !RoleAtLeast(role, RoleManager) {
			httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "manager role required on parent folder"})
			return
		}

		// Validate depth
		parentDepth, err := FolderDepth(ctx, h.deps.DB, *req.ParentID)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to compute depth"})
			return
		}
		if parentDepth+1 > MaxFolderDepth {
			httputil.WriteJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "maximum folder depth exceeded"})
			return
		}
	}

	slug := httputil.GenerateSlug(req.Name)

	// Begin transaction
	tx, err := h.deps.DB.Begin(ctx)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to begin transaction"})
		return
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var newID string
	err = tx.QueryRow(ctx,
		`INSERT INTO folders (name, slug, domain_id, parent_id, position, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id::text`,
		req.Name, slug, req.DomainID, req.ParentID, req.Position, userID,
	).Scan(&newID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusConflict, map[string]string{"error": "failed to create folder (slug may be duplicate)"})
		return
	}

	// Auto-grant manager to creator
	if userID != "" {
		_, err = tx.Exec(ctx,
			`INSERT INTO folder_permissions (folder_id, user_id, role) VALUES ($1, $2, 'manager') ON CONFLICT DO NOTHING`,
			newID, userID)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to grant permissions"})
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to commit"})
		return
	}

	var result folderNode
	var pID *string
	var cBy *string
	var cAt, uAt time.Time
	_ = h.deps.DB.QueryRow(ctx,
		`SELECT id::text, name, slug, domain_id::text, parent_id::text, position, created_by::text, created_at, updated_at
		 FROM folders WHERE id = $1`, newID,
	).Scan(&result.ID, &result.Name, &result.Slug, &result.DomainID, &pID, &result.Position, &cBy, &cAt, &uAt)
	result.ParentID = pID
	result.CreatedBy = cBy
	result.CreatedAt = cAt.Format(time.RFC3339)
	result.UpdatedAt = uAt.Format(time.RFC3339)
	result.Children = []*folderNode{}
	result.UserRole = string(RoleManager)

	httputil.WriteJSON(w, http.StatusCreated, result)
}

// updateFolder handles PUT /api/folders/{id}
func (h *handler) updateFolder(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Name     *string `json:"name"`
		ParentID *string `json:"parent_id"`
		Position *int    `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	ctx := r.Context()
	userID := getUserID(ctx)
	userRole := getUserRole(ctx)

	// Resolve role on this folder
	role, err := ResolveUserRole(ctx, h.deps.DB, id, userID, userRole)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to resolve role"})
		return
	}
	if !RoleAtLeast(role, RoleManager) {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "manager role required"})
		return
	}

	// Fetch current folder
	var current struct {
		DomainID string
		ParentID *string
	}
	err = h.deps.DB.QueryRow(ctx,
		`SELECT domain_id::text, parent_id::text FROM folders WHERE id = $1`, id,
	).Scan(&current.DomainID, &current.ParentID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "folder not found"})
		return
	}

	// If moving to a new parent, validate
	if req.ParentID != nil && (current.ParentID == nil || *req.ParentID != *current.ParentID) {
		newParentID := *req.ParentID

		// Cycle detection: new parent must not be a descendant of this folder
		isDesc, err := IsDescendant(ctx, h.deps.DB, newParentID, id)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed cycle check"})
			return
		}
		if isDesc {
			httputil.WriteJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "cannot move folder into its own descendant"})
			return
		}

		// Cross-domain check
		var targetDomainID string
		err = h.deps.DB.QueryRow(ctx, `SELECT domain_id::text FROM folders WHERE id = $1`, newParentID).Scan(&targetDomainID)
		if err != nil {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "target parent not found"})
			return
		}
		if targetDomainID != current.DomainID {
			httputil.WriteJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "cannot move folder to a different domain"})
			return
		}

		// Depth check: current subtree depth + new parent depth must not exceed max
		subtreeDepth, err := MaxDescendantDepth(ctx, h.deps.DB, id)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to compute depth"})
			return
		}
		parentDepth, err := FolderDepth(ctx, h.deps.DB, newParentID)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to compute parent depth"})
			return
		}
		if parentDepth+1+subtreeDepth > MaxFolderDepth {
			httputil.WriteJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "move would exceed maximum folder depth"})
			return
		}

		// Destination permission check
		destRole, err := ResolveUserRole(ctx, h.deps.DB, newParentID, userID, userRole)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to resolve destination role"})
			return
		}
		if !RoleAtLeast(destRole, RoleManager) {
			httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "manager role required on destination folder"})
			return
		}
	}

	// Build update query dynamically
	setClauses := []string{"updated_at = now()"}
	args := []any{}
	argIdx := 1

	if req.Name != nil {
		slug := httputil.GenerateSlug(*req.Name)
		setClauses = append(setClauses, "name = $"+itoa(argIdx), "slug = $"+itoa(argIdx+1))
		args = append(args, *req.Name, slug)
		argIdx += 2
	}
	if req.ParentID != nil {
		setClauses = append(setClauses, "parent_id = $"+itoa(argIdx))
		args = append(args, *req.ParentID)
		argIdx++
	}
	if req.Position != nil {
		setClauses = append(setClauses, "position = $"+itoa(argIdx))
		args = append(args, *req.Position)
		argIdx++
	}

	args = append(args, id)
	query := "UPDATE folders SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
	if _, err := h.deps.DB.Exec(ctx, query, args...); err != nil {
		httputil.WriteJSON(w, http.StatusConflict, map[string]string{"error": "failed to update folder"})
		return
	}

	var result folderNode
	var pID, cBy *string
	var cAt, uAt time.Time
	_ = h.deps.DB.QueryRow(ctx,
		`SELECT id::text, name, slug, domain_id::text, parent_id::text, position, created_by::text, created_at, updated_at
		 FROM folders WHERE id = $1`, id,
	).Scan(&result.ID, &result.Name, &result.Slug, &result.DomainID, &pID, &result.Position, &cBy, &cAt, &uAt)
	result.ParentID = pID
	result.CreatedBy = cBy
	result.CreatedAt = cAt.Format(time.RFC3339)
	result.UpdatedAt = uAt.Format(time.RFC3339)
	result.Children = []*folderNode{}

	httputil.WriteJSON(w, http.StatusOK, result)
}

// cascadeCount handles GET /api/folders/{id}/cascade-count
func (h *handler) cascadeCount(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()

	type countResp struct {
		Folders   int `json:"folders"`
		Documents int `json:"documents"`
	}

	var resp countResp

	// Count sub-folders
	err := h.deps.DB.QueryRow(ctx, `
WITH RECURSIVE descendants AS (
    SELECT id FROM folders WHERE parent_id = $1
  UNION ALL
    SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
)
SELECT COUNT(*) FROM descendants
`, id).Scan(&resp.Folders)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to count folders"})
		return
	}

	// Count documents in entire subtree
	err = h.deps.DB.QueryRow(ctx, `
WITH RECURSIVE subtree AS (
    SELECT id FROM folders WHERE id = $1
  UNION ALL
    SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id
)
SELECT COUNT(*) FROM documents WHERE folder_id IN (SELECT id FROM subtree)
`, id).Scan(&resp.Documents)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to count documents"})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

// deleteFolder handles DELETE /api/folders/{id}?confirm=true
func (h *handler) deleteFolder(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()

	if r.URL.Query().Get("confirm") != "true" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "confirm=true query parameter required"})
		return
	}

	userID := getUserID(ctx)
	userRole := getUserRole(ctx)

	role, err := ResolveUserRole(ctx, h.deps.DB, id, userID, userRole)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to resolve role"})
		return
	}
	if !RoleAtLeast(role, RoleManager) {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "manager role required"})
		return
	}

	tx, err := h.deps.DB.Begin(ctx)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to begin transaction"})
		return
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Collect all descendant folder IDs (inclusive)
	descRows, err := tx.Query(ctx, `
WITH RECURSIVE subtree AS (
    SELECT id FROM folders WHERE id = $1
  UNION ALL
    SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id
)
SELECT id::text FROM subtree
`, id)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to collect subtree"})
		return
	}
	var folderIDs []string
	for descRows.Next() {
		var fid string
		if err := descRows.Scan(&fid); err != nil {
			descRows.Close()
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan subtree"})
			return
		}
		folderIDs = append(folderIDs, fid)
	}
	descRows.Close()

	// Delete documents in subtree
	if len(folderIDs) > 0 {
		// Build $1,$2,... placeholders
		placeholders := make([]string, len(folderIDs))
		args := make([]any, len(folderIDs))
		for i, fid := range folderIDs {
			placeholders[i] = "$" + itoa(i+1)
			args[i] = fid
		}
		_, err = tx.Exec(ctx,
			`DELETE FROM documents WHERE folder_id IN (`+joinStrings(placeholders, ",")+`)`,
			args...)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete documents"})
			return
		}
	}

	// Delete the folder itself (cascades to children via ON DELETE CASCADE)
	if _, err := tx.Exec(ctx, `DELETE FROM folders WHERE id = $1`, id); err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete folder"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to commit"})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// listPermissions handles GET /api/folders/{id}/permissions
func (h *handler) listPermissions(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()

	rows, err := h.deps.DB.Query(ctx, `
SELECT fp.folder_id::text, fp.user_id::text, u.username, COALESCE(u.display_name, u.username), fp.role::text
FROM folder_permissions fp
JOIN users u ON u.id = fp.user_id
WHERE fp.folder_id = $1
ORDER BY u.username
`, id)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list permissions"})
		return
	}
	defer rows.Close()

	var perms []permissionEntry
	for rows.Next() {
		var p permissionEntry
		if err := rows.Scan(&p.FolderID, &p.UserID, &p.Username, &p.DisplayName, &p.Role); err != nil {
			continue
		}
		perms = append(perms, p)
	}
	if perms == nil {
		perms = []permissionEntry{}
	}

	httputil.WriteJSON(w, http.StatusOK, perms)
}

// setPermissions handles PUT /api/folders/{id}/permissions
func (h *handler) setPermissions(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()
	userID := getUserID(ctx)
	userRole := getUserRole(ctx)

	role, err := ResolveUserRole(ctx, h.deps.DB, id, userID, userRole)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to resolve role"})
		return
	}
	if !RoleAtLeast(role, RoleManager) {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "manager role required"})
		return
	}

	var entries []struct {
		UserID string `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&entries); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	tx, err := h.deps.DB.Begin(ctx)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to begin transaction"})
		return
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Replace all permissions for this folder
	if _, err := tx.Exec(ctx, `DELETE FROM folder_permissions WHERE folder_id = $1`, id); err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to clear permissions"})
		return
	}

	for _, e := range entries {
		if _, err := tx.Exec(ctx,
			`INSERT INTO folder_permissions (folder_id, user_id, role) VALUES ($1, $2, $3::folder_role)`,
			id, e.UserID, e.Role); err != nil {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to insert permission for user " + e.UserID})
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to commit"})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// itoa converts an int to its decimal string representation.
func itoa(n int) string {
	const digits = "0123456789"
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 10)
	for n > 0 {
		buf = append([]byte{digits[n%10]}, buf...)
		n /= 10
	}
	return string(buf)
}
