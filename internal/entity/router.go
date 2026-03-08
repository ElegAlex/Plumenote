package entity

import (
	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

// Router creates the entity sub-router mounted at /api/entities.
func Router(deps *model.Deps) chi.Router {
	r := chi.NewRouter()
	h := &handler{deps: deps}

	// Public
	r.Get("/config/entity-label", h.getEntityLabel)

	// OptionalAuth
	r.Group(func(r chi.Router) {
		r.Use(auth.OptionalAuth(deps.JWTSecret))
		r.Get("/types", h.ListEntityTypes)
		r.Get("/types/{id}", h.GetEntityType)
		r.Get("/", h.listEntities)
		r.Get("/{id}", h.getEntity)
	})

	// RequireAuth
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth(deps.JWTSecret))
		r.Post("/", h.createEntity)
		r.Put("/{id}", h.updateEntity)
		r.Delete("/{id}", h.deleteEntity)
		r.Post("/{id}/link-document", h.linkDocument)
		r.Delete("/{id}/link-document/{doc_id}", h.unlinkDocument)
		r.Post("/{id}/link-bookmark", h.linkBookmark)
		r.Delete("/{id}/link-bookmark/{bm_id}", h.unlinkBookmark)
	})

	return r
}
