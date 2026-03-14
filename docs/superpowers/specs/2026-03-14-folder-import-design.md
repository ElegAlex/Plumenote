# Folder Import — Design Spec

## Goal

Add a folder import feature to PlumeNote that scrupulously respects filesystem hierarchy. Two modes: **root-level import** (first-level subdirectories become domains, deeper levels become folders) and **domain-level import** (subdirectories become folders within a target domain). Supports browser folder selection (`webkitdirectory`) and ZIP upload. Includes interactive preview with exclusion, real-time progress via SSE, and native integration in the existing Import page.

## Current State

- CLI import (`plumenote import <folder>`) walks a directory tree, resolves domains by name-matching, creates folders via `resolveFolder`, converts files with Pandoc/pdftotext, inserts documents.
- Web import (`POST /api/import`, `POST /api/import/batch`) handles single/batch file uploads with domain and optional folder selection. No directory structure support.
- Frontend ImportPage (`/import`) provides drag-and-drop file upload with domain/type selectors.
- `folder_id` is NOT NULL on `documents` — all documents must belong to a folder.
- Domain resolution in CLI relies on name-matching against existing domains, with fallback to a default domain. Many directory names don't match, causing misplacement.

## Data Model Changes

### Migration 14: `folder_id` nullable

```sql
-- Up
ALTER TABLE documents ALTER COLUMN folder_id DROP NOT NULL;

-- Down
-- Backfill NULLs to domain's first root folder, then re-add NOT NULL
UPDATE documents d
SET folder_id = (
  SELECT f.id FROM folders f
  WHERE f.domain_id = d.domain_id AND f.parent_id IS NULL
  ORDER BY f.position LIMIT 1
)
WHERE d.folder_id IS NULL;

ALTER TABLE documents ALTER COLUMN folder_id SET NOT NULL;
```

Documents with `folder_id = NULL` live at the domain root level. In the sidebar they appear below the folder tree. No new tables required.

### Queries impacted by nullable `folder_id`

The following existing queries and code paths must be updated to handle `folder_id IS NULL`:

- **`internal/folder/handler.go`** — `getFolder` handler: the query `WHERE folder_id = $1` for listing documents in a folder is unaffected (only matches non-NULL). But `filterPublicFolders` casts `folder_id::text` which returns NULL for root documents — add `WHERE folder_id IS NOT NULL` or handle NULL explicitly.
- **`internal/document/handlers.go`** — `createDocument`: `folder_id` becomes optional in the request body. If absent, insert with `folder_id = NULL`. Permission check: if no folder, require that user is at least editor on any root folder of the domain (or admin).
- **`internal/document/handlers.go`** — `updateDocument`: allow `folder_id` to be set to `null` (move to domain root). If moving from a folder to root, check editor+ on source folder.
- **`internal/document/handlers.go`** — `getDocument`: if `folder_id IS NULL`, skip folder path in breadcrumb response.
- **`internal/document/handlers.go`** — `listDocuments`: add support for `folder_id=null` query parameter to list root documents.
- **`internal/importer/web_handler.go`** — `HandleImport` / `processOneFile`: `folder_id` form field becomes optional. If empty, insert with `folder_id = NULL` instead of falling back to "General" folder.

## Backend API

### New endpoints

#### `POST /api/import/analyze-zip`

Analyzes a ZIP file and returns its directory tree without processing any files.

**Auth:** RequireAuth

**Input:** Multipart form with `file` (ZIP archive, max 200 MB)

**Output:**
```json
{
  "tree": [
    {
      "name": "CPAM 92",
      "path": "CPAM 92",
      "type": "dir",
      "children": [
        {
          "name": "GOUVERNANCE",
          "path": "CPAM 92/GOUVERNANCE",
          "type": "dir",
          "children": [
            {
              "name": "procedure.md",
              "path": "CPAM 92/GOUVERNANCE/procedure.md",
              "type": "file",
              "size": 4096
            }
          ]
        }
      ]
    },
    {
      "name": "readme.txt",
      "path": "readme.txt",
      "type": "file",
      "size": 512
    }
  ]
}
```

