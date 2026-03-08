-- Enable mindmap feature on all domains
UPDATE domains SET features_enabled = array_append(features_enabled, 'mindmap')
WHERE NOT ('mindmap' = ANY(features_enabled));
