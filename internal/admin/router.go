package admin

import (
	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

func Router(deps *model.Deps) chi.Router {
	r := chi.NewRouter()

	// All admin routes require authentication + admin role
	r.Use(auth.RequireAuth(deps.JWTSecret))
	r.Use(requireAdmin)

	pool := deps.DB

	// Templates
	r.Get("/templates", handleListTemplates(pool))
	r.Post("/templates", handleCreateTemplate(pool))
	r.Put("/templates/{id}", handleUpdateTemplate(pool))
	r.Delete("/templates/{id}", handleDeleteTemplate(pool))

	// Domains
	r.Get("/domains", handleListDomains(pool))
	r.Post("/domains", handleCreateDomain(pool))
	r.Put("/domains/{id}", handleUpdateDomain(pool))
	r.Delete("/domains/{id}", handleDeleteDomain(pool))

	// Users
	r.Get("/users", handleListUsers(pool))
	r.Post("/users", handleCreateUser(pool))
	r.Put("/users/{id}", handleUpdateUser(pool))
	r.Post("/users/{id}/reset-password", handleResetPassword(pool))

	// Analytics
	r.Get("/analytics/search-gaps", handleSearchGaps(pool))

	// Config
	r.Get("/config/freshness", handleGetFreshness(pool))
	r.Put("/config/freshness", handlePutFreshness(pool))
	r.Get("/config/ticket-url", handleGetTicketURL(pool))
	r.Put("/config/ticket-url", handlePutTicketURL(pool))

	return r
}
