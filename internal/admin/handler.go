package admin

import (
	"crypto/rand"
	"encoding/json"
	"math/big"
	"net/http"
	"strconv"
	"time"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// --- Helpers ---

const alphanumChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func generatePassword(length int) string {
	b := make([]byte, length)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(alphanumChars))))
		b[i] = alphanumChars[n.Int64()]
	}
	return string(b)
}

func requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c := auth.UserFromContext(r.Context())
		if c == nil {
			httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		if c.Role != "admin" {
			httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func timeStr(t time.Time) string {
	return t.Format(time.RFC3339)
}

func timePtrStr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.RFC3339)
	return &s
}

// --- Templates ---

type templateResponse struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Content     json.RawMessage `json:"content"`
	TypeID      *string         `json:"type_id,omitempty"`
	IsDefault   bool            `json:"is_default"`
	UsageCount  int             `json:"usage_count"`
	CreatedBy   *string         `json:"created_by,omitempty"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
}

type createTemplateRequest struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Content     json.RawMessage `json:"content"`
	TypeID      *string         `json:"type_id,omitempty"`
}

func handleListTemplates(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(),
			`SELECT id, name, description, content, type_id::text, is_default, usage_count, created_by::text, created_at, updated_at
			 FROM templates ORDER BY usage_count DESC, name`)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list templates"})
			return
		}
		defer rows.Close()

		templates := []templateResponse{}
		for rows.Next() {
			var t templateResponse
			var createdAt, updatedAt time.Time
			err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.Content, &t.TypeID, &t.IsDefault, &t.UsageCount, &t.CreatedBy, &createdAt, &updatedAt)
			if err != nil {
				httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan template"})
				return
			}
			t.CreatedAt = timeStr(createdAt)
			t.UpdatedAt = timeStr(updatedAt)
			templates = append(templates, t)
		}

		httputil.WriteJSON(w, http.StatusOK, templates)
	}
}

func handleCreateTemplate(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c := auth.UserFromContext(r.Context())

		var req createTemplateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if req.Name == "" {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		if req.Content == nil {
			req.Content = json.RawMessage(`{}`)
		}

		var t templateResponse
		var createdAt, updatedAt time.Time
		err := pool.QueryRow(r.Context(),
			`INSERT INTO templates (name, description, content, type_id, is_default, created_by)
			 VALUES ($1, $2, $3, $4, false, $5)
			 RETURNING id, name, description, content, type_id::text, is_default, usage_count, created_by::text, created_at, updated_at`,
			req.Name, req.Description, req.Content, req.TypeID, c.UserID,
		).Scan(&t.ID, &t.Name, &t.Description, &t.Content, &t.TypeID, &t.IsDefault, &t.UsageCount, &t.CreatedBy, &createdAt, &updatedAt)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create template"})
			return
		}
		t.CreatedAt = timeStr(createdAt)
		t.UpdatedAt = timeStr(updatedAt)

		httputil.WriteJSON(w, http.StatusCreated, t)
	}
}

func handleUpdateTemplate(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		var req createTemplateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if req.Name == "" {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		if req.Content == nil {
			req.Content = json.RawMessage(`{}`)
		}

		var t templateResponse
		var createdAt, updatedAt time.Time
		err := pool.QueryRow(r.Context(),
			`UPDATE templates
			 SET name = $2, description = $3, content = $4, type_id = $5, updated_at = now()
			 WHERE id = $1
			 RETURNING id, name, description, content, type_id::text, is_default, usage_count, created_by::text, created_at, updated_at`,
			id, req.Name, req.Description, req.Content, req.TypeID,
		).Scan(&t.ID, &t.Name, &t.Description, &t.Content, &t.TypeID, &t.IsDefault, &t.UsageCount, &t.CreatedBy, &createdAt, &updatedAt)
		if err != nil {
			httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "template not found"})
			return
		}
		t.CreatedAt = timeStr(createdAt)
		t.UpdatedAt = timeStr(updatedAt)

		httputil.WriteJSON(w, http.StatusOK, t)
	}
}

func handleDeleteTemplate(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		tag, err := pool.Exec(r.Context(), `DELETE FROM templates WHERE id = $1`, id)
		if err != nil || tag.RowsAffected() == 0 {
			httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "template not found"})
			return
		}

		httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "template deleted"})
	}
}

// --- Domains ---

type domainResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	Color     string `json:"color"`
	Icon      string `json:"icon"`
	SortOrder int    `json:"sort_order"`
	DocCount  int    `json:"doc_count"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type createDomainRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
	Icon  string `json:"icon"`
}

