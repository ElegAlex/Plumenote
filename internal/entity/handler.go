package entity

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/document"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/meilisearch/meilisearch-go"
)

const meiliIndex = "documents"

type handler struct {
	deps *model.Deps
}

// NewHandler creates an exported handler for use in server.go aliases.
func NewHandler(deps *model.Deps) *handler {
	return &handler{deps: deps}
}

// --- JSON helpers ---

func readJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func getUserID(ctx context.Context) string {
	c := auth.UserFromContext(ctx)
	if c == nil {
		return ""
	}
	return c.UserID
}

func getUserRole(ctx context.Context) string {
	c := auth.UserFromContext(ctx)
	if c == nil {
		return ""
	}
	return c.Role
}

func getUserDomainID(ctx context.Context) string {
	c := auth.UserFromContext(ctx)
	if c == nil {
		return ""
	}
	return c.DomainID
}

// --- Entity Types ---

// ListEntityTypes handles GET /types (exported for server.go alias).
func (h *handler) ListEntityTypes(w http.ResponseWriter, r *http.Request) {
	rows, err := h.deps.DB.Query(r.Context(),
		`SELECT et.id, et.name, et.slug, et.icon, et.schema,
		        COALESCE((SELECT count(*) FROM entities WHERE entity_type_id = et.id), 0) AS entity_count,
		        et.created_at
		 FROM entity_types et ORDER BY et.name`)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list entity types"})
		return
	}
	defer rows.Close()

	type entityTypeResp struct {
		ID          string          `json:"id"`
		Name        string          `json:"name"`
		Slug        string          `json:"slug"`
		Icon        string          `json:"icon"`
		Schema      json.RawMessage `json:"schema"`
		EntityCount int             `json:"entity_count"`
		CreatedAt   string          `json:"created_at"`
	}

	result := []entityTypeResp{}
	for rows.Next() {
		var et entityTypeResp
		var createdAt time.Time
		if err := rows.Scan(&et.ID, &et.Name, &et.Slug, &et.Icon, &et.Schema, &et.EntityCount, &createdAt); err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan entity type"})
			return
		}
		et.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, et)
	}

	httputil.WriteJSON(w, http.StatusOK, result)
}

// GetEntityType handles GET /types/{id} (exported for server.go alias).
func (h *handler) GetEntityType(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	type entityTypeResp struct {
		ID          string          `json:"id"`
		Name        string          `json:"name"`
		Slug        string          `json:"slug"`
		Icon        string          `json:"icon"`
		Schema      json.RawMessage `json:"schema"`
		EntityCount int             `json:"entity_count"`
		CreatedAt   string          `json:"created_at"`
	}

	var et entityTypeResp
	var createdAt time.Time
	err := h.deps.DB.QueryRow(r.Context(),
		`SELECT et.id, et.name, et.slug, et.icon, et.schema,
		        COALESCE((SELECT count(*) FROM entities WHERE entity_type_id = et.id), 0) AS entity_count,
		        et.created_at
		 FROM entity_types et WHERE et.id = $1`, id,
	).Scan(&et.ID, &et.Name, &et.Slug, &et.Icon, &et.Schema, &et.EntityCount, &createdAt)
	if err == pgx.ErrNoRows {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "entity type not found"})
		return
	}
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get entity type"})
		return
	}
	et.CreatedAt = createdAt.Format(time.RFC3339)

	httputil.WriteJSON(w, http.StatusOK, et)
}

// --- Entities CRUD ---

