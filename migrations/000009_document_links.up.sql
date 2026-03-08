CREATE TABLE IF NOT EXISTS document_links (
  source_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_document_links_source ON document_links(source_id);
CREATE INDEX IF NOT EXISTS idx_document_links_target ON document_links(target_id);
