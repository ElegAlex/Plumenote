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