func handleListDomains(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(),
			`SELECT d.id, d.name, d.slug, d.color, d.icon, d.sort_order,
			        COALESCE((SELECT count(*) FROM documents WHERE domain_id = d.id), 0) AS doc_count,
			        d.created_at, d.updated_at
			 FROM domains d ORDER BY d.sort_order, d.name`)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list domains"})
			return
		}
		defer rows.Close()

		domains := []domainResponse{}
		for rows.Next() {
			var d domainResponse
			var createdAt, updatedAt time.Time
			err := rows.Scan(&d.ID, &d.Name, &d.Slug, &d.Color, &d.Icon, &d.SortOrder, &d.DocCount, &createdAt, &updatedAt)
			if err != nil {
				httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan domain"})
				return
			}
			d.CreatedAt = timeStr(createdAt)
			d.UpdatedAt = timeStr(updatedAt)
			domains = append(domains, d)
		}

		httputil.WriteJSON(w, http.StatusOK, domains)
	}
}

func handleCreateDomain(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req createDomainRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if req.Name == "" {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		if req.Color == "" {
			req.Color = "#6B7280"
		}
		if req.Icon == "" {
			req.Icon = "folder"
		}

		slug := httputil.GenerateSlug(req.Name)

		var d domainResponse
		var createdAt, updatedAt time.Time
		err := pool.QueryRow(r.Context(),
			`INSERT INTO domains (name, slug, color, icon, sort_order)
			 VALUES ($1, $2, $3, $4, 0)
			 RETURNING id, name, slug, color, icon, sort_order, created_at, updated_at`,
			req.Name, slug, req.Color, req.Icon,
		).Scan(&d.ID, &d.Name, &d.Slug, &d.Color, &d.Icon, &d.SortOrder, &createdAt, &updatedAt)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create domain"})
			return
		}
		d.DocCount = 0
		d.CreatedAt = timeStr(createdAt)
		d.UpdatedAt = timeStr(updatedAt)

		httputil.WriteJSON(w, http.StatusCreated, d)
	}
}

func handleUpdateDomain(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		var req createDomainRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if req.Name == "" {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}

		slug := httputil.GenerateSlug(req.Name)

		var d domainResponse
		var createdAt, updatedAt time.Time
		err := pool.QueryRow(r.Context(),
			`UPDATE domains
			 SET name = $2, slug = $3, color = $4, icon = $5, updated_at = now()
			 WHERE id = $1
			 RETURNING id, name, slug, color, icon, sort_order, created_at, updated_at`,
			id, req.Name, slug, req.Color, req.Icon,
		).Scan(&d.ID, &d.Name, &d.Slug, &d.Color, &d.Icon, &d.SortOrder, &createdAt, &updatedAt)
		if err != nil {
			httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "domain not found"})
			return
		}
		d.CreatedAt = timeStr(createdAt)
		d.UpdatedAt = timeStr(updatedAt)

		pool.QueryRow(r.Context(), `SELECT count(*) FROM documents WHERE domain_id = $1`, id).Scan(&d.DocCount)

		httputil.WriteJSON(w, http.StatusOK, d)
	}
}

