package folder

import (
	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

// Router returns a Chi router mounted at /api/folders.
func Router(deps *model.Deps) chi.Router {
	r := chi.NewRouter()
	h := &handler{deps: deps}

	// Public/optional-auth routes
	r.Group(func(r chi.Router) {
		r.Use(auth.OptionalAuth(deps.JWTSecret))
		r.Get("/{id}", h.getFolder)
		r.Get("/{id}/cascade-count", h.cascadeCount)
	})

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth(deps.JWTSecret))
		r.Post("/", h.createFolder)
		r.Put("/{id}", h.updateFolder)
		r.Delete("/{id}", h.deleteFolder)
		r.Get("/{id}/permissions", h.listPermissions)
		r.Put("/{id}/permissions", h.setPermissions)
	})

	return r
}

// DomainFoldersRouter returns a Chi router for /api/domains/{domainId}/folders.
func DomainFoldersRouter(deps *model.Deps) chi.Router {
	r := chi.NewRouter()
	h := &handler{deps: deps}

	r.Group(func(r chi.Router) {
		r.Use(auth.OptionalAuth(deps.JWTSecret))
		r.Get("/", h.listFolderTree)
	})

	return r
}
