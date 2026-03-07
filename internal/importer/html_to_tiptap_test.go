package importer

import (
	"encoding/json"
	"testing"
)

func TestHTMLToTipTap_Paragraph(t *testing.T) {
	input := "<p>Hello world</p>"
	result, err := HTMLToTipTap(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var doc TipTapNode
	if err := json.Unmarshal(result, &doc); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	if doc.Type != "doc" {
		t.Errorf("expected doc type, got %s", doc.Type)
	}
	if len(doc.Content) != 1 {
		t.Fatalf("expected 1 content node, got %d", len(doc.Content))
	}
	if doc.Content[0].Type != "paragraph" {
		t.Errorf("expected paragraph, got %s", doc.Content[0].Type)
	}
	if len(doc.Content[0].Content) != 1 || doc.Content[0].Content[0].Text != "Hello world" {
		t.Errorf("unexpected paragraph content: %+v", doc.Content[0].Content)
	}
}

func TestHTMLToTipTap_Headings(t *testing.T) {
	input := "<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>"
	result, err := HTMLToTipTap(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var doc TipTapNode
	json.Unmarshal(result, &doc)

	if len(doc.Content) != 3 {
		t.Fatalf("expected 3 nodes, got %d", len(doc.Content))
	}

	tests := []struct {
		index int
		level int
		text  string
	}{
		{0, 1, "Title"},
		{1, 2, "Subtitle"},
		{2, 3, "Section"},
	}

	for _, tt := range tests {
		node := doc.Content[tt.index]
		if node.Type != "heading" {
			t.Errorf("[%d] expected heading, got %s", tt.index, node.Type)
		}
		level, _ := node.Attrs["level"].(float64)
		if int(level) != tt.level {
			t.Errorf("[%d] expected level %d, got %v", tt.index, tt.level, node.Attrs["level"])
		}
		if len(node.Content) < 1 || node.Content[0].Text != tt.text {
			t.Errorf("[%d] expected text %q", tt.index, tt.text)
		}
	}
}

func TestHTMLToTipTap_BoldItalic(t *testing.T) {
	input := "<p><strong>bold</strong> and <em>italic</em></p>"
	result, err := HTMLToTipTap(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var doc TipTapNode
	json.Unmarshal(result, &doc)

	para := doc.Content[0]
	if para.Type != "paragraph" {
		t.Fatalf("expected paragraph, got %s", para.Type)
	}

	// Should have: bold text, " and ", italic text
	if len(para.Content) < 3 {
		t.Fatalf("expected at least 3 inline nodes, got %d", len(para.Content))
	}

	boldNode := para.Content[0]
	if boldNode.Text != "bold" || len(boldNode.Marks) != 1 || boldNode.Marks[0].Type != "bold" {
		t.Errorf("expected bold mark, got %+v", boldNode)
	}

	italicNode := para.Content[2]
	if italicNode.Text != "italic" || len(italicNode.Marks) != 1 || italicNode.Marks[0].Type != "italic" {
		t.Errorf("expected italic mark, got %+v", italicNode)
	}
}

func TestHTMLToTipTap_BulletList(t *testing.T) {
	input := "<ul><li>item 1</li><li>item 2</li></ul>"
	result, err := HTMLToTipTap(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var doc TipTapNode
	json.Unmarshal(result, &doc)

	if len(doc.Content) != 1 {
		t.Fatalf("expected 1 node, got %d", len(doc.Content))
	}

	list := doc.Content[0]
	if list.Type != "bulletList" {
		t.Errorf("expected bulletList, got %s", list.Type)
	}
	if len(list.Content) != 2 {
		t.Fatalf("expected 2 items, got %d", len(list.Content))
	}
	if list.Content[0].Type != "listItem" {
		t.Errorf("expected listItem, got %s", list.Content[0].Type)
	}
}

func TestHTMLToTipTap_OrderedList(t *testing.T) {
	input := "<ol><li>first</li><li>second</li></ol>"
	result, err := HTMLToTipTap(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var doc TipTapNode
	json.Unmarshal(result, &doc)

	list := doc.Content[0]
	if list.Type != "orderedList" {
		t.Errorf("expected orderedList, got %s", list.Type)
	}
}

func TestHTMLToTipTap_Link(t *testing.T) {
	input := `<p><a href="https://example.com">click here</a></p>`
	result, err := HTMLToTipTap(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var doc TipTapNode
	json.Unmarshal(result, &doc)

	linkNode := doc.Content[0].Content[0]
	if linkNode.Text != "click here" {
		t.Errorf("expected 'click here', got %q", linkNode.Text)
	}
	if len(linkNode.Marks) != 1 || linkNode.Marks[0].Type != "link" {
		t.Errorf("expected link mark, got %+v", linkNode.Marks)
	}
	href, _ := linkNode.Marks[0].Attrs["href"].(string)
	if href != "https://example.com" {
		t.Errorf("expected href, got %q", href)
	}
}

func TestHTMLToTipTap_Image(t *testing.T) {
	input := `<img src="photo.png" alt="A photo">`
	result, err := HTMLToTipTap(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var doc TipTapNode
	json.Unmarshal(result, &doc)

	img := doc.Content[0]
	if img.Type != "image" {
		t.Errorf("expected image, got %s", img.Type)
	}
	if img.Attrs["src"] != "photo.png" {
		t.Errorf("expected src=photo.png, got %v", img.Attrs["src"])
	}
}

func TestHTMLToTipTap_Table(t *testing.T) {
	input := `<table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>`
	result, err := HTMLToTipTap(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var doc TipTapNode
	json.Unmarshal(result, &doc)

	table := doc.Content[0]
	if table.Type != "table" {
		t.Errorf("expected table, got %s", table.Type)
	}
	if len(table.Content) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(table.Content))
	}
	if table.Content[0].Content[0].Type != "tableHeader" {
		t.Errorf("expected tableHeader, got %s", table.Content[0].Content[0].Type)
	}
	if table.Content[1].Content[0].Type != "tableCell" {
		t.Errorf("expected tableCell, got %s", table.Content[1].Content[0].Type)
	}
}

func TestHTMLToTipTap_CodeBlock(t *testing.T) {
	input := `<pre><code>fmt.Println("hello")</code></pre>`
	result, err := HTMLToTipTap(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var doc TipTapNode
	json.Unmarshal(result, &doc)

	if doc.Content[0].Type != "codeBlock" {
		t.Errorf("expected codeBlock, got %s", doc.Content[0].Type)
	}
}

func TestHTMLToTipTap_EmptyInput(t *testing.T) {
	result, err := HTMLToTipTap("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var doc TipTapNode
	json.Unmarshal(result, &doc)

	if doc.Type != "doc" {
		t.Errorf("expected doc, got %s", doc.Type)
	}
	if len(doc.Content) == 0 {
		t.Error("expected at least one paragraph")
	}
}

func TestHTMLToTipTap_NestedMarks(t *testing.T) {
	input := `<p><strong><em>bold italic</em></strong></p>`
	result, err := HTMLToTipTap(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var doc TipTapNode
	json.Unmarshal(result, &doc)

	node := doc.Content[0].Content[0]
	if node.Text != "bold italic" {
		t.Errorf("expected 'bold italic', got %q", node.Text)
	}
	if len(node.Marks) != 2 {
		t.Fatalf("expected 2 marks, got %d", len(node.Marks))
	}
}
