package document

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/alexmusic/plumenote/internal/httputil"
)

func TestComputeFreshness(t *testing.T) {
	now := time.Now()
	old := now.AddDate(-1, 0, 0) // 1 year ago

	tests := []struct {
		name       string
		created    time.Time
		updated    time.Time
		verified   *time.Time
		greenDays  int
		yellowDays int
		want       string
	}{
		{"all old, no verify = red", old, old, nil, 30, 180, "red"},
		{"just created = green", now, now, nil, 30, 180, "green"},
		{"old but just verified = green", old, old, timePtr(now), 30, 180, "green"},
		{"old but recently updated = green", old, now, nil, 30, 180, "green"},
		{"created 10 days ago = green", now.AddDate(0, 0, -10), now.AddDate(0, 0, -10), nil, 30, 180, "green"},
		{"updated 60 days ago = yellow", old, now.AddDate(0, 0, -60), nil, 30, 180, "yellow"},
		{"verified 60 days ago = yellow", old, old, timePtr(now.AddDate(0, 0, -60)), 30, 180, "yellow"},
		{"all 200 days ago = red", now.AddDate(0, 0, -200), now.AddDate(0, 0, -200), nil, 30, 180, "red"},
		{"verified wins over old dates", old, old, timePtr(now.AddDate(0, 0, -5)), 30, 180, "green"},
		{"updated wins over old verify", old, now.AddDate(0, 0, -5), timePtr(old), 30, 180, "green"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ComputeFreshness(tt.created, tt.updated, tt.verified, tt.greenDays, tt.yellowDays)
			if got != tt.want {
				t.Errorf("ComputeFreshness() = %q, want %q", got, tt.want)
			}
		})
	}
}

func timePtr(t time.Time) *time.Time {
	return &t
}

func TestExtractBodyText(t *testing.T) {
	tests := []struct {
		name string
		json string
		want string
	}{
		{"empty", "", ""},
		{"invalid json", "{bad", ""},
		{"text node", `{"type":"text","text":"hello"}`, "hello"},
		{"paragraph with text", `{"type":"paragraph","content":[{"type":"text","text":"hello world"}]}`, "hello world"},
		{"nested doc", `{
			"type":"doc",
			"content":[
				{"type":"paragraph","content":[{"type":"text","text":"first"}]},
				{"type":"paragraph","content":[{"type":"text","text":"second"}]}
			]
		}`, "first\nsecond"},
		{"heading", `{"type":"heading","content":[{"type":"text","text":"Title"}]}`, "Title"},
		{"mixed inline", `{"type":"paragraph","content":[
			{"type":"text","text":"hello "},
			{"type":"text","text":"world"}
		]}`, "hello world"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractBodyText(json.RawMessage(tt.json))
			if got != tt.want {
				t.Errorf("ExtractBodyText() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestGenerateSlug(t *testing.T) {
	tests := []struct {
		name  string
		title string
		want  string
	}{
		{"simple", "Hello World", "hello-world"},
		{"accents", "Configuration VPN ProWeb", "configuration-vpn-proweb"},
		{"french accents", "Procedure d'installation", "procedure-d-installation"},
		{"special chars", "Test @#$ slug!!!", "test-slug"},
		{"multiple spaces", "hello   world", "hello-world"},
		{"leading trailing", "  hello  ", "hello"},
		{"empty", "", "untitled"},
		{"only special", "@#$%", "untitled"},
		{"long title", string(make([]byte, 200)), "untitled"},
		{"unicode accents", "Procédure réseau été", "procedure-reseau-ete"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := httputil.GenerateSlug(tt.title)
			if got != tt.want {
				t.Errorf("httputil.GenerateSlug(%q) = %q, want %q", tt.title, got, tt.want)
			}
		})
	}
}

func TestGenerateSlug_MaxLength(t *testing.T) {
	// Create a title that would generate a slug > 100 chars
	longTitle := ""
	for i := 0; i < 30; i++ {
		longTitle += "word "
	}
	slug := httputil.GenerateSlug(longTitle)
	if len(slug) > 100 {
		t.Errorf("slug length %d exceeds 100", len(slug))
	}
}
