package admin

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGenerateSlug(t *testing.T) {
	tests := []struct {
		input, want string
	}{
		{"Hello World", "hello-world"},
		{"Réseau & Sécurité", "reseau-securite"},
		{"  spaces  ", "spaces"},
		{"", "untitled"},
		{"already-slug", "already-slug"},
	}
	for _, tt := range tests {
		got := generateSlug(tt.input)
		if got != tt.want {
			t.Errorf("generateSlug(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestGeneratePassword(t *testing.T) {
	p := generatePassword(12)
	if len(p) != 12 {
		t.Errorf("generatePassword(12) length = %d, want 12", len(p))
	}
	for _, c := range p {
		found := false
		for _, a := range alphanumChars {
			if c == a {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("generatePassword produced invalid char: %c", c)
		}
	}
	p2 := generatePassword(12)
	if p == p2 {
		t.Error("generatePassword produced identical passwords")
	}
}

func TestRequireAdmin_NoAuth(t *testing.T) {
	handler := requireAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestWriteJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	writeJSON(rec, http.StatusCreated, map[string]string{"key": "val"})

	if rec.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected application/json, got %s", ct)
	}

	var body map[string]string
	json.NewDecoder(rec.Body).Decode(&body)
	if body["key"] != "val" {
		t.Errorf("expected val, got %s", body["key"])
	}
}

func TestFreshnessValidation(t *testing.T) {
	tests := []struct {
		name    string
		green   int
		yellow  int
		wantErr bool
	}{
		{"valid", 30, 90, false},
		{"green_zero", 0, 90, true},
		{"yellow_zero", 30, 0, true},
		{"green_ge_yellow", 90, 30, true},
		{"equal", 30, 30, true},
		{"negative", -1, 90, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hasErr := tt.green <= 0 || tt.yellow <= 0 || tt.green >= tt.yellow
			if hasErr != tt.wantErr {
				t.Errorf("validation(%d, %d) error = %v, wantErr %v", tt.green, tt.yellow, hasErr, tt.wantErr)
			}
		})
	}
}

func TestTimeStr(t *testing.T) {
	now := time.Date(2025, 1, 15, 10, 30, 0, 0, time.UTC)
	got := timeStr(now)
	want := "2025-01-15T10:30:00Z"
	if got != want {
		t.Errorf("timeStr() = %q, want %q", got, want)
	}
}

func TestTimePtrStr(t *testing.T) {
	now := time.Date(2025, 1, 15, 10, 30, 0, 0, time.UTC)
	got := timePtrStr(&now)
	if got == nil {
		t.Fatal("expected non-nil")
	}
	want := "2025-01-15T10:30:00Z"
	if *got != want {
		t.Errorf("timePtrStr() = %q, want %q", *got, want)
	}

	got = timePtrStr(nil)
	if got != nil {
		t.Error("expected nil for nil input")
	}
}

func TestRequestParsing(t *testing.T) {
	t.Run("createDomain_emptyName", func(t *testing.T) {
		body, _ := json.Marshal(createDomainRequest{Name: "", Color: "#fff", Icon: "x"})
		var parsed createDomainRequest
		json.NewDecoder(bytes.NewReader(body)).Decode(&parsed)
		if parsed.Name != "" {
			t.Error("expected empty name")
		}
	})

	t.Run("createTemplate_emptyName", func(t *testing.T) {
		body, _ := json.Marshal(createTemplateRequest{Name: "", Description: "test"})
		var parsed createTemplateRequest
		json.NewDecoder(bytes.NewReader(body)).Decode(&parsed)
		if parsed.Name != "" {
			t.Error("expected empty name")
		}
	})

	t.Run("createUser_emptyFields", func(t *testing.T) {
		body, _ := json.Marshal(createUserRequest{Username: "", Password: ""})
		var parsed createUserRequest
		json.NewDecoder(bytes.NewReader(body)).Decode(&parsed)
		if parsed.Username != "" || parsed.Password != "" {
			t.Error("expected empty username and password")
		}
	})
}
