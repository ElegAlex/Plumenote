package search

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alexmusic/plumenote/internal/model"
	"github.com/meilisearch/meilisearch-go"
)

// mockIndex implements meilisearch.IndexManager for testing.
type mockIndex struct {
	meilisearch.IndexManager
	searchFunc func(query string, req *meilisearch.SearchRequest) (*meilisearch.SearchResponse, error)
}

func (m *mockIndex) Search(query string, req *meilisearch.SearchRequest) (*meilisearch.SearchResponse, error) {
	return m.searchFunc(query, req)
}

// mockMeili implements meilisearch.ServiceManager for testing.
type mockMeili struct {
	meilisearch.ServiceManager
	idx *mockIndex
}

func (m *mockMeili) Index(uid string) meilisearch.IndexManager {
	return m.idx
}

func TestHandleSearch_QueryTooShort(t *testing.T) {
	deps := &model.Deps{}
	handler := Router(deps)

	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}

	req = httptest.NewRequest("GET", "/?q=a", nil)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for single char, got %d", w.Code)
	}
}

func TestHandleSearch_Success(t *testing.T) {
	idx := &mockIndex{
		searchFunc: func(query string, req *meilisearch.SearchRequest) (*meilisearch.SearchResponse, error) {
			if query != "test query" {
				t.Errorf("unexpected query: %s", query)
			}
			// Verify visibility filter for anonymous
			found := false
			for _, f := range req.Filter.([]string) {
				if f == "visibility = public" {
					found = true
				}
			}
			if !found {
				t.Error("expected visibility=public filter for anonymous user")
			}
			return &meilisearch.SearchResponse{
				Hits: []interface{}{
					map[string]interface{}{
						"id":          "doc-1",
						"title":       "Test Doc",
						"body_text":   "Some body text",
						"domain_id":   "dom-1",
						"type_id":     "type-1",
						"visibility":  "public",
						"author_name": "Didier",
						"view_count":  float64(42),
						"created_at":  "2026-01-01T00:00:00Z",
						"tags":        []interface{}{"vpn", "config"},
						"_formatted": map[string]interface{}{
							"title":     "<mark>Test</mark> Doc",
							"body_text": "Some <mark>body</mark> text",
						},
					},
				},
				EstimatedTotalHits: 1,
				ProcessingTimeMs:   5,
			}, nil
		},
	}

	deps := &model.Deps{
		Meili: &mockMeili{idx: idx},
		// DB is nil — batchFreshness will return "red" for all
	}

	handler := Router(deps)
	req := httptest.NewRequest("GET", "/?q=test+query&limit=10", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp searchResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Total != 1 {
		t.Errorf("expected total=1, got %d", resp.Total)
	}
	if len(resp.Results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(resp.Results))
	}
	r := resp.Results[0]
	if r.ID != "doc-1" {
		t.Errorf("expected id=doc-1, got %s", r.ID)
	}
	if r.Title != "<mark>Test</mark> Doc" {
		t.Errorf("unexpected title: %s", r.Title)
	}
	if r.BodyTextHighlight != "Some <mark>body</mark> text" {
		t.Errorf("unexpected body highlight: %s", r.BodyTextHighlight)
	}
	if r.ViewCount != 42 {
		t.Errorf("expected view_count=42, got %d", r.ViewCount)
	}
	if len(r.Tags) != 2 {
		t.Errorf("expected 2 tags, got %d", len(r.Tags))
	}
	if r.FreshnessBadge != "red" {
		t.Errorf("expected freshness=red (no DB), got %s", r.FreshnessBadge)
	}
}

func TestComputeBadge(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name     string
		verified time.Time
		want     string
	}{
		{"green", now.Add(-10 * 24 * time.Hour), "green"},
		{"yellow", now.Add(-120 * 24 * time.Hour), "yellow"},
		{"red", now.Add(-365 * 24 * time.Hour), "red"},
		{"boundary green", now.Add(-90 * 24 * time.Hour), "green"},
		{"boundary yellow", now.Add(-180 * 24 * time.Hour), "yellow"},
		{"boundary red", now.Add(-181 * 24 * time.Hour), "red"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := computeBadge(now, tt.verified, 90, 180)
			if got != tt.want {
				t.Errorf("computeBadge(%v) = %s, want %s", tt.verified, got, tt.want)
			}
		})
	}
}

func TestHandleSearch_WithDomainFilter(t *testing.T) {
	idx := &mockIndex{
		searchFunc: func(query string, req *meilisearch.SearchRequest) (*meilisearch.SearchResponse, error) {
			filters := req.Filter.([]string)
			foundDomain := false
			for _, f := range filters {
				if f == `domain_id = "d0000000-0000-0000-0000-000000000001"` {
					foundDomain = true
				}
			}
			if !foundDomain {
				t.Error("expected domain_id filter")
			}
			return &meilisearch.SearchResponse{
				Hits:               []interface{}{},
				EstimatedTotalHits: 0,
				ProcessingTimeMs:   1,
			}, nil
		},
	}

	deps := &model.Deps{Meili: &mockMeili{idx: idx}}
	handler := Router(deps)
	req := httptest.NewRequest("GET", "/?q=test&domain=d0000000-0000-0000-0000-000000000001", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
