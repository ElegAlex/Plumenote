# Charte de Cadrage — PlumeNote

---

## 1. Contexte & Déclencheur

La DSI dispose de ressources documentaires éparses (procédures Word, cartographies Excel, PDF nationaux, fichiers .txt, liens web, macros VBA) réparties dans des arborescences difficilement exploitables. La recherche Windows est inefficace pour des recherches transversales, la connaissance tacite (notamment au Support Parc) n'est pas formalisée, et l'adoption des documents existants par les utilisateurs internes et la MOA est faible.

Trois initiatives parallèles ont été identifiées à la prise de poste d'Alexandre Berge : un outil Excel/VBA développé par le SCI (Didier Bottaz), une solution BookStack déployée par les Études et Développement (Lilian Hammache), et une réflexion personnelle du responsable de projet. La réunion de lancement du 26 janvier 2026 a acté le besoin de convergence.

**PlumeNote** est la réponse : un outil de Knowledge Management from scratch, état de l'art, inspiré d'Obsidian (graph d'exploration, backlinks, Dataview), Logseq (référencement par blocs, outliner), Linear (UX keyboard-first, réactivité sub-50ms) et Tana (supertags, structuration dynamique). L'objectif n'est pas d'assembler des solutions existantes mais de construire la plateforme idéale couvrant l'ensemble des besoins DSI.

**Déclencheur** : Prise de poste du sponsor, constat de dispersion des initiatives et des formats, absence d'outil à la hauteur de l'ambition KM de la DSI.

---

## 2. Gouvernance

- **Sponsor / Décideur final** : Alexandre Berge
- **Contributeurs techniques clés** : Lilian Hammache (Dev/BookStack), Didier Bottaz (SCI/VBA), Mathieu Messe (Études & Dev)
- **Parties prenantes élargies** : Ensemble de la DSI

---

## 3. Stakeholders

|Partie prenante|Rôle|Intérêt|Influence|
|---|---|---|---|
|Alexandre Berge|Sponsor / Chef de projet|Haut|Haut|
|Mathieu Messe|Responsable Études & Dev|Haut|Haut|
|Lilian Hammache|Développeur (BookStack, scripts import)|Haut|Moyen|
|Didier Bottaz|Développeur (outil SCI Excel/VBA)|Haut|Moyen|
|Mohamed Zemouche|Responsable Infrastructure|Moyen|Moyen|
|Mohamed Diagana|Responsable Support|Moyen|Moyen|
|Christophe Redjil|Responsable SCI|Moyen|Moyen|
|Kevin Brisson|Support (départ prévu)|Moyen|Bas|
|Carine Raffin|Gestion de Parc|Moyen|Bas|
|Fella Ishak|Gestion de Parc / PEI|Moyen|Bas|
|Angélique Thibeaudau|Accueil / Passeport|Bas|Bas|
|Claude Barrere|À préciser|Bas|Bas|
|DFC / MOA / Réseau|Clients internes (consultation)|Haut|Bas|

---

## 4. Périmètre d'investigation

### IN (Ce que nous allons faire)

- Conception et développement from scratch d'une plateforme web de Knowledge Management
- Graphe d'exploration des connaissances avec liens bidirectionnels et backlinks
- Éditeur riche block-based (type Obsidian/Logseq) avec support Markdown
- Recherche transversale full-text sur l'ensemble de la documentation DSI (titres, contenus, métadonnées, tags)
- Import multi-formats : Word (.doc, .docx), PDF, TXT, PPTX, liens URL externes
- Syntaxe tableur intégrée pour absorber une partie des besoins Excel (sans être un tableur complet)
- Gestion des droits : lecture ouverte DSI, modification restreinte par domaine, exclusion des credentials/secrets
- Accès web sans dépendance réseau fichier, utilisable depuis un poste utilisateur lambda (sans compte admin)
- Documentation publique consultable sans compte pour les clients internes (DFC, MOA, réseau)
- Versionnement et historique des modifications
- UX keyboard-first inspirée Linear (Cmd+K, raccourcis, réactivité sub-100ms)
- Self-hosted : aucune donnée ne sort de l'infrastructure locale
- Cartographie applicative et cartographie serveurs intégrées via le graphe de connaissances
- Couverture : documentation technique Infra, Support, SCI, Études & Dev, procédures, architecture

### OUT (Ce que nous ne ferons pas)

- Tableurs Excel de gestion de parc à proprement parler (restent dans leur format natif)
- Fork ou extension de BookStack — PlumeNote est un développement indépendant
- Outil Excel/VBA du SCI — sera rendu obsolète par PlumeNote
- Application Chanel (gouvernance applicative PAL) — projet séparé, complémentaire
- Gestion de tickets / helpdesk
- Messagerie ou chat intégré

### Zones grises (Points d'attention)

- **Formalisation des procédures Support Parc** : nécessaire mais priorisation à définir (pas de documentation existante)
- **Cartographies Excel (applicative, serveurs)** : absorbées dans le graphe PlumeNote ou maintenues en parallèle ? À valider après POC
- **Import automatisé des packages nationaux compressés** : faisabilité technique à confirmer (PDF dans archives, livraison par objet de diffusion)
- **Niveau de segmentation des droits intra-DSI** : consensus actuel = lecture ouverte sauf credentials, mais cas limites à qualifier
- **Coexistence transitoire** : les outils existants (BookStack, outil SCI) continueront de fonctionner pendant la montée en charge de PlumeNote

---

## 5. Contraintes

|Type|Contrainte|Impact|
|---|---|---|
|Budget|Hors sujet (non dimensionnant pour le cadrage)|Pas de contrainte budgétaire identifiée à ce stade|
|Délai|Hors sujet (pas de deadline imposée)|Permet une approche qualité-first sans pression calendaire|
|Techno|**Self-hosted obligatoire** — aucune donnée ne doit sortir de l'infrastructure locale|Exclut tout SaaS. La stack doit être déployable en interne (Docker). Oriente vers des solutions open-source pour chaque brique|
|Techno|Stack optimale à déterminer par exploration approfondie (état de l'art KM 2025-2026)|Piste recommandée : React + TipTap + Yjs (frontend), Go (backend single-binary), PostgreSQL + Apache AGE (base relationnelle + graphe), Meilisearch (recherche), force-graph (visualisation graphe)|
|Techno|Formats hétérogènes à l'import (.doc, .docx, .pdf, .txt, .pptx, .xls, URLs)|Nécessite un pipeline de conversion robuste (Pandoc, mammoth.js, Marker/MinerU pour PDF)|
|Techno|Accès depuis poste utilisateur lambda sans compte admin|Exclut SSO/LDAP comme seul mécanisme d'authentification — nécessite un système d'auth propre et/ou contenus publics|
|Orga|Hors sujet (pas de contrainte RH formalisée)|Les ressources disponibles seront identifiées en phase Discovery|

---

## 6. Existant & Historique

**État actuel :**

- **Outil SCI (Excel/VBA — Didier Bottaz)** : Fichier Excel avec macros et userforms centralisant l'accès aux procédures, fichiers de travail, liens web et macros du SCI. Recherche par mots-clés sur descriptions indexées manuellement. POC fonctionnel démontrant l'adhésion au concept, mais limité par le format Excel (accès concurrent, dépendance réseau, incompatibilité .doc).
- **BookStack (Études & Dev — Lilian Hammache)** : Solution open-source de documentation web en cours de déploiement. Organisation hiérarchique Domaines → Manuels → Pages. Recherche full-text, versionnement, gestion des droits, éditeur WYSIWYG/Markdown, Draw.io intégré, API complète. Script d'import Python/Pandoc pour Word. Destiné initialement aux clients internes (DFC, MOA). Self-hosted. Tests de compatibilité PDF/TXT en cours.
- **Documentation Infrastructure** : Fichiers .txt bruts (bloc-notes) pour les commandes d'installation, choix délibéré pour éviter les caractères parasites au copier-coller. PDF nationaux livrés dans des packages compressés par objet de diffusion. Stockage sur serveur dédié, organisé par type (Linux, Windows…).
- **Documentation Support** : PDF et modes opératoires sur serveur partagé. Pas de recherche transversale, pas de versionnement.
- **Support Parc (Gestion de Parc)** : Absence de documentation procédurale formalisée. Connaissance tacite. Multiplicité de tableaux Excel non centralisés.
- **Application Chanel (PAL)** : Cartographie applicative et gouvernance. Projet complémentaire, bloqué par un problème d'homonymie Passeport/RESSAC. Non concurrent avec PlumeNote.

**Leçons du passé :**

- Pas de tentative formelle échouée antérieure
- Constat d'adoption faible de la documentation Word par les utilisateurs/MOA (trop lourde, pas intuitive)
- Trois initiatives parallèles non coordonnées avant la réunion du 26/01/2026 → risque de dispersion confirmé
- L'ergonomie et l'attractivité visuelle sont des facteurs d'adhésion identifiés comme critiques par les participants

---

## 7. Risques initiaux identifiés

1. **Risque d'adoption (ÉLEVÉ)** : Si l'outil est difficile à alimenter ou visuellement peu attractif, il ne sera pas maintenu et tombera en obsolescence rapide — c'est le risque #1 du KM en entreprise. L'UX doit être irréprochable dès le MVP.
    
2. **Risque de sur-ambition architecturale (ÉLEVÉ)** : Construire from scratch un outil combinant graphe, éditeur block-based, collaboration temps réel, import multi-formats et UX Linear-grade est un projet d'envergure significative. Sans jalonnement rigoureux, le risque d'enlisement est réel.
    
3. **Risque de formats hétérogènes (MOYEN)** : La diversité des formats existants (.doc, .docx, PDF avec caractères spéciaux, .txt, Excel, PPTX, liens, packages compressés nationaux) complexifie le pipeline d'import. Les PDF nationaux avec sommaires non dynamiques et caractères spéciaux sont un point dur identifié.
    
4. **Risque de résistance au changement (MOYEN)** : Les équipes Infrastructure et Support fonctionnent avec leurs outils actuels depuis longtemps. L'Infrastructure a explicitement conditionné son adhésion à la facilité d'alimentation et de modification. Le Support Parc n'a pas de documentation formalisée — la formalisation est un prérequis.
    
5. **Risque de coexistence prolongée (MOYEN)** : BookStack et l'outil SCI continueront à vivre pendant le développement de PlumeNote. Si la transition traîne, les utilisateurs s'ancrent dans les solutions intermédiaires et la migration devient plus difficile.
    
6. **Risque technique self-hosted (BAS)** : Le déploiement et la maintenance d'une stack complète (Go + PostgreSQL/AGE + Meilisearch + Docker) reposent sur les compétences internes de l'Infrastructure. La complexité opérationnelle doit rester minimale (cible : 3 containers Docker, <50 Mo).
    

---

## 8. Critères de succès du cadrage

- [ ] Périmètre fonctionnel validé par le sponsor
- [ ] Stack technique cible identifiée et argumentée (Deep Research réalisée ✅)
- [ ] Contraintes techniques documentées (self-hosted, formats, authentification)
- [ ] Liste des stakeholders exhaustive et rôles clarifiés
- [ ] Risques initiaux identifiés et priorisés
- [ ] Zones grises explicitement listées pour arbitrage en phase Discovery
- [ ] **Go/No-Go pour la phase P1 — Discovery**

---

_Livrable : P0-Cadrage.md — Projet PlumeNote — Version 1.0 — Mars 2026_