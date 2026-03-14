package importer

import (
	"fmt"
	"regexp"
	"strings"
)

// PreprocessMarkdown applies all Obsidian-specific transformations
// to a Markdown string before it is passed to Pandoc.
// It handles: callouts, wikilinks, highlights, and non-HTML tag escaping.
// Code fences are preserved untouched.
func PreprocessMarkdown(md string) string {
	// Extract code fences so preprocessor transformations don't corrupt them
	md, fences := extractCodeFences(md)
	md = convertCallouts(md)
	md = convertWikilinks(md)
	md = convertHighlights(md)
	md = escapeNonHTMLTags(md)
	md = disambiguateHRules(md)
	// Restore code fences
	md = restoreCodeFences(md, fences)
	return md
}

// codeFencePlaceholder is a unique placeholder for extracted code fences.
const codeFencePlaceholder = "\x00CODEFENCE_%d\x00"

// extractCodeFences replaces fenced code blocks (``` ... ```) with placeholders
// and returns the modified string plus the original fences.
//
// For fences WITH a language (e.g. ```markdown), bare ``` inside the content
// are expected to come in pairs (inner open/close). The real closing fence is
// the first unpaired bare ```. This handles any nested code blocks generically
// without relying on specific content patterns.
func extractCodeFences(md string) (string, []string) {
	var fences []string
	lines := strings.Split(md, "\n")
	var result []string
	inFence := false
	hasLang := false
	innerOpen := false // tracks paired inner ``` toggling
	var fenceLines []string
	fenceMarker := ""

	for i := 0; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)

		if !inFence {
			if strings.HasPrefix(trimmed, "```") || strings.HasPrefix(trimmed, "~~~") {
				inFence = true
				fenceMarker = trimmed[:3]
				lang := strings.TrimSpace(trimmed[3:])
				hasLang = lang != ""
				innerOpen = false
				fenceLines = []string{line}
				continue
			}
			result = append(result, line)
		} else {
			isBareClose := strings.HasPrefix(trimmed, fenceMarker) &&
				strings.TrimSpace(strings.TrimLeft(trimmed, fenceMarker[:1])) == ""

			if !isBareClose {
				fenceLines = append(fenceLines, line)
				continue
			}

			// Bare ``` found. For simple fences (no lang), it always closes.
			// For fences with a language, inner ``` come in pairs:
			// the first opens an inner block, the next closes it.
			// A bare ``` when no inner block is open = real close.
			if hasLang && innerOpen {
				// This closes an inner block — keep as content
				innerOpen = false
				fenceLines = append(fenceLines, line)
				continue
			}
			if hasLang && !innerOpen && hasMatchingBareClose(lines, i+1, fenceMarker) {
				// This opens an inner block — there's a matching close later
				innerOpen = true
				fenceLines = append(fenceLines, line)
				continue
			}

			// Real close
			fenceLines = append(fenceLines, line)
			inFence = false
			hasLang = false
			innerOpen = false
			placeholder := fmt.Sprintf(codeFencePlaceholder, len(fences))
			fences = append(fences, strings.Join(fenceLines, "\n"))
			result = append(result, placeholder)
			fenceLines = nil
		}
	}

	// If we ended inside an unclosed fence, put the lines back as-is
	if inFence {
		result = append(result, fenceLines...)
	}

	return strings.Join(result, "\n"), fences
}

// hasMatchingBareClose scans forward from startIdx looking for another bare ```
// that would pair with the current one (forming an inner open/close pair).
// It returns true if at least one more bare ``` exists before a ```lang fence
// (which would indicate a new outer block) or EOF.
func hasMatchingBareClose(lines []string, startIdx int, marker string) bool {
	for i := startIdx; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if !strings.HasPrefix(trimmed, marker) {
			continue
		}
		rest := strings.TrimSpace(trimmed[3:])
		if rest == "" {
			// Another bare ``` — this one would close the inner block
			return true
		}
		// A ```lang line means a new outer fence — stop searching
		return false
	}
	return false
}

// restoreCodeFences replaces placeholders with the original code fences.
func restoreCodeFences(md string, fences []string) string {
	for i, fence := range fences {
		placeholder := fmt.Sprintf(codeFencePlaceholder, i)
		md = strings.Replace(md, placeholder, fence, 1)
	}
	return md
}

// standardHTMLTags lists HTML tags that Pandoc and HTMLToTipTap handle correctly.
// Any other <tag> encountered in Markdown will be escaped to &lt;tag&gt;.
var standardHTMLTags = map[string]bool{
	"a": true, "b": true, "i": true, "u": true, "s": true, "p": true,
	"em": true, "strong": true, "del": true, "br": true, "hr": true,
	"h1": true, "h2": true, "h3": true, "h4": true, "h5": true, "h6": true,
	"ul": true, "ol": true, "li": true,
	"table": true, "thead": true, "tbody": true, "tr": true, "td": true, "th": true,
	"pre": true, "code": true, "blockquote": true,
	"img": true, "sup": true, "sub": true, "span": true,
	"mark": true, "div": true, "input": true,
}

