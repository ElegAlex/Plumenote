━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 PLAN D'IMPLÉMENTATION (ROADMAP) — PlumeNote
Basé sur : P4.1 (Backlog 48 US) · P4.2 (Blueprint v3.0) · P4.3 (GO CONDITIONNEL)
Hypothèse équipe : 2 Devs (Alexandre fullstack/back + Lilian front React) + 1 contributeur ponctuel (Mathieu back Go)
Durée estimée MVP : 8 Sprints (~17 semaines, dont Sprint 0 + Buffer) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## 0. Hypothèses Structurantes

**Équipe** : Le P0 ne formalise pas la taille de l'équipe. L'ADR-001 mentionne "1 développeur principal (Alexandre + Claude AI)". Lilian Hammache est identifié comme compétent React (BookStack, scripts Python). Mathieu Messe est responsable Études & Dev (potentiel Go). **Hypothèse retenue : 2 développeurs effectifs (Alexandre lead back Go + Lilian front React), Mathieu en renfort ponctuel.** Alexandre conserve le rôle PO/Sponsor en parallèle.

**Vélocité estimée** : Sprint 1 sera lent (onboarding stack, TipTap 3 learning curve). Capacité cible : ~6-8 US/sprint à partir du Sprint 3. Sprint 1-2 : ~4-5 US/sprint.

**Cadence** : Sprints de 2 semaines. Review + Rétro le vendredi de fin de sprint. Déploiement continu sur staging dès Sprint 1.

**Pré-requis P4.3** : Le GO CONDITIONNEL exige l'exécution des 3 tests P2.2 AVANT le développement. Le Sprint 0 + Sprint 1 absorbent le **spike technique** (Test #1). Le **concierge MVP contenu** (Test #3 — 20 fiches) se fait EN PARALLÈLE par les contributeurs métier (Didier, Mohamed). La **démo interne** (Test #2) clôture le Sprint 1.

---

## 1. Sizing des Epics (Estimation Macro T-Shirt)

|Epic|Domaine|Nb US|Taille|Justification|
|---|---|---|---|---|
|**EPIC-01**|Recherche & Navigation|7|**L**|Intégration Meilisearch, debounce, highlighting, filtres. Cœur du produit.|
|**EPIC-02**|Authentification & Accès|6|**M**|JWT + bcrypt, 3 niveaux permissions, vue publique. Pattern classique mais critique.|
|**EPIC-03**|Lecture & Consultation|7|**M**|TipTap read-only, sommaire auto, breadcrumb, copie code. Dépend de l'éditeur.|
|**EPIC-04**|Éditeur & Contribution|14|**XL**|TipTap 3 éditeur complet : WYSIWYG, Markdown, slash commands, images, tableaux, liens internes. Epic la plus lourde.|
|**EPIC-05**|Signaux de Fraîcheur|2|**S**|Calcul temporel simple + 1 bouton. Mais transversal (affiché partout).|
|**EPIC-06**|Organisation du Contenu|2|**S**|2 vues simples (domaines + récents).|
|**EPIC-07**|Import du Patrimoine|3|**L**|Pipeline Pandoc + pdftotext + TXT. Complexité format, pas volume.|
|**EPIC-08**|Administration & Templates|5|**M**|CRUD admin classique + seeding 10 templates.|
|**EPIC-09**|Analytics & Mesure|3|**S**|Logs SQL + compteur. Pas de dashboard au MVP.|

**Total : 48 US MUST HAVE · ~17 semaines**

---

## 2. Pré-requis & Sprint 0 (Setup) — Semaine 1

> _Tout ce qui doit être prêt AVANT de coder la première US._

**Durée : 1 semaine (pas un sprint complet)**

- 🛠 **Infra & Repo** :
    
    - [ ] Créer le repo Git `plumenote` (structure monorepo : `/cmd`, `/internal`, `/web`, `/migrations`, `/docker`)
    - [ ] Configurer Docker Compose : 4 containers (plumenote-app, plumenote-db PG18, plumenote-search Meilisearch CE, plumenote-caddy)
    - [ ] `docker compose up -d` → les 4 containers démarrent sans erreur
    - [ ] Configurer le Makefile (`make build`, `make dev`, `make deploy`)
    - [ ] Provisionner la VM interne CPAM92 (demande à Mohamed Zemouche / Infra)
- 🔑 **Accès & Comptes** :
    
    - [ ] Certificats TLS internes pour `plumenote.cpam92.local` (ou auto-signés Caddy)
    - [ ] Accès Git pour Lilian et Mathieu
    - [ ] Installer Pandoc 3 sur l'image Docker (pipeline import)
