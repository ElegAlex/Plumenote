-- Entity Types (Application, Serveur, Equipement reseau, Contact)
CREATE TABLE IF NOT EXISTS entity_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL DEFAULT '📋',
    schema JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entities (les fiches elles-memes)
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type_id UUID NOT NULL REFERENCES entity_types(id),
    domain_id UUID NOT NULL REFERENCES domains(id),
    name TEXT NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    notes JSONB,
    notes_text TEXT NOT NULL DEFAULT '',
    author_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relation Types (heberge/heberge sur, administre/administre par, etc.)
CREATE TABLE IF NOT EXISTS relation_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    inverse_name TEXT NOT NULL,
    inverse_slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entity Relations
CREATE TABLE IF NOT EXISTS entity_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relation_type_id UUID NOT NULL REFERENCES relation_types(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(source_id, target_id, relation_type_id)
);

-- Entity <-> Document links
CREATE TABLE IF NOT EXISTS entity_documents (
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (entity_id, document_id)
);

-- Entity <-> Bookmark links
CREATE TABLE IF NOT EXISTS entity_bookmarks (
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (entity_id, bookmark_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type_id);
CREATE INDEX IF NOT EXISTS idx_entities_domain ON entities(domain_id);
CREATE INDEX IF NOT EXISTS idx_entities_author ON entities(author_id);
CREATE INDEX IF NOT EXISTS idx_entity_relations_source ON entity_relations(source_id);
CREATE INDEX IF NOT EXISTS idx_entity_relations_target ON entity_relations(target_id);
CREATE INDEX IF NOT EXISTS idx_entity_documents_doc ON entity_documents(document_id);
