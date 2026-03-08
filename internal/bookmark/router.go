package bookmark

import (
	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

// Router returns a chi.Router with all bookmark endpoints.
func Router(deps *model.Deps) chi.Router {
	r := chi.NewRouter()
	h := &handler{deps: deps}

	r.Group(func(r chi.Router) {
		r.Use(auth.OptionalAuth(deps.JWTSecret))
		r.Get("/", h.listBookmarks)
		r.Get("/{id}", h.getBookmark)
	})

	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth(deps.JWTSecret))
		r.Post("/", h.createBookmark)
		r.Put("/{id}", h.updateBookmark)
		r.Delete("/{id}", h.deleteBookmark)
	})

	return r
}
