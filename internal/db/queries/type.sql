-- name: ListDocumentTypes :many
SELECT * FROM document_types ORDER BY sort_order, name;

-- name: GetDocumentTypeByID :one
SELECT * FROM document_types WHERE id = $1;

-- name: CreateDocumentType :one
INSERT INTO document_types (name, slug, icon, sort_order)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateDocumentType :one
UPDATE document_types SET name = $2, slug = $3, icon = $4, sort_order = $5 WHERE id = $1
RETURNING *;

-- name: DeleteDocumentType :exec
DELETE FROM document_types WHERE id = $1;
