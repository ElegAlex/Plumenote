-- Remove mindmap feature from all domains
UPDATE domains SET features_enabled = array_remove(features_enabled, 'mindmap');