func handleDeleteDomain(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		var docCount int
		err := pool.QueryRow(r.Context(), `SELECT count(*) FROM documents WHERE domain_id = $1`, id).Scan(&docCount)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to check domain usage"})
			return
		}
		if docCount > 0 {
			httputil.WriteJSON(w, http.StatusConflict, map[string]string{
				"error": "cannot delete domain: " + strconv.Itoa(docCount) + " document(s) still exist in this domain",
			})
			return
		}

		tag, err := pool.Exec(r.Context(), `DELETE FROM domains WHERE id = $1`, id)
		if err != nil || tag.RowsAffected() == 0 {
			httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "domain not found"})
			return
		}

		httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "domain deleted"})
	}
}

// --- Users ---

type userResponse struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name"`
	Role        string  `json:"role"`
	DomainID    *string `json:"domain_id,omitempty"`
	LastLoginAt *string `json:"last_login_at,omitempty"`
	CreatedAt   string  `json:"created_at"`
}

type createUserRequest struct {
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name"`
	Password    string  `json:"password"`
	Role        string  `json:"role"`
	DomainID    *string `json:"domain_id,omitempty"`
}

type updateUserRequest struct {
	DisplayName string  `json:"display_name"`
	Role        string  `json:"role"`
	DomainID    *string `json:"domain_id,omitempty"`
}

func handleListUsers(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(),
			`SELECT id, username, display_name, role, domain_id::text, last_login_at, created_at
			 FROM users ORDER BY created_at DESC`)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list users"})
			return
		}
		defer rows.Close()

		users := []userResponse{}
		for rows.Next() {
			var u userResponse
			var lastLogin *time.Time
			var createdAt time.Time
			err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.Role, &u.DomainID, &lastLogin, &createdAt)
			if err != nil {
				httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan user"})
				return
			}
			u.CreatedAt = timeStr(createdAt)
			u.LastLoginAt = timePtrStr(lastLogin)
			users = append(users, u)
		}

		httputil.WriteJSON(w, http.StatusOK, users)
	}
}

func handleCreateUser(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req createUserRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if req.Username == "" || req.Password == "" {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "username and password are required"})
			return
		}
		if len(req.Password) < 8 {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 8 characters"})
			return
		}
		if req.Role == "" {
			req.Role = "dsi"
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
			return
		}

		var u userResponse
		var createdAt time.Time
		err = pool.QueryRow(r.Context(),
			`INSERT INTO users (username, display_name, password_hash, role, domain_id)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, username, display_name, role, domain_id::text, created_at`,
			req.Username, req.DisplayName, string(hash), req.Role, req.DomainID,
		).Scan(&u.ID, &u.Username, &u.DisplayName, &u.Role, &u.DomainID, &createdAt)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create user"})
			return
		}
		u.CreatedAt = timeStr(createdAt)

		httputil.WriteJSON(w, http.StatusCreated, u)
	}
}

func handleUpdateUser(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		var req updateUserRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		var u userResponse
		var createdAt time.Time
		var lastLogin *time.Time
		err := pool.QueryRow(r.Context(),
			`UPDATE users
			 SET display_name = $2, role = $3, domain_id = $4, updated_at = now()
			 WHERE id = $1
			 RETURNING id, username, display_name, role, domain_id::text, last_login_at, created_at`,
			id, req.DisplayName, req.Role, req.DomainID,
		).Scan(&u.ID, &u.Username, &u.DisplayName, &u.Role, &u.DomainID, &lastLogin, &createdAt)
		if err != nil {
			httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		u.CreatedAt = timeStr(createdAt)
		u.LastLoginAt = timePtrStr(lastLogin)

		httputil.WriteJSON(w, http.StatusOK, u)
	}
}

