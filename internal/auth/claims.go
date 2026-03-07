package auth

import "github.com/golang-jwt/jwt/v5"

// Claims represents JWT token claims for authenticated users.
type Claims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	DomainID string `json:"domain_id,omitempty"`
	jwt.RegisteredClaims
}