func (h *handler) listEntities(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	domainID := q.Get("domain_id")
	typeID := q.Get("type_id")
	search := q.Get("q")
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	args := []any{limit, offset}
	paramIdx := 3
	var conditions []string

	if domainID != "" {
		conditions = append(conditions, fmt.Sprintf("AND e.domain_id = $%d", paramIdx))
		args = append(args, domainID)
		paramIdx++
	}
	if typeID != "" {
		conditions = append(conditions, fmt.Sprintf("AND e.entity_type_id = $%d", paramIdx))
		args = append(args, typeID)
		paramIdx++
	}
	if search != "" {
		conditions = append(conditions, fmt.Sprintf("AND e.name ILIKE '%%' || $%d || '%%'", paramIdx))
		args = append(args, search)
		paramIdx++
	}

	where := strings.Join(conditions, " ")
	query := fmt.Sprintf(`
		SELECT e.id, e.name, e.entity_type_id, et.name, et.slug, et.icon,
		       e.domain_id, dom.name, dom.color,
		       e.properties, e.author_id, u.display_name,
		       e.created_at, e.updated_at
		FROM entities e
		JOIN entity_types et ON et.id = e.entity_type_id
		JOIN domains dom ON dom.id = e.domain_id
		JOIN users u ON u.id = e.author_id
		WHERE 1=1 %s
		ORDER BY e.updated_at DESC
		LIMIT $1 OFFSET $2`, where)

	rows, err := h.deps.DB.Query(r.Context(), query, args...)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list entities"})
		return
	}
	defer rows.Close()

	type entitySummary struct {
		ID             string          `json:"id"`
		Name           string          `json:"name"`
		EntityTypeID   string          `json:"entity_type_id"`
		EntityTypeName string          `json:"entity_type_name"`
		EntityTypeSlug string          `json:"entity_type_slug"`
		EntityTypeIcon string          `json:"entity_type_icon"`
		DomainID       string          `json:"domain_id"`
		DomainName     string          `json:"domain_name"`
		DomainColor    string          `json:"domain_color"`
		Properties     json.RawMessage `json:"properties"`
		AuthorID       string          `json:"author_id"`
		AuthorName     string          `json:"author_name"`
		CreatedAt      string          `json:"created_at"`
		UpdatedAt      string          `json:"updated_at"`
	}

	result := []entitySummary{}
	for rows.Next() {
		var e entitySummary
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&e.ID, &e.Name, &e.EntityTypeID, &e.EntityTypeName, &e.EntityTypeSlug, &e.EntityTypeIcon,
			&e.DomainID, &e.DomainName, &e.DomainColor,
			&e.Properties, &e.AuthorID, &e.AuthorName,
			&createdAt, &updatedAt); err != nil {
			httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan entity"})
			return
		}
		e.CreatedAt = createdAt.Format(time.RFC3339)
		e.UpdatedAt = updatedAt.Format(time.RFC3339)
		result = append(result, e)
	}

	httputil.WriteJSON(w, http.StatusOK, result)
}

