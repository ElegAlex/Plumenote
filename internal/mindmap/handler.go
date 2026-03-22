package mindmap

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"log"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/document"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/alexmusic/plumenote/internal/model"
)

type handler struct {
	deps *model.Deps
}

// ---------- Response types ----------

// TreeNode represents a single node in the mind map tree.
type TreeNode struct {
	ID             string           `json:"id"`
	Type           string           `json:"type"`
	Label          string           `json:"label"`
	Icon           string           `json:"icon"`
	Meta           string           `json:"meta"`
	DomainName     string           `json:"domain_name"`
	DomainColor    string           `json:"domain_color"`
	FreshnessBadge *string          `json:"freshness_badge"`
	URL            string           `json:"url"`
	HasChildren    bool             `json:"has_children"`
	ChildrenCount  int              `json:"children_count"`
	Children       []RelationGroup  `json:"children"`
}

// RelationGroup groups connected items under a relation label.
type RelationGroup struct {
	Relation      string     `json:"relation"`
	RelationGroup string     `json:"relation_group"`
	Items         []TreeNode `json:"items"`
}

type treeResponse struct {
	Root TreeNode `json:"root"`
}


// ---------- Handlers ----------

func (h *handler) getTree(w http.ResponseWriter, r *http.Request) {
	rootType := r.URL.Query().Get("root_type")
	rootID := r.URL.Query().Get("root_id")
	depthStr := r.URL.Query().Get("depth")

	if rootType == "" || rootID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "root_type and root_id are required"})
		return
	}
	if rootType != "entity" && rootType != "document" && rootType != "domain" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "root_type must be entity, document, or domain"})
		return
	}

	depth := 2
	if depthStr != "" {
		if d, err := strconv.Atoi(depthStr); err == nil && d >= 0 && d <= 4 {
			depth = d
		}
	}

	// Auth check for domain root_type
	if rootType == "domain" {
		c := auth.UserFromContext(r.Context())
		if c == nil || (c.Role != "admin" && c.Role != "dsi") {
			httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "domain mind map requires admin or dsi role"})
			return
		}
	}

	ctx := r.Context()
	greenDays, yellowDays := freshnessThresholds(ctx, h.deps)
	visited := make(map[string]bool)

	var root TreeNode
	var err error

	if rootType == "domain" {
		root, err = h.buildDomainRoot(ctx, rootID, depth, visited, greenDays, yellowDays)
	} else {
		root, err = h.buildNode(ctx, rootType, rootID, depth, visited, greenDays, yellowDays)
	}
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to build tree"})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, treeResponse{Root: root})
}

func (h *handler) getExpand(w http.ResponseWriter, r *http.Request) {
	// Auth: expand requires at least an authenticated user
	c := auth.UserFromContext(r.Context())
	if c == nil {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}

	nodeType := r.URL.Query().Get("node_type")
	nodeID := r.URL.Query().Get("node_id")
	depthStr := r.URL.Query().Get("depth")
	excludeStr := r.URL.Query().Get("exclude_ids")

	if nodeType == "" || nodeID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "node_type and node_id are required"})
		return
	}
	if nodeType != "entity" && nodeType != "document" && nodeType != "bookmark" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "node_type must be entity, document, or bookmark"})
		return
	}

	depth := 1
	if depthStr != "" {
		if d, err := strconv.Atoi(depthStr); err == nil && d >= 0 && d <= 4 {
			depth = d
		}
	}

	visited := make(map[string]bool)
	// Mark excluded IDs as visited (support both "type:id" and raw "id" formats)
	if excludeStr != "" {
		for _, id := range strings.Split(excludeStr, ",") {
			id = strings.TrimSpace(id)
			if id != "" {
				if strings.Contains(id, ":") {
					visited[id] = true
				} else {
					// Raw UUID: mark all possible types
					visited["entity:"+id] = true
					visited["document:"+id] = true
					visited["bookmark:"+id] = true
				}
			}
		}
	}
	// Mark self as visited
	visited[nodeType+":"+nodeID] = true

	ctx := r.Context()
	greenDays, yellowDays := freshnessThresholds(ctx, h.deps)

	node, err := h.buildNode(ctx, nodeType, nodeID, depth, visited, greenDays, yellowDays)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to expand node"})
		return
	}
	node.HasChildren = len(node.Children) > 0
	node.ChildrenCount = countItems(node.Children)

	httputil.WriteJSON(w, http.StatusOK, treeResponse{Root: node})
}

