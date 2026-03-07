package auth

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const bcryptCost = 12

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string   `json:"token"`
	User  userInfo `json:"user"`
}

type userInfo struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name"`
	Role        string  `json:"role"`
	DomainID    *string `json:"domain_id,omitempty"`
}

type changePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

// handleLogin authenticates a user with username/password and returns a JWT.
func handleLogin(pool *pgxpool.Pool, jwtSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		if req.Username == "" || req.Password == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username and password are required"})
			return
		}

		var (
			id           string
			username     string
			displayName  string
			passwordHash string
			role         string
			domainID     *string
		)

		err := pool.QueryRow(r.Context(),
			`SELECT id, username, display_name, password_hash, role, domain_id::text FROM users WHERE username = $1`,
			req.Username,
		).Scan(&id, &username, &displayName, &passwordHash, &role, &domainID)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
			return
		}

		// Update last_login_at
		_, _ = pool.Exec(r.Context(), `UPDATE users SET last_login_at = now() WHERE id = $1`, id)

		domainStr := ""
		if domainID != nil {
			domainStr = *domainID
		}

		token, err := generateToken(id, username, role, domainStr, jwtSecret)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate token"})
			return
		}

		writeJSON(w, http.StatusOK, loginResponse{
			Token: token,
			User: userInfo{
				ID:          id,
				Username:    username,
				DisplayName: displayName,
				Role:        role,
				DomainID:    domainID,
			},
		})
	}
}

// handleMe returns the authenticated user's info.
func handleMe(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c := UserFromContext(r.Context())
		if c == nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		var u userInfo
		var domainID *string
		err := pool.QueryRow(r.Context(),
			`SELECT id, username, display_name, role, domain_id::text FROM users WHERE id = $1`,
			c.UserID,
		).Scan(&u.ID, &u.Username, &u.DisplayName, &u.Role, &domainID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		u.DomainID = domainID

		writeJSON(w, http.StatusOK, u)
	}
}

// handleChangePassword changes the authenticated user's password.
func handleChangePassword(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c := UserFromContext(r.Context())
		if c == nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		var req changePasswordRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}

		if len(req.NewPassword) < 8 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 8 characters"})
			return
		}

		var currentHash string
		err := pool.QueryRow(r.Context(),
			`SELECT password_hash FROM users WHERE id = $1`, c.UserID,
		).Scan(&currentHash)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(req.OldPassword)); err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "current password is incorrect"})
			return
		}

		newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcryptCost)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
			return
		}

		_, err = pool.Exec(r.Context(),
			`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`,
			c.UserID, string(newHash),
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update password"})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"message": "password updated"})
	}
}

// handleLogout handles client-side logout (server returns 200).
func handleLogout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
	}
}

func generateToken(userID, username, role, domainID, secret string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		DomainID: domainID,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)),
			Issuer:    "plumenote",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// GenerateToken is exported for use by other packages (e.g., admin user creation).
func GenerateToken(userID, username, role, domainID, secret string) (string, error) {
	return generateToken(userID, username, role, domainID, secret)
}

// HashPassword hashes a password with bcrypt for use by other packages.
func HashPassword(password string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	return string(h), err
}

