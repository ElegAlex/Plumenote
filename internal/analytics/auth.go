package analytics

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const ctxUserID contextKey = "user_id"

func optionalAuth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			tokenStr, ok := strings.CutPrefix(header, "Bearer ")
			if !ok || tokenStr == "" {
				next.ServeHTTP(w, r)
				return
			}

			claims := &jwtClaims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(jwtSecret), nil
			})
			if err != nil || !token.Valid {
				next.ServeHTTP(w, r)
				return
			}

			ctx := context.WithValue(r.Context(), ctxUserID, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

type jwtClaims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func userIDFromCtx(ctx context.Context) *string {
	v, ok := ctx.Value(ctxUserID).(string)
	if !ok || v == "" {
		return nil
	}
	return &v
}