func (h *handler) getEntity(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Main entity
	type entityDetail struct {
		ID           string          `json:"id"`
		Name         string          `json:"name"`
		Properties   json.RawMessage `json:"properties"`
		Notes        json.RawMessage `json:"notes"`
		NotesText    string          `json:"notes_text"`
		AuthorID     string          `json:"author_id"`
		AuthorName   string          `json:"author_name"`
		CreatedAt    string          `json:"created_at"`
		UpdatedAt    string          `json:"updated_at"`
		EntityType   entityTypeInfo  `json:"entity_type"`
		Domain       domainInfo      `json:"domain"`
		RelationsOut []relationOut   `json:"relations_outgoing"`
		RelationsIn  []relationIn    `json:"relations_incoming"`
		LinkedDocs   []linkedDoc     `json:"linked_documents"`
		LinkedBMs    []linkedBM      `json:"linked_bookmarks"`
	}

	var e entityDetail
	var createdAt, updatedAt time.Time
	err := h.deps.DB.QueryRow(r.Context(),
		`SELECT e.id, e.name, e.properties, e.notes, e.notes_text,
		        e.author_id, u.display_name,
		        e.created_at, e.updated_at,
		        et.id, et.name, et.slug, et.icon, et.schema,
		        dom.id, dom.name, dom.color
		 FROM entities e
		 JOIN entity_types et ON et.id = e.entity_type_id
		 JOIN domains dom ON dom.id = e.domain_id
		 JOIN users u ON u.id = e.author_id
		 WHERE e.id = $1`, id,
	).Scan(&e.ID, &e.Name, &e.Properties, &e.Notes, &e.NotesText,
		&e.AuthorID, &e.AuthorName,
		&createdAt, &updatedAt,
		&e.EntityType.ID, &e.EntityType.Name, &e.EntityType.Slug, &e.EntityType.Icon, &e.EntityType.Schema,
		&e.Domain.ID, &e.Domain.Name, &e.Domain.Color)
	if err == pgx.ErrNoRows {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "entity not found"})
		return
	}
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get entity"})
		return
	}
	e.CreatedAt = createdAt.Format(time.RFC3339)
	e.UpdatedAt = updatedAt.Format(time.RFC3339)

	// Relations outgoing
	e.RelationsOut = []relationOut{}
	rowsOut, err := h.deps.DB.Query(r.Context(),
		`SELECT er.id, rt.name, rt.slug,
		        te.id, te.name, et.name, et.icon
		 FROM entity_relations er
		 JOIN relation_types rt ON rt.id = er.relation_type_id
		 JOIN entities te ON te.id = er.target_id
		 JOIN entity_types et ON et.id = te.entity_type_id
		 WHERE er.source_id = $1`, id)
	if err == nil {
		defer rowsOut.Close()
		for rowsOut.Next() {
			var ro relationOut
			if err := rowsOut.Scan(&ro.ID, &ro.RelationType.Name, &ro.RelationType.Slug,
				&ro.Target.ID, &ro.Target.Name, &ro.Target.TypeName, &ro.Target.TypeIcon); err != nil {
				continue
			}
			e.RelationsOut = append(e.RelationsOut, ro)
		}
	}

	// Relations incoming (use inverse_name/inverse_slug)
	e.RelationsIn = []relationIn{}
	rowsIn, err := h.deps.DB.Query(r.Context(),
		`SELECT er.id, rt.inverse_name, rt.inverse_slug,
		        se.id, se.name, et.name, et.icon
		 FROM entity_relations er
		 JOIN relation_types rt ON rt.id = er.relation_type_id
		 JOIN entities se ON se.id = er.source_id
		 JOIN entity_types et ON et.id = se.entity_type_id
		 WHERE er.target_id = $1`, id)
	if err == nil {
		defer rowsIn.Close()
		for rowsIn.Next() {
			var ri relationIn
			if err := rowsIn.Scan(&ri.ID, &ri.RelationType.Name, &ri.RelationType.Slug,
				&ri.Source.ID, &ri.Source.Name, &ri.Source.TypeName, &ri.Source.TypeIcon); err != nil {
				continue
			}
			e.RelationsIn = append(e.RelationsIn, ri)
		}
	}

	// Linked documents
	e.LinkedDocs = []linkedDoc{}
	rowsDocs, err := h.deps.DB.Query(r.Context(),
		`SELECT d.id, d.title, d.slug, d.created_at, d.updated_at, d.last_verified_at
		 FROM entity_documents ed
		 JOIN documents d ON d.id = ed.document_id
		 WHERE ed.entity_id = $1
		 ORDER BY d.title`, id)
	if err == nil {
		defer rowsDocs.Close()
		greenDays, yellowDays := h.freshnessThresholds(r.Context())
		for rowsDocs.Next() {
			var ld linkedDoc
			var createdAt, updatedAt time.Time
			var lastVerified *time.Time
			if err := rowsDocs.Scan(&ld.ID, &ld.Title, &ld.Slug, &createdAt, &updatedAt, &lastVerified); err != nil {
				continue
			}
			ld.FreshnessBadge = document.ComputeFreshness(createdAt, updatedAt, lastVerified, greenDays, yellowDays)
			e.LinkedDocs = append(e.LinkedDocs, ld)
		}
	}

	// Linked bookmarks
	e.LinkedBMs = []linkedBM{}
	rowsBMs, err := h.deps.DB.Query(r.Context(),
		`SELECT b.id, b.title, b.url
		 FROM entity_bookmarks eb
		 JOIN bookmarks b ON b.id = eb.bookmark_id
		 WHERE eb.entity_id = $1
		 ORDER BY b.title`, id)
	if err == nil {
		defer rowsBMs.Close()
		for rowsBMs.Next() {
			var lb linkedBM
			if err := rowsBMs.Scan(&lb.ID, &lb.Title, &lb.URL); err != nil {
				continue
			}
			e.LinkedBMs = append(e.LinkedBMs, lb)
		}
	}

	httputil.WriteJSON(w, http.StatusOK, e)
}

type entityTypeInfo struct {
	ID     string          `json:"id"`
	Name   string          `json:"name"`
	Slug   string          `json:"slug"`
	Icon   string          `json:"icon"`
	Schema json.RawMessage `json:"schema"`
}

type domainInfo struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type relationOut struct {
	ID           string `json:"id"`
	RelationType struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	} `json:"relation_type"`
	Target struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		TypeName string `json:"type_name"`
		TypeIcon string `json:"type_icon"`
	} `json:"target"`
}

type relationIn struct {
	ID           string `json:"id"`
	RelationType struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	} `json:"relation_type"`
	Source struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		TypeName string `json:"type_name"`
		TypeIcon string `json:"type_icon"`
	} `json:"source"`
}

