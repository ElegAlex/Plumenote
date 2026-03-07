package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// --- Token generation tests ---

func TestGenerateToken(t *testing.T) {
	token, err := generateToken("user-1", "didier", "dsi", "domain-1", testSecret)
	if err != nil {
		t.Fatal(err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}

	// Parse and verify claims
	parsed, err := jwt.ParseWithClaims(token, &Claims{}, func(t *jwt.Token) (any, error) {
		return []byte(testSecret), nil
	})
	if err != nil {
		t.Fatal(err)
	}

	claims, ok := parsed.Claims.(*Claims)
	if !ok {
		t.Fatal("expected *Claims")
	}
	if claims.UserID != "user-1" {
		t.Errorf("got user_id %q, want %q", claims.UserID, "user-1")
	}
	if claims.Username != "didier" {
		t.Errorf("got username %q, want %q", claims.Username, "didier")
	}
	if claims.Role != "dsi" {
		t.Errorf("got role %q, want %q", claims.Role, "dsi")
	}
	if claims.DomainID != "domain-1" {
		t.Errorf("got domain_id %q, want %q", claims.DomainID, "domain-1")
	}
	if claims.Issuer != "plumenote" {
		t.Errorf("got issuer %q, want %q", claims.Issuer, "plumenote")
	}

	// Verify expiration is ~24h from now
	exp := claims.ExpiresAt.Time
	diff := time.Until(exp)
	if diff < 23*time.Hour || diff > 25*time.Hour {
		t.Errorf("token expiry %v not within 24h range", diff)
	}
}

// --- Login handler tests (unit-level, no DB) ---

func TestHandleLogin_EmptyBody(t *testing.T) {
	handler := handleLogin(nil, testSecret)
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader([]byte("{}")))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleLogin_InvalidJSON(t *testing.T) {
	handler := handleLogin(nil, testSecret)
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader([]byte("not json")))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

// --- Logout handler tests ---

func TestHandleLogout_ReturnsOK(t *testing.T) {
	handler := handleLogout()
	req := httptest.NewRequest(http.MethodPost, "/logout", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusOK)
	}

	var body map[string]string
	json.NewDecoder(rec.Body).Decode(&body)
	if body["message"] != "logged out" {
		t.Errorf("got message %q, want %q", body["message"], "logged out")
	}
}

// --- Me handler tests (no DB) ---

func TestHandleMe_NoClaims(t *testing.T) {
	handler := handleMe(nil)
	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

// --- Change password handler tests (no DB) ---

func TestHandleChangePassword_NoClaims(t *testing.T) {
	handler := handleChangePassword(nil)
	req := httptest.NewRequest(http.MethodPut, "/password", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestHandleChangePassword_TooShort(t *testing.T) {
	handler := handleChangePassword(nil)
	body := changePasswordRequest{OldPassword: "oldpass", NewPassword: "short"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPut, "/password", bytes.NewReader(b))
	ctx := withClaims(req.Context(), &Claims{UserID: "user-1", Role: "dsi"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req.WithContext(ctx))

	if rec.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusBadRequest)
	}

	var resp map[string]string
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["error"] != "password must be at least 8 characters" {
		t.Errorf("got error %q", resp["error"])
	}
}

func TestHandleChangePassword_InvalidJSON(t *testing.T) {
	handler := handleChangePassword(nil)
	req := httptest.NewRequest(http.MethodPut, "/password", bytes.NewReader([]byte("bad")))
	ctx := withClaims(req.Context(), &Claims{UserID: "user-1", Role: "dsi"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req.WithContext(ctx))

	if rec.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

// --- Context helper tests ---

func TestUserFromContext_Empty(t *testing.T) {
	ctx := context.Background()
	if c := UserFromContext(ctx); c != nil {
		t.Errorf("expected nil, got %+v", c)
	}
}

func TestUserFromContext_WithClaims(t *testing.T) {
	claims := &Claims{UserID: "u1", Username: "test", Role: "admin"}
	ctx := withClaims(context.Background(), claims)
	c := UserFromContext(ctx)
	if c == nil {
		t.Fatal("expected claims, got nil")
	}
	if c.UserID != "u1" {
		t.Errorf("got %q, want %q", c.UserID, "u1")
	}
}

// --- HashPassword tests ---

func TestHashPassword(t *testing.T) {
	hash, err := HashPassword("mysecurepassword")
	if err != nil {
		t.Fatal(err)
	}
	if hash == "" {
		t.Fatal("expected non-empty hash")
	}
	if hash == "mysecurepassword" {
		t.Fatal("hash should not be plaintext")
	}
}
