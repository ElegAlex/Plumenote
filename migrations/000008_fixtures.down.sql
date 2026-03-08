-- 000008_fixtures.down.sql
-- Suppression des fixtures de démonstration

-- Remettre domain_id à NULL pour l'admin
UPDATE users SET domain_id = NULL WHERE username = 'admin';

-- Remettre needs_review à false sur les documents modifiés
UPDATE documents SET needs_review = false WHERE id IN (
    '96acec5f-6c78-44b3-b4ed-35041ecae729',
    'ceb1ae65-2f12-4965-8be1-4cce335dbc60',
    'e9cd2e36-2577-4736-a180-b455750712d9'
);

-- Remettre last_verified_at à NULL sur les documents modifiés
UPDATE documents SET last_verified_at = NULL, last_verified_by = NULL WHERE id IN (
    'e4494b53-3c5d-4389-9f19-ea890108c46b',
    '51b62e4f-7e6f-4afc-bca8-5f4c23966f5a',
    '5ddcaca1-b7e8-4995-ae4f-a3d1902ecedc',
    'e96719dc-0e8a-44e8-96de-f2697e85ccd4',
    '22f5a5df-6ba2-467a-b20f-d64414188aa5',
    'bcba2316-f80f-4a3f-a84c-d441a5c59360',
    '94036b50-2f0d-4baa-bf03-a1d17074f6ae',
    '35571396-4d2c-400b-8ea2-cd84a29069a9',
    'bfc8afa0-169b-43ef-94e5-1e357c8c2d05'
);

-- Supprimer les vérifications de fraîcheur (fixtures)
DELETE FROM verification_log WHERE id IN (
    'd1000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000003',
    'd1000000-0000-0000-0000-000000000004',
    'd1000000-0000-0000-0000-000000000005',
    'd1000000-0000-0000-0000-000000000010',
    'd1000000-0000-0000-0000-000000000011',
    'd1000000-0000-0000-0000-000000000012',
    'd1000000-0000-0000-0000-000000000013'
);

-- Supprimer les liens fiches ↔ bookmarks (CASCADE depuis entities suffit, mais explicite)
DELETE FROM entity_bookmarks WHERE entity_id IN (
    SELECT id FROM entities WHERE id::text LIKE 'e1000000-0000-0000-0000-%'
);

-- Supprimer les liens fiches ↔ documents
DELETE FROM entity_documents WHERE entity_id IN (
    SELECT id FROM entities WHERE id::text LIKE 'e1000000-0000-0000-0000-%'
);

-- Supprimer les relations entre fiches
DELETE FROM entity_relations WHERE source_id IN (
    SELECT id FROM entities WHERE id::text LIKE 'e1000000-0000-0000-0000-%'
) OR target_id IN (
    SELECT id FROM entities WHERE id::text LIKE 'e1000000-0000-0000-0000-%'
);

-- Supprimer les fiches
DELETE FROM entities WHERE id::text LIKE 'e1000000-0000-0000-0000-%';

-- Supprimer les bookmarks
DELETE FROM bookmarks WHERE id::text LIKE 'b1000000-0000-0000-0000-%';
