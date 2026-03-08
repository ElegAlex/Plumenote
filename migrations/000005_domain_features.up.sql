ALTER TABLE domains ADD COLUMN IF NOT EXISTS features_enabled TEXT[] DEFAULT ARRAY['documents'];

-- Tous les domaines ont au minimum 'documents'
-- L'infrastructure a aussi 'cartography' (besoin sponsor : cartographie serveurs)
UPDATE domains SET features_enabled = ARRAY['documents', 'cartography'] WHERE slug = 'infrastructure';
