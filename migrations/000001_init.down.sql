-- Reverse of 000001_init.up.sql (drop in FK-safe order)
DROP TABLE IF EXISTS view_log;
DROP TABLE IF EXISTS search_log;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS verification_log;
DROP TABLE IF EXISTS document_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS document_types;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS domains;
DROP TABLE IF EXISTS config;
DROP TYPE IF EXISTS doc_visibility;
DROP TYPE IF EXISTS user_role;
