package importer

import (
	"archive/zip"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
)

const (
	maxZipSize  = 200 << 20 // 200 MB
	maxZipFiles = 1000
	maxZipRatio = 10
)

type TreeNode struct {
	Name     string      `json:"name"`
	Path     string      `json:"path"`
	Type     string      `json:"type"` // "file" or "dir"
	Size     int64       `json:"size,omitempty"`
	Children []*TreeNode `json:"children,omitempty"`
}

type fileEntry struct {
	Path string
	Size int64
}

func analyzeZip(zipPath string, maxSize int64) ([]*TreeNode, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	var entries []fileEntry
	var totalUncompressed uint64
	for _, f := range r.File {
		if f.FileInfo().IsDir() || isHidden(f.Name) {
			continue
		}
		ext := strings.ToLower(filepath.Ext(f.Name))
		if !isSupportedExtension(ext) {
			continue
		}
		entries = append(entries, fileEntry{
			Path: strings.TrimPrefix(f.Name, "/"),
			Size: int64(f.UncompressedSize64),
		})
		totalUncompressed += f.UncompressedSize64
	}
	if len(entries) > maxZipFiles {
		return nil, fmt.Errorf("too many files (%d, max %d)", len(entries), maxZipFiles)
	}
	if maxSize > 0 && totalUncompressed > uint64(maxSize)*uint64(maxZipRatio) {
		return nil, fmt.Errorf("uncompressed size exceeds safety limit")
	}
	return buildTreeFromPaths(entries), nil
}

func isHidden(path string) bool {
	for _, part := range strings.Split(path, "/") {
		if strings.HasPrefix(part, ".") {
			return true
		}
	}
	return false
}

func buildTreeFromPaths(files []fileEntry) []*TreeNode {
	rootMap := &TreeNode{Type: "dir", Children: []*TreeNode{}}
	for _, f := range files {
		parts := strings.Split(f.Path, "/")
		current := rootMap
		for i, part := range parts {
			if part == "" {
				continue
			}
			fullPath := strings.Join(parts[:i+1], "/")
			if i == len(parts)-1 {
				current.Children = append(current.Children, &TreeNode{
					Name: part, Path: fullPath, Type: "file", Size: f.Size,
				})
			} else {
				found := false
				for _, child := range current.Children {
					if child.Type == "dir" && child.Name == part {
						current = child
						found = true
						break
					}
				}
				if !found {
					dir := &TreeNode{Name: part, Path: fullPath, Type: "dir", Children: []*TreeNode{}}
					current.Children = append(current.Children, dir)
					current = dir
				}
			}
		}
	}
	sortTree(rootMap.Children)
	return rootMap.Children
}

func sortTree(nodes []*TreeNode) {
	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].Type != nodes[j].Type {
			return nodes[i].Type == "dir"
		}
		return nodes[i].Name < nodes[j].Name
	})
	for _, n := range nodes {
		if n.Children != nil {
			sortTree(n.Children)
		}
	}
}
