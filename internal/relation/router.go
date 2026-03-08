package relation

import (
	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

// Router creates the relation sub-router mounted at /api/entity-relations.
func Router(deps *model.Deps) chi.Router {
	r := chi.NewRouter()
	h := &handler{deps: deps}

	// OptionalAuth
	r.Group(func(r chi.Router) {
		r.Use(auth.OptionalAuth(deps.JWTSecret))
		r.Get("/types", h.ListRelationTypes)
		r.Get("/types/{id}", h.getRelationType)
	})

	// RequireAuth
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth(deps.JWTSecret))
		r.Post("/", h.createRelation)
		r.Delete("/{id}", h.deleteRelation)
	})

	return r
}
