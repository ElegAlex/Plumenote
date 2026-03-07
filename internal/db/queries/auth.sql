-- name: GetUserByUsername :one
SELECT * FROM users WHERE username = $1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: CreateUser :one
INSERT INTO users (username, display_name, password_hash, role, domain_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdatePassword :exec
UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1;

-- name: UpdateLastLogin :exec
UPDATE users SET last_login_at = now() WHERE id = $1;

-- name: ListUsers :many
SELECT * FROM users ORDER BY created_at DESC;

-- name: UpdateUser :one
UPDATE users
SET display_name = $2, role = $3, domain_id = $4, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;

-- name: UpdateOnboardingCompleted :exec
UPDATE users SET onboarding_completed = true, updated_at = now() WHERE id = $1;
