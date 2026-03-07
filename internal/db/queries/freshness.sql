-- name: InsertVerification :one
INSERT INTO verification_log (document_id, verified_by, note)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetVerificationHistory :many
SELECT * FROM verification_log
WHERE document_id = $1
ORDER BY created_at DESC;

-- name: GetLatestVerification :one
SELECT * FROM verification_log
WHERE document_id = $1
ORDER BY created_at DESC
LIMIT 1;