// nonHTMLTagRe matches opening/closing/self-closing tags like <foo>, </foo>, <foo/>, <foo attr="val">
var nonHTMLTagRe = regexp.MustCompile(`<(/?)([a-zA-Z][a-zA-Z0-9_-]*)((?:\s+[^>]*)?)(/?)>`)

// escapeNonHTMLTags escapes XML/HTML-like tags that are NOT standard HTML,
// so Pandoc treats them as literal text instead of raw HTML blocks.
// This preserves tags injected by the preprocessor (like <mark>, <div>).
func escapeNonHTMLTags(md string) string {
	return nonHTMLTagRe.ReplaceAllStringFunc(md, func(match string) string {
		sub := nonHTMLTagRe.FindStringSubmatch(match)
		if sub == nil {
			return match
		}
		tagName := strings.ToLower(sub[2])
		if standardHTMLTags[tagName] {
			return match // keep standard HTML tags
		}
		// Escape the opening < so Pandoc sees it as text
		return "&lt;" + match[1:]
	})
}

// calloutTypeMap maps Obsidian callout types to alertBlock types.
var calloutTypeMap = map[string]string{
	"warning":   "warning",
	"important": "warning",
	"danger":    "danger",
	"tip":       "tip",
	"success":   "tip",
	"info":      "tip",
	"note":      "tip",
	"abstract":  "tip",
	"summary":   "tip",
}

// convertCallouts detects Obsidian callout blocks (> [!type] title)
// and converts them to HTML <div class="alert-block" data-type="..."> blocks.
func convertCallouts(md string) string {
	lines := strings.Split(md, "\n")
	var result []string
	i := 0

	for i < len(lines) {
		line := lines[i]

		// Check if this line starts a callout: > [!type]
		calloutType, title := parseCalloutHeader(line)
		if calloutType == "" {
			result = append(result, line)
			i++
			continue
		}

		// Map the callout type
		mappedType, ok := calloutTypeMap[strings.ToLower(calloutType)]
		if !ok {
			mappedType = "tip"
		}

		// Collect the body lines (subsequent lines starting with >)
		var bodyLines []string
		if title != "" {
			bodyLines = append(bodyLines, title)
		}
		i++
		for i < len(lines) {
			l := lines[i]
			if strings.HasPrefix(l, "> ") {
				bodyLines = append(bodyLines, strings.TrimPrefix(l, "> "))
				i++
			} else if strings.TrimSpace(l) == ">" {
				bodyLines = append(bodyLines, "")
				i++
			} else {
				break
			}
		}

		// Emit HTML block (Pandoc will pass raw HTML through)
		result = append(result, "")
		result = append(result, "<div class=\"alert-block\" data-type=\""+mappedType+"\">")
		result = append(result, "")
		for _, bl := range bodyLines {
			result = append(result, bl)
		}
		result = append(result, "")
		result = append(result, "</div>")
		result = append(result, "")
	}

	return strings.Join(result, "\n")
}

// calloutHeaderRe matches lines like: > [!warning] Optional title
var calloutHeaderRe = regexp.MustCompile(`^>\s*\[!(\w+)\]\s*(.*)$`)

// parseCalloutHeader parses a callout header line.
// Returns (type, title) or ("", "") if not a callout.
func parseCalloutHeader(line string) (string, string) {
	m := calloutHeaderRe.FindStringSubmatch(line)
	if m == nil {
		return "", ""
	}
	return m[1], strings.TrimSpace(m[2])
}

// wikilinkWithAliasRe matches [[Target|display text]]
var wikilinkWithAliasRe = regexp.MustCompile(`\[\[([^\]|]+)\|([^\]]+)\]\]`)

// wikilinkAnchorRe matches [[#section]]
var wikilinkAnchorRe = regexp.MustCompile(`\[\[#([^\]]+)\]\]`)

// wikilinkSimpleRe matches [[Document]]
var wikilinkSimpleRe = regexp.MustCompile(`\[\[([^\]#|]+)\]\]`)

// convertWikilinks converts Obsidian wikilinks to standard Markdown links.
func convertWikilinks(md string) string {
	// Order matters: alias first, then anchor, then simple
	md = wikilinkWithAliasRe.ReplaceAllString(md, "[$2]()")
	md = wikilinkAnchorRe.ReplaceAllString(md, "[$1](#$1)")
	md = wikilinkSimpleRe.ReplaceAllString(md, "[$1]()")
	return md
}

// hruleRe matches lines that are exactly "---", "***", or "___" (thematic breaks).
// Pandoc can misinterpret "---" as a table separator after certain block elements.
// We normalise all horizontal rules to "***" which is unambiguous.
var hruleRe = regexp.MustCompile(`(?m)^---$`)

func disambiguateHRules(md string) string {
	return hruleRe.ReplaceAllString(md, "***")
}

// highlightRe matches ==highlighted text==
var highlightRe = regexp.MustCompile(`==((?:[^=]|=[^=])+)==`)

// convertHighlights replaces ==text== with <mark>text</mark>.
func convertHighlights(md string) string {
	return highlightRe.ReplaceAllString(md, "<mark>$1</mark>")
}
