package analytics

import (
	"encoding/json"
	"net/http"

	"github.com/alexmusic/plumenote/internal/model"
)

type searchLogRequest struct {
	Query              string  `json:"query"`
	ResultCount        int     `json:"result_count"`
	ClickedDocumentID  *string `json:"clicked_document_id,omitempty"`
}

type viewLogRequest struct {
	DocumentID      string `json:"document_id"`
	DurationSeconds int    `json:"duration_seconds"`
}

type viewCountRequest struct {
	DocumentID string `json:"document_id"`
}

func handleSearchLog(deps *model.Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req searchLogRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if req.Query == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "query is required"})
			return
		}

		userID := userIDFromCtx(r.Context())

		_, err := deps.DB.Exec(r.Context(),
			`INSERT INTO search_log (query, result_count, clicked_document_id, user_id) VALUES ($1, $2, $3, $4)`,
			req.Query, req.ResultCount, req.ClickedDocumentID, userID,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to log search"})
			return
		}

		writeJSON(w, http.StatusCreated, map[string]string{"status": "ok"})
	}
}

func handleViewLog(deps *model.Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req viewLogRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if req.DocumentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "document_id is required"})
			return
		}

		userID := userIDFromCtx(r.Context())

		_, err := deps.DB.Exec(r.Context(),
			`INSERT INTO view_log (document_id, user_id, duration_seconds) VALUES ($1, $2, $3)`,
			req.DocumentID, userID, req.DurationSeconds,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to log view"})
			return
		}

		writeJSON(w, http.StatusCreated, map[string]string{"status": "ok"})
	}
}

func handleViewCount(deps *model.Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req viewCountRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if req.DocumentID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "document_id is required"})
			return
		}

		_, err := deps.DB.Exec(r.Context(),
			`UPDATE documents SET view_count = view_count + 1 WHERE id = $1`,
			req.DocumentID,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to increment view count"})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
