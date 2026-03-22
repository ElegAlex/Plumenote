package feed

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/document"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/alexmusic/plumenote/internal/model"
)

const (
	fallbackGreenDays  = 90
	fallbackYellowDays = 180
)

type handler struct {
	deps *model.Deps
}

type feedItem struct {
	ID             string   `json:"id"`
	Title          string   `json:"title"`
	Slug           string   `json:"slug"`
	DomainID       string   `json:"domain_id"`
	DomainName     string   `json:"domain_name"`
	DomainColor    string   `json:"domain_color"`
	TypeName       string   `json:"type_name"`
	TypeSlug       string   `json:"type_slug"`
	AuthorName     string   `json:"author_name"`
	UpdatedAt      string   `json:"updated_at"`
	FreshnessBadge string   `json:"freshness_badge"`
	Visibility     string   `json:"visibility"`
	Tags           []string `json:"tags"`
}

// getFeed handles GET /api/feed
func (h *handler) getFeed(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	domainID := q.Get("domain_id")
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	claims := auth.UserFromContext(r.Context())
	if claims == nil {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}

	// Default to user's domain if no domain_id query param
	if domainID == "" && claims.DomainID != "" {
		domainID = claims.DomainID
	}

	// Build query
	var conditions []string
	args := []any{limit, offset}
	paramIdx := 3

	if domainID != "" {
		conditions = append(conditions, fmt.Sprintf("AND d.domain_id = $%d", paramIdx))
		args = append(args, domainID)
		paramIdx++
	}

	where := strings.Join(conditions, " ")
	query := fmt.Sprintf(`
		SELECT d.id, d.title, d.slug, d.domain_id,
		       COALESCE(dom.name, '') AS domain_name,
		       COALESCE(dom.color, '') AS domain_color,
		       COALESCE(dt.name, '') AS type_name,
		       COALESCE(dt.slug, '') AS type_slug,
		       u.display_name AS author_name,
		       d.created_at, d.updated_at, d.last_verified_at, d.visibility
		FROM documents d
		JOIN users u ON u.id = d.author_id
		LEFT JOIN domains dom ON dom.id = d.domain_id
		LEFT JOIN document_types dt ON dt.id = d.type_id
		WHERE 1=1 %s
		ORDER BY d.updated_at DESC
		LIMIT $1 OFFSET $2`, where)

	rows, err := h.deps.DB.Query(r.Context(), query, args...)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query feed"})
		return
	}
	defer rows.Close()

	greenDays, yellowDays := h.freshnessThresholds(r)

	var items []feedItem
	for rows.Next() {
		var item feedItem
		var createdAt, updatedAt time.Time
		var lastVerifiedAt *time.Time
		if err := rows.Scan(&item.ID, &item.Title, &item.Slug, &item.DomainID,
			&item.DomainName, &item.DomainColor, &item.TypeName, &item.TypeSlug,
			&item.AuthorName, &createdAt, &updatedAt, &lastVerifiedAt, &item.Visibility); err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan feed item"})
			return
		}
		item.UpdatedAt = updatedAt.Format(time.RFC3339)
		item.FreshnessBadge = document.ComputeFreshness(createdAt, updatedAt, lastVerifiedAt, greenDays, yellowDays)
		item.Tags = h.getDocumentTags(r, item.ID)
		items = append(items, item)
	}
	if items == nil {
		items = []feedItem{}
	}
	httputil.WriteJSON(w, http.StatusOK, items)
}

// getPendingReviews handles GET /api/reviews/pending
func (h *handler) getPendingReviews(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	domainID := q.Get("domain_id")
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	claims := auth.UserFromContext(r.Context())
	if claims == nil {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}

	// Build query
	var conditions []string
	args := []any{limit, offset}
	paramIdx := 3

	// Always filter needs_review = true
	conditions = append(conditions, "AND d.needs_review = true")

	// Non-admin users can only see their domain's documents
	if claims.Role != "admin" {
		conditions = append(conditions, fmt.Sprintf("AND d.domain_id = $%d", paramIdx))
		args = append(args, claims.DomainID)
		paramIdx++
	}

	if domainID != "" {
		conditions = append(conditions, fmt.Sprintf("AND d.domain_id = $%d", paramIdx))
		args = append(args, domainID)
		paramIdx++
	}

	where := strings.Join(conditions, " ")
	query := fmt.Sprintf(`
		SELECT d.id, d.title, d.slug, d.domain_id,
		       COALESCE(dom.name, '') AS domain_name,
		       COALESCE(dom.color, '') AS domain_color,
		       COALESCE(dt.name, '') AS type_name,
		       COALESCE(dt.slug, '') AS type_slug,
		       u.display_name AS author_name,
		       d.created_at, d.updated_at, d.last_verified_at, d.visibility
		FROM documents d
		JOIN users u ON u.id = d.author_id
		LEFT JOIN domains dom ON dom.id = d.domain_id
		LEFT JOIN document_types dt ON dt.id = d.type_id
		WHERE 1=1 %s
		ORDER BY d.updated_at ASC
		LIMIT $1 OFFSET $2`, where)

	rows, err := h.deps.DB.Query(r.Context(), query, args...)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query pending reviews"})
		return
	}
	defer rows.Close()

	greenDays, yellowDays := h.freshnessThresholds(r)

	var items []feedItem
	for rows.Next() {
		var item feedItem
		var createdAt, updatedAt time.Time
		var lastVerifiedAt *time.Time
		if err := rows.Scan(&item.ID, &item.Title, &item.Slug, &item.DomainID,
			&item.DomainName, &item.DomainColor, &item.TypeName, &item.TypeSlug,
			&item.AuthorName, &createdAt, &updatedAt, &lastVerifiedAt, &item.Visibility); err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan review item"})
			return
		}
		item.UpdatedAt = updatedAt.Format(time.RFC3339)
		item.FreshnessBadge = document.ComputeFreshness(createdAt, updatedAt, lastVerifiedAt, greenDays, yellowDays)
		item.Tags = h.getDocumentTags(r, item.ID)
		items = append(items, item)
	}
	if items == nil {
		items = []feedItem{}
	}
	httputil.WriteJSON(w, http.StatusOK, items)
}

// freshnessThresholds reads green/yellow day thresholds from the config table.
func (h *handler) freshnessThresholds(r *http.Request) (int, int) {
	greenDays := fallbackGreenDays
	yellowDays := fallbackYellowDays
	var val string
	if err := h.deps.DB.QueryRow(r.Context(), `SELECT value FROM config WHERE key = 'freshness_green'`).Scan(&val); err == nil {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			greenDays = n
		}
	}
	if err := h.deps.DB.QueryRow(r.Context(), `SELECT value FROM config WHERE key = 'freshness_yellow'`).Scan(&val); err == nil {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			yellowDays = n
		}
	}
	return greenDays, yellowDays
}

// getDocumentTags fetches tag names for a document.
func (h *handler) getDocumentTags(r *http.Request, docID string) []string {
	rows, err := h.deps.DB.Query(r.Context(),
		`SELECT t.name FROM tags t
		 JOIN document_tags dt ON dt.tag_id = t.id
		 WHERE dt.document_id = $1 ORDER BY t.name`, docID)
	if err != nil {
		return []string{}
	}
	defer rows.Close()
	var tags []string
	for rows.Next() {
		var name string
		if rows.Scan(&name) == nil {
			tags = append(tags, name)
		}
	}
	if tags == nil {
		tags = []string{}
	}
	return tags
}
