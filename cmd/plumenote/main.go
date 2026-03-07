package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/alexmusic/plumenote/internal/db"
	"github.com/alexmusic/plumenote/internal/model"
	"github.com/alexmusic/plumenote/internal/server"
	"github.com/meilisearch/meilisearch-go"
)

//go:embed all:static
var staticFiles embed.FS

func main() {
	// Check for subcommands
	if len(os.Args) > 1 && os.Args[1] == "import" {
		runImport(os.Args[2:])
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Config from env
	databaseURL := getEnv("DATABASE_URL", "postgres://plumenote:plumenote@localhost:5432/plumenote?sslmode=disable")
	meiliURL := getEnv("MEILI_URL", "http://localhost:7700")
	meiliKey := getEnv("MEILI_MASTER_KEY", "plumenote-dev-key")
	jwtSecret := getEnv("JWT_SECRET", "plumenote-dev-secret-change-me")
	listenAddr := getEnv("LISTEN_ADDR", ":8080")

	// Connect to PostgreSQL
	pool, err := db.NewPool(ctx, databaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()
	log.Println("Connected to PostgreSQL")

	// Connect to Meilisearch
	meili := meilisearch.New(meiliURL, meilisearch.WithAPIKey(meiliKey))
	if _, err := meili.Health(); err != nil {
		log.Printf("Warning: Meilisearch not available: %v", err)
	} else {
		log.Println("Connected to Meilisearch")
	}

	// Build deps
	deps := &model.Deps{
		DB:        pool,
		Meili:     meili,
		JWTSecret: jwtSecret,
	}

	// Embedded SPA static files
	var staticFS fs.FS
	staticFS, err = fs.Sub(staticFiles, "static")
	if err != nil {
		log.Printf("Warning: no embedded static files: %v", err)
	}

	// Create HTTP server
	handler := server.New(deps, staticFS)
	srv := &http.Server{
		Addr:         listenAddr,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down...")
		shutdownCtx, shutdownCancel := context.WithTimeout(ctx, 10*time.Second)
		defer shutdownCancel()
		srv.Shutdown(shutdownCtx)
	}()

	log.Printf("PlumeNote starting on %s", listenAddr)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
	log.Println("Server stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