- 📐 **Design & Outillage** :
    
    - [ ] Initialiser le projet React 19 + Vite 7 + Tailwind 4 + shadcn/ui
    - [ ] Initialiser le binaire Go 1.24 avec Chi v5
    - [ ] Créer le fichier `migrations/001_init.sql` (schéma complet P4.2 : 11 tables)
    - [ ] Créer le fichier `migrations/002_seed.sql` (4 domaines, 10 types, 10 templates, 1 admin)
- ✅ **Definition of Done Sprint 0** :
    
    - [ ] `docker compose up -d` démarre les 4 containers
    - [ ] `curl https://plumenote.cpam92.local` → réponse Caddy
    - [ ] PostgreSQL 18 accessible, schéma migré, seed injecté
    - [ ] Meilisearch CE accessible (`/health` → OK)
    - [ ] React dev server fonctionne (`make dev`)

---

## 3. Stratégie de Découpage (Sprints)

---

### 🏃 Sprint 1 : Le "Walking Skeleton" — Semaines 2-3

> **Objectif : Prouver que la stack P4.2 fonctionne de bout en bout.** _C'est le spike technique P2.2 Test #1. Si ça échoue → pivot fork Docmost (ADR-001)._

**Focus** : Un flux complet Front → API → DB → Meilisearch → Front. Une page créée, sauvegardée, indexée, retrouvée par recherche. C'est la preuve d'architecture.

- [ ] **SPIKE** : Assemblage Go 1.24 + React 19 + TipTap 3 + PG18 + Meilisearch CE
- [ ] **US-201** : Se connecter avec un compte local (auth JWT — le minimum pour sécuriser les appels API)
- [ ] **US-401** : Créer une nouvelle page vierge (TipTap 3 éditeur basique — titre + corps texte seulement)
- [ ] **US-412** : Sauvegarder et publier (Ctrl+S → POST /api/documents → PG18 JSONB → indexation Meilisearch async)
- [ ] **US-102** : Recherche full-text as-you-type (GET /api/search → Meilisearch → résultats JSON)
- [ ] Setup CI/CD : `make build` → binary Go + bundle React. `make deploy` → docker compose up sur staging.

**⚠️ Ce qui n'est PAS dans ce sprint** : barre d'outils complète, templates, permissions, filtres, badges fraîcheur. Juste le flux end-to-end minimal.

**Gate Sprint 1** : Recherche "config vpn" retourne un document créé avec TipTap 3 en <3 secondes. Si OUI → GO. Si NON → analyse root cause ou pivot Docmost.

