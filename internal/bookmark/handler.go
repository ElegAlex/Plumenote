package bookmark

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/meilisearch/meilisearch-go"
)

const meiliIndex = "documents"

type handler struct {
	deps *model.Deps
}

// --- JSON helpers ---

func readJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

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

func getUserDomainID(ctx context.Context) string {
	c := auth.UserFromContext(ctx)
	if c == nil {
		return ""
	}
	return c.DomainID
}

// --- Meilisearch struct ---

type searchBookmark struct {
	ID         string   `json:"id"`
	Title      string   `json:"title"`
	BodyText   string   `json:"body_text"`
	URL        string   `json:"url"`
	ObjectType string   `json:"object_type"`
	DomainID   string   `json:"domain_id"`
	Tags       []string `json:"tags"`
	AuthorName string   `json:"author_name"`
	CreatedAt  int64    `json:"created_at"`
	UpdatedAt  int64    `json:"updated_at"`
}

// --- Handlers ---

// listBookmarks handles GET /api/bookmarks
func (h *handler) listBookmarks(w http.ResponseWriter, r *http.Request) {
	domainID := r.URL.Query().Get("domain_id")
	q := r.URL.Query().Get("q")

	var conditions []string
	args := []any{}
	paramIdx := 1

	if domainID != "" {
		conditions = append(conditions, fmt.Sprintf("b.domain_id = $%d", paramIdx))
		args = append(args, domainID)
		paramIdx++
	}
	if q != "" {
		conditions = append(conditions, fmt.Sprintf("b.title ILIKE $%d", paramIdx))
		args = append(args, "%"+q+"%")
		paramIdx++
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT b.id, b.title, b.url, b.description, b.domain_id,
		       b.author_id, b.created_at, b.updated_at,
		       COALESCE(dom.name, '') AS domain_name,
		       COALESCE(dom.color, '') AS domain_color,
		       COALESCE(u.display_name, '') AS author_name
		FROM bookmarks b
		LEFT JOIN domains dom ON dom.id = b.domain_id
		LEFT JOIN users u ON u.id = b.author_id
		%s
		ORDER BY b.updated_at DESC`, where)

	rows, err := h.deps.DB.Query(r.Context(), query, args...)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list bookmarks"})
		return
	}
	defer rows.Close()

	type bookmarkDTO struct {
		ID          string    `json:"id"`
		Title       string    `json:"title"`
		URL         string    `json:"url"`
		Description string    `json:"description"`
		DomainID    *string   `json:"domain_id"`
		AuthorID    *string   `json:"author_id"`
		DomainName  string    `json:"domain_name"`
		DomainColor string    `json:"domain_color"`
		AuthorName  string    `json:"author_name"`
		Tags        []tagDTO  `json:"tags"`
		CreatedAt   time.Time `json:"created_at"`
		UpdatedAt   time.Time `json:"updated_at"`
	}

	var bookmarks []bookmarkDTO
	for rows.Next() {
		var b bookmarkDTO
		if err := rows.Scan(&b.ID, &b.Title, &b.URL, &b.Description, &b.DomainID,
			&b.AuthorID, &b.CreatedAt, &b.UpdatedAt,
			&b.DomainName, &b.DomainColor, &b.AuthorName); err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan bookmark"})
			return
		}
		tags, _ := h.getBookmarkTags(r.Context(), b.ID)
		b.Tags = tags
		bookmarks = append(bookmarks, b)
	}
	if bookmarks == nil {
		bookmarks = []bookmarkDTO{}
	}
	httputil.WriteJSON(w, http.StatusOK, bookmarks)
}

// getBookmark handles GET /api/bookmarks/{id}
func (h *handler) getBookmark(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	type bookmarkDetail struct {
		ID          string    `json:"id"`
		Title       string    `json:"title"`
		URL         string    `json:"url"`
		Description string    `json:"description"`
		DomainID    *string   `json:"domain_id"`
		AuthorID    *string   `json:"author_id"`
		DomainName  string    `json:"domain_name"`
		DomainColor string    `json:"domain_color"`
		AuthorName  string    `json:"author_name"`
		Tags        []tagDTO  `json:"tags"`
		CreatedAt   time.Time `json:"created_at"`
		UpdatedAt   time.Time `json:"updated_at"`
	}

	var b bookmarkDetail
	err := h.deps.DB.QueryRow(r.Context(),
		`SELECT b.id, b.title, b.url, b.description, b.domain_id,
		        b.author_id, b.created_at, b.updated_at,
		        COALESCE(dom.name, '') AS domain_name,
		        COALESCE(dom.color, '') AS domain_color,
		        COALESCE(u.display_name, '') AS author_name
		 FROM bookmarks b
		 LEFT JOIN domains dom ON dom.id = b.domain_id
		 LEFT JOIN users u ON u.id = b.author_id
		 WHERE b.id = $1`, id,
	).Scan(&b.ID, &b.Title, &b.URL, &b.Description, &b.DomainID,
		&b.AuthorID, &b.CreatedAt, &b.UpdatedAt,
		&b.DomainName, &b.DomainColor, &b.AuthorName)
	if err == pgx.ErrNoRows {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "bookmark not found"})
		return
	}
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get bookmark"})
		return
	}

	tags, _ := h.getBookmarkTags(r.Context(), b.ID)
	b.Tags = tags

	httputil.WriteJSON(w, http.StatusOK, b)
}

// createBookmark handles POST /api/bookmarks
func (h *handler) createBookmark(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r.Context())
	if userID == "" {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}

	var req struct {
		Title       string   `json:"title"`
		URL         string   `json:"url"`
		Description string   `json:"description"`
		DomainID    *string  `json:"domain_id"`
		Tags        []string `json:"tags"`
	}
	if err := readJSON(r, &req); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.Title == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
		return
	}
	if req.URL == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "url is required"})
		return
	}
	if !strings.HasPrefix(req.URL, "http://") && !strings.HasPrefix(req.URL, "https://") {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "url must start with http:// or https://"})
		return
	}

	var bookmark struct {
		ID          string    `json:"id"`
		Title       string    `json:"title"`
		URL         string    `json:"url"`
		Description string    `json:"description"`
		DomainID    *string   `json:"domain_id"`
		AuthorID    string    `json:"author_id"`
		CreatedAt   time.Time `json:"created_at"`
		UpdatedAt   time.Time `json:"updated_at"`
	}

	err := h.deps.DB.QueryRow(r.Context(),
		`INSERT INTO bookmarks (title, url, description, domain_id, author_id)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, title, url, description, domain_id, author_id, created_at, updated_at`,
		req.Title, req.URL, req.Description, req.DomainID, userID,
	).Scan(&bookmark.ID, &bookmark.Title, &bookmark.URL, &bookmark.Description,
		&bookmark.DomainID, &bookmark.AuthorID, &bookmark.CreatedAt, &bookmark.UpdatedAt)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create bookmark"})
		return
	}

	// Sync tags
	if len(req.Tags) > 0 {
		h.syncTags(r.Context(), bookmark.ID, req.Tags)
	}

	// Index in Meilisearch async
	go h.indexBookmark(bookmark.ID)

	httputil.WriteJSON(w, http.StatusCreated, bookmark)
}

// updateBookmark handles PUT /api/bookmarks/{id}
func (h *handler) updateBookmark(w http.ResponseWriter, r *http.Request) {
	bookmarkID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())
	userDomainID := getUserDomainID(r.Context())

	if userID == "" {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}

	// Fetch existing bookmark for permission check
	var authorID string
	var bmDomainID *string
	err := h.deps.DB.QueryRow(r.Context(),
		"SELECT author_id, domain_id FROM bookmarks WHERE id = $1", bookmarkID,
	).Scan(&authorID, &bmDomainID)
	if err == pgx.ErrNoRows {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "bookmark not found"})
		return
	}
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get bookmark"})
		return
	}

	// RG-003: author OR same domain OR admin
	domainMatch := bmDomainID != nil && *bmDomainID == userDomainID
	if userRole != "admin" && authorID != userID && !domainMatch {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "you can only edit bookmarks in your domain"})
		return
	}

	var req struct {
		Title       string   `json:"title"`
		URL         string   `json:"url"`
		Description string   `json:"description"`
		DomainID    *string  `json:"domain_id"`
		Tags        []string `json:"tags"`
	}
	if err := readJSON(r, &req); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.Title == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
		return
	}
	if req.URL == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "url is required"})
		return
	}
	if !strings.HasPrefix(req.URL, "http://") && !strings.HasPrefix(req.URL, "https://") {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "url must start with http:// or https://"})
		return
	}

	var bookmark struct {
		ID        string    `json:"id"`
		Title     string    `json:"title"`
		URL       string    `json:"url"`
		UpdatedAt time.Time `json:"updated_at"`
	}
	err = h.deps.DB.QueryRow(r.Context(),
		`UPDATE bookmarks
		 SET title = $2, url = $3, description = $4, domain_id = $5, updated_at = now()
		 WHERE id = $1
		 RETURNING id, title, url, updated_at`,
		bookmarkID, req.Title, req.URL, req.Description, req.DomainID,
	).Scan(&bookmark.ID, &bookmark.Title, &bookmark.URL, &bookmark.UpdatedAt)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update bookmark"})
		return
	}

	// Sync tags
	h.syncTags(r.Context(), bookmarkID, req.Tags)

	// Re-index Meilisearch async
	go h.indexBookmark(bookmarkID)

	httputil.WriteJSON(w, http.StatusOK, bookmark)
}

// deleteBookmark handles DELETE /api/bookmarks/{id}
func (h *handler) deleteBookmark(w http.ResponseWriter, r *http.Request) {
	bookmarkID := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())

	if userID == "" {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}

	var authorID string
	err := h.deps.DB.QueryRow(r.Context(),
		"SELECT author_id FROM bookmarks WHERE id = $1", bookmarkID,
	).Scan(&authorID)
	if err == pgx.ErrNoRows {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "bookmark not found"})
		return
	}
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get bookmark"})
		return
	}

	// Permission: author OR admin
	if userRole != "admin" && authorID != userID {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "you can only delete your own bookmarks"})
		return
	}

	_, err = h.deps.DB.Exec(r.Context(), "DELETE FROM bookmarks WHERE id = $1", bookmarkID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete bookmark"})
		return
	}

	// De-index from Meilisearch async
	go func() {
		if h.deps.Meili != nil {
			idx := h.deps.Meili.Index(meiliIndex)
			_, _ = idx.DeleteDocument(bookmarkID, nil)
		}
	}()

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// --- Tag helpers ---

type tagDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

func (h *handler) getBookmarkTags(ctx context.Context, bookmarkID string) ([]tagDTO, error) {
	rows, err := h.deps.DB.Query(ctx,
		`SELECT t.id, t.name, t.slug FROM tags t
		 JOIN bookmark_tags bt ON bt.tag_id = t.id
		 WHERE bt.bookmark_id = $1 ORDER BY t.name`, bookmarkID)
	if err != nil {
		return []tagDTO{}, err
	}
	defer rows.Close()
	var tags []tagDTO
	for rows.Next() {
		var t tagDTO
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug); err != nil {
			return []tagDTO{}, err
		}
		tags = append(tags, t)
	}
	if tags == nil {
		tags = []tagDTO{}
	}
	return tags, nil
}

func (h *handler) syncTags(ctx context.Context, bookmarkID string, tagIDs []string) {
	if _, err := h.deps.DB.Exec(ctx, "DELETE FROM bookmark_tags WHERE bookmark_id = $1", bookmarkID); err != nil {
		log.Printf("syncTags: failed to delete tags for bookmark %s: %v", bookmarkID, err)
		return
	}
	for _, tagID := range tagIDs {
		if _, err := h.deps.DB.Exec(ctx,
			"INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
			bookmarkID, tagID); err != nil {
			log.Printf("syncTags: failed to insert tag %s for bookmark %s: %v", tagID, bookmarkID, err)
		}
	}
}

// --- Meilisearch indexing ---

func (h *handler) indexBookmark(bookmarkID string) {
	if h.deps.Meili == nil {
		return
	}
	ctx := context.Background()

	var sb searchBookmark
	var createdAt, updatedAt time.Time
	var authorName string
	err := h.deps.DB.QueryRow(ctx,
		`SELECT b.id, b.title, b.url, b.description, b.created_at, b.updated_at,
		        COALESCE(b.domain_id::text, '') AS domain_id,
		        COALESCE(u.display_name, '') AS author_name
		 FROM bookmarks b
		 LEFT JOIN users u ON u.id = b.author_id
		 WHERE b.id = $1`, bookmarkID,
	).Scan(&sb.ID, &sb.Title, &sb.URL, &sb.BodyText, &createdAt, &updatedAt,
		&sb.DomainID, &authorName)
	if err != nil {
		log.Printf("indexBookmark: failed to fetch bookmark %s: %v", bookmarkID, err)
		return
	}
	sb.ObjectType = "bookmark"
	sb.AuthorName = authorName
	sb.CreatedAt = createdAt.Unix()
	sb.UpdatedAt = updatedAt.Unix()

	// Fetch tags
	rows, err := h.deps.DB.Query(ctx,
		`SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = $1`, bookmarkID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var name string
			if rows.Scan(&name) == nil {
				sb.Tags = append(sb.Tags, name)
			}
		}
	}
	if sb.Tags == nil {
		sb.Tags = []string{}
	}

	idx := h.deps.Meili.Index(meiliIndex)
	pk := "id"
	if _, err := idx.AddDocuments([]searchBookmark{sb}, &meilisearch.DocumentOptions{PrimaryKey: &pk}); err != nil {
		log.Printf("indexBookmark: failed to index bookmark %s in Meilisearch: %v", bookmarkID, err)
	}
}