type linkedDoc struct {
	ID             string `json:"id"`
	Title          string `json:"title"`
	Slug           string `json:"slug"`
	FreshnessBadge string `json:"freshness_badge"`
}

type linkedBM struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	URL   string `json:"url"`
}

func (h *handler) createEntity(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name         string          `json:"name"`
		EntityTypeID string          `json:"entity_type_id"`
		DomainID     string          `json:"domain_id"`
		Properties   json.RawMessage `json:"properties"`
		Notes        json.RawMessage `json:"notes"`
	}
	if err := readJSON(r, &req); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.Name == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}
	if req.EntityTypeID == "" || req.DomainID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "entity_type_id and domain_id are required"})
		return
	}

	authorID := getUserID(r.Context())
	if authorID == "" {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}

	// Validate properties against schema
	var schema json.RawMessage
	err := h.deps.DB.QueryRow(r.Context(),
		"SELECT schema FROM entity_types WHERE id = $1", req.EntityTypeID).Scan(&schema)
	if err == pgx.ErrNoRows {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "entity type not found"})
		return
	}
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get entity type"})
		return
	}

	if errMsg := validateProperties(req.Properties, schema); errMsg != "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": errMsg})
		return
	}

	if req.Properties == nil {
		req.Properties = json.RawMessage(`{}`)
	}

	notesText := document.ExtractBodyText(req.Notes)

	var entity struct {
		ID        string    `json:"id"`
		Name      string    `json:"name"`
		CreatedAt time.Time `json:"created_at"`
		UpdatedAt time.Time `json:"updated_at"`
	}
	err = h.deps.DB.QueryRow(r.Context(),
		`INSERT INTO entities (name, entity_type_id, domain_id, properties, notes, notes_text, author_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, name, created_at, updated_at`,
		req.Name, req.EntityTypeID, req.DomainID, req.Properties, req.Notes, notesText, authorID,
	).Scan(&entity.ID, &entity.Name, &entity.CreatedAt, &entity.UpdatedAt)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create entity"})
		return
	}

	// Async Meilisearch indexing
	go h.indexEntity(entity.ID)

	httputil.WriteJSON(w, http.StatusCreated, entity)
}

func (h *handler) updateEntity(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())
	userDomainID := getUserDomainID(r.Context())

	if userID == "" {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}

	// Permission check: author OR same domain OR admin (RG-003)
	var authorID, entityDomainID string
	err := h.deps.DB.QueryRow(r.Context(),
		"SELECT author_id, domain_id FROM entities WHERE id = $1", id,
	).Scan(&authorID, &entityDomainID)
	if err == pgx.ErrNoRows {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "entity not found"})
		return
	}
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get entity"})
		return
	}

	if userRole != "admin" && authorID != userID && entityDomainID != userDomainID {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "you can only edit entities in your domain"})
		return
	}

	var req struct {
		Name         string          `json:"name"`
		EntityTypeID string          `json:"entity_type_id"`
		DomainID     string          `json:"domain_id"`
		Properties   json.RawMessage `json:"properties"`
		Notes        json.RawMessage `json:"notes"`
	}
	if err := readJSON(r, &req); err != nil {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.Name == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	// Validate properties against schema if entity_type_id provided
	typeID := req.EntityTypeID
	if typeID == "" {
		// Keep existing type
		_ = h.deps.DB.QueryRow(r.Context(), "SELECT entity_type_id FROM entities WHERE id = $1", id).Scan(&typeID)
	}
	var schema json.RawMessage
	if err := h.deps.DB.QueryRow(r.Context(), "SELECT schema FROM entity_types WHERE id = $1", typeID).Scan(&schema); err == nil {
		if errMsg := validateProperties(req.Properties, schema); errMsg != "" {
			httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": errMsg})
			return
		}
	}

	if req.Properties == nil {
		req.Properties = json.RawMessage(`{}`)
	}

	notesText := document.ExtractBodyText(req.Notes)

	domainID := req.DomainID
	if domainID == "" {
		domainID = entityDomainID
	}

	var entity struct {
		ID        string    `json:"id"`
		Name      string    `json:"name"`
		UpdatedAt time.Time `json:"updated_at"`
	}
	err = h.deps.DB.QueryRow(r.Context(),
		`UPDATE entities
		 SET name = $2, entity_type_id = $3, domain_id = $4, properties = $5, notes = $6, notes_text = $7, updated_at = now()
		 WHERE id = $1
		 RETURNING id, name, updated_at`,
		id, req.Name, typeID, domainID, req.Properties, req.Notes, notesText,
	).Scan(&entity.ID, &entity.Name, &entity.UpdatedAt)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update entity"})
		return
	}

	go h.indexEntity(id)

	httputil.WriteJSON(w, http.StatusOK, entity)
}

