package document

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/model"
)

func withTestAuth(req *http.Request, userID, role, domainID string) *http.Request {
	// Generate a real JWT token for testing
	token, _ := auth.GenerateToken(userID, "testuser", role, domainID, "test-secret")
	req.Header.Set("Authorization", "Bearer "+token)
	return req
}

func testRouter() (http.Handler, *model.Deps) {
	deps := &model.Deps{JWTSecret: "test-secret"}
	return Router(deps), deps
}

func TestCreateDocument_MissingTitle(t *testing.T) {
	h, _ := testRouter()

	body := `{"body":{},"domain_id":"d1","type_id":"t1"}`
	req := httptest.NewRequest("POST", "/", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req = withTestAuth(req, "user-1", "dsi", "dom-1")

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateDocument_NoAuth(t *testing.T) {
	h, _ := testRouter()

	body := `{"title":"test","body":{},"domain_id":"d1","type_id":"t1"}`
	req := httptest.NewRequest("POST", "/", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateDocument_InvalidVisibility(t *testing.T) {
	h, _ := testRouter()

	body := `{"title":"test","body":{},"domain_id":"d1","type_id":"t1","visibility":"invalid"}`
	req := httptest.NewRequest("POST", "/", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req = withTestAuth(req, "user-1", "dsi", "dom-1")

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateDocument_MissingDomainType(t *testing.T) {
	h, _ := testRouter()

	body := `{"title":"test","body":{}}`
	req := httptest.NewRequest("POST", "/", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req = withTestAuth(req, "user-1", "dsi", "dom-1")

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetDocument_NotFound(t *testing.T) {
	// Without a DB connection, this will fail with 500 (no DB), not 404.
	// This test validates the route is wired correctly.
	h, _ := testRouter()

	req := httptest.NewRequest("GET", "/non-existent-slug", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	// Without DB, we expect 500 (connection error)
	if w.Code == http.StatusOK {
		t.Fatal("expected non-200 without DB")
	}
}

func TestListDocuments_NoDB(t *testing.T) {
	h, _ := testRouter()

	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	// Without DB, we expect 500
	if w.Code == http.StatusOK {
		t.Fatal("expected non-200 without DB")
	}
}

func TestDeleteDocument_NoAuth(t *testing.T) {
	h, _ := testRouter()

	req := httptest.NewRequest("DELETE", "/some-id", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestUpdateDocument_NoAuth(t *testing.T) {
	h, _ := testRouter()

	body := `{"title":"test"}`
	req := httptest.NewRequest("PUT", "/some-id", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestVerifyDocument_NoAuth(t *testing.T) {
	h, _ := testRouter()

	req := httptest.NewRequest("POST", "/some-id/verify", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestUploadAttachment_NoAuth(t *testing.T) {
	h, _ := testRouter()

	req := httptest.NewRequest("POST", "/some-id/attachments", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestCreateTag_NoAuth(t *testing.T) {
	h, _ := testRouter()

	body := `{"name":"test-tag"}`
	req := httptest.NewRequest("POST", "/tags", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()
	writeJSON(w, http.StatusOK, map[string]string{"key": "value"})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected application/json, got %s", ct)
	}
	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if resp["key"] != "value" {
		t.Fatalf("expected value, got %s", resp["key"])
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	writeError(w, http.StatusNotFound, "not found")

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if resp["error"] != "not found" {
		t.Fatalf("expected 'not found', got %s", resp["error"])
	}
}
