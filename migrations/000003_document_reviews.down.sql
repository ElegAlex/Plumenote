DROP INDEX IF EXISTS idx_documents_needs_review;
ALTER TABLE documents DROP COLUMN IF EXISTS needs_review;