func (h *handler) deleteEntity(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := getUserID(r.Context())
	userRole := getUserRole(r.Context())

	if userID == "" {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}

	// Permission: author OR admin
	var authorID string
	err := h.deps.DB.QueryRow(r.Context(),
		"SELECT author_id FROM entities WHERE id = $1", id,
	).Scan(&authorID)
	if err == pgx.ErrNoRows {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "entity not found"})
		return
	}
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get entity"})
		return
	}

	if userRole != "admin" && authorID != userID {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "only author or admin can delete entities"})
		return
	}

	_, err = h.deps.DB.Exec(r.Context(), "DELETE FROM entities WHERE id = $1", id)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete entity"})
		return
	}

	// De-index from Meilisearch
	go func() {
		if h.deps.Meili != nil {
			idx := h.deps.Meili.Index(meiliIndex)
			_, _ = idx.DeleteDocument(id, nil)
		}
	}()

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// --- Link handlers ---

func (h *handler) linkDocument(w http.ResponseWriter, r *http.Request) {
	entityID := chi.URLParam(r, "id")
	var req struct {
		DocumentID string `json:"document_id"`
	}
	if err := readJSON(r, &req); err != nil || req.DocumentID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "document_id is required"})
		return
	}

	_, err := h.deps.DB.Exec(r.Context(),
		`INSERT INTO entity_documents (entity_id, document_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		entityID, req.DocumentID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to link document"})
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, map[string]string{"status": "linked"})
}

func (h *handler) unlinkDocument(w http.ResponseWriter, r *http.Request) {
	entityID := chi.URLParam(r, "id")
	docID := chi.URLParam(r, "doc_id")

	tag, err := h.deps.DB.Exec(r.Context(),
		`DELETE FROM entity_documents WHERE entity_id = $1 AND document_id = $2`,
		entityID, docID)
	if err != nil || tag.RowsAffected() == 0 {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "link not found"})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "unlinked"})
}

func (h *handler) linkBookmark(w http.ResponseWriter, r *http.Request) {
	entityID := chi.URLParam(r, "id")
	var req struct {
		BookmarkID string `json:"bookmark_id"`
	}
	if err := readJSON(r, &req); err != nil || req.BookmarkID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "bookmark_id is required"})
		return
	}

	_, err := h.deps.DB.Exec(r.Context(),
		`INSERT INTO entity_bookmarks (entity_id, bookmark_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		entityID, req.BookmarkID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to link bookmark"})
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, map[string]string{"status": "linked"})
}

func (h *handler) unlinkBookmark(w http.ResponseWriter, r *http.Request) {
	entityID := chi.URLParam(r, "id")
	bmID := chi.URLParam(r, "bm_id")

	tag, err := h.deps.DB.Exec(r.Context(),
		`DELETE FROM entity_bookmarks WHERE entity_id = $1 AND bookmark_id = $2`,
		entityID, bmID)
	if err != nil || tag.RowsAffected() == 0 {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "link not found"})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "unlinked"})
}

// --- Config: entity label ---

func (h *handler) getEntityLabel(w http.ResponseWriter, r *http.Request) {
	var label string
	err := h.deps.DB.QueryRow(r.Context(), `SELECT value FROM config WHERE key = 'entity_label'`).Scan(&label)
	if err != nil {
		label = "Fiche"
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"label": label})
}

// --- Internal helpers ---

func validateProperties(props json.RawMessage, schema json.RawMessage) string {
	if len(props) == 0 || string(props) == "{}" {
		// Check if any required fields exist
		var fields []struct {
			Name     string `json:"name"`
			Label    string `json:"label"`
			Required bool   `json:"required"`
		}
		if err := json.Unmarshal(schema, &fields); err != nil {
			return ""
		}
		for _, f := range fields {
			if f.Required {
				return fmt.Sprintf("property '%s' is required", f.Label)
			}
		}
		return ""
	}

	var propsMap map[string]interface{}
	if err := json.Unmarshal(props, &propsMap); err != nil {
		return "properties must be a JSON object"
	}

	var fields []struct {
		Name     string `json:"name"`
		Label    string `json:"label"`
		Required bool   `json:"required"`
	}
	if err := json.Unmarshal(schema, &fields); err != nil {
		return ""
	}
	for _, f := range fields {
		if f.Required {
			val, ok := propsMap[f.Name]
			if !ok {
				return fmt.Sprintf("property '%s' is required", f.Label)
			}
			if s, ok := val.(string); ok && s == "" {
				return fmt.Sprintf("property '%s' is required", f.Label)
			}
		}
	}
	return ""
}

