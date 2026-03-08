package document

import (
	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

func Router(deps *model.Deps) chi.Router {
	r := chi.NewRouter()
	h := &handler{deps: deps}

	// Configure Meilisearch index on startup
	go h.configureMeiliIndex()

	// Public routes: OptionalAuth (anonymous can read public docs)
	r.Group(func(r chi.Router) {
		r.Use(auth.OptionalAuth(deps.JWTSecret))
		r.Get("/", h.listDocuments)
		r.Get("/{slug}", h.getDocument)
		r.Get("/{id}/verifications", h.listVerifications)
		r.Get("/{id}/attachments", h.listAttachments)
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
		r.Post("/{id}/attachments", h.uploadAttachment)
		r.Delete("/{id}/attachments/{att_id}", h.deleteAttachment)
		r.Post("/tags", h.createTag)
		r.Delete("/tags/{id}", h.deleteTag)
	})

	return r
}
