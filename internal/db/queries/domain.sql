-- name: CreateDomain :one
INSERT INTO domains (name, slug, color, icon, sort_order)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetDomainByID :one
SELECT * FROM domains WHERE id = $1;

-- name: GetDomainBySlug :one
SELECT * FROM domains WHERE slug = $1;

-- name: ListDomains :many
SELECT * FROM domains ORDER BY sort_order, name;

-- name: UpdateDomain :one
UPDATE domains
SET name = $2, slug = $3, color = $4, icon = $5, sort_order = $6, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteDomain :exec
DELETE FROM domains WHERE id = $1;
