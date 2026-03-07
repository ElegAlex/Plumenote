# PlumeNote — Agent Instructions

## Stack
- **Backend**: Go 1.24, Chi v5, pgx v5, sqlc, bcrypt + JWT HS256
- **Frontend**: React 19, Vite, Tailwind CSS 4, shadcn/ui, TipTap 3
- **Database**: PostgreSQL 18 (JSONB, UUIDv7)
- **Search**: Meilisearch CE v1.12 (full-text, typo-tolerant)
- **Proxy**: Caddy v2 (HTTPS auto, SPA fallback)
- **Infra**: Docker Compose (4 containers), self-hosted

## Project Structure
```
cmd/plumenote/main.go          # Entry point, embeds SPA
internal/
  server/server.go             # Chi router + middleware
  db/pool.go                   # pgx pool
  db/queries/*.sql             # sqlc SQL queries
  db/sqlc/                     # Generated Go code (sqlc generate)
  model/deps.go                # Shared Deps struct
  auth/                        # Auth module (JWT login/logout)
  document/                    # Document CRUD + freshness
  search/                      # Meilisearch proxy
  admin/                       # Admin backoffice API
  analytics/                   # Search/view logging
  importer/                    # CLI import (Pandoc)
web/src/
  features/{auth,home,search,editor,reader,admin,profile}/
  components/layout/{Shell,Sidebar,Topbar}.tsx
  components/ui/               # shadcn/ui components
  lib/api.ts                   # Fetch wrapper with JWT
  lib/auth-context.tsx         # AuthProvider
migrations/                    # SQL migrations (001_init, 002_seed)
docker/                        # docker-compose.yml, Dockerfile, Caddyfile
```

## Commands
- `make dev` — Start dev (DB + Meili containers, Vite dev server, Go run)
- `make build` — Production build (Go binary + embedded SPA)
- `make test` — Run Go tests
- `make sqlc` — Regenerate sqlc Go code from SQL queries
- `make deploy` — Docker Compose build and up
- `cd web && npm run dev` — Frontend dev server only
- `cd web && npm run build` — Frontend production build

## Conventions
- Go: standard library style, Chi v5 routers, pgx v5 for DB
- SQL: all queries in internal/db/queries/*.sql, generated via sqlc
- Frontend: feature-based folders, lazy-loaded routes, Tailwind 4 CSS-first
- API: REST JSON, /api/* prefix, JWT Bearer auth
- IDs: UUID (gen_random_uuid() in PG18)
- Content: TipTap JSON stored as JSONB in PostgreSQL

## Data Model
11 tables: users, domains, document_types, templates, documents, tags,
document_tags, verification_log, attachments, search_log, view_log, config.
See migrations/001_init.sql for full schema.

## Environment Variables
- DATABASE_URL — PostgreSQL connection string
- MEILI_URL — Meilisearch URL
- MEILI_MASTER_KEY — Meilisearch API key
- JWT_SECRET — JWT signing secret
- LISTEN_ADDR — HTTP listen address (default :8080)

## References
- docs/P4_2_blueprint.md — Architecture, data model, ADRs
- docs/P4_1_backlog.md — 48 user stories, templates, business rules
- docs/P3_4_concept.md — User flows, wireframes
- docs/P0_cadrage.md — Project scope IN/OUT
