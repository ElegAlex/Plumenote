package importer

import (
	"testing"
)

func TestParseFrontmatter_Basic(t *testing.T) {
	input := `---
title: Mon document
date: 2026-01-15
tags:
  - tag1
  - tag2
type: compte_rendu
---
# Content starts here

Some text.`

	fm, content := ParseFrontmatter(input)

	if fm.Title != "Mon document" {
		t.Errorf("expected title 'Mon document', got %q", fm.Title)
	}
	if fm.Date != "2026-01-15" {
		t.Errorf("expected date '2026-01-15', got %q", fm.Date)
	}
	if len(fm.Tags) != 2 || fm.Tags[0] != "tag1" || fm.Tags[1] != "tag2" {
		t.Errorf("expected tags [tag1, tag2], got %v", fm.Tags)
	}
	if fm.Type != "compte_rendu" {
		t.Errorf("expected type 'compte_rendu', got %q", fm.Type)
	}

	if content != "# Content starts here\n\nSome text." {
		t.Errorf("unexpected remaining content: %q", content)
	}
}

func TestParseFrontmatter_NoFrontmatter(t *testing.T) {
	input := "# Just a heading\n\nSome content."
	fm, content := ParseFrontmatter(input)

	if fm.Title != "" {
		t.Errorf("expected empty title, got %q", fm.Title)
	}
	if content != input {
		t.Errorf("content should be unchanged")
	}
}

func TestParseFrontmatter_EmptyFrontmatter(t *testing.T) {
	input := "---\n---\nContent after."
	fm, content := ParseFrontmatter(input)

	if fm.Title != "" {
		t.Errorf("expected empty title, got %q", fm.Title)
	}
	if content != "Content after." {
		t.Errorf("unexpected content: %q", content)
	}
}

func TestParseFrontmatter_TitleOnly(t *testing.T) {
	input := "---\ntitle: My Title\n---\nBody"
	fm, content := ParseFrontmatter(input)

	if fm.Title != "My Title" {
		t.Errorf("expected 'My Title', got %q", fm.Title)
	}
	if content != "Body" {
		t.Errorf("unexpected content: %q", content)
	}
}

func TestParseFrontmatter_InvalidYAML(t *testing.T) {
	input := "---\n: invalid yaml [[\n---\nContent"
	fm, content := ParseFrontmatter(input)

	// Should return empty frontmatter and original content on invalid YAML
	if fm.Title != "" {
		t.Errorf("expected empty title for invalid YAML, got %q", fm.Title)
	}
	if content != input {
		t.Errorf("content should be original on invalid YAML")
	}
}

func TestParseFrontmatter_WithLeadingWhitespace(t *testing.T) {
	input := "\n\n---\ntitle: After whitespace\n---\nContent"
	fm, content := ParseFrontmatter(input)

	if fm.Title != "After whitespace" {
		t.Errorf("expected 'After whitespace', got %q", fm.Title)
	}
	if content != "Content" {
		t.Errorf("unexpected content: %q", content)
	}
}

func TestParseFrontmatter_TagsInline(t *testing.T) {
	input := "---\ntags: [alpha, beta, gamma]\n---\nBody"
	fm, content := ParseFrontmatter(input)

	if len(fm.Tags) != 3 {
		t.Fatalf("expected 3 tags, got %d: %v", len(fm.Tags), fm.Tags)
	}
	if fm.Tags[0] != "alpha" || fm.Tags[1] != "beta" || fm.Tags[2] != "gamma" {
		t.Errorf("unexpected tags: %v", fm.Tags)
	}
	if content != "Body" {
		t.Errorf("unexpected content: %q", content)
	}
}
