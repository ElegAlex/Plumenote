package cartography

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/alexmusic/plumenote/internal/model"
)

type handler struct {
	deps *model.Deps
}

type node struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	TypeName          string `json:"type_name"`
	TypeIcon          string `json:"type_icon"`
	TypeSlug          string `json:"type_slug"`
	DomainID          string `json:"domain_id"`
	DomainName        string `json:"domain_name"`
	DomainColor       string `json:"domain_color"`
	PropertiesSummary string `json:"properties_summary"`
	IsGhost           bool   `json:"is_ghost"`
}

type edge struct {
	ID           string `json:"id"`
	Source       string `json:"source"`
	Target       string `json:"target"`
	RelationName string `json:"relation_name"`
	RelationSlug string `json:"relation_slug"`
}

type cartographyResponse struct {
	Nodes []node `json:"nodes"`
	Edges []edge `json:"edges"`
}

func (h *handler) getCartography(w http.ResponseWriter, r *http.Request) {
	domainID := r.URL.Query().Get("domain_id")

	// Global view requires admin/dsi
	if domainID == "" {
		c := auth.UserFromContext(r.Context())
		if c == nil || (c.Role != "admin" && c.Role != "dsi") {
			httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "global cartography requires admin or dsi role"})
			return
		}
	}

	ctx := r.Context()
	resp := cartographyResponse{Nodes: []node{}, Edges: []edge{}}

	// Fetch entities in the domain (or all for global)
	var entityQuery string
	var args []any
	if domainID != "" {
		entityQuery = `SELECT e.id, e.name, et.name, et.icon, et.slug,
		                      e.domain_id, dom.name, dom.color, e.properties
		               FROM entities e
		               JOIN entity_types et ON et.id = e.entity_type_id
		               JOIN domains dom ON dom.id = e.domain_id
		               WHERE e.domain_id = $1`
		args = []any{domainID}
	} else {
		entityQuery = `SELECT e.id, e.name, et.name, et.icon, et.slug,
		                      e.domain_id, dom.name, dom.color, e.properties
		               FROM entities e
		               JOIN entity_types et ON et.id = e.entity_type_id
		               JOIN domains dom ON dom.id = e.domain_id`
	}

	rows, err := h.deps.DB.Query(ctx, entityQuery, args...)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query entities"})
		return
	}
	defer rows.Close()

	nodeMap := make(map[string]bool)
	for rows.Next() {
		var n node
		var properties []byte
		if err := rows.Scan(&n.ID, &n.Name, &n.TypeName, &n.TypeIcon, &n.TypeSlug,
			&n.DomainID, &n.DomainName, &n.DomainColor, &properties); err != nil {
			continue
		}
		n.PropertiesSummary = propertiesSummary(properties)
		n.IsGhost = false
		nodeMap[n.ID] = true
		resp.Nodes = append(resp.Nodes, n)
	}

	// Fetch relations involving these entities
	var relQuery string
	if domainID != "" {
		relQuery = `SELECT er.id, er.source_id, er.target_id, rt.name, rt.slug
		            FROM entity_relations er
		            JOIN relation_types rt ON rt.id = er.relation_type_id
		            WHERE er.source_id IN (SELECT id FROM entities WHERE domain_id = $1)
		               OR er.target_id IN (SELECT id FROM entities WHERE domain_id = $1)`
		args = []any{domainID}
	} else {
		relQuery = `SELECT er.id, er.source_id, er.target_id, rt.name, rt.slug
		            FROM entity_relations er
		            JOIN relation_types rt ON rt.id = er.relation_type_id`
		args = nil
	}

	relRows, err := h.deps.DB.Query(ctx, relQuery, args...)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query relations"})
		return
	}
	defer relRows.Close()

	ghostIDs := make(map[string]bool)
	for relRows.Next() {
		var e edge
		if err := relRows.Scan(&e.ID, &e.Source, &e.Target, &e.RelationName, &e.RelationSlug); err != nil {
			continue
		}
		resp.Edges = append(resp.Edges, e)

		// Track ghost entities (from other domains)
		if !nodeMap[e.Source] {
			ghostIDs[e.Source] = true
		}
		if !nodeMap[e.Target] {
			ghostIDs[e.Target] = true
		}
	}

	// Fetch ghost entities (batch query to avoid N+1)
	if len(ghostIDs) > 0 {
		ghostIDSlice := make([]string, 0, len(ghostIDs))
		for id := range ghostIDs {
			ghostIDSlice = append(ghostIDSlice, id)
		}

		ghostRows, err := h.deps.DB.Query(ctx,
			`SELECT e.id, e.name, et.name, et.icon, et.slug,
			        e.domain_id, dom.name, dom.color, e.properties
			 FROM entities e
			 JOIN entity_types et ON et.id = e.entity_type_id
			 JOIN domains dom ON dom.id = e.domain_id
			 WHERE e.id = ANY($1)`, ghostIDSlice)
		if err == nil {
			defer ghostRows.Close()
			for ghostRows.Next() {
				var n node
				var properties []byte
				if err := ghostRows.Scan(&n.ID, &n.Name, &n.TypeName, &n.TypeIcon, &n.TypeSlug,
					&n.DomainID, &n.DomainName, &n.DomainColor, &properties); err != nil {
					continue
				}
				n.PropertiesSummary = propertiesSummary(properties)
				n.IsGhost = true
				resp.Nodes = append(resp.Nodes, n)
			}
		}
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

func propertiesSummary(properties []byte) string {
	if len(properties) == 0 {
		return ""
	}

	// Parse as map and take first 2-3 non-empty values
	var m map[string]interface{}
	if err := json.Unmarshal(properties, &m); err != nil {
		return ""
	}

	var parts []string
	for _, val := range m {
		s := fmt.Sprintf("%v", val)
		if s != "" && s != "<nil>" {
			parts = append(parts, s)
			if len(parts) >= 3 {
				break
			}
		}
	}

	summary := strings.Join(parts, " · ")
	if len(summary) > 60 {
		summary = summary[:57] + "..."
	}
	return summary
}
