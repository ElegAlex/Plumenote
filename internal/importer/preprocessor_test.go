package importer

import (
	"strings"
	"testing"
)

func TestConvertCallouts(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		wantType   string
		wantInBody string
	}{
		{
			name:       "warning callout",
			input:      "> [!warning] Be careful\n> This is dangerous",
			wantType:   "warning",
			wantInBody: "Be careful",
		},
		{
			name:       "important maps to warning",
			input:      "> [!important] Important note\n> Details here",
			wantType:   "warning",
			wantInBody: "Important note",
		},
		{
			name:       "danger callout",
			input:      "> [!danger] Do not do this\n> Seriously",
			wantType:   "danger",
			wantInBody: "Do not do this",
		},
		{
			name:       "tip callout",
			input:      "> [!tip] Helpful tip\n> Use this",
			wantType:   "tip",
			wantInBody: "Helpful tip",
		},
		{
			name:       "note maps to tip",
			input:      "> [!note] A note\n> Some details",
			wantType:   "tip",
			wantInBody: "A note",
		},
		{
			name:       "info maps to tip",
			input:      "> [!info] Information\n> More info",
			wantType:   "tip",
			wantInBody: "Information",
		},
		{
			name:       "success maps to tip",
			input:      "> [!success] It worked\n> Great",
			wantType:   "tip",
			wantInBody: "It worked",
		},
		{
			name:       "abstract maps to tip",
			input:      "> [!abstract] Abstract\n> Summary text",
			wantType:   "tip",
			wantInBody: "Abstract",
		},
		{
			name:       "summary maps to tip",
			input:      "> [!summary] Summary\n> Key points",
			wantType:   "tip",
			wantInBody: "Summary",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := convertCallouts(tt.input)
			if !strings.Contains(result, `data-type="`+tt.wantType+`"`) {
				t.Errorf("expected data-type=%q in output, got:\n%s", tt.wantType, result)
			}
			if !strings.Contains(result, tt.wantInBody) {
				t.Errorf("expected %q in output, got:\n%s", tt.wantInBody, result)
			}
			if !strings.Contains(result, `class="alert-block"`) {
				t.Errorf("expected alert-block class in output, got:\n%s", result)
			}
		})
	}
}

func TestConvertCallouts_RegularBlockquote(t *testing.T) {
	input := "> This is a regular blockquote\n> with multiple lines"
	result := convertCallouts(input)
	if strings.Contains(result, "alert-block") {
		t.Error("regular blockquote should not be converted to alert-block")
	}
	if result != input {
		t.Errorf("regular blockquote should be unchanged, got:\n%s", result)
	}
}

func TestConvertCallouts_NoTitle(t *testing.T) {
	input := "> [!warning]\n> Content only"
	result := convertCallouts(input)
	if !strings.Contains(result, `data-type="warning"`) {
		t.Errorf("expected warning type, got:\n%s", result)
	}
	if !strings.Contains(result, "Content only") {
		t.Errorf("expected content, got:\n%s", result)
	}
}

