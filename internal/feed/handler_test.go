package feed

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/golang-jwt/jwt/v5"
)

// wrapWithRecoverer wraps the router with Chi's Recoverer middleware
// so that nil DB panics are caught and returned as 500.
func wrapWithRecoverer(h http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/", middleware.Recoverer(h))
	return mux
}

func TestGetFeedWithoutAuthReturns401(t *testing.T) {
	deps := setupDeps(t)
	router := Router(deps)

	req := httptest.NewRequest(http.MethodGet, "/feed", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("GET /feed without auth: expected 401, got %d", w.Code)
	}
}

func TestGetFeedWithAuthReturnsNon401(t *testing.T) {
	deps := setupDeps(t)
	router := wrapWithRecoverer(Router(deps))

	claims := jwt.MapClaims{
		"user_id":   "test-user-id",
		"username":  "testuser",
		"role":      "dsi",
		"domain_id": "test-domain-id",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/feed", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Without DB, we expect 500 (validates route wiring + auth passes)
	if w.Code == http.StatusUnauthorized {
		t.Errorf("GET /feed with valid auth: should not be 401, got %d", w.Code)
	}
}

func TestGetPendingReviewsWithoutAuthReturns401(t *testing.T) {
	deps := setupDeps(t)
	router := Router(deps)

	req := httptest.NewRequest(http.MethodGet, "/reviews/pending", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("GET /reviews/pending without auth: expected 401, got %d", w.Code)
	}
}

func TestGetPendingReviewsWithAuthReturnsNon401(t *testing.T) {
	deps := setupDeps(t)
	router := wrapWithRecoverer(Router(deps))

	// Create a valid JWT token
	claims := jwt.MapClaims{
		"user_id":   "test-user-id",
		"username":  "testuser",
		"role":      "admin",
		"domain_id": "test-domain-id",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/reviews/pending", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Without DB, we expect 500 (validates route wiring + auth passes)
	if w.Code == http.StatusUnauthorized {
		t.Errorf("GET /reviews/pending with valid auth: should not be 401, got %d", w.Code)
	}
}
