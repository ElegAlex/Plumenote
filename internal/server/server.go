package server

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"strings"
	"time"

	"github.com/alexmusic/plumenote/internal/admin"
	"github.com/alexmusic/plumenote/internal/analytics"
	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/document"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/alexmusic/plumenote/internal/search"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// New creates the main HTTP router with all middleware and sub-routers.
func New(deps *model.Deps, staticFS fs.FS) http.Handler {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Public domains listing (read-only, no auth required)
	r.Get("/api/domains", func(w http.ResponseWriter, r *http.Request) {
		rows, err := deps.DB.Query(r.Context(),
			`SELECT d.id, d.name, d.slug, d.color, d.icon, d.sort_order,
			        COALESCE((SELECT count(*) FROM documents WHERE domain_id = d.id), 0) AS doc_count,
			        d.created_at, d.updated_at
			 FROM domains d ORDER BY d.sort_order, d.name`)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "failed to list domains"})
			return
		}
		defer rows.Close()

		type domainRow struct {
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
		domains := []domainRow{}
		for rows.Next() {
			var d domainRow
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&d.ID, &d.Name, &d.Slug, &d.Color, &d.Icon, &d.SortOrder, &d.DocCount, &createdAt, &updatedAt); err != nil {
				continue
			}
			d.CreatedAt = createdAt.Format(time.RFC3339)
			d.UpdatedAt = updatedAt.Format(time.RFC3339)
			domains = append(domains, d)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(domains)
	})

	// Public config endpoints (read-only, no auth)
	r.Get("/api/config/ticket-url", func(w http.ResponseWriter, r *http.Request) {
		var url string
		err := deps.DB.QueryRow(r.Context(), `SELECT value FROM config WHERE key = 'ticket_url'`).Scan(&url)
		if err != nil {
			url = ""
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"url": url})
	})

	// Public stats (no auth)
	r.Get("/api/stats", func(w http.ResponseWriter, r *http.Request) {
		type statsResp struct {
			Documents     int `json:"documents"`
			SearchesMonth int `json:"searches_month"`
			Contributors  int `json:"contributors"`
			UpdatesMonth  int `json:"updates_month"`
		}
		var s statsResp
		_ = deps.DB.QueryRow(r.Context(),
			"SELECT COUNT(*) FROM documents").Scan(&s.Documents)
		_ = deps.DB.QueryRow(r.Context(),
			"SELECT COUNT(*) FROM search_log WHERE created_at >= date_trunc('month', CURRENT_DATE)").Scan(&s.SearchesMonth)
		_ = deps.DB.QueryRow(r.Context(),
			"SELECT COUNT(DISTINCT author_id) FROM documents").Scan(&s.Contributors)
		_ = deps.DB.QueryRow(r.Context(),
			"SELECT COUNT(*) FROM documents WHERE updated_at >= date_trunc('month', CURRENT_DATE)").Scan(&s.UpdatesMonth)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(s)
	})

	// Public document types listing (no auth)
	r.Get("/api/document-types", func(w http.ResponseWriter, r *http.Request) {
		rows, err := deps.DB.Query(r.Context(),
			"SELECT id, name, slug, icon, sort_order FROM document_types ORDER BY sort_order, name")
		if err != nil {
			http.Error(w, "internal error", 500)
			return
		}
		defer rows.Close()

		type dt struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			Slug      string `json:"slug"`
			Icon      string `json:"icon"`
			SortOrder int    `json:"sort_order"`
		}
		var list []dt
		for rows.Next() {
			var d dt
			if err := rows.Scan(&d.ID, &d.Name, &d.Slug, &d.Icon, &d.SortOrder); err != nil {
				continue
			}
			list = append(list, d)
		}
		if list == nil {
			list = []dt{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(list)
	})

	// API sub-routers
	r.Mount("/api/auth", auth.Router(deps))
	r.Mount("/api/documents", document.Router(deps))
	r.Mount("/api/search", search.Router(deps))
	r.Mount("/api/admin", admin.Router(deps))
	r.Mount("/api/analytics", analytics.Router(deps))

	// Alias: /api/tags -> /api/documents/tags (frontend expects /api/tags)
	docRouter := document.Router(deps)
	r.Get("/api/tags", func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = "/tags"
		docRouter.ServeHTTP(w, r)
	})

	// Serve embedded SPA
	if staticFS != nil {
		fileServer := http.FileServer(http.FS(staticFS))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			// Try to serve static file first
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path == "" {
				path = "index.html"
			}
			if _, err := fs.Stat(staticFS, path); err != nil {
				// SPA fallback: serve index.html for client-side routing
				path = "index.html"
				r.URL.Path = "/"
			}
			fileServer.ServeHTTP(w, r)
		})
	}

	return r
}
