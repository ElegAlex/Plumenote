package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-key-for-testing"

func makeToken(t *testing.T, claims Claims, secret string) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func validClaims() Claims {
	return Claims{
		UserID:   "user-1",
		Username: "didier",
		Role:     "dsi",
		DomainID: "domain-1",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			Issuer:    "plumenote",
		},
	}
}

func TestRequireAuth_ValidToken(t *testing.T) {
	token := makeToken(t, validClaims(), testSecret)

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c := UserFromContext(r.Context())
		if c == nil {
			t.Fatal("expected claims in context")
		}
		if c.UserID != "user-1" {
			t.Errorf("got user_id %q, want %q", c.UserID, "user-1")
		}
		if c.Role != "dsi" {
			t.Errorf("got role %q, want %q", c.Role, "dsi")
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestRequireAuth_MissingHeader(t *testing.T) {
	handler := RequireAuth(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("should not reach handler")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestRequireAuth_InvalidToken(t *testing.T) {
	handler := RequireAuth(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("should not reach handler")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestRequireAuth_ExpiredToken(t *testing.T) {
	claims := validClaims()
	claims.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-1 * time.Hour))
	token := makeToken(t, claims, testSecret)

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("should not reach handler")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestRequireAuth_WrongSecret(t *testing.T) {
	token := makeToken(t, validClaims(), "wrong-secret")

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("should not reach handler")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestRequireRole_Allowed(t *testing.T) {
	handler := RequireRole("admin", "dsi")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := withClaims(req.Context(), &Claims{UserID: "u1", Role: "dsi"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req.WithContext(ctx))

	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestRequireRole_Forbidden(t *testing.T) {
	handler := RequireRole("admin")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("should not reach handler")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := withClaims(req.Context(), &Claims{UserID: "u1", Role: "dsi"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req.WithContext(ctx))

	if rec.Code != http.StatusForbidden {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusForbidden)
	}
}

func TestRequireRole_NoClaims(t *testing.T) {
	handler := RequireRole("admin")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("should not reach handler")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestRequireDomainWrite_Admin(t *testing.T) {
	handler := RequireDomainWrite(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Resource-Domain", "other-domain")
	ctx := withClaims(req.Context(), &Claims{UserID: "u1", Role: "admin", DomainID: "domain-1"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req.WithContext(ctx))

	if rec.Code != http.StatusOK {
		t.Errorf("admin should bypass domain check: got %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestRequireDomainWrite_SameDomain(t *testing.T) {
	handler := RequireDomainWrite(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Resource-Domain", "domain-1")
	ctx := withClaims(req.Context(), &Claims{UserID: "u1", Role: "dsi", DomainID: "domain-1"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req.WithContext(ctx))

	if rec.Code != http.StatusOK {
		t.Errorf("same domain should pass: got %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestRequireDomainWrite_DifferentDomain(t *testing.T) {
	handler := RequireDomainWrite(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("should not reach handler")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Resource-Domain", "other-domain")
	ctx := withClaims(req.Context(), &Claims{UserID: "u1", Role: "dsi", DomainID: "domain-1"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req.WithContext(ctx))

	if rec.Code != http.StatusForbidden {
		t.Errorf("different domain should be forbidden: got %d, want %d", rec.Code, http.StatusForbidden)
	}
}
