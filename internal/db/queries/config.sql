-- name: GetConfig :one
SELECT * FROM config WHERE key = $1;

-- name: UpsertConfig :exec
INSERT INTO config (key, value, updated_at)
VALUES ($1, $2, now())
ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now();

-- name: ListConfig :many
SELECT * FROM config ORDER BY key;
