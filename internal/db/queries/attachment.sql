-- name: InsertAttachment :one
INSERT INTO attachments (document_id, filename, filepath, mime_type, size_bytes)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListAttachmentsByDocument :many
SELECT * FROM attachments WHERE document_id = $1 ORDER BY created_at;

-- name: DeleteAttachment :exec
DELETE FROM attachments WHERE id = $1;

-- name: GetAttachmentByID :one
SELECT * FROM attachments WHERE id = $1;
