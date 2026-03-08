ALTER TABLE documents ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_documents_needs_review ON documents(needs_review) WHERE needs_review = true;
