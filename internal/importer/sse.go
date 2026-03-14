package importer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/alexmusic/plumenote/internal/auth"
	"github.com/alexmusic/plumenote/internal/httputil"
	"github.com/go-chi/chi/v5"
)

const (
	maxConcurrentJobs = 3
	jobChannelSize    = 64
	jobCleanupDelay   = 60 * time.Second
)

var (
	activeJobs     sync.Map
	activeJobCount atomic.Int32
)

type importJob struct {
	ch       chan progressEvent
	cancel   context.CancelFunc
	authorID string
	done     atomic.Bool
}

type progressEvent struct {
	Type           string   `json:"type"`
	Current        int      `json:"current,omitempty"`
	Total          int      `json:"total"`
	Filename       string   `json:"filename,omitempty"`
	Status         string   `json:"status,omitempty"`
	Error          string   `json:"error,omitempty"`
	Success        int      `json:"success,omitempty"`
	Failed         int      `json:"failed,omitempty"`
	DomainsCreated []string `json:"domains_created,omitempty"`
	FoldersCreated int      `json:"folders_created,omitempty"`
}

func registerJob(authorID string, cancel context.CancelFunc) (string, *importJob) {
	if activeJobCount.Load() >= maxConcurrentJobs {
		return "", nil
	}
	activeJobCount.Add(1)
	jobID := fmt.Sprintf("%x%04x", time.Now().UnixNano(), rand.Int31n(0xFFFF))
	job := &importJob{
		ch:       make(chan progressEvent, jobChannelSize),
		cancel:   cancel,
		authorID: authorID,
	}
	activeJobs.Store(jobID, job)
	return jobID, job
}

func (j *importJob) sendProgress(evt progressEvent) {
	select {
	case j.ch <- evt:
	default:
		log.Printf("import job: dropped progress event (channel full)")
	}
}

func (j *importJob) finish(evt progressEvent) {
	evt.Type = "done"
	j.sendProgress(evt)
	j.done.Store(true)
}

func cleanupJob(jobID string) {
	time.Sleep(jobCleanupDelay)
	if val, ok := activeJobs.LoadAndDelete(jobID); ok {
		job := val.(*importJob)
		close(job.ch)
		activeJobCount.Add(-1)
	}
}

// HandleImportProgress handles GET /api/import/folder/progress/{jobId} — SSE stream.
func (wh *WebHandler) HandleImportProgress(w http.ResponseWriter, r *http.Request) {
	// Auth: try middleware first, then query param fallback for EventSource
	claims := auth.UserFromContext(r.Context())
	if claims == nil {
		if tokenStr := r.URL.Query().Get("token"); tokenStr != "" {
			claims, _ = auth.ParseTokenString(tokenStr, wh.deps.JWTSecret)
		}
	}
	if claims == nil {
		httputil.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "authentication required"})
		return
	}

	jobID := chi.URLParam(r, "jobId")
	val, ok := activeJobs.Load(jobID)
	if !ok {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "job not found"})
		return
	}
	job := val.(*importJob)

	if job.authorID != claims.UserID {
		httputil.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "not your job"})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "streaming not supported"})
		return
	}

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			job.cancel()
			return
		case evt, open := <-job.ch:
			if !open {
				return
			}
			data, _ := json.Marshal(evt)
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", evt.Type, data)
			flusher.Flush()
			if evt.Type == "done" {
				return
			}
		}
	}
}
