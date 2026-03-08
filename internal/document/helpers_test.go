package document

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/alexmusic/plumenote/internal/httputil"
)

func TestComputeFreshness(t *testing.T) {
	tests := []struct {
		name       string
		verified   *time.Time
		greenDays  int
		yellowDays int
		want       string
	}{
		{"nil = red", nil, 30, 180, "red"},
		{"just verified = green", timePtr(time.Now()), 30, 180, "green"},
		{"10 days ago = green", timePtr(time.Now().AddDate(0, 0, -10)), 30, 180, "green"},
		{"29 days ago = green", timePtr(time.Now().AddDate(0, 0, -29)), 30, 180, "green"},
		{"60 days ago = yellow", timePtr(time.Now().AddDate(0, 0, -60)), 30, 180, "yellow"},
		{"180 days ago = yellow", timePtr(time.Now().AddDate(0, 0, -180)), 30, 180, "yellow"},
		{"200 days ago = red", timePtr(time.Now().AddDate(0, 0, -200)), 30, 180, "red"},
		{"365 days ago = red", timePtr(time.Now().AddDate(-1, 0, 0)), 30, 180, "red"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ComputeFreshness(tt.verified, tt.greenDays, tt.yellowDays)
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