**🎯 Démo interne (P2.2 Test #2)** : En fin de Sprint 1, présentation 30 min à Lilian, Didier, Mathieu, Mohamed. Objectif : ≥3/4 engagés.

---

### 🏃 Sprint 2 : Authentification & Lecture — Semaines 4-5

> **Objectif : Sécuriser les accès et rendre le contenu lisible correctement.**

**Focus** : Le modèle de permissions 3 niveaux fonctionne. La vue lecture est professionnelle. Sophie peut consulter sans login.

- [ ] **US-202** : Accès public sans login (vue Sophie — filtre automatique `visibility='public'`, RG-006)
- [ ] **US-203** : Page d'accueil personnalisée après connexion (dashboard Didier)
- [ ] **US-205** : Se déconnecter (invalidation token, redirect)
- [ ] **US-206** : Changer son mot de passe (profil utilisateur)
- [ ] **US-301** : Lire un document avec sommaire latéral auto-généré (TipTap read-only + extraction H2)
- [ ] **US-303** : Coloration syntaxique en lecture (Shiki via TipTap 3)
- [ ] **US-302** : Copier un bloc de code en 1 clic
- [ ] **US-305** : Breadcrumb de navigation (Domaine > Type > Document)

**Gate Sprint 2** : Un utilisateur DSI se connecte, voit son dashboard, ouvre un document avec sommaire et code coloré. Sophie accède en anonyme et ne voit que le contenu public.

---

### 🏃 Sprint 3 : Recherche Complète & Éditeur Core — Semaines 6-7

> **Objectif : La recherche est production-ready. L'éditeur gère les formats essentiels.**

**Focus** : Livrer la valeur principale — EPIC-01 complet + l'éditeur TipTap riche.

- [ ] **US-101** : Modale de recherche Ctrl+K (ouverture/fermeture, focus)
- [ ] **US-103** : Tolérance fautes de frappe (configuration Meilisearch typo)
- [ ] **US-104** : Métadonnées de confiance dans les résultats (badge fraîcheur, domaine, auteur, vues, highlighting)
- [ ] **US-105** : Navigation clavier dans les résultats (↑↓ + Entrée)
- [ ] **US-106** : Message "aucun résultat" + CTA "Créer cette page"
- [ ] **US-107** : Filtres par domaine et par type (facets Meilisearch `filterableAttributes`)
- [ ] **US-403** : Barre d'outils WYSIWYG (B, I, H1, H2, listes, code, lien, alerte)
- [ ] **US-404** : Markdown natif auto-conversion (TipTap InputRules)

**Gate Sprint 3** : Didier tape Ctrl+K, cherche "confg vpn" (typo), trouve le bon document, navigue au clavier, filtre par domaine SCI. Didier crée un document avec formatage riche.

---

### 🏃 Sprint 4 : Éditeur Complet & Fraîcheur — Semaines 8-9

> **Objectif : L'éditeur est feature-complete. Le "Secret Sauce" fraîcheur est en place.**

**Focus** : Toutes les US éditeur restantes + les signaux de fraîcheur (le différenciateur P3.2).

- [ ] **US-405** : Blocs de code avec coloration syntaxique dans l'éditeur
- [ ] **US-406** : Menu commande slash (/) pour insertion de blocs
- [ ] **US-407** : Insertion et affichage d'images (upload + drag & drop)
- [ ] **US-408** : Blocs d'alerte/astuce (💡 Astuce, ⚠️ Attention, 🔴 Danger)
- [ ] **US-409** : Insertion de tableaux (édition cellules, ajout lignes/colonnes)
- [ ] **US-410** : Liens internes entre documents (`[[` auto-complétion)
- [ ] **US-411** : Tags avec auto-complétion
- [ ] **US-413** : Modifier un document existant (basculement lecture → édition)
- [ ] **US-414** : Supprimer un document (confirmation, impact index + liens)
- [ ] **US-501** : Badge de fraîcheur (🟢/🟡/🔴 calculé sur `last_verified_at`, seuils RG-004)
- [ ] **US-502** : Marquer comme vérifié en 1 clic

**Gate Sprint 4** : Didier crée un document complet avec code, images, tableaux, liens internes, tags. Le badge de fraîcheur est visible partout. Un document 🔴 peut être marqué vérifié en 1 clic → passe en 🟢.

---

### 🏃 Sprint 5 : Administration & Organisation — Semaines 10-11

> **Objectif : L'admin peut gérer l'outil. La navigation par domaine est fonctionnelle.**

**Focus** : Console admin complète + pages d'organisation + analytics backend.

- [ ] **US-601** : Navigation par domaine depuis la page d'accueil (liste documents par domaine)
- [ ] **US-602** : Documents récemment modifiés sur l'accueil (section "Activité récente")
- [ ] **US-801** : Gérer les templates (CRUD Admin — TipTap éditeur dans backoffice)
- [ ] **US-802** : Gérer les domaines (CRUD Admin — créer, renommer, archiver)
- [ ] **US-803** : Configurer les seuils de fraîcheur (admin, validation seuils cohérents)
- [ ] **US-804** : Gérer les utilisateurs et rôles (création comptes, attribution domaine, reset MDP)
- [ ] **US-805** : Configurer l'URL portail tickets GLPI
- [ ] **US-204** : CTA fallback "Ouvrir un ticket support" (vue publique Sophie)
- [ ] **US-901** : Compteur de vues sur chaque document (incrémentation VIEW_LOG)
- [ ] **US-902** : Enregistrer les logs de recherche (SEARCH_LOG)
- [ ] **US-903** : Enregistrer les logs de consultation (VIEW_LOG avec durée)

**Gate Sprint 5** : Alexandre crée un compte pour Didier dans le backoffice, configure les seuils de fraîcheur, gère les domaines. Les compteurs de vues sont visibles. Les logs analytics sont requêtables en SQL.

---

### 🏃 Sprint 6 : Import & Intégration — Semaines 12-13

> **Objectif : Le patrimoine documentaire existant est migré. PlumeNote n'est plus vide.**

**Focus** : Pipeline d'import batch + lecture transversale (liens, prévisualisation) + vue publique complète.

- [ ] **US-701** : Import Word (.doc/.docx) en lot (Pandoc → HTML → TipTap JSON, rapport d'import)
- [ ] **US-702** : Import PDF (extraction texte via pdftotext, fallback "contenu scanné")
- [ ] **US-703** : Import TXT bruts (interprétation Markdown, titre = nom de fichier)
- [ ] **US-304** : Métadonnées de confiance en vue lecture (auteur, domaine, type, fraîcheur, vues, date)
- [ ] **US-306** : Liens internes entre documents (navigation + gestion liens cassés)
- [ ] **US-307** : Prévisualisation avant publication (TipTap read-only dans l'éditeur)
- [ ] **US-402** : Créer une page depuis un template (bandeau suggestion, injection structure)

**Gate Sprint 6** : Alexandre lance `plumenote import ./docs/SCI` → 50 fichiers Word importés, rattachés au domaine SCI, indexés dans Meilisearch, retrouvables par recherche en <10s. Les templates fonctionnent à la création de page.

---

### 🏃 Sprint 7 : Hardening & Buffer — Semaines 14-15

> **Objectif : Stabilisation, bugs, dette technique critique, import réel du patrimoine.**

**Focus** : Pas de nouvelles features. Correction des bugs remontés lors des sprints précédents. Durcissement. Import réel des documents existants (pas juste le pipeline — le contenu DSI).

- [ ] Fix des bugs remontés par les tests manuels des Sprints 1-6
- [ ] Gestion d'erreurs transversale (erreurs réseau, timeouts, états de bord)
- [ ] Validation des 48 critères d'acceptance (pass BDD)
- [ ] Tests de charge légers (500 documents dans Meilisearch, recherche <1.5s)
- [ ] Import réel : documentation SCI (Didier), documentation Infra (Mohamed), guides Études & Dev (Lilian)
- [ ] Validation cross-browser (Chrome, Firefox, Edge — postes CPAM92)
- [ ] Configuration backup : `pg_dump` cron quotidien + rsync `/data/uploads/`
- [ ] Rédaction README déploiement (`docker compose up -d` + config)
- [ ] Revue sécurité : CSRF token, injection SQL (sqlc = safe), XSS (TipTap JSON = safe)

**Gate Sprint 7** : Les 48 US passent les critères d'acceptance. La recherche fonctionne sur le vrai patrimoine importé. Le backup automatique est en place.

---

### 🏃 Sprint 8 : Mise en Production & Adoption — Semaines 16-17

> **Objectif : PlumeNote est en production. Les premiers utilisateurs sont actifs.**

- [ ] Déploiement production sur la VM CPAM92 (`docker compose up -d` avec données réelles)
- [ ] Configuration DNS : `plumenote.cpam92.local` pointe vers la VM
- [ ] Création des comptes utilisateurs DSI (US-804 — ~15-20 comptes)
- [ ] Formation rapide (30 min) : présentation aux 4 services (SCI, Infra, Support, Études & Dev)
- [ ] Communication interne : accès vue publique pour DFC/MOA/Réseau (Sophie)
- [ ] Monitoring baseline : `docker logs`, `docker stats`, vérification RAM <600 Mo
- [ ] Collecte feedback J+7 : premiers retours, bugs critiques éventuels
- [ ] Mesure KPI J+14 : Search-to-View Rate (US-902/903), nombre de documents créés

**Gate Sprint 8** : ≥60% des collaborateurs DSI ont un compte actif. ≥5 recherches/jour observées dans SEARCH_LOG. Le patrimoine importé est consultable.

---

## 4. Concierge MVP Contenu (Parallèle — Test #3 P2.2)

> _Ce chantier se déroule EN PARALLÈLE des sprints de dev, porté par les contributeurs métier._

|Semaine|Action|Responsable|Livrable|
|---|---|---|---|
|S1-S4|Identifier les 20 procédures critiques par service|Alexandre + Didier + Mohamed|Liste priorisée|
|S2-S6|Rédiger les 15-20 fiches en Word/TXT (format libre)|Didier (SCI), Mohamed (Infra), Lilian (Études)|Fichiers prêts pour import|
|S6|Import batch dans PlumeNote via pipeline (Sprint 6)|Alexandre|Documents en base, indexés|
|S7|Validation du contenu importé (qualité conversion)|Contributeurs métier|≥15 fiches validées|

**Critère de succès P2.2 Test #3** : ≥15 fiches de procédures critiques rédigées et importées.

---

## 5. Definition of Done (DoD) & Qualité

_Pour qu'un ticket passe en "Terminé" :_

- [ ] Code mergé sur `main` sans conflit (branche feature → PR → merge)
- [ ] Pas de régression sur les US déjà livrées (tests manuels, pas de tests E2E au MVP — dette acceptée P4.2)
- [ ] Critères d'acceptance BDD (P4.1) validés manuellement
- [ ] Déployé en environnement de staging (Docker Compose sur VM de dev)
- [ ] Code Go : `go vet` + `golangci-lint` sans erreur
- [ ] Code React : `eslint` + `tsc --noEmit` sans erreur
- [ ] Couverture des cas d'erreur identifiés dans les scénarios BDD

**Seuils de qualité MVP (pragmatiques)** :

- Pas de tests unitaires obligatoires au MVP (1 dev principal, 48 US → vélocité avant couverture). Les tests critiques sont les tests fonctionnels sur les critères d'acceptance.
- Tests E2E Playwright : V1.0 (dette acceptée P4.2).
- Le code doit être lisible par un autre développeur (Lilian ou Mathieu) → code Go idiomatique, sqlc type-safe, composants React bien découpés.

---

## 6. Chemin Critique & Dépendances

> _Attention, ces points peuvent bloquer tout le projet._

|#|Bloqueur Potentiel|Impact|Sprint impacté|Mitigation (Qui fait quoi ?)|
|---|---|---|---|---|
|**B1**|**Spike technique échoue** : assemblage Go + TipTap 3 + Meilisearch + PG18 ne fonctionne pas de bout en bout|🔴 Bloque TOUT — pivot Docmost|Sprint 1|Alexandre : 2 semaines max. Si échec → fork Docmost (ADR-001). Critère : recherche <3s.|
|**B2**|**VM non provisionnée par l'Infra**|🔴 Bloque déploiement staging|Sprint 0|Alexandre → Mohamed Zemouche : demander la VM dès J1. Fallback : dev local Docker Desktop.|
|**B3**|**Certificats TLS internes** non fournis|🟡 Bloque HTTPS prod (pas staging)|Sprint 7-8|Caddy auto-signé en staging. Certs CPAM92 demandés à l'Infra en Sprint 0.|
|**B4**|**TipTap 3 breaking changes** vs TipTap 2 (extensions slash commands, tables)|🟡 Bloque EPIC-04 partiellement|Sprint 3-4|Tester toutes les extensions en Sprint 1 (spike). TipTap 3 GA depuis mid-2025, risque modéré.|
|**B5**|**Pandoc conversion Word → TipTap JSON imparfaite**|🟡 Bloque import avec perte de qualité|Sprint 6|Conversion "80/20" acceptée (ADR P4.2 R2). Tester 10 docs réels en Sprint 1. Formatage Word avancé perdu = OK.|
|**B6**|**Contenu Concierge MVP pas prêt**|🟡 PlumeNote démarre vide → pas d'adoption|Sprint 6-7|Alexandre relance Didier et Mohamed toutes les 2 semaines. Objectif ≥15 fiches à S6.|
|**B7**|**Bus factor Alexandre = 1**|🟡 Ralentissement si indisponible|Tout|Code Go idiomatique + sqlc lisible. Lilian monte en compétence front. Mathieu en backup back.|
|**B8**|**Lilian non disponible (charge BookStack / autres projets)**|🟡 Front ralenti|Sprint 2+|Alexandre prend le relais front si nécessaire (React). Prioriser les US back-end en attendant.|

**Ordre des dépendances techniques** :

```
Sprint 0: Docker + PG18 + Meilisearch + Caddy + Repo
    ↓
Sprint 1: Go API → PG18 (schéma) → Meilisearch (index) → React + TipTap 3 (SPA)
    ↓ (l'auth est le pré-requis de tout le reste)
Sprint 2: Auth JWT (US-201) → Permissions 3 niveaux → Vue publique (US-202)
    ↓ (la recherche enrichie dépend des badges de fraîcheur)
Sprint 3: Recherche complète (Meilisearch filtres) + Éditeur core
    ↓
Sprint 4: Éditeur avancé + Fraîcheur (dépend du modèle de données complet)
    ↓
Sprint 5: Admin (CRUD) → peut se faire en parallèle avec Sprint 4 si 2 devs
    ↓
Sprint 6: Import (dépend de l'API documents complète + Meilisearch index) + Templates
    ↓
Sprint 7-8: Hardening → Production
```

---

## 7. Matrice RACI Simplifiée (Responsabilités)

|Activité|Alexandre (Sponsor/Lead Dev)|Lilian (Dev Front)|Mathieu (Renfort Back)|Didier/Mohamed (Contributeurs métier)|
|---|---|---|---|---|
|Architecture & ADR|**R** (Responsable)|C (Consulté)|C|—|
|Backend Go (API, Auth, Import)|**R**|—|**A** (Appui)|—|
|Frontend React (TipTap, UI)|A|**R**|—|—|
|Rédaction contenu (Concierge MVP)|I (Informé)|—|—|**R**|
|Validation des US (PO)|**R**|—|—|C|
|Déploiement staging/prod|**R**|—|C|—|
|Provisioning VM & réseau|I|—|—|Mohamed Zemouche (**R**)|
|Gestion des incidents prod|**R**|A|A|—|

**Qui valide les US ?** : Alexandre (PO/Sponsor) — validation sur critères d'acceptance P4.1. **Qui déploie ?** : Alexandre — `make deploy` sur la VM CPAM92. **Qui gère les incidents ?** : Alexandre en première ligne, Lilian/Mathieu en escalade.

---

## 8. Vue Calendaire Synthétique

```
Semaine   1    2    3    4    5    6    7    8    9   10   11   12   13   14   15   16   17
          ┌──┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
Sprint    │S0│ │ Sprint 1│ │ Sprint 2│ │ Sprint 3│ │ Sprint 4│ │ Sprint 5│ │ Sprint 6│ │ Sprint 7│ Sprint 8
          │  │ │ Walking │ │  Auth + │ │Search + │ │Editeur +│ │Admin +  │ │Import + │ │Hardening│ Prod
          │  │ │Skeleton │ │ Lecture │ │Edit Core│ │Fraîcheur│ │Orga +   │ │Templates│ │ Buffer  │ Adoption
          └──┘ └────┬────┘ └─────────┘ └─────────┘ └─────────┘ │Analytics│ └─────────┘ └─────────┘
                    │                                           └─────────┘
                    ▼
              Démo interne
              (Test #2 P2.2)

Concierge ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (parallèle S1-S7)
MVP contenu        ^^^^^^^^ rédaction ^^^^^^^^   ^^import^^
```

---

## 9. Critères de Succès & KPIs de Livraison

|Jalon|Critère|Date cible|
|---|---|---|
|**Spike validé** (P2.2 Test #1)|Recherche <3s sur 1 doc TipTap → Meilisearch|Fin Sprint 1 (S3)|
|**Démo interne** (P2.2 Test #2)|≥3/4 contributeurs engagés avec docs nommés|Fin Sprint 1 (S3)|
|**GO FRANC** (Gate Review P4.3 finale)|3/3 tests P2.2 passés → sponsor valide|S3-S4|
|**MVP Feature-Complete**|48/48 US livrées|Fin Sprint 6 (S13)|
|**Concierge MVP** (P2.2 Test #3)|≥15 fiches critiques rédigées et importées|Fin Sprint 7 (S15)|
|**Production**|PlumeNote accessible à `plumenote.cpam92.local`|Fin Sprint 8 (S17)|
|**Adoption J+30**|≥60% MAU DSI, ≥5 recherches/jour|S21|

---

## 10. Risques Projet & Plan de Contingence

|Risque|Probabilité|Impact|Stratégie|
|---|---|---|---|
|**Sur-ambition** : 48 US en 8 sprints avec 2 devs|Moyen|Fort|Le buffer Sprint 7 absorbe le retard. Si nécessaire : repousser EPIC-07 (Import) en Sprint 9 et faire l'import manuellement.|
|**Adoption faible** : l'outil est prêt mais personne ne l'utilise|Moyen|Fort|Le concierge MVP contenu pré-remplit la base. La démo interne engage les contributeurs tôt. L'import du patrimoine existant donne de la valeur immédiate.|
|**Qualité Pandoc insuffisante** : les imports Word sont illisibles|Fort|Moyen|Accepter la conversion "80/20". Les contributeurs métier valident et retouchent manuellement dans TipTap. C'est un coût one-shot.|
|**Alexandre surchargé** (PO + Lead Dev + Sponsor)|Fort|Moyen|Déléguer la validation des US front à Lilian. Déléguer la rédaction contenu aux contributeurs métier. Ne pas micro-manager.|

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_Livrable : P5-Plan-Implementation.md — Projet PlumeNote — Version 1.0 — Mars 2026_ _Hypothèse : 2 devs effectifs + contributeurs métier. 48 US en 8 sprints (~17 semaines)._ _Prochaine étape immédiate : Sprint 0 (Setup) puis Sprint 1 (Walking Skeleton / Spike P2.2)._

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━