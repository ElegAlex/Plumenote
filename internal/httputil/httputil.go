package httputil

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

var (
	slugRegexp   = regexp.MustCompile(`[^a-z0-9-]+`)
	dashCollapse = regexp.MustCompile(`-{2,}`)
)

func GenerateSlug(title string) string {
	s := strings.ToLower(strings.TrimSpace(title))
	s = removeAccents(s)
	s = strings.ReplaceAll(s, " ", "-")
	s = slugRegexp.ReplaceAllString(s, "-")
	s = dashCollapse.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if len(s) > 100 {
		s = s[:100]
		s = strings.TrimRight(s, "-")
	}
	if s == "" {
		s = "untitled"
	}
	return s
}

func removeAccents(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range norm.NFD.String(s) {
		if unicode.Is(unicode.Mn, r) {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}
