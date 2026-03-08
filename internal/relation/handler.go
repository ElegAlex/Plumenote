package relation

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type handler struct {
	deps *model.Deps
}

// NewHandler creates an exported handler for use in server.go aliases.
func NewHandler(deps *model.Deps) *handler {
	return &handler{deps: deps}
}

func readJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

// --- Relations ---

func (h *handler) createRelation(w http.ResponseWriter, r *http.Request) {
	c := auth.UserFromContext(r.Context())
	if c == nil {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}

	var req struct {
		SourceID       string `json:"source_id"`
		TargetID       string `json:"target_id"`
		RelationTypeID string `json:"relation_type_id"`
	}
	if err := readJSON(r, &req); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.SourceID == "" || req.TargetID == "" || req.RelationTypeID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "source_id, target_id and relation_type_id are required"})
		return
	}

	// Verify both entities exist
	var sourceExists, targetExists bool
	_ = h.deps.DB.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM entities WHERE id = $1)", req.SourceID).Scan(&sourceExists)
	_ = h.deps.DB.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM entities WHERE id = $1)", req.TargetID).Scan(&targetExists)
	if !sourceExists || !targetExists {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "source or target entity not found"})
		return
	}

	var rel struct {
		ID        string    `json:"id"`
		SourceID  string    `json:"source_id"`
		TargetID  string    `json:"target_id"`
		CreatedAt time.Time `json:"created_at"`
	}
	err := h.deps.DB.QueryRow(r.Context(),
		`INSERT INTO entity_relations (source_id, target_id, relation_type_id)
		 VALUES ($1, $2, $3)
		 RETURNING id, source_id, target_id, created_at`,
		req.SourceID, req.TargetID, req.RelationTypeID,
	).Scan(&rel.ID, &rel.SourceID, &rel.TargetID, &rel.CreatedAt)
	if err != nil {
		httputil.WriteJSON(w, http.StatusConflict, map[string]string{"error": "relation already exists or invalid type"})
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, rel)
}

func (h *handler) deleteRelation(w http.ResponseWriter, r *http.Request) {
	c := auth.UserFromContext(r.Context())
	if c == nil {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}

	id := chi.URLParam(r, "id")
	tag, err := h.deps.DB.Exec(r.Context(), "DELETE FROM entity_relations WHERE id = $1", id)
	if err != nil || tag.RowsAffected() == 0 {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "relation not found"})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// --- Relation Types ---

// ListRelationTypes handles GET /types (exported for server.go alias).
func (h *handler) ListRelationTypes(w http.ResponseWriter, r *http.Request) {
	rows, err := h.deps.DB.Query(r.Context(),
		`SELECT id, name, slug, inverse_name, inverse_slug, created_at
		 FROM relation_types ORDER BY name`)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list relation types"})
		return
	}
	defer rows.Close()

	type rtResp struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Slug        string `json:"slug"`
		InverseName string `json:"inverse_name"`
		InverseSlug string `json:"inverse_slug"`
		CreatedAt   string `json:"created_at"`
	}

	result := []rtResp{}
	for rows.Next() {
		var rt rtResp
		var createdAt time.Time
		if err := rows.Scan(&rt.ID, &rt.Name, &rt.Slug, &rt.InverseName, &rt.InverseSlug, &createdAt); err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan relation type"})
			return
		}
		rt.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, rt)
	}

	httputil.WriteJSON(w, http.StatusOK, result)
}

// getRelationType handles GET /types/{id}
func (h *handler) getRelationType(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	type rtResp struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Slug        string `json:"slug"`
		InverseName string `json:"inverse_name"`
		InverseSlug string `json:"inverse_slug"`
		CreatedAt   string `json:"created_at"`
	}

	var rt rtResp
	var createdAt time.Time
	err := h.deps.DB.QueryRow(r.Context(),
		`SELECT id, name, slug, inverse_name, inverse_slug, created_at
		 FROM relation_types WHERE id = $1`, id,
	).Scan(&rt.ID, &rt.Name, &rt.Slug, &rt.InverseName, &rt.InverseSlug, &createdAt)
	if err == pgx.ErrNoRows {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "relation type not found"})
		return
	}
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get relation type"})
		return
	}
	rt.CreatedAt = createdAt.Format(time.RFC3339)

	httputil.WriteJSON(w, http.StatusOK, rt)
}
