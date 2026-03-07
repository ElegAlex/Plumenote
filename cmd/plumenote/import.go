package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/alexmusic/plumenote/internal/db"
	"github.com/alexmusic/plumenote/internal/importer"
)

func runImport(args []string) {
	if len(args) == 0 {
		fmt.Fprintf(os.Stderr, "Usage: plumenote import <folder> [--author-id=UUID]\n")
		os.Exit(1)
	}

	folder := args[0]

	// Parse optional flags
	authorID := ""
	for _, arg := range args[1:] {
		if len(arg) > 12 && arg[:12] == "--author-id=" {
			authorID = arg[12:]
		}
	}

	if authorID == "" {
		authorID = os.Getenv("PLUMENOTE_AUTHOR_ID")
	}
	if authorID == "" {
		fmt.Fprintf(os.Stderr, "Error: author ID required. Use --author-id=UUID or set PLUMENOTE_AUTHOR_ID\n")
		os.Exit(1)
	}

	// Validate folder exists
	info, err := os.Stat(folder)
	if err != nil {
		log.Fatalf("Cannot access folder %q: %v", folder, err)
	}
	if !info.IsDir() {
		log.Fatalf("%q is not a directory", folder)
	}

	ctx := context.Background()

	databaseURL := getEnv("DATABASE_URL", "postgres://plumenote:plumenote@localhost:5432/plumenote?sslmode=disable")
	pool, err := db.NewPool(ctx, databaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	log.Printf("Importing from %s ...", folder)

	report, err := importer.Import(ctx, pool, folder, authorID)
	if err != nil {
		log.Fatalf("Import failed: %v", err)
	}

	fmt.Println()
	fmt.Println("=== Import Report ===")
	fmt.Printf("Total files:  %d\n", report.Total)
	fmt.Printf("Success:      %d\n", report.Success)
	fmt.Printf("Failed:       %d\n", report.Failed)

	if len(report.Failures) > 0 {
		fmt.Println()
		fmt.Println("Failures:")
		for _, f := range report.Failures {
			fmt.Printf("  - %s: %s\n", f.Path, f.Reason)
		}
	}

	if len(report.Documents) > 0 {
		fmt.Println()
		fmt.Println("Imported documents:")
		for _, d := range report.Documents {
			fmt.Printf("  - %s → ID=%s (domain=%s)\n", d.Title, d.DocID, d.DomainID)
		}
	}
}
