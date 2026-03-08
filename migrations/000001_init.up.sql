-- PlumeNote — Initial Schema Migration
-- All PKs use gen_random_uuid() (UUIDv7 behavior in PG18)

-- Enum types
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('public', 'dsi', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE doc_visibility AS ENUM ('public', 'dsi'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Domains
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6B7280',
    icon TEXT NOT NULL DEFAULT 'folder',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'dsi',
    domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Document types
CREATE TABLE IF NOT EXISTS document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL DEFAULT 'file-text',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Templates
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    content JSONB NOT NULL DEFAULT '{}',
    type_id UUID REFERENCES document_types(id) ON DELETE SET NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    usage_count INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_type_id ON templates(type_id);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    body JSONB NOT NULL DEFAULT '{}',
    body_text TEXT NOT NULL DEFAULT '',
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE RESTRICT,
    type_id UUID NOT NULL REFERENCES document_types(id) ON DELETE RESTRICT,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    visibility doc_visibility NOT NULL DEFAULT 'dsi',
    view_count INT NOT NULL DEFAULT 0,
    last_verified_at TIMESTAMPTZ,
    last_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_domain_id ON documents(domain_id);
CREATE INDEX IF NOT EXISTS idx_documents_type_id ON documents(type_id);
CREATE INDEX IF NOT EXISTS idx_documents_author_id ON documents(author_id);
CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents(visibility);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document-Tag junction
CREATE TABLE IF NOT EXISTS document_tags (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON document_tags(tag_id);

-- Verification log (freshness tracking)
CREATE TABLE IF NOT EXISTS verification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    verified_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_log_document_id ON verification_log(document_id);
CREATE INDEX IF NOT EXISTS idx_verification_log_created_at ON verification_log(created_at DESC);

-- Attachments
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_document_id ON attachments(document_id);

-- Search log (analytics)
CREATE TABLE IF NOT EXISTS search_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    result_count INT NOT NULL DEFAULT 0,
    clicked_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_log_created_at ON search_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_log_user_id ON search_log(user_id);

-- View log (analytics)
CREATE TABLE IF NOT EXISTS view_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    duration_seconds INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_view_log_document_id ON view_log(document_id);
CREATE INDEX IF NOT EXISTS idx_view_log_created_at ON view_log(created_at DESC);

-- Config (key-value store)
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
