-- 1. Enum type for folder roles
CREATE TYPE folder_role AS ENUM ('reader', 'editor', 'manager');

-- 2. Folders table
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (parent_id != id)
);

-- Slug uniqueness: separate indexes for root vs child (NULL-safe)
CREATE UNIQUE INDEX idx_folders_unique_root
  ON folders(domain_id, slug) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX idx_folders_unique_child
  ON folders(domain_id, parent_id, slug) WHERE parent_id IS NOT NULL;

CREATE INDEX idx_folders_domain ON folders(domain_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);

-- 3. Folder permissions table
CREATE TABLE folder_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role folder_role NOT NULL,
    UNIQUE(folder_id, user_id)
);
CREATE INDEX idx_folder_perms_folder ON folder_permissions(folder_id);
CREATE INDEX idx_folder_perms_user ON folder_permissions(user_id);

-- 4. Add folder_id to documents (nullable initially)
ALTER TABLE documents ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE RESTRICT;

-- 5. Create "General" root folder for each existing domain and backfill
DO $$
DECLARE
    d RECORD;
    folder_uuid UUID;
BEGIN
    FOR d IN SELECT id FROM domains LOOP
        INSERT INTO folders (name, slug, domain_id, position)
        VALUES ('General', 'general', d.id, 0)
        RETURNING id INTO folder_uuid;

        UPDATE documents SET folder_id = folder_uuid WHERE domain_id = d.id;

        -- Grant manager to all authors in this domain
        INSERT INTO folder_permissions (folder_id, user_id, role)
        SELECT DISTINCT folder_uuid, author_id, 'manager'::folder_role
        FROM documents WHERE domain_id = d.id
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- 6. Make folder_id NOT NULL
ALTER TABLE documents ALTER COLUMN folder_id SET NOT NULL;
CREATE INDEX idx_documents_folder ON documents(folder_id);