**Behavior:**
- Reads the ZIP central directory via `archive/zip` without extracting files to disk.
- Filters out unsupported file types (only `.doc`, `.docx`, `.pdf`, `.txt`, `.md`).
- Filters out hidden files/directories (starting with `.`).
- Returns error if ZIP exceeds 200 MB or contains more than 1000 files.

#### `POST /api/import/folder`

Starts an asynchronous folder import job.

**Auth:** RequireAuth

**Input:** Multipart form with:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | string | yes | `"root"` or `"domain"` |
| `domain_id` | UUID | if mode=domain | Target domain ID |
| `type_id` | UUID | no | Document type for all imported docs (default: first type in DB) |
| `source` | string | yes | `"directory"` or `"zip"` |
| `paths[]` | string[] | yes | Relative paths of selected files |
| `files[]` | File[] | if source=directory | The actual files (matched by index to `paths[]`) |
| `file` | File | if source=zip | The ZIP archive |

**Output (HTTP 202):**
```json
{
  "job_id": "uuid"
}
```

**Server-side processing (goroutine):**

1. **Parse file tree** from `paths[]` to reconstruct the hierarchy.
2. **Mode "root":**
   - First-level directories → domains. Create domain if it doesn't exist (name = directory name, slug = slugified name).
   - Files at root level (no parent directory) → assigned to a "Divers" domain (slug: `divers`, created if needed). Shown in preview tree as "(Domaine) Divers" with the loose files listed under it.
   - Second-level and deeper directories → folders within the resolved domain.
   - Documents at domain root (directly inside a first-level dir, no subfolder) → `folder_id = NULL`.
3. **Mode "domain":**
   - All directories → folders within the target domain.
   - Files at root level → `folder_id = NULL` (domain root).
   - Subdirectories → nested folders via `resolveFolder`.
4. **For each file** (sequential):
   - Save to temp file.
   - Convert via `convertFile()` (Pandoc/pdftotext → TipTap JSON).
   - Insert document with resolved `domain_id` and `folder_id`.
   - Index in Meilisearch.
   - Publish progress event to job channel.
5. **Cleanup** temp files.

**Authorization:**
- **Mode "root":** Only admin users can use root mode (domain creation is an admin-level action). Non-admin users get HTTP 403.
- **Mode "domain":** Requires editor+ role on at least one folder in the target domain, or admin. Folders created during import grant "manager" to the importing user.

**Domain creation (mode root):**
```go
// Auto-create domain from directory name
name := dirName           // e.g. "CPAM 92"
slug := slugify(dirName)  // e.g. "cpam-92"
// INSERT INTO domains (name, slug) VALUES ($1, $2)
//   ON CONFLICT (slug) DO NOTHING RETURNING id
// If conflict, SELECT id FROM domains WHERE slug = $2
```

**Folder depth enforcement:** When creating nested folders, enforce `MaxFolderDepth = 10`. If a directory tree exceeds this depth, the deepest directories are flattened into the last allowed level with a warning in the progress stream.

**Error handling:** Individual file failures don't abort the job. Each file's result (ok/error) is reported in the progress stream. The job completes even if some files fail.

#### `GET /api/import/folder/progress/{jobId}`

SSE stream for real-time import progress.

**Auth:** RequireAuth

**Events:**

```
event: progress
data: {"current": 5, "total": 42, "filename": "procedure.md", "status": "ok"}

event: progress
data: {"current": 6, "total": 42, "filename": "scan.pdf", "status": "error", "error": "conversion failed: pdftotext not found"}

event: done
data: {"total": 42, "success": 38, "failed": 4, "domains_created": ["CPAM 92", "SCI"], "folders_created": 12}
```

**Implementation:** A `sync.Map` of `jobId → *importJob` in the WebHandler. Each job stores the `authorID` — the SSE handler verifies `claims.UserID == job.authorID` before streaming. The channel is buffered (capacity 64). The import goroutine uses `select` with a default case to avoid blocking on a full channel (drops events if consumer is too slow). The job's `cancel` function is called when the SSE client disconnects. Channel is cleaned up 60 seconds after the `done` event (allows late reconnection).

