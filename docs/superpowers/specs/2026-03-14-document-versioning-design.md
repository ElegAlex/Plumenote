# Document Versioning System — Design Spec

## Overview

Add complete version history to PlumeNote documents: automatic snapshots on every save, version listing, diff comparison (text and visual), and restore capability. Retention is admin-configurable.

## Data Model

### New table: `document_versions`

```sql
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    title TEXT NOT NULL,
    body JSONB NOT NULL,
    body_text TEXT NOT NULL DEFAULT '',
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(document_id, version_number)
);
CREATE INDEX idx_doc_versions_document_id ON document_versions(document_id);
```

- `ON DELETE CASCADE`: deleting a document deletes all its versions.
- `version_number`: auto-incremented per document (1, 2, 3...).
- Stores `title` + `body` + `body_text` — full snapshot per save.
- `author_id`: who made this modification.

### Retention config

```sql
INSERT INTO config (key, value) VALUES ('max_versions_per_document', '50');
```

Configurable via admin panel. Purge runs after each version insertion:

```sql
DELETE FROM document_versions
WHERE document_id = $1
  AND version_number <= (SELECT MAX(version_number) - $max FROM document_versions WHERE document_id = $1);
```

## Backend API

### New endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/documents/:id/versions` | List versions (id, version_number, author, created_at, title) — no body |
| `GET` | `/api/documents/:id/versions/:versionNumber` | Single version detail with full body |
| `GET` | `/api/documents/:id/versions/:v1/diff/:v2` | Text diff between two versions (server-side) |
| `POST` | `/api/documents/:id/versions/:versionNumber/restore` | Restore a version — creates a new version as current |

### Admin endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/config/max_versions_per_document` | Read retention limit |
| `PUT` | `/api/admin/config/max_versions_per_document` | Update retention limit |

### Modified handler: `PUT /documents/:id`

Before the existing UPDATE statement, insert a snapshot of the **current** document state into `document_versions`. The entire sequence runs inside a single PostgreSQL transaction with `SELECT ... FOR UPDATE` on the document row to prevent concurrent saves from producing duplicate version numbers.

```go
// tx := pool.Begin(ctx)
// 1. SELECT ... FROM documents WHERE id = $1 FOR UPDATE  (lock row + read current state)
// 2. SELECT COALESCE(MAX(version_number), 0) + 1 FROM document_versions WHERE document_id = $1
// 3. Skip snapshot if body hash unchanged (SHA-256 of body JSON)
// 4. INSERT INTO document_versions (document_id, version_number, title, body, body_text, author_id)
// 5. Purge excess versions beyond config limit (inside same tx)
// 6. UPDATE documents SET ... (the actual save)
// 7. tx.Commit()
```

This means version N captures the state **before** the write that produces version N+1. The current live document is always the latest state (not in the versions table). The `FOR UPDATE` lock serializes concurrent saves to the same document, preventing version_number race conditions.

### Text diff (server-side)

Uses `github.com/sergi/go-diff` (Myers algorithm) for line-by-line diff on `body_text`.

The endpoint normalizes order (if v1 > v2, swap them) and returns 400 if v1 == v2.

Response format:

```json
{
  "v1": 5,
  "v2": 8,
  "v1_created_at": "2026-03-10T14:00:00Z",
  "v2_created_at": "2026-03-14T09:30:00Z",
  "v1_author": "Admin",
  "v2_author": "Admin",
  "lines": [
    {"type": "equal", "text": "Unchanged paragraph"},
    {"type": "delete", "text": "Old text"},
    {"type": "insert", "text": "New text"}
  ]
}
```

### Restore endpoint

`POST /api/documents/:id/versions/:versionNumber/restore`:

1. Read the target version's body, title, body_text.
2. Snapshot the current document state as a new version (same as save flow).
3. UPDATE the document with the restored content.
4. Return the updated document.

This preserves full history — restoring is just "save with old content".

## Frontend

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `VersionHistory.tsx` | `features/reader/` | Side panel listing versions |
| `VersionPreview.tsx` | `features/reader/` | Read-only display of an old version |
| `DiffTextView.tsx` | `features/reader/` | Git-style text diff (green/red lines) |
| `DiffVisualView.tsx` | `features/reader/` | Side-by-side TipTap diff with color marking |
| `DiffToggle.tsx` | `features/reader/` | Toggle switch between text and visual diff |

### Version history panel