func TestConvertWikilinks(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "simple wikilink",
			input:    "See [[Document]]",
			expected: "See [Document]()",
		},
		{
			name:     "anchor wikilink",
			input:    "See [[#Section Title]]",
			expected: "See [Section Title](#Section Title)",
		},
		{
			name:     "aliased wikilink",
			input:    "See [[Document|click here]]",
			expected: "See [click here]()",
		},
		{
			name:     "multiple wikilinks",
			input:    "Link to [[A]] and [[B]]",
			expected: "Link to [A]() and [B]()",
		},
		{
			name:     "no wikilinks",
			input:    "Normal text without links",
			expected: "Normal text without links",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := convertWikilinks(tt.input)
			if got != tt.expected {
				t.Errorf("convertWikilinks(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestConvertHighlights(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "simple highlight",
			input:    "This is ==highlighted== text",
			expected: "This is <mark>highlighted</mark> text",
		},
		{
			name:     "multiple highlights",
			input:    "==first== and ==second==",
			expected: "<mark>first</mark> and <mark>second</mark>",
		},
		{
			name:     "no highlights",
			input:    "Normal text",
			expected: "Normal text",
		},
		{
			name:     "single equals not highlighted",
			input:    "a = b",
			expected: "a = b",
		},
		{
			name:     "highlight with spaces",
			input:    "==multiple words here==",
			expected: "<mark>multiple words here</mark>",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := convertHighlights(tt.input)
			if got != tt.expected {
				t.Errorf("convertHighlights(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestEscapeNonHTMLTags(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "XML prompt tags are escaped",
			input:    "<prompt>\n<system_role>You are an expert</system_role>\n</prompt>",
			expected: "&lt;prompt>\n&lt;system_role>You are an expert&lt;/system_role>\n&lt;/prompt>",
		},
		{
			name:     "standard HTML tags are preserved",
			input:    "<div class=\"test\"><strong>bold</strong></div>",
			expected: "<div class=\"test\"><strong>bold</strong></div>",
		},
		{
			name:     "mark tags preserved",
			input:    "<mark>highlighted</mark>",
			expected: "<mark>highlighted</mark>",
		},
		{
			name:     "custom tags like context escaped",
			input:    "<context>some context</context>",
			expected: "&lt;context>some context&lt;/context>",
		},
		{
			name:     "mixed standard and custom tags",
			input:    "<div><methodology>step 1</methodology></div>",
			expected: "<div>&lt;methodology>step 1&lt;/methodology></div>",
		},
		{
			name:     "self-closing custom tag",
			input:    "<my-component/>",
			expected: "&lt;my-component/>",
		},
		{
			name:     "no tags at all",
			input:    "just plain text",
			expected: "just plain text",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := escapeNonHTMLTags(tt.input)
			if got != tt.expected {
				t.Errorf("escapeNonHTMLTags(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestPreprocessMarkdown_Integration(t *testing.T) {
	input := `# Title

> [!warning] Attention
> Be careful with this

Some ==highlighted== text and a [[Document]] link.

> [!tip] Pro tip
> Use [[#section]] for anchors.
`
	result := PreprocessMarkdown(input)

	// Should have alert-block divs
	if !strings.Contains(result, `class="alert-block"`) {
		t.Error("expected alert-block in output")
	}
	// Should have mark tags
	if !strings.Contains(result, "<mark>highlighted</mark>") {
		t.Error("expected <mark> tag in output")
	}
	// Should have converted wikilinks
	if strings.Contains(result, "[[Document]]") {
		t.Error("wikilinks should be converted")
	}
	if !strings.Contains(result, "[Document]()") {
		t.Error("expected converted wikilink")
	}
}

func TestPreprocessMarkdown_CodeFenceProtection(t *testing.T) {
	input := "# Title\n\n```markdown\n<prompt>\n<system_role>\nYou are an expert\n</system_role>\n## Phase 1\n==highlighted==\n[[Document]]\n> [!warning] test\n</prompt>\n```\n\nSome ==real highlight== text."

	result := PreprocessMarkdown(input)

	// Content inside code fence must be preserved verbatim
	if !strings.Contains(result, "<prompt>") {
		t.Error("code fence content should NOT have <prompt> escaped")
	}
	if !strings.Contains(result, "<system_role>") {
		t.Error("code fence content should NOT have <system_role> escaped")
	}
	if !strings.Contains(result, "==highlighted==") {
		t.Error("code fence content should NOT have highlights converted")
	}
	if !strings.Contains(result, "[[Document]]") {
		t.Error("code fence content should NOT have wikilinks converted")
	}
	if !strings.Contains(result, "> [!warning] test") {
		t.Error("code fence content should NOT have callouts converted")
	}

	// Content outside code fence should still be processed
	if !strings.Contains(result, "<mark>real highlight</mark>") {
		t.Error("content outside code fence should still be processed")
	}
}

func TestPreprocessMarkdown_NestedCodeFences(t *testing.T) {
	// Simulates the real-world pattern: ```markdown blocks containing inner ``` blocks
	input := "# PROMPT 1\n\n```markdown\n<prompt>\n<output_format>\n## Section\n```\n\n[diagram here]\n\n```\n## More content\n</output_format>\n</prompt>\n```\n\n---\n\n# PROMPT 2\n\n```markdown\n<prompt>\nContent of prompt 2\n</prompt>\n```\n\nSome ==highlight== outside."

	result := PreprocessMarkdown(input)

	// Both prompts should be preserved as code fences (not escaped)
	if !strings.Contains(result, "<prompt>") {
		t.Error("prompt tags should be preserved inside code fences")
	}
	if !strings.Contains(result, "<output_format>") {
		t.Error("output_format tags should be preserved inside code fences")
	}
	if !strings.Contains(result, "Content of prompt 2") {
		t.Error("second prompt content should be preserved")
	}

	// Content outside should be processed
	if !strings.Contains(result, "<mark>highlight</mark>") {
		t.Error("content outside code fence should still be processed")
	}
}
