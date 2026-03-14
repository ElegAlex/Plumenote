DROP INDEX IF EXISTS idx_documents_folder;
ALTER TABLE documents DROP COLUMN IF EXISTS folder_id;
DROP TABLE IF EXISTS folder_permissions;
DROP TABLE IF EXISTS folders;
DROP TYPE IF EXISTS folder_role;
