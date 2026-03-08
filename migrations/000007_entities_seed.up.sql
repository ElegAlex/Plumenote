-- Seed entity types
INSERT INTO entity_types (id, name, slug, icon, schema) VALUES
('f0000000-0000-0000-0000-000000000001', 'Application', 'application', '🖥️', '[
  {"name":"editeur","label":"Éditeur","type":"text","required":false},
  {"name":"version","label":"Version","type":"text","required":false},
  {"name":"url_acces","label":"URL d''accès","type":"url","required":false},
  {"name":"statut","label":"Statut","type":"select","required":true,"options":["production","deploiement","fin_de_vie","hors_service"]},
  {"name":"environnement","label":"Environnement","type":"select","required":false,"options":["production","preprod","recette","dev"]},
  {"name":"responsable","label":"Responsable DSI","type":"text","required":false},
  {"name":"contact_n2","label":"Contact support N2","type":"text","required":false},
  {"name":"description","label":"Description fonctionnelle","type":"textarea","required":false},
  {"name":"habilitations","label":"Habilitations","type":"textarea","required":false}
]'),
('f0000000-0000-0000-0000-000000000002', 'Serveur', 'serveur', '🖧', '[
  {"name":"hostname","label":"Hostname","type":"text","required":true},
  {"name":"os","label":"Système d''exploitation","type":"text","required":false},
  {"name":"ip","label":"Adresse IP","type":"text","required":false},
  {"name":"ram","label":"RAM","type":"text","required":false},
  {"name":"cpu","label":"CPU","type":"text","required":false},
  {"name":"stockage","label":"Stockage","type":"text","required":false},
  {"name":"environnement","label":"Environnement","type":"select","required":false,"options":["production","preprod","recette","dev"]},
  {"name":"localisation","label":"Localisation","type":"text","required":false},
  {"name":"statut","label":"Statut","type":"select","required":true,"options":["actif","maintenance","hors_service"]},
  {"name":"responsable","label":"Responsable","type":"text","required":false}
]'),
('f0000000-0000-0000-0000-000000000003', 'Équipement réseau', 'equipement-reseau', '🔌', '[
  {"name":"type_equipement","label":"Type","type":"select","required":true,"options":["switch","routeur","firewall","load_balancer","wifi","autre"]},
  {"name":"modele","label":"Modèle","type":"text","required":false},
  {"name":"ip","label":"Adresse IP","type":"text","required":false},
  {"name":"localisation","label":"Localisation","type":"text","required":false},
  {"name":"statut","label":"Statut","type":"select","required":true,"options":["actif","maintenance","hors_service"]},
  {"name":"vlan","label":"VLAN","type":"text","required":false},
  {"name":"responsable","label":"Responsable","type":"text","required":false}
]'),
('f0000000-0000-0000-0000-000000000004', 'Contact', 'contact', '👤', '[
  {"name":"fonction","label":"Fonction","type":"text","required":false},
  {"name":"service","label":"Service/Équipe","type":"text","required":false},
  {"name":"email","label":"Email","type":"text","required":false},
  {"name":"telephone","label":"Téléphone","type":"text","required":false},
  {"name":"role_si","label":"Rôle SI","type":"select","required":false,"options":["administrateur","referent","utilisateur_cle","prestataire"]}
]')
ON CONFLICT (id) DO NOTHING;

-- Seed relation types
INSERT INTO relation_types (id, name, slug, inverse_name, inverse_slug) VALUES
('c0000000-0000-0000-0000-000000000001', 'héberge', 'heberge', 'hébergé sur', 'heberge_sur'),
('c0000000-0000-0000-0000-000000000002', 'administre', 'administre', 'administré par', 'administre_par'),
('c0000000-0000-0000-0000-000000000003', 'utilise', 'utilise', 'utilisé par', 'utilise_par'),
('c0000000-0000-0000-0000-000000000004', 'connecté à', 'connecte_a', 'connecté à', 'connecte_a_inv'),
('c0000000-0000-0000-0000-000000000005', 'dépend de', 'depend_de', 'requis par', 'requis_par')
ON CONFLICT (id) DO NOTHING;

-- Enable entities feature on all domains
UPDATE domains SET features_enabled = array_append(features_enabled, 'entities')
WHERE NOT ('entities' = ANY(features_enabled));

-- Config entry
INSERT INTO config (key, value) VALUES ('entity_label', 'Fiche') ON CONFLICT (key) DO NOTHING;
