package importer

import (
	"strings"

	"gopkg.in/yaml.v3"
)

// Frontmatter holds metadata extracted from YAML frontmatter.
type Frontmatter struct {
	Title string   `yaml:"title"`
	Date  string   `yaml:"date"`
	Tags  []string `yaml:"tags"`
	Type  string   `yaml:"type"`
}

// ParseFrontmatter detects and parses YAML frontmatter delimited by --- lines.
// It returns the parsed metadata and the remaining content with frontmatter removed.
// If no frontmatter is found, it returns an empty Frontmatter and the original content.
func ParseFrontmatter(content string) (Frontmatter, string) {
	var fm Frontmatter

	trimmed := strings.TrimLeft(content, " \t\r\n")
	if !strings.HasPrefix(trimmed, "---") {
		return fm, content
	}

	// Find the opening ---
	startIdx := strings.Index(content, "---")
	afterOpen := content[startIdx+3:]

	// Must have a newline right after ---
	if len(afterOpen) == 0 || (afterOpen[0] != '\n' && afterOpen[0] != '\r') {
		return fm, content
	}

	// Skip the newline after opening ---
	yamlStart := 1
	if afterOpen[0] == '\r' && len(afterOpen) > 1 && afterOpen[1] == '\n' {
		yamlStart = 2
	}

	// Find the closing --- on its own line
	closeIdx := strings.Index(afterOpen[yamlStart:], "\n---")
	var yamlContent string
	var remaining string
	if closeIdx == -1 {
		// Check if content starts with --- (empty frontmatter)
		if strings.HasPrefix(afterOpen[yamlStart:], "---") {
			yamlContent = ""
			remaining = afterOpen[yamlStart+3:]
		} else {
			return fm, content
		}
	} else {
		yamlContent = afterOpen[yamlStart : yamlStart+closeIdx]
		remaining = afterOpen[yamlStart+closeIdx+4:] // skip \n---
	}

	// Skip optional newline after closing ---
	if len(remaining) > 0 && remaining[0] == '\n' {
		remaining = remaining[1:]
	} else if len(remaining) > 1 && remaining[0] == '\r' && remaining[1] == '\n' {
		remaining = remaining[2:]
	}

	if err := yaml.Unmarshal([]byte(yamlContent), &fm); err != nil {
		// If YAML is invalid, return content unchanged
		return Frontmatter{}, content
	}

	return fm, remaining
}
