package document

import (
	"encoding/json"
	"strings"
	"time"
)

// extractInternalLinkSlugs traverses a TipTap JSON tree and extracts slugs
// from internal link marks (href starting with "/documents/").
func extractInternalLinkSlugs(body json.RawMessage) []string {
	if len(body) == 0 {
		return nil
	}
	seen := make(map[string]bool)
	var slugs []string
	extractLinksRecursive(body, seen, &slugs)
	return slugs
}

func extractLinksRecursive(raw json.RawMessage, seen map[string]bool, slugs *[]string) {
	var node struct {
		Type    string          `json:"type"`
		Text    string          `json:"text"`
		Marks   []mark          `json:"marks"`
		Content json.RawMessage `json:"content"`
	}
	if err := json.Unmarshal(raw, &node); err != nil {
		return
	}

	// Check marks on text nodes for internal links
	if node.Type == "text" && len(node.Marks) > 0 {
		for _, m := range node.Marks {
			if m.Type == "link" && strings.HasPrefix(m.Attrs.Href, "/documents/") {
				slug := strings.TrimPrefix(m.Attrs.Href, "/documents/")
				if slug != "" && !seen[slug] {
					seen[slug] = true
					*slugs = append(*slugs, slug)
				}
			}
		}
	}

	// Recurse into children
	if len(node.Content) == 0 {
		return
	}
	var children []json.RawMessage
	if err := json.Unmarshal(node.Content, &children); err != nil {
		return
	}
	for _, child := range children {
		extractLinksRecursive(child, seen, slugs)
	}
}

type mark struct {
	Type  string    `json:"type"`
	Attrs markAttrs `json:"attrs"`
}

type markAttrs struct {
	Href string `json:"href"`
}

// ComputeFreshness returns "green", "yellow", or "red" based on last verification date.
func ComputeFreshness(lastVerifiedAt *time.Time, greenDays, yellowDays int) string {
	if lastVerifiedAt == nil {
		return "red"
	}
	days := int(time.Since(*lastVerifiedAt).Hours() / 24)
	if days < greenDays {
		return "green"
	}
	if days <= yellowDays {
		return "yellow"
	}
	return "red"
}

// UnwrapDoubleEncodedBody detects and fixes a body that was stored as a JSON string
// instead of a JSON object (e.g. `"{\"type\":\"doc\",...}"` instead of `{"type":"doc",...}`).
// This can happen if the frontend double-encodes the body before sending it.
func UnwrapDoubleEncodedBody(body json.RawMessage) json.RawMessage {
	if len(body) < 2 || body[0] != '"' {
		return body // already a JSON object/array, not a string
	}
	var s string
	if err := json.Unmarshal(body, &s); err != nil {
		return body
	}
	// Verify the unwrapped string is valid JSON object
	candidate := json.RawMessage(s)
	if len(candidate) > 0 && (candidate[0] == '{' || candidate[0] == '[') && json.Valid(candidate) {
		return candidate
	}
	return body
}

// ExtractBodyText traverses a TipTap/ProseMirror JSON tree and extracts plain text.
func ExtractBodyText(tiptapJSON json.RawMessage) string {
	if len(tiptapJSON) == 0 {
		return ""
	}
	var node struct {
		Type    string          `json:"type"`
		Text    string          `json:"text"`
		Content json.RawMessage `json:"content"`
	}
	if err := json.Unmarshal(tiptapJSON, &node); err != nil {
		return ""
	}
	if node.Type == "text" {
		return node.Text
	}
	if len(node.Content) == 0 {
		return ""
	}
	var children []json.RawMessage
	if err := json.Unmarshal(node.Content, &children); err != nil {
		return ""
	}
	var parts []string
	for _, child := range children {
		if t := ExtractBodyText(child); t != "" {
			parts = append(parts, t)
		}
	}
	// doc-level: join block children with newlines
	// block-level nodes (paragraph, heading, etc.): join inline children without separator
	switch node.Type {
	case "doc", "bulletList", "orderedList", "blockquote":
		return strings.Join(parts, "\n")
	}
	return strings.Join(parts, "")
}

