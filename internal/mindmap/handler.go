package mindmap

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/document"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/alexmusic/plumenote/internal/model"
)

type handler struct {
	deps *model.Deps
}

type mindmapNode struct {
	ID             string `json:"id"`
	Title          string `json:"title"`
	Slug           string `json:"slug"`
	DomainID       string `json:"domain_id"`
	DomainName     string `json:"domain_name"`
	DomainColor    string `json:"domain_color"`
	TypeName       string `json:"type_name"`
	FreshnessBadge string `json:"freshness_badge"`
	ViewCount      int    `json:"view_count"`
	IsOrphan       bool   `json:"is_orphan"`
	LinkCount      int    `json:"link_count"`
	IsGhost        bool   `json:"is_ghost"`
}

type mindmapEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Type   string `json:"type"`
	Label  string `json:"label"`
	Weight int    `json:"weight"`
}

type mindmapResponse struct {
	Nodes        []mindmapNode `json:"nodes"`
	Edges        []mindmapEdge `json:"edges"`
	OrphansCount int           `json:"orphans_count"`
}

func (h *handler) getMindMap(w http.ResponseWriter, r *http.Request) {
	domainID := r.URL.Query().Get("domain_id")

	// Global view requires admin/dsi
	if domainID == "" {
		c := auth.UserFromContext(r.Context())
		if c == nil || (c.Role != "admin" && c.Role != "dsi") {
			httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "global mind map requires admin or dsi role"})
			return
		}
	}

	ctx := r.Context()

	// 1. Fetch documents
	var docQuery string
	var args []any
	if domainID != "" {
		docQuery = `SELECT d.id, d.title, d.slug, d.domain_id,
		                   COALESCE(dom.name, '') AS domain_name,
		                   COALESCE(dom.color, '#6B7280') AS domain_color,
		                   COALESCE(dt.name, '') AS type_name,
		                   d.view_count, d.last_verified_at
		            FROM documents d
		            LEFT JOIN domains dom ON dom.id = d.domain_id
		            LEFT JOIN document_types dt ON dt.id = d.type_id
		            WHERE d.domain_id = $1`
		args = []any{domainID}
	} else {
		docQuery = `SELECT d.id, d.title, d.slug, d.domain_id,
		                   COALESCE(dom.name, '') AS domain_name,
		                   COALESCE(dom.color, '#6B7280') AS domain_color,
		                   COALESCE(dt.name, '') AS type_name,
		                   d.view_count, d.last_verified_at
		            FROM documents d
		            LEFT JOIN domains dom ON dom.id = d.domain_id
		            LEFT JOIN document_types dt ON dt.id = d.type_id`
	}

	rows, err := h.deps.DB.Query(ctx, docQuery, args...)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query documents"})
		return
	}
	defer rows.Close()

	// Freshness thresholds
	greenDays, yellowDays := h.freshnessThresholds(ctx)

	nodeMap := make(map[string]*mindmapNode)
	var docIDs []string
	for rows.Next() {
		var n mindmapNode
		var lastVerifiedAt *time.Time
		if err := rows.Scan(&n.ID, &n.Title, &n.Slug, &n.DomainID,
			&n.DomainName, &n.DomainColor, &n.TypeName,
			&n.ViewCount, &lastVerifiedAt); err != nil {
			continue
		}
		n.FreshnessBadge = document.ComputeFreshness(lastVerifiedAt, greenDays, yellowDays)
		n.IsGhost = false
		nodeMap[n.ID] = &n
		docIDs = append(docIDs, n.ID)
	}

	if len(docIDs) == 0 {
		httputil.WriteJSON(w, http.StatusOK, mindmapResponse{
			Nodes: []mindmapNode{}, Edges: []mindmapEdge{}, OrphansCount: 0,
		})
		return
	}

	// Edge deduplication: key = "min(a,b)|max(a,b)"
	type edgeKey struct{ a, b string }
	makeKey := func(s, t string) edgeKey {
		if s < t {
			return edgeKey{s, t}
		}
		return edgeKey{t, s}
	}
	edgeMap := make(map[edgeKey]*mindmapEdge)
	linkCount := make(map[string]int)

	addEdge := func(source, target, etype, label string, weight int) {
		k := makeKey(source, target)
		if existing, ok := edgeMap[k]; ok {
			if weight > existing.Weight {
				existing.Type = etype
				existing.Label = label
				existing.Weight = weight
			}
		} else {
			edgeMap[k] = &mindmapEdge{
				Source: k.a, Target: k.b,
				Type: etype, Label: label, Weight: weight,
			}
		}
		linkCount[source]++
		linkCount[target]++
	}

	// 2a. Internal links (weight 3)
	linkRows, err := h.deps.DB.Query(ctx,
		`SELECT source_id, target_id FROM document_links
		 WHERE source_id = ANY($1) OR target_id = ANY($1)`, docIDs)
	if err == nil {
		defer linkRows.Close()
		for linkRows.Next() {
			var src, tgt string
			if linkRows.Scan(&src, &tgt) == nil {
				addEdge(src, tgt, "internal_link", "", 3)
				// Track potential ghost nodes (domain mode)
				if _, ok := nodeMap[src]; !ok {
					nodeMap[src] = nil
				}
				if _, ok := nodeMap[tgt]; !ok {
					nodeMap[tgt] = nil
				}
			}
		}
	}

	// 2b. Shared entities (weight 2)
	entityRows, err := h.deps.DB.Query(ctx,
		`SELECT ed1.document_id, ed2.document_id, e.name
		 FROM entity_documents ed1
		 JOIN entity_documents ed2 ON ed1.entity_id = ed2.entity_id AND ed1.document_id < ed2.document_id
		 JOIN entities e ON e.id = ed1.entity_id
		 WHERE ed1.document_id = ANY($1) AND ed2.document_id = ANY($1)`, docIDs)
	if err == nil {
		defer entityRows.Close()
		for entityRows.Next() {
			var d1, d2, name string
			if entityRows.Scan(&d1, &d2, &name) == nil {
				addEdge(d1, d2, "shared_entity", name, 2)
			}
		}
	}

	// 2c. Shared tags (weight 1, minimum 2 shared)
	tagRows, err := h.deps.DB.Query(ctx,
		`SELECT dt1.document_id, dt2.document_id, COUNT(*) as shared
		 FROM document_tags dt1
		 JOIN document_tags dt2 ON dt1.tag_id = dt2.tag_id AND dt1.document_id < dt2.document_id
		 WHERE dt1.document_id = ANY($1) AND dt2.document_id = ANY($1)
		 GROUP BY dt1.document_id, dt2.document_id
		 HAVING COUNT(*) >= 2`, docIDs)
	if err == nil {
		defer tagRows.Close()
		for tagRows.Next() {
			var d1, d2 string
			var shared int
			if tagRows.Scan(&d1, &d2, &shared) == nil {
				addEdge(d1, d2, "shared_tags", "", 1)
			}
		}
	}

	// 3. Fetch ghost documents (connected but from other domains) - domain mode only
	if domainID != "" {
		var ghostIDs []string
		for id, n := range nodeMap {
			if n == nil {
				ghostIDs = append(ghostIDs, id)
			}
		}
		if len(ghostIDs) > 0 {
			ghostRows, err := h.deps.DB.Query(ctx,
				`SELECT d.id, d.title, d.slug, d.domain_id,
				        COALESCE(dom.name, '') AS domain_name,
				        COALESCE(dom.color, '#6B7280') AS domain_color,
				        COALESCE(dt.name, '') AS type_name,
				        d.view_count, d.last_verified_at
				 FROM documents d
				 LEFT JOIN domains dom ON dom.id = d.domain_id
				 LEFT JOIN document_types dt ON dt.id = d.type_id
				 WHERE d.id = ANY($1)`, ghostIDs)
			if err == nil {
				defer ghostRows.Close()
				for ghostRows.Next() {
					var n mindmapNode
					var lastVerifiedAt *time.Time
					if err := ghostRows.Scan(&n.ID, &n.Title, &n.Slug, &n.DomainID,
						&n.DomainName, &n.DomainColor, &n.TypeName,
						&n.ViewCount, &lastVerifiedAt); err != nil {
						continue
					}
					n.FreshnessBadge = document.ComputeFreshness(lastVerifiedAt, greenDays, yellowDays)
					n.IsGhost = true
					nodeMap[n.ID] = &n
				}
			}
		}
	}

	// 4. Build response
	resp := mindmapResponse{
		Nodes: []mindmapNode{},
		Edges: []mindmapEdge{},
	}

	for _, e := range edgeMap {
		resp.Edges = append(resp.Edges, *e)
	}

	orphansCount := 0
	for id, n := range nodeMap {
		if n == nil {
			continue // unresolved ghost
		}
		n.LinkCount = linkCount[id]
		n.IsOrphan = n.LinkCount == 0
		if n.IsOrphan && !n.IsGhost {
			orphansCount++
		}
		resp.Nodes = append(resp.Nodes, *n)
	}
	resp.OrphansCount = orphansCount

	httputil.WriteJSON(w, http.StatusOK, resp)
}

func (h *handler) freshnessThresholds(ctx context.Context) (int, int) {
	greenDays := 90
	yellowDays := 180
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
