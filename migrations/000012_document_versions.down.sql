DELETE FROM config WHERE key = 'max_versions_per_document';
DROP TABLE IF EXISTS document_versions;