// ---------- Node building ----------

func (h *handler) buildNode(ctx context.Context, nodeType, nodeID string, depth int, visited map[string]bool, greenDays, yellowDays int) (TreeNode, error) {
	key := nodeType + ":" + nodeID
	visited[key] = true

	var node TreeNode
	var err error

	switch nodeType {
	case "entity":
		node, err = h.loadEntity(ctx, nodeID, greenDays, yellowDays)
	case "document":
		node, err = h.loadDocument(ctx, nodeID, greenDays, yellowDays)
	case "bookmark":
		node, err = h.loadBookmark(ctx, nodeID)
	default:
		return TreeNode{}, fmt.Errorf("unknown node type: %s", nodeType)
	}
	if err != nil {
		return TreeNode{}, err
	}

	if depth > 0 {
		groups, err := h.findConnections(ctx, nodeType, nodeID, depth-1, visited, greenDays, yellowDays)
		if err != nil {
			return node, nil // return node without children on error
		}
		node.Children = groups
	}

	return node, nil
}

// ---------- Load individual node types ----------

func (h *handler) loadEntity(ctx context.Context, id string, greenDays, yellowDays int) (TreeNode, error) {
	var node TreeNode
	var properties json.RawMessage
	var typeName, typeIcon, domainName, domainColor string

	err := h.deps.DB.QueryRow(ctx,
		`SELECT e.id, e.name,
		        COALESCE(et.name, ''), COALESCE(et.icon, ''),
		        COALESCE(dom.name, ''), COALESCE(dom.color, '#6B7280'),
		        COALESCE(e.properties, '{}'::jsonb)
		 FROM entities e
		 LEFT JOIN entity_types et ON et.id = e.entity_type_id
		 LEFT JOIN domains dom ON dom.id = e.domain_id
		 WHERE e.id = $1`, id,
	).Scan(&node.ID, &node.Label, &typeName, &typeIcon, &domainName, &domainColor, &properties)
	if err != nil {
		return TreeNode{}, fmt.Errorf("entity %s not found: %w", id, err)
	}

	node.Type = "entity"
	node.Icon = typeIcon
	node.DomainName = domainName
	node.DomainColor = domainColor
	node.URL = "/entities/" + id
	node.Meta = buildEntityMeta(typeName, properties)

	return node, nil
}

func (h *handler) loadDocument(ctx context.Context, id string, greenDays, yellowDays int) (TreeNode, error) {
	var node TreeNode
	var slug, typeName, domainName, domainColor string
	var viewCount int
	var createdAt, updatedAt time.Time
	var lastVerifiedAt *time.Time

	err := h.deps.DB.QueryRow(ctx,
		`SELECT d.id, d.title, d.slug,
		        COALESCE(dt.name, ''), COALESCE(dt.icon, '📄'),
		        COALESCE(dom.name, ''), COALESCE(dom.color, '#6B7280'),
		        d.view_count, d.created_at, d.updated_at, d.last_verified_at
		 FROM documents d
		 LEFT JOIN document_types dt ON dt.id = d.type_id
		 LEFT JOIN domains dom ON dom.id = d.domain_id
		 WHERE d.id = $1`, id,
	).Scan(&node.ID, &node.Label, &slug, &typeName, &node.Icon, &domainName, &domainColor, &viewCount, &createdAt, &updatedAt, &lastVerifiedAt)
	if err != nil {
		return TreeNode{}, fmt.Errorf("document %s not found: %w", id, err)
	}

	node.Type = "document"
	node.DomainName = domainName
	node.DomainColor = domainColor
	node.URL = "/documents/" + slug

	badge := document.ComputeFreshness(createdAt, updatedAt, lastVerifiedAt, greenDays, yellowDays)
	if badge != "" {
		node.FreshnessBadge = &badge
	}

	meta := typeName
	if viewCount > 0 {
		if meta != "" {
			meta += " · "
		}
		meta += fmt.Sprintf("%d vues", viewCount)
	}
	node.Meta = meta

	return node, nil
}

