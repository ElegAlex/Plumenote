package importer

import (
	"testing"
)

func TestSlugify(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Hello World", "hello-world"},
		{"Guide VPN ProWeb", "guide-vpn-proweb"},
		{"  spaces  ", "spaces"},
		{"file_name_here", "file-name-here"},
		{"UPPERCASE", "uppercase"},
		{"special!@#chars", "specialchars"},
		{"", "untitled"},
		{"---dashes---", "dashes"},
	}

	for _, tt := range tests {
		got := slugify(tt.input)
		if got != tt.expected {
			t.Errorf("slugify(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestTitleFromFilename(t *testing.T) {
	tests := []struct {
		path     string
		expected string
	}{
		{"/path/to/document.docx", "document"},
		{"/path/to/My Guide.pdf", "My Guide"},
		{"file.txt", "file"},
		{"/folder/README.md", "README"},
	}

	for _, tt := range tests {
		got := titleFromFilename(tt.path)
		if got != tt.expected {
			t.Errorf("titleFromFilename(%q) = %q, want %q", tt.path, got, tt.expected)
		}
	}
}

func TestIsSupportedExtension(t *testing.T) {
	supported := []string{".doc", ".docx", ".pdf", ".txt", ".md"}
	for _, ext := range supported {
		if !isSupportedExtension(ext) {
			t.Errorf("expected %s to be supported", ext)
		}
	}

	unsupported := []string{".jpg", ".png", ".xlsx", ".go", ".html"}
	for _, ext := range unsupported {
		if isSupportedExtension(ext) {
			t.Errorf("expected %s to NOT be supported", ext)
		}
	}
}

func TestStripHTMLTags(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"<p>Hello</p>", "Hello"},
		{"<strong>bold</strong> text", "bold text"},
		{"no tags", "no tags"},
		{"<div><p>nested</p></div>", "nested"},
	}

	for _, tt := range tests {
		got := stripHTMLTags(tt.input)
		if got != tt.expected {
			t.Errorf("stripHTMLTags(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestTextToTipTap(t *testing.T) {
	text := "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
	doc := textToTipTap(text)

	if doc.Type != "doc" {
		t.Errorf("expected doc type, got %s", doc.Type)
	}
	if len(doc.Content) != 3 {
		t.Fatalf("expected 3 paragraphs, got %d", len(doc.Content))
	}
	for i, p := range doc.Content {
		if p.Type != "paragraph" {
			t.Errorf("content[%d]: expected paragraph, got %s", i, p.Type)
		}
	}
}

func TestTextToTipTap_Empty(t *testing.T) {
	doc := textToTipTap("")
	if len(doc.Content) == 0 {
		t.Error("expected at least one paragraph for empty input")
	}
}

func TestResolveDomain(t *testing.T) {
	domainMap := map[string]string{
		"sci":            "uuid-sci",
		"infrastructure": "uuid-infra",
		"support":        "uuid-support",
	}
	defaultID := "uuid-sci"

	tests := []struct {
		root     string
		path     string
		expected string
	}{
		{"/import", "/import/SCI/doc.docx", "uuid-sci"},
		{"/import", "/import/Infrastructure/guide.pdf", "uuid-infra"},
		{"/import", "/import/Support/file.txt", "uuid-support"},
		{"/import", "/import/doc.docx", defaultID},           // root file
		{"/import", "/import/Unknown/doc.docx", defaultID},   // unknown subfolder
	}

	for _, tt := range tests {
		got := resolveDomain(tt.root, tt.path, domainMap, defaultID)
		if got != tt.expected {
			t.Errorf("resolveDomain(%q, %q) = %q, want %q", tt.root, tt.path, got, tt.expected)
		}
	}
}

func TestFindDefaultDomain(t *testing.T) {
	m := map[string]string{
		"sci":  "uuid-sci",
		"infra": "uuid-infra",
	}
	got := findDefaultDomain(m)
	if got != "uuid-sci" {
		t.Errorf("expected uuid-sci, got %s", got)
	}

	m2 := map[string]string{
		"infra": "uuid-infra",
	}
	got2 := findDefaultDomain(m2)
	if got2 != "uuid-infra" {
		t.Errorf("expected uuid-infra, got %s", got2)
	}
}

func TestReportStructure(t *testing.T) {
	r := &Report{
		Total:   5,
		Success: 3,
		Failed:  2,
		Failures: []Failure{
			{Path: "/a.pdf", Reason: "corrupt"},
			{Path: "/b.doc", Reason: "too large"},
		},
		Documents: []ImportedDoc{
			{Path: "/c.docx", Title: "Doc C", DocID: "id-1", DomainID: "d-1"},
		},
	}

	if r.Total != r.Success+r.Failed {
		t.Errorf("total %d != success %d + failed %d", r.Total, r.Success, r.Failed)
	}
	if len(r.Failures) != 2 {
		t.Errorf("expected 2 failures, got %d", len(r.Failures))
	}
}
