package importer

import (
	"archive/zip"
	"os"
	"testing"
)

func TestBuildTreeFromPaths(t *testing.T) {
	files := []fileEntry{
		{Path: "CPAM/GOUV/proc.md", Size: 100},
		{Path: "CPAM/GOUV/guide.docx", Size: 200},
		{Path: "CPAM/tech.txt", Size: 50},
		{Path: "SCI/readme.md", Size: 30},
		{Path: "loose.txt", Size: 10},
	}
	tree := buildTreeFromPaths(files)

	if len(tree) != 3 {
		t.Fatalf("expected 3 root nodes, got %d", len(tree))
	}
	if tree[0].Name != "CPAM" || tree[0].Type != "dir" {
		t.Errorf("expected CPAM dir first, got %s %s", tree[0].Name, tree[0].Type)
	}
	if tree[1].Name != "SCI" || tree[1].Type != "dir" {
		t.Errorf("expected SCI dir second, got %s %s", tree[1].Name, tree[1].Type)
	}
	if tree[2].Name != "loose.txt" || tree[2].Type != "file" {
		t.Errorf("expected loose.txt file third, got %s %s", tree[2].Name, tree[2].Type)
	}
	cpam := tree[0]
	if len(cpam.Children) != 2 {
		t.Fatalf("CPAM: expected 2 children, got %d", len(cpam.Children))
	}
}

func TestAnalyzeZip(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "test-*.zip")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpFile.Name())

	w := zip.NewWriter(tmpFile)
	for _, name := range []string{"domain1/folder1/file.md", "domain1/root.txt", "domain2/doc.pdf", ".hidden/secret.md"} {
		fw, _ := w.Create(name)
		fw.Write([]byte("test content"))
	}
	w.Close()
	tmpFile.Close()

	tree, err := analyzeZip(tmpFile.Name(), maxZipSize)
	if err != nil {
		t.Fatal(err)
	}
	if len(tree) != 2 {
		t.Fatalf("expected 2 root nodes, got %d", len(tree))
	}
}
