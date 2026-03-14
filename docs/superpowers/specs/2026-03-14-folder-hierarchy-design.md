# Folder Hierarchy with Permissions — Design Spec

## Goal

Add a hierarchical folder system within each domain, displayed as a collapsible tree in the sidebar. Documents must belong to a folder. Folders have role-based permissions (reader/editor/manager) with inheritance from parent folders.

## Current State

- Documents are organized flat within domains, with type and tags as metadata
- Sidebar shows domains as top-level items; clicking navigates to DomainPage
- No folder/hierarchy concept exists in the data model
- Permission model is simple: documents have visibility (public/dsi) and author-based edit checks

## Data Model

### New table: `folders`

```sql
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (parent_id != id)
);

-- Slug uniqueness: separate indexes for root and child folders (NULL-safe)
CREATE UNIQUE INDEX idx_folders_unique_root
  ON folders(domain_id, slug) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX idx_folders_unique_child
  ON folders(domain_id, parent_id, slug) WHERE parent_id IS NOT NULL;

CREATE INDEX idx_folders_domain ON folders(domain_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);
```

- `parent_id = NULL` means root-level folder within the domain.
- `position` controls display order among siblings.
- `slug` is unique per parent within a domain (allows same name in different parents).
- `ON DELETE CASCADE` on `parent_id` ensures deleting a folder deletes all sub-folders recursively.
- `CHECK (parent_id != id)` prevents direct self-referencing. Multi-level cycles are prevented at the application level (see "Move validation" below).
- `created_by` uses `ON DELETE SET NULL` to allow user cleanup without blocking.
- **Max depth: 10 levels.** Enforced at the application level on create and move operations.

### New table: `folder_permissions`

```sql
CREATE TYPE folder_role AS ENUM ('reader', 'editor', 'manager');

CREATE TABLE folder_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role folder_role NOT NULL,
    UNIQUE(folder_id, user_id)
);
CREATE INDEX idx_folder_perms_folder ON folder_permissions(folder_id);
CREATE INDEX idx_folder_perms_user ON folder_permissions(user_id);
```

### Roles

| Role | Read folder & docs | Create/edit docs | Create sub-folders | Rename/move/delete folder | Manage permissions |
|------|-------------------|-----------------|-------------------|--------------------------|-------------------|
| reader | yes | no | no | no | no |
| editor | yes | yes | no | no | no |
| manager | yes | yes | yes | yes | yes |

### Inheritance

- A user's effective role on a folder is determined by walking up the tree from the folder to the root.
- The **most specific** (closest to the folder) explicit permission wins.
- If no explicit permission exists on the folder or any ancestor, the user has **no access** (unless admin).
- Admin users bypass all folder permissions (full access everywhere).
- Domain-level permissions: a `folder_permissions` entry on a root folder (parent_id = NULL) effectively grants domain-wide access for that subtree.

### Unauthenticated users and public documents

- Folder permissions only apply to **authenticated** users.
- Unauthenticated users can see folders that contain at least one `public` visibility document.
- The folder tree endpoint for unauthenticated users returns a filtered tree: only folders with public documents (or ancestors of such folders) are shown.
- `GET /api/documents/{slug}` for public documents remains accessible without auth, regardless of folder permissions.

### Modified table: `documents`

```sql
ALTER TABLE documents ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE RESTRICT;
```

- `folder_id` is required for new documents going forward.
- Existing documents (pre-migration) get assigned to an auto-created "General" root folder per domain.
- `ON DELETE RESTRICT` prevents accidental data loss at the DB level. Cascade deletion of folder contents is handled explicitly in the application layer within a transaction (delete documents first, then sub-folders, then the folder itself), after the confirmation modal is validated. This matches the existing pattern where `documents.domain_id` uses a restrictive approach.

## Backend API

