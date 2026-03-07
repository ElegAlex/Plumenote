package auth

import (
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// RequireAuth returns middleware that validates JWT Bearer tokens.
// It extracts user_id, role, and domain_id into the request context.
// Returns 401 if the token is missing, invalid, or expired.
func RequireAuth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" {
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			tokenStr, ok := strings.CutPrefix(header, "Bearer ")
			if !ok || tokenStr == "" {
				http.Error(w, `{"error":"invalid authorization header"}`, http.StatusUnauthorized)
				return
			}

			claims := &Claims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(jwtSecret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			ctx := withClaims(r.Context(), claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole returns middleware that checks the user's role against an allow list.
// Returns 403 if the user's role is not in the provided list.
// Must be used after RequireAuth.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c := UserFromContext(r.Context())
			if c == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if !allowed[c.Role] {
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// OptionalAuth returns middleware that tries to extract JWT claims into the
// request context, but does NOT reject unauthenticated requests.
// Downstream handlers can use UserFromContext and check for nil.
func OptionalAuth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			tokenStr, ok := strings.CutPrefix(header, "Bearer ")
			if !ok || tokenStr == "" {
				next.ServeHTTP(w, r)
				return
			}

			claims := &Claims{}
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

			ctx := withClaims(r.Context(), claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireDomainWrite is middleware that ensures the user belongs to the same
// domain as the resource, or is an admin. Returns 403 otherwise.
// The domain_id of the resource must be set in the request context by the
// upstream handler. Must be used after RequireAuth.
func RequireDomainWrite(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c := UserFromContext(r.Context())
		if c == nil {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		if c.Role == "admin" {
			next.ServeHTTP(w, r)
			return
		}

		resourceDomain := r.Header.Get("X-Resource-Domain")
		if resourceDomain == "" || resourceDomain == c.DomainID {
			next.ServeHTTP(w, r)
			return
		}

		http.Error(w, `{"error":"forbidden: domain mismatch"}`, http.StatusForbidden)
	})
}
