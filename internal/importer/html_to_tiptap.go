package importer

import (
	"encoding/json"
	"strings"

	"golang.org/x/net/html"
)

// TipTapNode represents a node in TipTap's JSON document format.
type TipTapNode struct {
	Type    string            `json:"type"`
	Attrs   map[string]any    `json:"attrs,omitempty"`
	Content []TipTapNode      `json:"content,omitempty"`
	Marks   []TipTapMark      `json:"marks,omitempty"`
	Text    string            `json:"text,omitempty"`
}

// TipTapMark represents a mark (bold, italic, etc.) on a text node.
type TipTapMark struct {
	Type  string         `json:"type"`
	Attrs map[string]any `json:"attrs,omitempty"`
}

// HTMLToTipTap converts an HTML string into TipTap JSON format.
func HTMLToTipTap(htmlContent string) (json.RawMessage, error) {
	doc := TipTapNode{Type: "doc"}

	reader := strings.NewReader(htmlContent)
	root, err := html.Parse(reader)
	if err != nil {
		return nil, err
	}

	// Find <body> or use root
	body := findBody(root)
	if body == nil {
		body = root
	}

	doc.Content = processChildren(body, nil)

	// Ensure doc has at least one paragraph
	if len(doc.Content) == 0 {
		doc.Content = []TipTapNode{
			{Type: "paragraph"},
		}
	}

	return json.Marshal(doc)
}

func findBody(n *html.Node) *html.Node {
	if n.Type == html.ElementNode && n.Data == "body" {
		return n
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if found := findBody(c); found != nil {
			return found
		}
	}
	return nil
}

func processChildren(n *html.Node, marks []TipTapMark) []TipTapNode {
	var nodes []TipTapNode
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		nodes = append(nodes, processNode(c, marks)...)
	}
	return nodes
}

func processNode(n *html.Node, marks []TipTapMark) []TipTapNode {
	switch n.Type {
	case html.TextNode:
		text := n.Data
		if strings.TrimSpace(text) == "" {
			return nil
		}
		node := TipTapNode{Type: "text", Text: text}
		if len(marks) > 0 {
			node.Marks = make([]TipTapMark, len(marks))
			copy(node.Marks, marks)
		}
		return []TipTapNode{node}

	case html.ElementNode:
		return processElement(n, marks)
	}

	// For other node types, process children
	return processChildren(n, marks)
}

func processElement(n *html.Node, marks []TipTapMark) []TipTapNode {
	tag := strings.ToLower(n.Data)

	switch tag {
	case "h1", "h2", "h3", "h4", "h5", "h6":
		level := int(tag[1] - '0')
		node := TipTapNode{
			Type:    "heading",
			Attrs:   map[string]any{"level": level},
			Content: inlineChildren(n, nil),
		}
		return []TipTapNode{node}

	case "p":
		node := TipTapNode{
			Type:    "paragraph",
			Content: inlineChildren(n, nil),
		}
		return []TipTapNode{node}

	case "ul":
		node := TipTapNode{
			Type:    "bulletList",
			Content: listItems(n),
		}
		return []TipTapNode{node}

	case "ol":
		node := TipTapNode{
			Type:    "orderedList",
			Content: listItems(n),
		}
		return []TipTapNode{node}

	case "li":
		content := processListItemContent(n)
		node := TipTapNode{
			Type:    "listItem",
			Content: content,
		}
		return []TipTapNode{node}

	case "blockquote":
		node := TipTapNode{
			Type:    "blockquote",
			Content: processChildren(n, nil),
		}
		return []TipTapNode{node}

	case "pre":
		// Extract text content from <pre> (possibly containing <code>)
		text := extractText(n)
		node := TipTapNode{
			Type: "codeBlock",
			Content: []TipTapNode{
				{Type: "text", Text: text},
			},
		}
		return []TipTapNode{node}

	case "table":
		return []TipTapNode{processTable(n)}

	case "img":
		src := getAttr(n, "src")
		alt := getAttr(n, "alt")
		node := TipTapNode{
			Type:  "image",
			Attrs: map[string]any{"src": src, "alt": alt},
		}
		return []TipTapNode{node}

	case "br":
		return []TipTapNode{{Type: "hardBreak"}}

	case "hr":
		return []TipTapNode{{Type: "horizontalRule"}}

	// Inline marks
	case "strong", "b":
		newMarks := appendMark(marks, TipTapMark{Type: "bold"})
		return inlineChildren(n, newMarks)

	case "em", "i":
		newMarks := appendMark(marks, TipTapMark{Type: "italic"})
		return inlineChildren(n, newMarks)

	case "code":
		newMarks := appendMark(marks, TipTapMark{Type: "code"})
		return inlineChildren(n, newMarks)

	case "u":
		newMarks := appendMark(marks, TipTapMark{Type: "underline"})
		return inlineChildren(n, newMarks)

	case "s", "strike", "del":
		newMarks := appendMark(marks, TipTapMark{Type: "strike"})
		return inlineChildren(n, newMarks)

	case "a":
		href := getAttr(n, "href")
		newMarks := appendMark(marks, TipTapMark{
			Type:  "link",
			Attrs: map[string]any{"href": href},
		})
		return inlineChildren(n, newMarks)

	case "span", "div":
		// For div at block level, wrap inline content in paragraphs
		if tag == "div" {
			return processChildren(n, marks)
		}
		return inlineChildren(n, marks)

	default:
		// Unknown elements: process children
		return processChildren(n, marks)
	}
}

