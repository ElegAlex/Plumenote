package analytics

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alexmusic/plumenote/internal/model"
)

func TestHandleSearchLog_MissingQuery(t *testing.T) {
	deps := setupDeps(t)
	handler := Router(deps)

	body := `{"result_count": 5}`
	req := httptest.NewRequest("POST", "/search-log", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandleSearchLog_InvalidBody(t *testing.T) {
	deps := setupDeps(t)
	handler := Router(deps)

	req := httptest.NewRequest("POST", "/search-log", bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandleViewLog_MissingDocumentID(t *testing.T) {
	deps := setupDeps(t)
	handler := Router(deps)

	body := `{"duration_seconds": 30}`
	req := httptest.NewRequest("POST", "/view-log", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandleViewCount_MissingDocumentID(t *testing.T) {
	deps := setupDeps(t)
	handler := Router(deps)

	body := `{}`
	req := httptest.NewRequest("POST", "/view-count", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandleViewCount_InvalidBody(t *testing.T) {
	deps := setupDeps(t)
	handler := Router(deps)

	req := httptest.NewRequest("POST", "/view-count", bytes.NewBufferString("{bad"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
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
	var m map[string]string
	if err := json.NewDecoder(w.Body).Decode(&m); err != nil {
		t.Fatal(err)
	}
	if m["key"] != "value" {
		t.Fatalf("unexpected response: %v", m)
	}
}

func setupDeps(t *testing.T) *model.Deps {
	t.Helper()
	return &model.Deps{}
}
