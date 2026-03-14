package document

import (
	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

// NewHandler creates an exported handler for use in other packages.
func NewHandler(deps *model.Deps) *handler {
	return &handler{deps: deps}
}

func Router(deps *model.Deps) chi.Router {
	r := chi.NewRouter()
	h := &handler{deps: deps}

	// Configure Meilisearch index on startup
	go h.configureMeiliIndex()

	// Backfill document links on first run
	go h.backfillDocumentLinks()

	// Public routes: OptionalAuth (anonymous can read public docs)
	r.Group(func(r chi.Router) {
		r.Use(auth.OptionalAuth(deps.JWTSecret))
		r.Get("/", h.listDocuments)
		r.Get("/{slug}", h.getDocument)
		r.Get("/{id}/verifications", h.listVerifications)
		r.Get("/{id}/attachments", h.listAttachments)
		r.Get("/{id}/versions", h.listVersions)
		r.Get("/{id}/versions/{versionNumber}", h.getVersion)
		r.Get("/{id}/versions/{v1}/diff/{v2}", h.diffVersions)
		r.Get("/tags", h.listTags)
	})

	// Protected routes: RequireAuth (must be authenticated)
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth(deps.JWTSecret))
		r.Post("/", h.createDocument)
		r.Put("/{id}", h.updateDocument)
		r.Delete("/{id}", h.deleteDocument)
		r.Post("/{id}/verify", h.verifyDocument)
		r.Post("/{id}/flag-review", h.flagReview)
		r.Post("/{id}/versions/{versionNumber}/restore", h.restoreVersion)
		r.Post("/{id}/attachments", h.uploadAttachment)
		r.Delete("/{id}/attachments/{att_id}", h.deleteAttachment)
		r.Post("/tags", h.createTag)
		r.Delete("/tags/{id}", h.deleteTag)
	})

	return r
}