#### `GET /api/domains/{domainId}/root-documents`

Returns documents without a folder (`folder_id IS NULL`) for a domain.

**Auth:** OptionalAuth (respects document visibility for unauthenticated users)

**Output:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "Document Title",
      "slug": "document-title",
      "type_name": "Note",
      "updated_at": "2026-03-14T10:00:00Z"
    }
  ]
}
```

### Modified endpoints

- **`POST /api/documents`** — `folder_id` becomes optional (nullable).
- **`PUT /api/documents/{id}`** — Allow setting `folder_id` to null (move to domain root).
- **`GET /api/documents/{slug}`** — Handle `folder_id = NULL` for breadcrumb (no folder segment).
- **`GET /api/domains/{domainId}/folders`** — No change (already returns only folders).

## Frontend

### ImportPage refactoring

The existing ImportPage gets restructured with tabs:

**Tab 1: "Fichiers"** — Current single/batch file upload (unchanged).

**Tab 2: "Dossier"** — New folder import flow.

### Folder import flow (Tab 2)

#### Step 1 — Mode & source selection

```
┌─────────────────────────────────────────┐
│  Mode d'import                          │
│  ○ Importer des domaines (racine)       │
│  ○ Importer dans un domaine existant    │
│     [Sélecteur de domaine ▾]            │
│                                         │
│  Source                                 │
│  [📁 Sélectionner un dossier]           │
│  [📦 Uploader un ZIP]                   │
└─────────────────────────────────────────┘
```

- Radio buttons for mode.
- Domain selector shown only in "domain" mode.
- Optional document type selector (applies to all imported documents).
- Two buttons for source type.
- In root mode: a note explains that first-level subdirectories will become domains.

#### Step 2 — Preview tree with exclusion

**For `webkitdirectory`:** The browser reads files via `input.files`. Each file has `webkitRelativePath` (e.g., `"CPAM 92/GOUVERNANCE/file.md"`). Build the tree in JavaScript — no server call needed.

**For ZIP:** Upload ZIP to `POST /api/import/analyze-zip`, display returned tree.

```
┌─────────────────────────────────────────┐
│  Aperçu de l'import                     │
│                                         │
│  3 domaines · 12 dossiers · 42 fichiers │
│                                         │
│  ☑ 📁 CPAM 92           (Domaine)      │
│    ☑ 📁 GOUVERNANCE                    │
│      ☑ 📄 procedure.md                 │
│      ☑ 📄 guide.docx                   │
│    ☑ 📁 TECHNIQUE                      │
│      ☐ 📄 old-draft.txt  ← excluded    │
│  ☑ 📁 SCI               (Domaine)      │
│    ☑ 📄 readme.md                       │
│  ☐ 📁 BROUILLONS         ← excluded    │
│                                         │
│  [Lancer l'import]                      │
└─────────────────────────────────────────┘
```

- Checkboxes on every node. Unchecking a folder unchecks all children.
- In root mode: first-level dirs labeled "(Domaine)".
- Counters update live as items are checked/unchecked.
- Only supported file types shown (others filtered out silently or with a note).

#### Step 3 — Progress

```
┌─────────────────────────────────────────┐
│  Import en cours...                     │
│                                         │
│  ████████████░░░░░░░░  28/42 fichiers   │
│                                         │
│  ✓ procedure.md                         │
│  ✓ guide.docx                           │
│  ⟳ scan.pdf ← en cours                 │
│  ✗ corrupt.doc — conversion failed      │
│                                         │
│  Domaines créés : CPAM 92, SCI          │
│  Dossiers créés : 12                    │
└─────────────────────────────────────────┘
```

- SSE via `EventSource` connected to `/api/import/folder/progress/{jobId}`.
- Progress bar + per-file status (scrollable list, latest at bottom).
- Cannot close/navigate away without confirmation (beforeunload).

#### Step 4 — Results

```
┌─────────────────────────────────────────┐
│  Import terminé ✓                       │
│                                         │
│  38 succès · 4 échecs                   │
│                                         │
│  Domaines créés :                       │
│    → CPAM 92  [Voir]                    │
│    → SCI      [Voir]                    │
│                                         │
│  Fichiers en erreur :                   │
│    ✗ corrupt.doc — conversion failed    │
│    ✗ huge.pdf — file too large          │
│                                         │
│  [Nouvel import]                        │
└─────────────────────────────────────────┘
```

- Links to created domains/folders.
- Error details for failed files.
- Button to start another import.

### Sidebar changes

When a domain is expanded in the sidebar:
1. Folder tree (existing FolderTree component)
2. Below: root documents (`folder_id IS NULL`), fetched from `GET /api/domains/{domainId}/root-documents`
   - Displayed as document entries with a document icon (Lucide `FileText`)
   - Clicking navigates to `/documents/:slug`

### DomainPage changes

- Add a section for root documents (no folder) at the top or below the folder grid.
- Same data source: `GET /api/domains/{domainId}/root-documents`.

### Breadcrumb changes

- Documents with `folder_id = NULL`: breadcrumb is `Home > Domain > Document` (no folder segment).
- Documents with a folder: unchanged (`Home > Domain > Folder > ... > Document`).

### EditorPage changes

- Folder picker becomes optional (was required). "Aucun dossier (racine du domaine)" option.

## Backend architecture

### Job management

```go
// In WebHandler
type importJob struct {
    ch       chan progressEvent
    cancel   context.CancelFunc
    authorID string
}

type progressEvent struct {
    Type     string `json:"type"`     // "progress" or "done"
    Current  int    `json:"current,omitempty"`
    Total    int    `json:"total"`
    Filename string `json:"filename,omitempty"`
    Status   string `json:"status,omitempty"`    // "ok" or "error"
    Error    string `json:"error,omitempty"`
    // done fields
    Success        int      `json:"success,omitempty"`
    Failed         int      `json:"failed,omitempty"`
    DomainsCreated []string `json:"domains_created,omitempty"`
    FoldersCreated int      `json:"folders_created,omitempty"`
}

// sync.Map for active jobs
var activeJobs sync.Map // map[string]*importJob

// Max concurrent import jobs (global)
const maxConcurrentJobs = 3
var activeJobCount atomic.Int32
```

### File processing reuse

The existing functions are reused directly:
- `convertFile(ctx, tmpPath, ext)` → TipTap JSON + body text
- `resolveFolder(ctx, db, domainID, authorID, pathParts, cache)` → folder ID
- `indexDocumentAsync(docID)` → Meilisearch indexing
- `titleFromFilename(filename)` → document title
- `slugify(name)` → slug generation

New functions:
- `createDomainFromName(ctx, db, name, authorID)` → creates domain, returns ID
- `buildTreeFromPaths(paths []string)` → reconstructs hierarchy from flat path list
- `analyzeZip(zipPath string)` → returns tree structure

### Upload limits

**Directory upload (`webkitdirectory`):**
- `MaxBytesReader`: 500 MB total (all files combined).
- Max file count: 1000. Validated client-side before upload; server rejects if exceeded.

**ZIP upload:**
- Max ZIP size: 200 MB.
- Max files in ZIP: 1000.
- ZIP is extracted to temp directory for processing, cleaned up after job completes.
- Protection against zip bombs: check uncompressed size ratio (max 10:1).

**Concurrency:** Max 3 concurrent import jobs globally. If limit reached, return HTTP 429 "Too many imports in progress, please retry later".

## Migration strategy

Migration `000014_folder_id_nullable.up.sql`:
1. `ALTER TABLE documents ALTER COLUMN folder_id DROP NOT NULL;`

Migration `000014_folder_id_nullable.down.sql`:
1. Backfill NULL `folder_id` with first root folder of each domain.
2. `ALTER TABLE documents ALTER COLUMN folder_id SET NOT NULL;`

## Out of scope

- Drag-and-drop folder reordering in preview tree
- Import progress persistence across page reloads (job lost if page closed)
- Resumable imports (partial failure → retry only failed files)
- Import scheduling / background jobs
- Import from cloud storage (Google Drive, OneDrive)
- Recursive folder permissions auto-assignment post-import (only manager on created folders for the importing user)
