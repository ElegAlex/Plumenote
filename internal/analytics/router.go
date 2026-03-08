package analytics

import (
	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
)

func Router(deps *model.Deps) chi.Router {
	r := chi.NewRouter()

	r.Use(auth.OptionalAuth(deps.JWTSecret))

	r.Post("/search-log", handleSearchLog(deps))
	r.Post("/view-log", handleViewLog(deps))
	r.Post("/view-count", handleViewCount(deps))

	return r
}
