-- name: InsertSearchLog :exec
INSERT INTO search_log (query, result_count, clicked_document_id, user_id)
VALUES ($1, $2, $3, $4);

-- name: InsertViewLog :exec
INSERT INTO view_log (document_id, user_id, duration_seconds)
VALUES ($1, $2, $3);

-- name: GetTopSearches :many
SELECT query, count(*) as search_count
FROM search_log
GROUP BY query
ORDER BY search_count DESC
LIMIT $1;

-- name: GetTopViewedDocuments :many
SELECT document_id, count(*) as view_count
FROM view_log
GROUP BY document_id
ORDER BY view_count DESC
LIMIT $1;

-- name: GetSearchLogsByDate :many
SELECT * FROM search_log
WHERE created_at >= $1 AND created_at < $2
ORDER BY created_at DESC;

-- name: GetViewLogsByDate :many
SELECT * FROM view_log
WHERE created_at >= $1 AND created_at < $2
ORDER BY created_at DESC;
