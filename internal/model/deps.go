package model

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meilisearch/meilisearch-go"
)

// Deps holds shared dependencies for all modules.
type Deps struct {
	DB        *pgxpool.Pool
	Meili     meilisearch.ServiceManager
	JWTSecret string
}
