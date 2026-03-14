-- Reverse of 000011_templates_cr.up.sql
-- Delete the 4 new templates by slug
DELETE FROM templates WHERE slug IN (
    'compte-rendu-reunion',
    'bilaterale',
    'note-cadrage',
    'dossier-projet'
);

-- Remove slugs from existing templates and drop the column
ALTER TABLE templates DROP COLUMN IF EXISTS slug;
