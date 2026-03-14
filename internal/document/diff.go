package document

import (
	"strings"

	difflib "github.com/sergi/go-diff/diffmatchpatch"
)

// DiffLineType represents the type of a diff line.
type DiffLineType string

const (
	DiffEqual  DiffLineType = "equal"
	DiffInsert DiffLineType = "insert"
	DiffDelete DiffLineType = "delete"
)

// DiffLine is a single line in a text diff result.
type DiffLine struct {
	Type DiffLineType `json:"type"`
	Text string       `json:"text"`
}

// ComputeTextDiff computes a line-by-line diff between two texts.
func ComputeTextDiff(oldText, newText string) []DiffLine {
	dmp := difflib.New()
	diffs := dmp.DiffMain(oldText, newText, true)
	diffs = dmp.DiffCleanupSemantic(diffs)

	var lines []DiffLine
	for _, d := range diffs {
		parts := strings.Split(d.Text, "\n")
		for i, part := range parts {
			if part == "" && i == len(parts)-1 {
				continue // skip trailing empty from split
			}
			switch d.Type {
			case difflib.DiffEqual:
				lines = append(lines, DiffLine{Type: DiffEqual, Text: part})
			case difflib.DiffInsert:
				lines = append(lines, DiffLine{Type: DiffInsert, Text: part})
			case difflib.DiffDelete:
				lines = append(lines, DiffLine{Type: DiffDelete, Text: part})
			}
		}
	}
	return lines
}