### Folder CRUD

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/domains/{domainId}/folders` | OptionalAuth | Full folder tree for a domain (filtered by user permissions) |
| POST | `/api/folders` | RequireAuth | Create folder (requires manager on parent, or admin) |
| PUT | `/api/folders/{id}` | RequireAuth | Rename or move folder (requires manager) |
| DELETE | `/api/folders/{id}?confirm=true` | RequireAuth | Delete folder + cascade (requires manager) |
| GET | `/api/folders/{id}` | OptionalAuth | Folder detail + documents (grouped by type) |
| GET | `/api/folders/{id}/cascade-count` | RequireAuth | Returns count of sub-folders and documents for delete confirmation |

#### GET `/api/domains/{domainId}/folders` response

```json
[
  {
    "id": "uuid",
    "name": "Serveurs",
    "slug": "serveurs",
    "position": 0,
    "parent_id": null,
    "children": [
      {
        "id": "uuid",
        "name": "Linux",
        "slug": "linux",
        "position": 0,
        "parent_id": "parent-uuid",
        "children": []
      }
    ]
  }
]
```

The tree is built server-side. Only folders the user has read access to are included.

**Performance optimization:** For the tree endpoint, all `folder_permissions` for the requesting user in the domain are fetched in a single query. Permission resolution is then done in-memory while building the tree, avoiding N+1 queries.

#### POST `/api/folders` request

```json
{
  "name": "Firewall",
  "domain_id": "uuid",
  "parent_id": "uuid-or-null"
}
```

`slug` is auto-generated from `name`. `position` defaults to last among siblings.

**Depth validation:** Before creating, compute the depth of the parent folder. If parent depth + 1 > 10, reject with 400 "maximum folder depth exceeded".

#### PUT `/api/folders/{id}` request

```json
{
  "name": "New name",
  "parent_id": "new-parent-uuid-or-null",
  "position": 2
}
```

All fields optional; only provided fields are updated.

**Move validation (when `parent_id` changes):**
1. Requires manager on both the source parent and the destination parent.
2. **Cross-domain moves are forbidden.** The destination parent must have the same `domain_id` as the folder being moved.
3. **Cycle detection:** Use a recursive CTE to walk from the destination parent up to the root. If the folder being moved appears in that ancestry chain, reject with 400 "cannot move a folder into its own descendant".
4. **Depth check:** Compute the depth of the deepest descendant of the folder being moved. If destination depth + subtree depth > 10, reject with 400 "maximum folder depth exceeded".

#### GET `/api/folders/{id}/cascade-count` response

```json
{
  "folder_count": 5,
  "document_count": 12
}
```

#### DELETE `/api/folders/{id}?confirm=true`

Requires `?confirm=true` query parameter. Without it, returns 400.

Deletion is performed in a transaction:
1. Recursively collect all descendant folder IDs (CTE).
2. Delete all documents in those folders (also removes from Meilisearch index).
3. Delete the folder (CASCADE takes care of sub-folders and permissions).
4. Commit.

#### GET `/api/folders/{id}` response

```json
{
  "id": "uuid",
  "name": "Linux",
  "slug": "linux",
  "domain_id": "uuid",
  "domain_name": "SCI",
  "domain_slug": "sci",
  "parent_id": "parent-uuid",
  "path": [
    { "id": "uuid", "name": "Serveurs", "slug": "serveurs" },
    { "id": "uuid", "name": "Linux", "slug": "linux" }
  ],
  "children": [
    { "id": "uuid", "name": "Ubuntu", "slug": "ubuntu" }
  ],
  "documents_by_type": [
    {
      "type_name": "Procedure technique",
      "type_slug": "procedure-technique",
      "documents": [
        { "id": "uuid", "title": "Install Ubuntu 24.04", "slug": "install-ubuntu-24-04", "updated_at": "..." }
      ]
    }
  ],
  "user_role": "editor"
}
```

`path` is the full ancestor chain from root to this folder (for breadcrumb). `user_role` is the resolved effective role for the requesting user.

### Folder Permissions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/folders/{id}/permissions` | RequireAuth | List explicit permissions on this folder (requires manager) |
| PUT | `/api/folders/{id}/permissions` | RequireAuth | Set permissions (requires manager) |

#### PUT `/api/folders/{id}/permissions` request

```json
{
  "permissions": [
    { "user_id": "uuid", "role": "editor" },
    { "user_id": "uuid", "role": "reader" }
  ]
}
```

Replaces all explicit permissions on this folder. Omitting a user removes their explicit permission (they may still inherit from parent).

### Permission resolution (backend helper)

```
func resolveUserRole(ctx, db, folderID, userID) -> folder_role | nil
  1. Check if user is admin → return "manager"
  2. Walk from folderID up to root via parent_id (max 10 iterations)
  3. At each level, check folder_permissions for (folder_id, user_id)
  4. Return the first explicit role found
  5. If none found at any level, return nil (no access)
```

