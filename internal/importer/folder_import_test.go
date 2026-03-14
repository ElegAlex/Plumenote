package importer

import "testing"

func TestResolveImportPath_RootMode(t *testing.T) {
	tests := []struct {
		name       string
		filePath   string
		wantDomain string
		wantParts  []string
	}{
		{
			name:       "nested with domain and subfolder",
			filePath:   "CPAM/GOUV/file.md",
			wantDomain: "CPAM",
			wantParts:  []string{"GOUV"},
		},
		{
			name:       "file directly in domain folder",
			filePath:   "CPAM/file.md",
			wantDomain: "CPAM",
			wantParts:  nil,
		},
		{
			name:       "file at root level",
			filePath:   "file.md",
			wantDomain: "",
			wantParts:  nil,
		},
		{
			name:       "deeply nested",
			filePath:   "CPAM/A/B/C/file.md",
			wantDomain: "CPAM",
			wantParts:  []string{"A", "B", "C"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			domain, parts := resolveImportPath(tt.filePath, "root")
			if domain != tt.wantDomain {
				t.Errorf("domain = %q, want %q", domain, tt.wantDomain)
			}
			if len(parts) != len(tt.wantParts) {
				t.Errorf("parts = %v, want %v", parts, tt.wantParts)
				return
			}
			for i := range parts {
				if parts[i] != tt.wantParts[i] {
					t.Errorf("parts[%d] = %q, want %q", i, parts[i], tt.wantParts[i])
				}
			}
		})
	}
}

func TestResolveImportPath_DomainMode(t *testing.T) {
	tests := []struct {
		name      string
		filePath  string
		wantParts []string
	}{
		{
			name:      "single folder",
			filePath:  "folder/file.md",
			wantParts: []string{"folder"},
		},
		{
			name:      "file at root",
			filePath:  "file.md",
			wantParts: nil,
		},
		{
			name:      "nested folders",
			filePath:  "A/B/file.md",
			wantParts: []string{"A", "B"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			domain, parts := resolveImportPath(tt.filePath, "domain")
			if domain != "" {
				t.Errorf("domain = %q, want empty in domain mode", domain)
			}
			if len(parts) != len(tt.wantParts) {
				t.Errorf("parts = %v, want %v", parts, tt.wantParts)
				return
			}
			for i := range parts {
				if parts[i] != tt.wantParts[i] {
					t.Errorf("parts[%d] = %q, want %q", i, parts[i], tt.wantParts[i])
				}
			}
		})
	}
}
