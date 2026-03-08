package document

import (
	"encoding/json"
	"strings"
	"time"
)

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

