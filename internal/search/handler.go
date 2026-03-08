package search

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/meilisearch/meilisearch-go"
)

var uuidRegexp = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type searchResult struct {
	ID                string   `json:"id"`
	Title             string   `json:"title"`
	BodyTextHighlight string   `json:"body_text_highlight"`
	ObjectType        string   `json:"object_type"`
	URL               string   `json:"url,omitempty"`
	DomainID          string   `json:"domain_id"`
	DomainName        string   `json:"domain_name,omitempty"`
	DomainColor       string   `json:"domain_color,omitempty"`
	TypeID            string   `json:"type_id"`
	Visibility        string   `json:"visibility"`
	Tags              []string `json:"tags"`
	AuthorName        string   `json:"author_name"`
	ViewCount         int      `json:"view_count"`
	FreshnessBadge    string   `json:"freshness_badge"`
	CreatedAt         string   `json:"created_at"`
}

type searchResponse struct {
	Results          []searchResult `json:"results"`
	Total            int64          `json:"total"`
	Query            string         `json:"query"`
	ProcessingTimeMs int64          `json:"processing_time_ms"`
}

func handleSearch(deps *model.Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		if len(q) < 2 {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "query must be at least 2 characters"})
			return
		}

		domain := r.URL.Query().Get("domain")
		docType := r.URL.Query().Get("type")
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
		if limit <= 0 || limit > 50 {
			limit = 20
		}
		if offset < 0 {
			offset = 0
		}

		// Build filters
		var filters []string
		var role string
		if c := auth.UserFromContext(r.Context()); c != nil {
			role = c.Role
		}
		if role != "dsi" && role != "admin" {
			filters = append(filters, "visibility = public")
		}
		if domain != "" && uuidRegexp.MatchString(domain) {
			filters = append(filters, fmt.Sprintf("domain_id = \"%s\"", domain))
		}
		if docType != "" && uuidRegexp.MatchString(docType) {
			filters = append(filters, fmt.Sprintf("type_id = \"%s\"", docType))
		}

		searchReq := &meilisearch.SearchRequest{
			Filter:                filters,
			AttributesToHighlight: []string{"title", "body_text"},
			HighlightPreTag:       "<mark>",
			HighlightPostTag:      "</mark>",
			Limit:                 int64(limit),
			Offset:                int64(offset),
		}

		searchRes, err := deps.Meili.Index("documents").Search(q, searchReq)
		if err != nil {
			httputil.WriteJSON(w, http.StatusBadGateway, map[string]string{"error": "search engine error"})
			return
		}

		// Decode hits into generic maps
		type hitMap = map[string]interface{}
		decodedHits := make([]hitMap, 0, len(searchRes.Hits))
		for _, hit := range searchRes.Hits {
			var m hitMap
			if err := hit.Decode(&m); err != nil {
				continue
			}
			decodedHits = append(decodedHits, m)
		}

		// Collect document IDs for batch freshness lookup (skip bookmarks)
		docIDs := make([]string, 0, len(decodedHits))
		for _, m := range decodedHits {
			if id, ok := m["id"].(string); ok {
				objType := getString(m, "object_type")
				if objType != "bookmark" {
					docIDs = append(docIDs, id)
				}
			}
		}

		// Batch fetch last_verified_at from PG
		greenDays, yellowDays := readFreshnessConfig(r.Context(), deps)
		freshnessMap := batchFreshness(r.Context(), deps, docIDs, greenDays, yellowDays)

		results := make([]searchResult, 0, len(decodedHits))
		for _, m := range decodedHits {
			formatted := mapToFormatted(m)

			sr := searchResult{
				ID:         getString(m, "id"),
				Title:      getString(formatted, "title"),
				ObjectType: getString(m, "object_type"),
				URL:        getString(m, "url"),
				DomainID:   getString(m, "domain_id"),
				TypeID:     getString(m, "type_id"),
				Visibility: getString(m, "visibility"),
				AuthorName: getString(m, "author_name"),
				ViewCount:  getInt(m, "view_count"),
				CreatedAt:  getString(m, "created_at"),
			}

			if bodyHL := getString(formatted, "body_text"); bodyHL != "" {
				sr.BodyTextHighlight = bodyHL
			} else {
				sr.BodyTextHighlight = getString(m, "body_text")
			}

			if tags, ok := m["tags"].([]interface{}); ok {
				sr.Tags = make([]string, 0, len(tags))
				for _, t := range tags {
					if s, ok := t.(string); ok {
						sr.Tags = append(sr.Tags, s)
					}
				}
			}
			if sr.Tags == nil {
				sr.Tags = []string{}
			}

			if sr.ObjectType != "bookmark" {
				sr.FreshnessBadge = freshnessMap[sr.ID]
			}
			results = append(results, sr)
		}

		resp := searchResponse{
			Results:          results,
			Total:            searchRes.EstimatedTotalHits,
			Query:            q,
			ProcessingTimeMs: searchRes.ProcessingTimeMs,
		}

		httputil.WriteJSON(w, http.StatusOK, resp)
	}
}

func batchFreshness(ctx context.Context, deps *model.Deps, ids []string, greenDays, yellowDays int) map[string]string {
	result := make(map[string]string, len(ids))
	if len(ids) == 0 || deps.DB == nil {
		for _, id := range ids {
			result[id] = "red"
		}
		return result
	}

	rows, err := deps.DB.Query(ctx,
		`SELECT id, last_verified_at FROM documents WHERE id = ANY($1)`, ids)
	if err != nil {
		for _, id := range ids {
			result[id] = "red"
		}
		return result
	}
	defer rows.Close()

	verified := make(map[string]time.Time)
	for rows.Next() {
		var id string
		var lastVerified *time.Time
		if err := rows.Scan(&id, &lastVerified); err != nil {
			continue
		}
		if lastVerified != nil {
			verified[id] = *lastVerified
		}
	}

	now := time.Now()
	for _, id := range ids {
		t, ok := verified[id]
		if !ok {
			result[id] = "red"
			continue
		}
		result[id] = computeBadge(now, t, greenDays, yellowDays)
	}
	return result
}

func computeBadge(now, verified time.Time, greenDays, yellowDays int) string {
	days := int(now.Sub(verified).Hours() / 24)
	switch {
	case days <= greenDays:
		return "green"
	case days <= yellowDays:
		return "yellow"
	default:
		return "red"
	}
}

func readFreshnessConfig(ctx context.Context, deps *model.Deps) (int, int) {
	greenDays, yellowDays := 90, 180
	if deps.DB == nil {
		return greenDays, yellowDays
	}
	var val string
	if err := deps.DB.QueryRow(ctx, `SELECT value FROM config WHERE key = 'freshness_green'`).Scan(&val); err == nil {
		if n, _ := strconv.Atoi(val); n > 0 {
			greenDays = n
		}
	}
	if err := deps.DB.QueryRow(ctx, `SELECT value FROM config WHERE key = 'freshness_yellow'`).Scan(&val); err == nil {
		if n, _ := strconv.Atoi(val); n > 0 {
			yellowDays = n
		}
	}
	return greenDays, yellowDays
}

func mapToFormatted(m map[string]interface{}) map[string]interface{} {
	formatted, ok := m["_formatted"].(map[string]interface{})
	if ok {
		return formatted
	}
	return m
}

func getString(m map[string]interface{}, key string) string {
	v, _ := m[key].(string)
	return v
}

func getInt(m map[string]interface{}, key string) int {
	switch v := m[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	default:
		return 0
	}
}