For single-folder checks (document access, folder mutations), this is called per request.

For the tree endpoint, the optimized batch approach is used instead (see GET tree endpoint above).

### Modified document endpoints

- `POST /api/documents` — requires `folder_id` in body. Permission check: user must have editor+ role on the folder.
- `PUT /api/documents/{id}` — if `folder_id` changes (move), check editor+ on both source and destination folders.
- `GET /api/documents/{slug}` — for authenticated users, check reader+ on the document's folder. For unauthenticated users, allow if document visibility is `public`.
- When a document is moved to a different folder (or deleted via folder cascade), update the Meilisearch index accordingly.

### Routing: folder URLs use IDs, not slugs

Since folder slugs are only unique per parent (not per domain), URLs use folder IDs:

- `/domains/:domainSlug/folders/:folderId`

This avoids ambiguity and simplifies routing. The folder name is displayed in the UI breadcrumb from the `path` array in the API response.

## Frontend

### Sidebar changes

Current sidebar shows domains as links. New behavior:

- Each domain has a **chevron toggle** (right side) to expand/collapse.
- Clicking the domain **name** still navigates to DomainPage.
- Expanding a domain loads its folder tree via `GET /api/domains/{domainId}/folders`.
- Folders are displayed as an indented tree with chevrons for folders that have children.
- Clicking a folder name navigates to `/domains/{domainSlug}/folders/{folderId}`.
- Clicking a folder chevron expands/collapses its children.
- Tree state (which domains/folders are expanded) is persisted to localStorage.
- Indentation: 16px per level.
- Only folders the user can read are shown (API filters).

### New component: `FolderTree`

Props: `domainId`, `domainSlug`

- Fetches folder tree on mount (or when domain is expanded).
- Renders recursive `FolderTreeItem` components.
- Manages expand/collapse state locally + localStorage.

### New component: `FolderTreeItem`

Props: `folder`, `depth`, `domainSlug`

- Renders folder name with indentation based on depth.
- Chevron if has children.
- Active state when current route matches.
- Folder icon (Lucide `Folder` / `FolderOpen`).

### New page: `FolderPage`

Route: `/domains/:domainSlug/folders/:folderId`

- Breadcrumb: Home > Domain > Parent Folder > ... > Current Folder (from `path` array)
- Sub-folders displayed as cards/links at the top
- Documents listed below, grouped by document type
- Action buttons based on `user_role` from API:
  - editor+: "New document" button
  - manager: "New sub-folder", "Rename", "Delete", "Permissions" buttons
- Delete button triggers cascade-count fetch, then shows confirmation modal

### New modal: `FolderPermissionsModal`

- Lists current explicit permissions on the folder
- Shows inherited permissions (grayed out, from parent)
- Add user with role picker (reader/editor/manager)
- Remove explicit permission

### New modal: `DeleteFolderModal`

- Shows folder name
- Shows count: "This will delete X sub-folders and Y documents"
- Requires typing the folder name to confirm (destructive action)

### Modified: `Breadcrumb`

- Currently: Home > Domain > Document
- New: Home > Domain > Folder > ... > Document (full folder path)
- The folder path for a document is fetched via the document's `folder_id` → folder detail API

### Modified: `EditorPage`

- Folder picker when creating a new document (required field)
- Dropdown or tree-select showing the folder hierarchy of the selected domain
- When editing, the current folder is pre-selected and can be changed (move)

## Migration strategy

Migration `000013_folders.up.sql`:

1. Create `folder_role` enum type.
2. Create `folders` table with indexes and constraints.
3. Create `folder_permissions` table with indexes.
4. For each existing domain, create a "General" root folder.
5. Add `folder_id` column to `documents` (nullable initially).
6. Set `folder_id` on all existing documents to the "General" folder of their domain.
7. Make `folder_id` NOT NULL.
8. Grant "manager" role on each "General" folder to all users who authored documents in that domain.

Migration `000013_folders.down.sql`:

1. Remove `folder_id` column from `documents`.
2. Drop `folder_permissions` table.
3. Drop `folders` table.
4. Drop `folder_role` enum type.

## Out of scope

- Drag-and-drop reordering in sidebar (can be added later)
- Folder icons/colors customization
- Folder templates
- Bulk move documents between folders
- Folder-level search filtering in Meilisearch
