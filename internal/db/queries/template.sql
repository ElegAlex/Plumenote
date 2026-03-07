-- name: CreateTemplate :one
INSERT INTO templates (name, description, content, type_id, is_default, created_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetTemplateByID :one
SELECT * FROM templates WHERE id = $1;

-- name: ListTemplates :many
SELECT * FROM templates ORDER BY usage_count DESC, name;

-- name: UpdateTemplate :one
UPDATE templates
SET name = $2, description = $3, content = $4, type_id = $5, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteTemplate :exec
DELETE FROM templates WHERE id = $1;

-- name: IncrementTemplateUsage :exec
UPDATE templates SET usage_count = usage_count + 1 WHERE id = $1;