- Triggered by "Historique" button in ReaderPage header.
- Slides in from the right as a side panel.
- Each entry: `v12 — il y a 3 jours — par Admin`.
- Click a version: displays it read-only in the main content area with a banner "Version 12 du 11/03/2026" + "Restaurer" button.
- Checkboxes to select two versions for comparison.
- "Comparer" button opens the diff view.

### Text diff view

- Route: `/documents/:slug/diff/:v1/:v2`
- Renders line-by-line diff from server response.
- Header: "Version 5 → Version 8".
- Toggle button to switch to visual diff.

### Visual diff view

- Same route, alternate mode.
- Two columns: old version (left), new version (right).
- Both rendered as read-only TipTap editors.
- Deleted nodes highlighted in red (left column).
- Added nodes highlighted in green (right column).
- Equal nodes aligned between columns.

### Visual diff algorithm (client-side)

Compares `body.content[]` arrays from two versions using LCS (Longest Common Subsequence) on top-level nodes:

1. Hash each node by serializing its JSON content.
2. Run LCS to find common subsequence.
3. Nodes not in LCS are marked as `insert` (right) or `delete` (left).
4. Left column renders: `equal` + `delete` nodes.
5. Right column renders: `equal` + `insert` nodes.

**Granularity**: block-level (paragraph, heading, code block). A modified paragraph appears as delete + insert. Fine-grained character diff is covered by the text diff mode.

**Alignment**: when one side has extra deleted/inserted nodes between two equal nodes, spacer `<div>` elements with matching height are inserted in the opposite column to keep equal nodes visually aligned.

### Admin panel

Add a field in the existing admin page: "Nombre max de versions par document" — numeric input calling `PUT /api/admin/config/max_versions_per_document`.

## Migration

New migration files `000012_document_versions.up.sql` / `000012_document_versions.down.sql`:

**Up:**

```sql
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    title TEXT NOT NULL,
    body JSONB NOT NULL,
    body_text TEXT NOT NULL DEFAULT '',
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(document_id, version_number)
);
CREATE INDEX idx_doc_versions_document_id ON document_versions(document_id);

INSERT INTO config (key, value) VALUES ('max_versions_per_document', '50')
ON CONFLICT (key) DO NOTHING;
```

**Down:**

```sql
DELETE FROM config WHERE key = 'max_versions_per_document';
DROP TABLE IF EXISTS document_versions;
```

## Dependencies

- `github.com/sergi/go-diff` — Myers diff algorithm for Go (text diff endpoint).
- No new frontend dependencies — LCS implemented inline (~50 lines), TipTap already available.

## Access Control

- **Read endpoints** (list, detail, diff): registered in the `OptionalAuth` route group, same as `GET /{slug}`. Visible to all users who can view the document (follows existing `visibility` field).
- **Restore endpoint**: registered in the `RequireAuth` group with same permission check as `updateDocument` (document author or admin).

## Handler Pattern

Version handlers are methods on the existing `handler` struct in `internal/document/`, consistent with the rest of that package (e.g. `func (h *handler) listVersions(...)`). Raw pgx queries (not sqlc), matching the de facto pattern in the existing handlers.

## Testing

New file `internal/document/version_handlers_test.go` covering:
- Version creation on save (snapshot before UPDATE)
- Skip snapshot when body unchanged (hash check)
- Version list ordering (newest first)
- Restore flow (creates new version)
- Purge (only N versions kept)
- Diff endpoint (validates v1 < v2, returns correct diff)

## Files to create/modify

### New files

- `migrations/000012_document_versions.up.sql`
- `migrations/000012_document_versions.down.sql`
- `internal/document/version_handlers.go` — version list, detail, diff, restore handlers
- `internal/document/version_queries.go` — SQL queries for versions
- `internal/document/diff.go` — text diff logic using go-diff
- `internal/document/version_handlers_test.go` — tests for version endpoints
- `web/src/features/reader/VersionHistory.tsx`
- `web/src/features/reader/VersionPreview.tsx`
- `web/src/features/reader/DiffTextView.tsx`
- `web/src/features/reader/DiffVisualView.tsx`
- `web/src/features/reader/DiffToggle.tsx`
- `web/src/lib/diff.ts` — LCS algorithm for TipTap JSON nodes

### Modified files

- `internal/document/handlers.go` — add snapshot insertion before UPDATE in `updateDocument`
- `internal/document/router.go` — register new version routes
- `internal/admin/handlers.go` — add config endpoints for retention
- `web/src/features/reader/ReaderPage.tsx` — add "Historique" button + side panel integration
- `web/src/features/admin/AdminPage.tsx` — add retention config field
- `web/src/App.tsx` — add diff route