func inlineChildren(n *html.Node, marks []TipTapMark) []TipTapNode {
	var nodes []TipTapNode
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		switch c.Type {
		case html.TextNode:
			text := c.Data
			if text == "" {
				continue
			}
			node := TipTapNode{Type: "text", Text: text}
			if len(marks) > 0 {
				node.Marks = make([]TipTapMark, len(marks))
				copy(node.Marks, marks)
			}
			nodes = append(nodes, node)
		case html.ElementNode:
			nodes = append(nodes, processElement(c, marks)...)
		}
	}
	return nodes
}

func listItems(n *html.Node) []TipTapNode {
	var items []TipTapNode
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == html.ElementNode && strings.ToLower(c.Data) == "li" {
			items = append(items, processElement(c, nil)...)
		}
	}
	return items
}

func processListItemContent(n *html.Node) []TipTapNode {
	// Check if li contains block elements
	hasBlock := false
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == html.ElementNode {
			tag := strings.ToLower(c.Data)
			if tag == "p" || tag == "ul" || tag == "ol" || tag == "blockquote" || tag == "pre" {
				hasBlock = true
				break
			}
		}
	}

	if hasBlock {
		return processChildren(n, nil)
	}

	// Wrap inline content in a paragraph
	inline := inlineChildren(n, nil)
	if len(inline) == 0 {
		return []TipTapNode{{Type: "paragraph"}}
	}
	return []TipTapNode{{Type: "paragraph", Content: inline}}
}

func processTable(n *html.Node) TipTapNode {
	table := TipTapNode{Type: "table"}
	// Find tbody, thead, or direct tr children
	processTableRows(n, &table)
	return table
}

func processTableRows(n *html.Node, table *TipTapNode) {
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if c.Type != html.ElementNode {
			continue
		}
		tag := strings.ToLower(c.Data)
		switch tag {
		case "thead", "tbody", "tfoot":
			processTableRows(c, table)
		case "tr":
			row := TipTapNode{Type: "tableRow"}
			for td := c.FirstChild; td != nil; td = td.NextSibling {
				if td.Type != html.ElementNode {
					continue
				}
				cellTag := strings.ToLower(td.Data)
				if cellTag == "th" || cellTag == "td" {
					cellType := "tableCell"
					if cellTag == "th" {
						cellType = "tableHeader"
					}
					cell := TipTapNode{
						Type: cellType,
						Content: []TipTapNode{
							{Type: "paragraph", Content: inlineChildren(td, nil)},
						},
					}
					row.Content = append(row.Content, cell)
				}
			}
			table.Content = append(table.Content, row)
		}
	}
}

func extractText(n *html.Node) string {
	var sb strings.Builder
	extractTextRecursive(n, &sb)
	return sb.String()
}

func extractTextRecursive(n *html.Node, sb *strings.Builder) {
	if n.Type == html.TextNode {
		sb.WriteString(n.Data)
		return
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		extractTextRecursive(c, sb)
	}
}

func getAttr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}

func appendMark(marks []TipTapMark, m TipTapMark) []TipTapMark {
	newMarks := make([]TipTapMark, len(marks)+1)
	copy(newMarks, marks)
	newMarks[len(marks)] = m
	return newMarks
}