func (h *handler) freshnessThresholds(ctx context.Context) (int, int) {
	greenDays, yellowDays := 90, 180
	var val string
	if err := h.deps.DB.QueryRow(ctx, `SELECT value FROM config WHERE key = 'freshness_green'`).Scan(&val); err == nil {
		if n, _ := strconv.Atoi(val); n > 0 {
			greenDays = n
		}
	}
	if err := h.deps.DB.QueryRow(ctx, `SELECT value FROM config WHERE key = 'freshness_yellow'`).Scan(&val); err == nil {
		if n, _ := strconv.Atoi(val); n > 0 {
			yellowDays = n
		}
	}
	return greenDays, yellowDays
}

// --- Meilisearch indexing ---

type searchEntity struct {
	ID             string `json:"id"`
	Title          string `json:"title"`
	BodyText       string `json:"body_text"`
	ObjectType     string `json:"object_type"`
	DomainID       string `json:"domain_id"`
	EntityTypeName string `json:"entity_type_name"`
	EntityTypeIcon string `json:"entity_type_icon"`
	AuthorName     string `json:"author_name"`
	CreatedAt      int64  `json:"created_at"`
	UpdatedAt      int64  `json:"updated_at"`
}

func (h *handler) indexEntity(entityID string) {
	if h.deps.Meili == nil {
		return
	}
	ctx := context.Background()

	var se searchEntity
	var properties json.RawMessage
	var notesText string
	var createdAt, updatedAt time.Time
	err := h.deps.DB.QueryRow(ctx,
		`SELECT e.id, e.name, e.properties, e.notes_text,
		        e.domain_id, et.name, et.icon, u.display_name,
		        e.created_at, e.updated_at
		 FROM entities e
		 JOIN entity_types et ON et.id = e.entity_type_id
		 JOIN users u ON u.id = e.author_id
		 WHERE e.id = $1`, entityID,
	).Scan(&se.ID, &se.Title, &properties, &notesText,
		&se.DomainID, &se.EntityTypeName, &se.EntityTypeIcon, &se.AuthorName,
		&createdAt, &updatedAt)
	if err != nil {
		log.Printf("indexEntity: failed to fetch entity %s: %v", entityID, err)
		return
	}

	se.ObjectType = "entity"
	se.CreatedAt = createdAt.Unix()
	se.UpdatedAt = updatedAt.Unix()

	// Build body_text: stringify properties + notes_text
	se.BodyText = buildBodyText(properties, notesText, ctx, h.deps, se.ID)

	idx := h.deps.Meili.Index(meiliIndex)
	pk := "id"
	if _, err := idx.AddDocuments([]searchEntity{se}, &meilisearch.DocumentOptions{PrimaryKey: &pk}); err != nil {
		log.Printf("indexEntity: failed to index entity %s in Meilisearch: %v", entityID, err)
	}
}

func buildBodyText(properties json.RawMessage, notesText string, ctx context.Context, deps *model.Deps, entityID string) string {
	var parts []string

	// Get schema labels for this entity's type
	var schema json.RawMessage
	_ = deps.DB.QueryRow(ctx,
		`SELECT et.schema FROM entities e JOIN entity_types et ON et.id = e.entity_type_id WHERE e.id = $1`,
		entityID).Scan(&schema)

	var fields []struct {
		Name  string `json:"name"`
		Label string `json:"label"`
	}
	_ = json.Unmarshal(schema, &fields)

	labelMap := make(map[string]string)
	for _, f := range fields {
		labelMap[f.Name] = f.Label
	}

	var propsMap map[string]interface{}
	if err := json.Unmarshal(properties, &propsMap); err == nil {
		for key, val := range propsMap {
			s := fmt.Sprintf("%v", val)
			if s != "" && s != "<nil>" {
				label := key
				if l, ok := labelMap[key]; ok {
					label = l
				}
				parts = append(parts, label+": "+s)
			}
		}
	}

	if notesText != "" {
		parts = append(parts, notesText)
	}

	return strings.Join(parts, "\n")
}
