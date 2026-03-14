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

Before the existing UPDATE statement, insert a snapshot of the **current** document state into `document_versions`:

```go
// 1. Read current document state
// 2. Determine next version_number: SELECT COALESCE(MAX(version_number), 0) + 1
// 3. INSERT INTO document_versions (document_id, version_number, title, body, body_text, author_id)
// 4. Purge excess versions beyond config limit
// 5. Proceed with existing UPDATE
```

This means version N captures the state **before** the write that produces version N+1. The current live document is always the latest state (not in the versions table).

### Text diff (server-side)

Uses `github.com/sergi/go-diff` (Myers algorithm) for line-by-line diff on `body_text`.

Response format:

```json
{
  "v1": 5,
  "v2": 8,
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

### Admin panel

Add a field in the existing admin page: "Nombre max de versions par document" — numeric input calling `PUT /api/admin/config/max_versions_per_document`.

## Migration

New migration file `003_document_versions.sql`:

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

## Dependencies

- `github.com/sergi/go-diff` — Myers diff algorithm for Go (text diff endpoint).
- No new frontend dependencies — LCS implemented inline (~50 lines), TipTap already available.

## Access Control

Version history is visible to all users who can view the document (follows existing `visibility` field: public or DSI). Restore requires edit permission (document author or admin).

## Files to create/modify

### New files

- `migrations/000003_document_versions.up.sql`
- `migrations/000003_document_versions.down.sql`
- `internal/document/version_handlers.go` — version list, detail, diff, restore handlers
- `internal/document/version_queries.go` — SQL queries for versions
- `internal/document/diff.go` — text diff logic using go-diff
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
