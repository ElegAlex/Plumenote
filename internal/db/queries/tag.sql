-- name: CreateTag :one
INSERT INTO tags (name, slug) VALUES ($1, $2)
RETURNING *;

-- name: GetTagByID :one
SELECT * FROM tags WHERE id = $1;

-- name: ListTags :many
SELECT * FROM tags ORDER BY name;

-- name: DeleteTag :exec
DELETE FROM tags WHERE id = $1;

-- name: AutocompleteTags :many
SELECT * FROM tags WHERE name ILIKE $1 || '%' ORDER BY name LIMIT 10;

-- name: AddDocumentTag :exec
INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: RemoveDocumentTag :exec
DELETE FROM document_tags WHERE document_id = $1 AND tag_id = $2;

-- name: GetTagsByDocumentID :many
SELECT t.* FROM tags t
JOIN document_tags dt ON dt.tag_id = t.id
WHERE dt.document_id = $1
ORDER BY t.name;

-- name: RemoveAllDocumentTags :exec
DELETE FROM document_tags WHERE document_id = $1;