func handleResetPassword(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		tempPassword := generatePassword(12)

		hash, err := bcrypt.GenerateFromPassword([]byte(tempPassword), 12)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
			return
		}

		tag, err := pool.Exec(r.Context(),
			`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`,
			id, string(hash),
		)
		if err != nil || tag.RowsAffected() == 0 {
			httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}

		httputil.WriteJSON(w, http.StatusOK, map[string]string{"temporary_password": tempPassword})
	}
}

// --- Analytics ---

type searchGapResponse struct {
	Query        string `json:"query"`
	Count        int    `json:"count"`
	LastSearched string `json:"last_searched"`
}

func handleSearchGaps(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 20
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				limit = n
			}
		}

		rows, err := pool.Query(r.Context(),
			`SELECT query, COUNT(*) AS count, MAX(created_at) AS last_searched
			 FROM search_log
			 WHERE result_count = 0
			 GROUP BY query
			 ORDER BY count DESC
			 LIMIT $1`, limit)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query search gaps"})
			return
		}
		defer rows.Close()

		gaps := []searchGapResponse{}
		for rows.Next() {
			var g searchGapResponse
			var lastSearched time.Time
			if err := rows.Scan(&g.Query, &g.Count, &lastSearched); err != nil {
				httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan search gap"})
				return
			}
			g.LastSearched = timeStr(lastSearched)
			gaps = append(gaps, g)
		}

		httputil.WriteJSON(w, http.StatusOK, gaps)
	}
}

// --- Config ---

type freshnessConfig struct {
	GreenDays  int `json:"green_days"`
	YellowDays int `json:"yellow_days"`
}

type ticketURLConfig struct {
	URL string `json:"url"`
}

func handleGetFreshness(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var greenStr, yellowStr string
		err := pool.QueryRow(r.Context(), `SELECT value FROM config WHERE key = 'freshness_green'`).Scan(&greenStr)
		if err != nil {
			greenStr = "30"
		}
		err = pool.QueryRow(r.Context(), `SELECT value FROM config WHERE key = 'freshness_yellow'`).Scan(&yellowStr)
		if err != nil {
			yellowStr = "90"
		}

		green, _ := strconv.Atoi(greenStr)
		yellow, _ := strconv.Atoi(yellowStr)
		if green == 0 {
			green = 30
		}
		if yellow == 0 {
			yellow = 90
		}

		httputil.WriteJSON(w, http.StatusOK, freshnessConfig{GreenDays: green, YellowDays: yellow})
	}
}

func handlePutFreshness(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req freshnessConfig
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if req.GreenDays <= 0 || req.YellowDays <= 0 {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "green_days and yellow_days must be greater than 0"})
			return
		}
		if req.GreenDays >= req.YellowDays {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "green_days must be less than yellow_days"})
			return
		}

		ctx := r.Context()
		_, err := pool.Exec(ctx,
			`INSERT INTO config (key, value, updated_at) VALUES ('freshness_green', $1, now())
			 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
			strconv.Itoa(req.GreenDays),
		)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save freshness_green"})
			return
		}
		_, err = pool.Exec(ctx,
			`INSERT INTO config (key, value, updated_at) VALUES ('freshness_yellow', $1, now())
			 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
			strconv.Itoa(req.YellowDays),
		)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save freshness_yellow"})
			return
		}

		httputil.WriteJSON(w, http.StatusOK, req)
	}
}

func handleGetTicketURL(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var url string
		err := pool.QueryRow(r.Context(), `SELECT value FROM config WHERE key = 'ticket_url'`).Scan(&url)
		if err != nil {
			url = ""
		}
		httputil.WriteJSON(w, http.StatusOK, ticketURLConfig{URL: url})
	}
}

func handlePutTicketURL(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req ticketURLConfig
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		_, err := pool.Exec(r.Context(),
			`INSERT INTO config (key, value, updated_at) VALUES ('ticket_url', $1, now())
			 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
			req.URL,
		)
		if err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save ticket_url"})
			return
		}

		httputil.WriteJSON(w, http.StatusOK, req)
	}
}