func (h *handler) loadBookmark(ctx context.Context, id string) (TreeNode, error) {
	var node TreeNode
	var bookmarkURL, domainName, domainColor string

	err := h.deps.DB.QueryRow(ctx,
		`SELECT b.id, b.title, b.url,
		        COALESCE(dom.name, ''), COALESCE(dom.color, '#6B7280')
		 FROM bookmarks b
		 LEFT JOIN domains dom ON dom.id = b.domain_id
		 WHERE b.id = $1`, id,
	).Scan(&node.ID, &node.Label, &bookmarkURL, &domainName, &domainColor)
	if err != nil {
		return TreeNode{}, fmt.Errorf("bookmark %s not found: %w", id, err)
	}

	node.Type = "bookmark"
	node.Icon = "🔖"
	node.DomainName = domainName
	node.DomainColor = domainColor
	node.URL = bookmarkURL

	if parsed, err := url.Parse(bookmarkURL); err == nil {
		node.Meta = parsed.Hostname()
	}

	return node, nil
}

// ---------- Find connections (BFS level) ----------

func (h *handler) findConnections(ctx context.Context, nodeType, nodeID string, remainingDepth int, visited map[string]bool, greenDays, yellowDays int) ([]RelationGroup, error) {
	type connectedItem struct {
		nodeType     string
		nodeID       string
		relation     string
		relationGrp  string
	}

	var items []connectedItem

	switch nodeType {
	case "entity":
		// Single UNION ALL query for all entity connections
		rows, err := h.deps.DB.Query(ctx,
			`SELECT 'entity' AS node_type, er.target_id AS node_id, rt.name AS rel, rt.slug AS rel_grp
			 FROM entity_relations er
			 JOIN relation_types rt ON rt.id = er.relation_type_id
			 WHERE er.source_id = $1
			 UNION ALL
			 SELECT 'entity', er.source_id, COALESCE(rt.inverse_name, rt.name), rt.slug
			 FROM entity_relations er
			 JOIN relation_types rt ON rt.id = er.relation_type_id
			 WHERE er.target_id = $1
			 UNION ALL
			 SELECT 'document', ed.document_id, 'documenté par', 'documentation'
			 FROM entity_documents ed WHERE ed.entity_id = $1
			 UNION ALL
			 SELECT 'bookmark', eb.bookmark_id, 'lié à', 'bookmarks'
			 FROM entity_bookmarks eb WHERE eb.entity_id = $1`, nodeID)
		if err != nil {
			log.Printf("mindmap: findConnections entity %s: %v", nodeID, err)
			return nil, fmt.Errorf("find entity connections: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var nt, nid, rel, rg string
			if rows.Scan(&nt, &nid, &rel, &rg) == nil {
				items = append(items, connectedItem{nt, nid, rel, rg})
			}
		}

	case "document":
		// Single UNION ALL query for all document connections
		rows, err := h.deps.DB.Query(ctx,
			`SELECT 'document' AS node_type, dl.target_id AS node_id, 'lien vers' AS rel, 'liens internes' AS rel_grp
			 FROM document_links dl WHERE dl.source_id = $1
			 UNION ALL
			 SELECT 'document', dl.source_id, 'référencé par', 'liens internes'
			 FROM document_links dl WHERE dl.target_id = $1
			 UNION ALL
			 SELECT 'entity', ed.entity_id, 'entité liée', 'entités'
			 FROM entity_documents ed WHERE ed.document_id = $1`, nodeID)
		if err != nil {
			log.Printf("mindmap: findConnections document %s: %v", nodeID, err)
			return nil, fmt.Errorf("find document connections: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var nt, nid, rel, rg string
			if rows.Scan(&nt, &nid, &rel, &rg) == nil {
				items = append(items, connectedItem{nt, nid, rel, rg})
			}
		}

	case "bookmark":
		rows, err := h.deps.DB.Query(ctx,
			`SELECT eb.entity_id FROM entity_bookmarks eb WHERE eb.bookmark_id = $1`, nodeID)
		if err != nil {
			log.Printf("mindmap: findConnections bookmark %s: %v", nodeID, err)
			return nil, fmt.Errorf("find bookmark connections: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var entityID string
			if rows.Scan(&entityID) == nil {
				items = append(items, connectedItem{"entity", entityID, "entité liée", "entités"})
			}
		}
	}

	// Group by relation, skip visited nodes (anti-cycle)
	type groupKey struct {
		relation    string
		relationGrp string
	}
	grouped := make(map[groupKey][]connectedItem)
	var order []groupKey

	for _, item := range items {
		key := item.nodeType + ":" + item.nodeID
		if visited[key] {
			continue
		}
		gk := groupKey{item.relation, item.relationGrp}
		if _, exists := grouped[gk]; !exists {
			order = append(order, gk)
		}
		grouped[gk] = append(grouped[gk], item)
	}

	var groups []RelationGroup
	for _, gk := range order {
		grpItems := grouped[gk]
		rg := RelationGroup{
			Relation:      gk.relation,
			RelationGroup: gk.relationGrp,
			Items:         make([]TreeNode, 0, len(grpItems)),
		}
		for _, item := range grpItems {
			childKey := item.nodeType + ":" + item.nodeID
			if visited[childKey] {
				continue // double-check after concurrent additions
			}

			if remainingDepth <= 0 {
				// Leaf: load node info + children count only
				childNode, err := h.buildNode(ctx, item.nodeType, item.nodeID, 0, visited, greenDays, yellowDays)
				if err != nil {
					continue
				}
				count, hasChildren := h.countChildren(ctx, item.nodeType, item.nodeID, visited)
				childNode.HasChildren = hasChildren
				childNode.ChildrenCount = count
				childNode.Children = nil
				rg.Items = append(rg.Items, childNode)
			} else {
				childNode, err := h.buildNode(ctx, item.nodeType, item.nodeID, remainingDepth, visited, greenDays, yellowDays)
				if err != nil {
					continue
				}
				childNode.HasChildren = len(childNode.Children) > 0
				childNode.ChildrenCount = countItems(childNode.Children)
				rg.Items = append(rg.Items, childNode)
			}
		}
		if len(rg.Items) > 0 {
			groups = append(groups, rg)
		}
	}

	return groups, nil
}

// ---------- Domain root ----------

func (h *handler) buildDomainRoot(ctx context.Context, domainID string, depth int, visited map[string]bool, greenDays, yellowDays int) (TreeNode, error) {
	var name, color, icon string
	err := h.deps.DB.QueryRow(ctx,
		`SELECT id, name, COALESCE(color, '#6B7280'), COALESCE(icon, '📁')
		 FROM domains WHERE id = $1`, domainID,
	).Scan(&domainID, &name, &color, &icon)
	if err != nil {
		return TreeNode{}, fmt.Errorf("domain %s not found: %w", domainID, err)
	}

	root := TreeNode{
		ID:          domainID,
		Type:        "domain",
		Label:       name,
		Icon:        icon,
		DomainName:  name,
		DomainColor: color,
		URL:         "/domains/" + domainID,
	}

	visited["domain:"+domainID] = true

	if depth <= 0 {
		return root, nil
	}

	// Group entities by entity_type
	entityRows, err := h.deps.DB.Query(ctx,
		`SELECT e.id, COALESCE(et.name, 'Entité'), COALESCE(et.slug, 'entity')
		 FROM entities e
		 LEFT JOIN entity_types et ON et.id = e.entity_type_id
		 WHERE e.domain_id = $1
		 ORDER BY et.name, e.name`, domainID)
	if err == nil {
		defer entityRows.Close()
		typeGroups := make(map[string][]string) // slug -> []entityID
		typeNames := make(map[string]string)    // slug -> name
		var typeOrder []string
		for entityRows.Next() {
			var eid, etName, etSlug string
			if entityRows.Scan(&eid, &etName, &etSlug) == nil {
				if _, exists := typeGroups[etSlug]; !exists {
					typeOrder = append(typeOrder, etSlug)
					typeNames[etSlug] = etName
				}
				typeGroups[etSlug] = append(typeGroups[etSlug], eid)
			}
		}
		for _, slug := range typeOrder {
			rg := RelationGroup{
				Relation:      typeNames[slug],
				RelationGroup: "entités",
				Items:         make([]TreeNode, 0),
			}
			for _, eid := range typeGroups[slug] {
				key := "entity:" + eid
				if visited[key] {
					continue
				}
				node, err := h.buildNode(ctx, "entity", eid, depth-1, visited, greenDays, yellowDays)
				if err != nil {
					continue
				}
				node.HasChildren = len(node.Children) > 0
				node.ChildrenCount = countItems(node.Children)
				if depth-1 <= 0 {
					count, has := h.countChildren(ctx, "entity", eid, visited)
					node.HasChildren = has
					node.ChildrenCount = count
					node.Children = nil
				}
				rg.Items = append(rg.Items, node)
			}
			if len(rg.Items) > 0 {
				root.Children = append(root.Children, rg)
			}
		}
	}

	// Documents by document_type
	docRows, err := h.deps.DB.Query(ctx,
		`SELECT d.id, COALESCE(dt.name, 'Document'), COALESCE(dt.slug, 'document')
		 FROM documents d
		 LEFT JOIN document_types dt ON dt.id = d.type_id
		 WHERE d.domain_id = $1
		 ORDER BY dt.name, d.title`, domainID)
	if err == nil {
		defer docRows.Close()
		typeGroups := make(map[string][]string)
		typeNames := make(map[string]string)
		var typeOrder []string
		for docRows.Next() {
			var did, dtName, dtSlug string
			if docRows.Scan(&did, &dtName, &dtSlug) == nil {
				if _, exists := typeGroups[dtSlug]; !exists {
					typeOrder = append(typeOrder, dtSlug)
					typeNames[dtSlug] = dtName
				}
				typeGroups[dtSlug] = append(typeGroups[dtSlug], did)
			}
		}
		for _, slug := range typeOrder {
			rg := RelationGroup{
				Relation:      typeNames[slug],
				RelationGroup: "documents",
				Items:         make([]TreeNode, 0),
			}
			for _, did := range typeGroups[slug] {
				key := "document:" + did
				if visited[key] {
					continue
				}
				node, err := h.buildNode(ctx, "document", did, depth-1, visited, greenDays, yellowDays)
				if err != nil {
					continue
				}
				node.HasChildren = len(node.Children) > 0
				node.ChildrenCount = countItems(node.Children)
				if depth-1 <= 0 {
					count, has := h.countChildren(ctx, "document", did, visited)
					node.HasChildren = has
					node.ChildrenCount = count
					node.Children = nil
				}
				rg.Items = append(rg.Items, node)
			}
			if len(rg.Items) > 0 {
				root.Children = append(root.Children, rg)
			}
		}
	}

	// Bookmarks
	bkRows, err := h.deps.DB.Query(ctx,
		`SELECT id FROM bookmarks WHERE domain_id = $1 ORDER BY title`, domainID)
	if err == nil {
		defer bkRows.Close()
		rg := RelationGroup{
			Relation:      "Bookmarks",
			RelationGroup: "bookmarks",
			Items:         make([]TreeNode, 0),
		}
		for bkRows.Next() {
			var bid string
			if bkRows.Scan(&bid) == nil {
				key := "bookmark:" + bid
				if visited[key] {
					continue
				}
				node, err := h.buildNode(ctx, "bookmark", bid, depth-1, visited, greenDays, yellowDays)
				if err != nil {
					continue
				}
				node.HasChildren = len(node.Children) > 0
				node.ChildrenCount = countItems(node.Children)
				if depth-1 <= 0 {
					count, has := h.countChildren(ctx, "bookmark", bid, visited)
					node.HasChildren = has
					node.ChildrenCount = count
					node.Children = nil
				}
				rg.Items = append(rg.Items, node)
			}
		}
		if len(rg.Items) > 0 {
			root.Children = append(root.Children, rg)
		}
	}

	root.HasChildren = len(root.Children) > 0
	root.ChildrenCount = countItems(root.Children)

	return root, nil
}

// ---------- Helpers ----------

// countChildren returns the number of direct connections for a node, excluding already-visited IDs.
func (h *handler) countChildren(ctx context.Context, nodeType, nodeID string, visited map[string]bool) (int, bool) {
	// Collect visited IDs per type for SQL exclusion
	visitedEntities := visitedIDsForType(visited, "entity")
	visitedDocuments := visitedIDsForType(visited, "document")
	visitedBookmarks := visitedIDsForType(visited, "bookmark")

	var count int
	switch nodeType {
	case "entity":
		_ = h.deps.DB.QueryRow(ctx,
			`SELECT
				(SELECT COUNT(*) FROM entity_relations WHERE source_id = $1 AND target_id != ALL($2))
			  + (SELECT COUNT(*) FROM entity_relations WHERE target_id = $1 AND source_id != ALL($2))
			  + (SELECT COUNT(*) FROM entity_documents WHERE entity_id = $1 AND document_id != ALL($3))
			  + (SELECT COUNT(*) FROM entity_bookmarks WHERE entity_id = $1 AND bookmark_id != ALL($4))`,
			nodeID, visitedEntities, visitedDocuments, visitedBookmarks).Scan(&count)
	case "document":
		_ = h.deps.DB.QueryRow(ctx,
			`SELECT
				(SELECT COUNT(*) FROM document_links WHERE source_id = $1 AND target_id != ALL($2))
			  + (SELECT COUNT(*) FROM document_links WHERE target_id = $1 AND source_id != ALL($2))
			  + (SELECT COUNT(*) FROM entity_documents WHERE document_id = $1 AND entity_id != ALL($3))`,
			nodeID, visitedDocuments, visitedEntities).Scan(&count)
	case "bookmark":
		_ = h.deps.DB.QueryRow(ctx,
			`SELECT COUNT(*) FROM entity_bookmarks WHERE bookmark_id = $1 AND entity_id != ALL($2)`,
			nodeID, visitedEntities).Scan(&count)
	}
	return count, count > 0
}

// visitedIDsForType extracts raw UUIDs from the visited map for a given type prefix.
func visitedIDsForType(visited map[string]bool, nodeType string) []string {
	prefix := nodeType + ":"
	var ids []string
	for k := range visited {
		if strings.HasPrefix(k, prefix) {
			ids = append(ids, strings.TrimPrefix(k, prefix))
		}
	}
	return ids
}

func countItems(groups []RelationGroup) int {
	n := 0
	for _, g := range groups {
		n += len(g.Items)
	}
	return n
}

func buildEntityMeta(typeName string, properties json.RawMessage) string {
	parts := []string{}
	if typeName != "" {
		parts = append(parts, typeName)
	}

	// Extract a few key properties for summary
	var props map[string]any
	if json.Unmarshal(properties, &props) == nil {
		// Common property keys to show in meta
		for _, key := range []string{"version", "status", "environnement", "ip", "os"} {
			if v, ok := props[key]; ok {
				if s, ok := v.(string); ok && s != "" {
					parts = append(parts, s)
				}
			}
		}
	}

	return strings.Join(parts, " · ")
}

func freshnessThresholds(ctx context.Context, deps *model.Deps) (int, int) {
	greenDays := 90
	yellowDays := 180
	var val string
	if err := deps.DB.QueryRow(ctx, `SELECT value FROM config WHERE key = 'freshness_green'`).Scan(&val); err == nil {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			greenDays = n
		}
	}
	if err := deps.DB.QueryRow(ctx, `SELECT value FROM config WHERE key = 'freshness_yellow'`).Scan(&val); err == nil {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			yellowDays = n
		}
	}
	return greenDays, yellowDays
}
