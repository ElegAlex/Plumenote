package search

import (
	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

func Router(deps *model.Deps) chi.Router {
	r := chi.NewRouter()

	r.Use(auth.OptionalAuth(deps.JWTSecret))

	r.Get("/", handleSearch(deps))

	return r
}
