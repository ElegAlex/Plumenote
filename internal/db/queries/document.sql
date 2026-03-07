-- name: CreateDocument :one
INSERT INTO documents (title, slug, body, body_text, domain_id, type_id, author_id, visibility)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetDocumentByID :one
SELECT * FROM documents WHERE id = $1;

-- name: GetDocumentBySlug :one
SELECT * FROM documents WHERE slug = $1;

-- name: UpdateDocument :one
UPDATE documents
SET title = $2, slug = $3, body = $4, body_text = $5, domain_id = $6, type_id = $7, visibility = $8, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteDocument :exec
DELETE FROM documents WHERE id = $1;

-- name: ListDocumentsByDomain :many
SELECT * FROM documents
WHERE domain_id = $1
ORDER BY updated_at DESC;

-- name: ListRecentDocuments :many
SELECT * FROM documents
ORDER BY updated_at DESC
LIMIT $1;

-- name: SearchDocumentsByTitle :many
SELECT * FROM documents
WHERE title ILIKE '%' || $1 || '%'
ORDER BY updated_at DESC
LIMIT 20;

-- name: IncrementViewCount :exec
UPDATE documents SET view_count = view_count + 1 WHERE id = $1;

-- name: VerifyDocument :exec
UPDATE documents
SET last_verified_at = now(), last_verified_by = $2, updated_at = now()
WHERE id = $1;

-- name: ListDocuments :many
SELECT * FROM documents ORDER BY updated_at DESC;

-- name: CountDocumentsByDomain :one
SELECT count(*) FROM documents WHERE domain_id = $1;
