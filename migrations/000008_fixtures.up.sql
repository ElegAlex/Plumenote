-- 000008_fixtures.up.sql
-- Fixtures de démonstration PlumeNote — DSI CPAM 92
-- Idempotent: ON CONFLICT DO NOTHING partout

-- ============================================================
-- Constantes UUIDs
-- ============================================================
-- Domains:       d0000000-...-000000000001 (SCI), ...002 (Etudes & Dev), ...003 (Infrastructure), ...004 (Support), ...005 (Gouvernance)
-- Entity Types:  f0000000-...-000000000001 (application), ...002 (serveur), ...003 (equipement-reseau), ...004 (contact)
-- Relation Types: c0000000-...-000000000001 (héberge), ...002 (administre), ...003 (utilise), ...004 (connecté à), ...005 (dépend de)
-- User:          a0000000-...-000000000001

-- ============================================================
-- 1. Fiches Applications — SCI
-- ============================================================
INSERT INTO entities (id, entity_type_id, domain_id, name, properties, author_id) VALUES
('e1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
 'ProWeb', '{"editeur":"CNAV","version":"4.2.1","url_acces":"https://proweb.cpam92.local","statut":"production","environnement":"production","responsable":"Christophe Redjil","description":"Gestion des flux de remboursement"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
 'Chorus', '{"editeur":"AIFE","version":"3.8","url_acces":"https://chorus-pro.gouv.fr","statut":"production","environnement":"production","responsable":"Didier Bottaz","description":"Gestion de la facturation publique"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
 'SUCRE', '{"editeur":"CNAM","version":"2.1.0","url_acces":"https://sucre.cpam92.local","statut":"production","environnement":"production","responsable":"Lilian Hammache","description":"Documentation utilisateur applicative"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
 'Passeport', '{"editeur":"CNAM","version":"5.0","url_acces":"https://passeport.cpam92.local","statut":"production","environnement":"production","responsable":"Angélique Thibeaudau","description":"Gestion des habilitations"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
 'GLPI', '{"editeur":"Teclib","version":"10.0.12","url_acces":"https://glpi.cpam92.local","statut":"production","environnement":"production","responsable":"Mohamed Zemouche","description":"Gestion de parc et tickets"}', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. Fiches Applications — Etudes & Dev
-- ============================================================
INSERT INTO entities (id, entity_type_id, domain_id, name, properties, author_id) VALUES
('e1000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
 'BookStack', '{"editeur":"Open Source","version":"24.02","url_acces":"https://bookstack.cpam92.local","statut":"deploiement","environnement":"production","responsable":"Lilian Hammache","description":"Documentation web MOA/DFC (en cours de remplacement par PlumeNote)"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
 'PlumeNote', '{"editeur":"DSI CPAM92","version":"1.0","url_acces":"https://plumenote.cpam92.local","statut":"production","environnement":"production","responsable":"Alexandre Berge","description":"Knowledge Management DSI"}', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Fiches Serveurs — Infrastructure
-- ============================================================
INSERT INTO entities (id, entity_type_id, domain_id, name, properties, author_id) VALUES
('e1000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003',
 'SRV-PROD-01', '{"hostname":"SRV-PROD-01","os":"linux","ip":"10.92.1.10","ram":"16 Go","statut":"actif","environnement":"production","localisation":"Salle serveur A - Baie 3","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003',
 'SRV-PROD-02', '{"hostname":"SRV-PROD-02","os":"linux","ip":"10.92.1.11","ram":"16 Go","statut":"actif","environnement":"production","localisation":"Salle serveur A - Baie 3","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003',
 'SRV-BDD-01', '{"hostname":"SRV-BDD-01","os":"linux","ip":"10.92.1.20","ram":"32 Go","statut":"actif","environnement":"production","localisation":"Salle serveur A - Baie 5","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003',
 'SRV-BDD-02', '{"hostname":"SRV-BDD-02","os":"linux","ip":"10.92.1.21","ram":"16 Go","statut":"actif","environnement":"production","localisation":"Salle serveur A - Baie 5","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003',
 'SRV-WEB-01', '{"hostname":"SRV-WEB-01","os":"linux","ip":"10.92.1.30","ram":"4 Go","statut":"actif","environnement":"production","localisation":"Salle serveur A - Baie 1","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000015', 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003',
 'SRV-AD-01', '{"hostname":"SRV-AD-01","os":"windows","ip":"10.92.2.10","ram":"8 Go","statut":"actif","environnement":"production","localisation":"Salle serveur B - Baie 1","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000016', 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003',
 'SRV-FILE-01', '{"hostname":"SRV-FILE-01","os":"windows","ip":"10.92.2.20","ram":"8 Go","statut":"actif","environnement":"production","localisation":"Salle serveur B - Baie 2","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000017', 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003',
 'SRV-GLPI-01', '{"hostname":"SRV-GLPI-01","os":"linux","ip":"10.92.1.40","ram":"8 Go","statut":"actif","environnement":"production","localisation":"Salle serveur A - Baie 4","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000018', 'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003',
 'SRV-LEGACY-01', '{"hostname":"SRV-LEGACY-01","os":"windows","ip":"10.92.2.30","ram":"4 Go","statut":"maintenance","environnement":"production","localisation":"Salle serveur B - Baie 3","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Fiches Équipement réseau — Infrastructure
-- ============================================================
INSERT INTO entities (id, entity_type_id, domain_id, name, properties, author_id) VALUES
('e1000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003',
 'SW-CORE-01', '{"type_equipement":"switch","ip":"10.92.0.1","localisation":"Salle serveur A - Armoire réseau","statut":"actif","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000021', 'f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003',
 'SW-CORE-02', '{"type_equipement":"switch","ip":"10.92.0.2","localisation":"Salle serveur B - Armoire réseau","statut":"actif","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000022', 'f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003',
 'FW-EDGE-01', '{"type_equipement":"firewall","ip":"10.92.0.254","localisation":"Salle serveur A - Tête de rack","statut":"actif","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000023', 'f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003',
 'AP-WIFI-RDC', '{"type_equipement":"wifi","ip":"10.92.3.10","localisation":"Bâtiment principal - RDC","statut":"actif","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000024', 'f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003',
 'AP-WIFI-R1', '{"type_equipement":"wifi","ip":"10.92.3.11","localisation":"Bâtiment principal - R+1","statut":"actif","responsable":"Mohamed Zemouche"}', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. Fiches Contacts
-- ============================================================
INSERT INTO entities (id, entity_type_id, domain_id, name, properties, author_id) VALUES
('e1000000-0000-0000-0000-000000000030', 'f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000005',
 'Alexandre Berge', '{"fonction":"DSI - Responsable","service":"Direction","email":"a.berge@cpam92.fr","role_si":"administrateur"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',
 'Christophe Redjil', '{"fonction":"Responsable SCI","service":"SCI","email":"c.redjil@cpam92.fr","role_si":"referent"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000032', 'f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',
 'Didier Bottaz', '{"fonction":"Technicien référent SCI","service":"SCI","email":"d.bottaz@cpam92.fr","role_si":"referent"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000033', 'f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002',
 'Lilian Hammache', '{"fonction":"Développeur Études & Dev","service":"Études","email":"l.hammache@cpam92.fr","role_si":"administrateur"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000034', 'f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002',
 'Mathieu Messe', '{"fonction":"Responsable Études & Dev / R&D","service":"Études","email":"m.messe@cpam92.fr","role_si":"referent"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000035', 'f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003',
 'Mohamed Zemouche', '{"fonction":"Référent Infrastructure","service":"Infra","email":"m.zemouche@cpam92.fr","role_si":"administrateur"}', 'a0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000036', 'f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004',
 'Mohamed Diagana', '{"fonction":"Responsable Support","service":"Support","email":"m.diagana@cpam92.fr","role_si":"referent"}', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. Relations — Hébergement (serveur héberge application)
-- ============================================================
INSERT INTO entity_relations (source_id, target_id, relation_type_id) VALUES
-- SRV-PROD-01 héberge ProWeb, Chorus
('e1000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001'),
-- SRV-PROD-02 héberge SUCRE, Passeport
('e1000000-0000-0000-0000-000000000011', 'e1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000011', 'e1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001'),
-- SRV-BDD-01 héberge ProWeb (base Oracle)
('e1000000-0000-0000-0000-000000000012', 'e1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
-- SRV-BDD-02 héberge PlumeNote, BookStack (base PostgreSQL)
('e1000000-0000-0000-0000-000000000013', 'e1000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000013', 'e1000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001'),
-- SRV-WEB-01 héberge PlumeNote, BookStack (reverse proxy)
('e1000000-0000-0000-0000-000000000014', 'e1000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000014', 'e1000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001'),
-- SRV-GLPI-01 héberge GLPI
('e1000000-0000-0000-0000-000000000017', 'e1000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001'),
-- SRV-LEGACY-01 héberge Chorus (instance legacy)
('e1000000-0000-0000-0000-000000000018', 'e1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6b. Relations — Dépendances
-- ============================================================
INSERT INTO entity_relations (source_id, target_id, relation_type_id) VALUES
-- ProWeb dépend_de Passeport (habilitations)
('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005'),
-- SUCRE dépend_de BookStack (documentation)
('e1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000005'),
-- PlumeNote dépend_de SRV-BDD-02 (base de données)
('e1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000005'),
-- PlumeNote dépend_de SRV-WEB-01 (reverse proxy)
('e1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6c. Relations — Réseau (connecté_à)
-- ============================================================
INSERT INTO entity_relations (source_id, target_id, relation_type_id) VALUES
-- SW-CORE-01 connecté_à serveurs salle A
('e1000000-0000-0000-0000-000000000020', 'e1000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000004'),
('e1000000-0000-0000-0000-000000000020', 'e1000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000004'),
('e1000000-0000-0000-0000-000000000020', 'e1000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000004'),
('e1000000-0000-0000-0000-000000000020', 'e1000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000004'),
('e1000000-0000-0000-0000-000000000020', 'e1000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000004'),
-- SW-CORE-02 connecté_à serveurs salle B
('e1000000-0000-0000-0000-000000000021', 'e1000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000004'),
('e1000000-0000-0000-0000-000000000021', 'e1000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000004'),
('e1000000-0000-0000-0000-000000000021', 'e1000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000004'),
-- Firewall connecté aux deux switches
('e1000000-0000-0000-0000-000000000020', 'e1000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000004'),
('e1000000-0000-0000-0000-000000000021', 'e1000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000004'),
-- Interconnexion switches
('e1000000-0000-0000-0000-000000000020', 'e1000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6d. Relations — Administration (contact administre)
-- ============================================================
INSERT INTO entity_relations (source_id, target_id, relation_type_id) VALUES
-- Mohamed Zemouche administre serveurs + firewall
('e1000000-0000-0000-0000-000000000035', 'e1000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000002'),
('e1000000-0000-0000-0000-000000000035', 'e1000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002'),
('e1000000-0000-0000-0000-000000000035', 'e1000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000002'),
('e1000000-0000-0000-0000-000000000035', 'e1000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000002'),
('e1000000-0000-0000-0000-000000000035', 'e1000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000002'),
('e1000000-0000-0000-0000-000000000035', 'e1000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000002'),
-- Christophe Redjil administre ProWeb, Chorus
('e1000000-0000-0000-0000-000000000031', 'e1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002'),
('e1000000-0000-0000-0000-000000000031', 'e1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002'),
-- Lilian Hammache administre BookStack, PlumeNote
('e1000000-0000-0000-0000-000000000033', 'e1000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002'),
('e1000000-0000-0000-0000-000000000033', 'e1000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000002'),
-- Alexandre Berge administre PlumeNote
('e1000000-0000-0000-0000-000000000030', 'e1000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. Bookmarks
-- ============================================================
INSERT INTO bookmarks (id, title, url, description, domain_id, author_id) VALUES
('b1000000-0000-0000-0000-000000000001', 'Ameli Réseau — Documentation ProWeb', 'https://amelireseau.ameli.fr/proweb/documentation', 'Documentation nationale ProWeb sur Ameli Réseau', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
('b1000000-0000-0000-0000-000000000002', 'Ameli Réseau — Portail général', 'https://amelireseau.ameli.fr', 'Portail principal Ameli Réseau', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
('b1000000-0000-0000-0000-000000000003', 'Chorus Pro — Guide utilisateur', 'https://chorus-pro.gouv.fr/documentation', 'Documentation Chorus Pro nationale', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
('b1000000-0000-0000-0000-000000000004', 'CNAM — Espace technique', 'https://technique.cnam.fr', 'Portail technique national CNAM', 'd0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001'),
('b1000000-0000-0000-0000-000000000005', 'CNAM — Objets de diffusion', 'https://technique.cnam.fr/od', 'Catalogue des OD nationaux', 'd0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001'),
('b1000000-0000-0000-0000-000000000006', 'ANSSI — MonServiceSécurisé', 'https://monservicesecurise.cyber.gouv.fr', 'Outil d''homologation RGS', 'd0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001'),
('b1000000-0000-0000-0000-000000000007', 'GLPI — Documentation officielle', 'https://glpi-project.org/documentation', 'Documentation officielle GLPI', 'd0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001'),
('b1000000-0000-0000-0000-000000000008', 'TipTap — Documentation', 'https://tiptap.dev/docs', 'Documentation éditeur TipTap', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
('b1000000-0000-0000-0000-000000000009', 'Meilisearch — Documentation', 'https://docs.meilisearch.com', 'Documentation moteur de recherche', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. Liens fiches ↔ documents existants
-- ============================================================
INSERT INTO entity_documents (entity_id, document_id) VALUES
-- ProWeb ← "Installation ProWeb v4.2", "ProWeb", "Configuration SCI poste agent"
('e1000000-0000-0000-0000-000000000001', 'e4494b53-3c5d-4389-9f19-ea890108c46b'),
('e1000000-0000-0000-0000-000000000001', '51b62e4f-7e6f-4afc-bca8-5f4c23966f5a'),
('e1000000-0000-0000-0000-000000000001', 'e9cd2e36-2577-4736-a180-b455750712d9'),
-- SUCRE ← "SUCRE", "Architecture SUCRE schema global"
('e1000000-0000-0000-0000-000000000003', '5ddcaca1-b7e8-4995-ae4f-a3d1902ecedc'),
('e1000000-0000-0000-0000-000000000003', 'bcba2316-f80f-4a3f-a84c-d441a5c59360'),
-- BookStack ← "BookStack", "Documentation API BookStack"
('e1000000-0000-0000-0000-000000000006', 'e96719dc-0e8a-44e8-96de-f2697e85ccd4'),
('e1000000-0000-0000-0000-000000000006', '94036b50-2f0d-4baa-bf03-a1d17074f6ae'),
-- GLPI ← "FAQ support poste de travail"
('e1000000-0000-0000-0000-000000000005', '22f5a5df-6ba2-467a-b20f-d64414188aa5'),
-- SRV-PROD-01 ← "Deploiement serveur Linux", "Cartographie serveurs IDF"
('e1000000-0000-0000-0000-000000000010', '35571396-4d2c-400b-8ea2-cd84a29069a9'),
('e1000000-0000-0000-0000-000000000010', 'bfc8afa0-169b-43ef-94e5-1e357c8c2d05'),
-- SRV-PROD-02 ← "Deploiement serveur Linux", "Cartographie serveurs IDF"
('e1000000-0000-0000-0000-000000000011', '35571396-4d2c-400b-8ea2-cd84a29069a9'),
('e1000000-0000-0000-0000-000000000011', 'bfc8afa0-169b-43ef-94e5-1e357c8c2d05'),
-- FW-EDGE-01 ← "Configuration VPN acces distant"
('e1000000-0000-0000-0000-000000000022', '96acec5f-6c78-44b3-b4ed-35041ecae729'),
-- SW-CORE-01 ← "Mode operatoire ticket N2 reseau"
('e1000000-0000-0000-0000-000000000020', 'ceb1ae65-2f12-4965-8be1-4cce335dbc60')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. Liens fiches ↔ bookmarks
-- ============================================================
INSERT INTO entity_bookmarks (entity_id, bookmark_id) VALUES
-- ProWeb ← Ameli Réseau doc + portail
('e1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001'),
('e1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002'),
-- Chorus ← Chorus Pro guide
('e1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003'),
-- GLPI ← GLPI doc
('e1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000007'),
-- PlumeNote ← TipTap + Meilisearch
('e1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000008'),
('e1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000009')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. Vérifications de fraîcheur
-- ============================================================
-- Badge vert : vérifiés récemment (il y a 2-3 jours)
INSERT INTO verification_log (id, document_id, verified_by, note, created_at) VALUES
('d1000000-0000-0000-0000-000000000001', 'e4494b53-3c5d-4389-9f19-ea890108c46b', 'a0000000-0000-0000-0000-000000000001', 'Procédure à jour après mise à jour ProWeb 4.2.1', now() - interval '2 days'),
('d1000000-0000-0000-0000-000000000002', '51b62e4f-7e6f-4afc-bca8-5f4c23966f5a', 'a0000000-0000-0000-0000-000000000001', 'Contenu vérifié, RAS', now() - interval '3 days'),
('d1000000-0000-0000-0000-000000000003', '5ddcaca1-b7e8-4995-ae4f-a3d1902ecedc', 'a0000000-0000-0000-0000-000000000001', 'Vérifié après déploiement SUCRE 2.1', now() - interval '1 day'),
('d1000000-0000-0000-0000-000000000004', 'e96719dc-0e8a-44e8-96de-f2697e85ccd4', 'a0000000-0000-0000-0000-000000000001', 'Doc BookStack à jour', now() - interval '5 days'),
('d1000000-0000-0000-0000-000000000005', '22f5a5df-6ba2-467a-b20f-d64414188aa5', 'a0000000-0000-0000-0000-000000000001', 'FAQ vérifiée, ajout entrée imprimante', now() - interval '4 days')
ON CONFLICT DO NOTHING;

-- Badge jaune : vérifiés il y a ~100 jours
INSERT INTO verification_log (id, document_id, verified_by, note, created_at) VALUES
('d1000000-0000-0000-0000-000000000010', 'bcba2316-f80f-4a3f-a84c-d441a5c59360', 'a0000000-0000-0000-0000-000000000001', 'Architecture SUCRE conforme au schéma national', now() - interval '100 days'),
('d1000000-0000-0000-0000-000000000011', '94036b50-2f0d-4baa-bf03-a1d17074f6ae', 'a0000000-0000-0000-0000-000000000001', 'API BookStack stable, doc OK', now() - interval '95 days'),
('d1000000-0000-0000-0000-000000000012', '35571396-4d2c-400b-8ea2-cd84a29069a9', 'a0000000-0000-0000-0000-000000000001', 'Procédure Linux vérifiée', now() - interval '110 days'),
('d1000000-0000-0000-0000-000000000013', 'bfc8afa0-169b-43ef-94e5-1e357c8c2d05', 'a0000000-0000-0000-0000-000000000001', 'Cartographie à jour pour IDF', now() - interval '105 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10b. Mettre à jour last_verified_at sur les documents
-- (le endpoint /api/stats/health utilise documents.last_verified_at, pas verification_log)
-- ============================================================
-- Badge vert : vérifiés récemment
UPDATE documents SET last_verified_at = now() - interval '2 days',  last_verified_by = 'a0000000-0000-0000-0000-000000000001' WHERE id = 'e4494b53-3c5d-4389-9f19-ea890108c46b' AND last_verified_at IS NULL;
UPDATE documents SET last_verified_at = now() - interval '3 days',  last_verified_by = 'a0000000-0000-0000-0000-000000000001' WHERE id = '51b62e4f-7e6f-4afc-bca8-5f4c23966f5a' AND last_verified_at IS NULL;
UPDATE documents SET last_verified_at = now() - interval '1 day',   last_verified_by = 'a0000000-0000-0000-0000-000000000001' WHERE id = '5ddcaca1-b7e8-4995-ae4f-a3d1902ecedc' AND last_verified_at IS NULL;
UPDATE documents SET last_verified_at = now() - interval '5 days',  last_verified_by = 'a0000000-0000-0000-0000-000000000001' WHERE id = 'e96719dc-0e8a-44e8-96de-f2697e85ccd4' AND last_verified_at IS NULL;
UPDATE documents SET last_verified_at = now() - interval '4 days',  last_verified_by = 'a0000000-0000-0000-0000-000000000001' WHERE id = '22f5a5df-6ba2-467a-b20f-d64414188aa5' AND last_verified_at IS NULL;

-- Badge jaune : vérifiés il y a ~100 jours
UPDATE documents SET last_verified_at = now() - interval '100 days', last_verified_by = 'a0000000-0000-0000-0000-000000000001' WHERE id = 'bcba2316-f80f-4a3f-a84c-d441a5c59360' AND last_verified_at IS NULL;
UPDATE documents SET last_verified_at = now() - interval '95 days',  last_verified_by = 'a0000000-0000-0000-0000-000000000001' WHERE id = '94036b50-2f0d-4baa-bf03-a1d17074f6ae' AND last_verified_at IS NULL;
UPDATE documents SET last_verified_at = now() - interval '110 days', last_verified_by = 'a0000000-0000-0000-0000-000000000001' WHERE id = '35571396-4d2c-400b-8ea2-cd84a29069a9' AND last_verified_at IS NULL;
UPDATE documents SET last_verified_at = now() - interval '105 days', last_verified_by = 'a0000000-0000-0000-0000-000000000001' WHERE id = 'bfc8afa0-169b-43ef-94e5-1e357c8c2d05' AND last_verified_at IS NULL;

-- ============================================================
-- 10c. Assigner un domaine à l'admin (pour JWT cohérent)
-- ============================================================
UPDATE users SET domain_id = (SELECT id FROM domains WHERE slug = 'sci') WHERE username = 'admin' AND domain_id IS NULL;

-- ============================================================
-- 10d. Marquer des documents "à réviser" (needs_review = true)
-- pour peupler le panel "À RÉVISER" de la HomePage
-- ============================================================
-- Les 3 documents jamais vérifiés (badge rouge) → à réviser
UPDATE documents SET needs_review = true WHERE id = '96acec5f-6c78-44b3-b4ed-35041ecae729'; -- Configuration VPN
UPDATE documents SET needs_review = true WHERE id = 'ceb1ae65-2f12-4965-8be1-4cce335dbc60'; -- Mode opératoire ticket N2
UPDATE documents SET needs_review = true WHERE id = 'e9cd2e36-2577-4736-a180-b455750712d9'; -- Configuration SCI poste agent
