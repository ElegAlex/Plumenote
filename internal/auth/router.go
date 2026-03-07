package auth

import (
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

// Router returns a chi.Router with all auth endpoints mounted.
func Router(deps *model.Deps) chi.Router {
	r := chi.NewRouter()

	r.Post("/login", handleLogin(deps.DB, deps.JWTSecret))
	r.Post("/logout", handleLogout())

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(RequireAuth(deps.JWTSecret))
		r.Get("/me", handleMe(deps.DB))
		r.Put("/password", handleChangePassword(deps.DB))
	})

	return r
}
