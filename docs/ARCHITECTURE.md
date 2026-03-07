# PlumeNote -- Architecture Technique Exhaustive

> **Version** : 1.0 -- Mars 2026
> **Projet** : PlumeNote -- Plateforme de Knowledge Management DSI
> **Contexte** : Outil self-hosted pour ~50 utilisateurs (CPAM92), developpement from scratch

---

## Table des matieres

1. [Stack Technique](#1-stack-technique)
2. [Architecture Backend](#2-architecture-backend)
3. [Architecture Frontend](#3-architecture-frontend)
4. [Schema de Donnees](#4-schema-de-donnees)
5. [API Reference](#5-api-reference)
6. [Infrastructure](#6-infrastructure)
7. [Architecture Decision Records (ADR)](#7-architecture-decision-records-adr)
8. [Regles Metier](#8-regles-metier)
9. [Performance et Securite](#9-performance-et-securite)

---

## 1. Stack Technique

### 1.1 Backend -- Go 1.25

| Composant | Version | Role |
|-----------|---------|------|
| **Go** | 1.25 | Langage backend, binary unique ~15 Mo, idle ~50 Mo RAM |
| **Chi** | v5.2.1 | Framework HTTP, 100% net/http compatible, middleware grouping + subrouter mounting |
| **pgx** | v5.7.4 | Driver PostgreSQL natif (protocole binaire, connection pool, statement cache) |
| **golang-jwt** | v5.3.1 | Generation et validation de tokens JWT HS256 |
| **meilisearch-go** | v0.36.1 | Client Go officiel pour Meilisearch |
| **x/crypto** | v0.36.0 | bcrypt (cost 12) pour le hachage des mots de passe |
| **x/net** | v0.33.0 | Parser HTML pour la conversion import (html.Parse) |
| **x/text** | v0.23.0 | Normalisation Unicode (suppression accents pour les slugs) |

**Pourquoi Go** : Binary unique ~15 Mo, empreinte memoire ~50 Mo en idle, compilation rapide, concurrence native (goroutines pour l'indexation async). Go 1.25 apporte les Swiss Tables pour des performances hash map ameliorees. Rust exclu (compilation 5-20x plus lente, gain invisible a 50 users). Node/Bun exclus (runtime ~100 Mo, idle 30-80 Mo, depasse le budget memoire).

**Pourquoi Chi v5** : 18.6k etoiles GitHub, 100% compatible net/http, supporte le middleware grouping et le subrouter mounting (absent de la stdlib Go 1.22+). Fiber exclu car pas net/http compatible.

**Pourquoi pgx** : Driver PostgreSQL le plus performant en Go (protocole binaire natif, statement cache, connection pooling). Pas d'ORM -- les requetes SQL sont ecrites directement, parametrees pour prevenir l'injection SQL.

### 1.2 Frontend -- React 19 + Vite 6 + Tailwind CSS 4

| Composant | Version | Role |
|-----------|---------|------|
| **React** | 19.x | Framework UI, lazy loading des routes |
| **React DOM** | 19.x | Rendu DOM |
| **React Router DOM** | v7.3.x | Routing SPA (BrowserRouter), routes imbriquees |
| **Vite** | 6.2.x | Build tool, dev server avec HMR, proxy API |
| **@vitejs/plugin-react-swc** | 4.1.x | Compilation React via SWC (plus rapide que Babel) |
| **Tailwind CSS** | 4.1.x | Framework CSS utility-first, config CSS-first (@theme) |
| **@tailwindcss/vite** | 4.1.x | Plugin Vite natif pour Tailwind 4 |
| **@tailwindcss/typography** | 0.5.x | Plugin prose pour le rendu du contenu documentaire |
| **TypeScript** | 5.7.x | Typage statique |

**Pourquoi React 19** : Stable depuis decembre 2024, 48% d'adoption. Ecosysteme editeur riche (TipTap). Svelte/Solid exclus car ecosysteme editeur trop pauvre pour les 13 US editeur (EPIC-04).

**Pourquoi Vite 6** : Standard de facto (31M npm/semaine). Plugin @tailwindcss/vite natif. Turbopack/Rspack exclus (pas de gain pertinent hors Next.js).

**Pourquoi Tailwind CSS 4** : V4 stable (janvier 2025). Moteur Oxide (Rust) : builds 5x, rebuilds 100x plus rapides. Configuration CSS-first via `@theme`.

### 1.3 Editeur -- TipTap 3

| Package | Version | Role |
|---------|---------|------|
| **@tiptap/react** | 3.20.x | Binding React pour TipTap |
| **@tiptap/starter-kit** | 3.20.x | Extensions de base (paragraphe, heading, bold, italic, lists, code, blockquote, horizontal rule, hard break) |
| **@tiptap/pm** | 3.20.x | Acces direct a ProseMirror |
| **@tiptap/extension-code-block-lowlight** | 3.20.x | Blocs de code avec coloration syntaxique |
| **@tiptap/extension-highlight** | 3.20.x | Surlignage de texte |
| **@tiptap/extension-image** | 3.20.x | Insertion d'images |
| **@tiptap/extension-link** | 3.20.x | Liens hypertexte et internes |
| **@tiptap/extension-placeholder** | 3.20.x | Texte placeholder dans l'editeur |
| **@tiptap/extension-table** | 3.20.x | Insertion et edition de tableaux |
| **@tiptap/extension-table-cell** | 3.20.x | Cellules de tableau |
| **@tiptap/extension-table-header** | 3.20.x | En-tetes de tableau |
| **@tiptap/extension-table-row** | 3.20.x | Lignes de tableau |
| **@tiptap/suggestion** | 3.20.x | Framework pour le menu slash (/) |
| **lowlight** | 3.3.x | Coloration syntaxique cote client (base de Shiki) |
| **shiki** | 4.0.x | Coloration syntaxique server-grade (bash, PowerShell, SQL, Python, JSON, XML) |
| **tippy.js** | 6.3.x | Popups pour le menu slash et les tooltips |

**Pourquoi TipTap 3** : Ecosysteme editeur le plus large (slash commands, code blocks, tables, liens internes). TipTap 3 apporte le composant declaratif `<Tiptap />`, support SSR, JSX natif et TableKit consolide. Produit un arbre JSON ProseMirror stocke directement en JSONB PostgreSQL (zero conversion save/load).

### 1.4 Base de Donnees -- PostgreSQL 18

| Aspect | Detail |
|--------|--------|
| **Version** | 18 (image `postgres:18-alpine`) |
| **PKs** | UUID via `gen_random_uuid()` (comportement UUIDv7 en PG18, ordonnees temporellement) |
| **Contenu** | JSONB pour les documents TipTap (arbre ProseMirror) |
| **Enums** | `user_role` (public, dsi, admin), `doc_visibility` (public, dsi) |
| **Indexes** | B-tree sur toutes les FKs, timestamps DESC, role, visibility |
| **RAM estimee** | ~300 Mo |

**Pourquoi PG18** : AIO (Asynchronous I/O) pour jusqu'a 3x de performance en lectures. UUIDv7 natif (PKs ordonnees temporellement, meilleur indexage B-tree que UUIDv4). SQL/JSON standard (herite PG17) pour querying JSONB TipTap. OAuth2 natif (prepare V2). Stable depuis septembre 2025 avec 3 minor releases.

### 1.5 Recherche -- Meilisearch CE v1.37

| Aspect | Detail |
|--------|--------|
| **Version** | v1.37 (MIT, Community Edition) |
| **Index** | `documents` |
| **Searchable attributes** | `title`, `body_text`, `tags` |
| **Filterable attributes** | `domain_id`, `type_id`, `visibility` |
| **Sortable attributes** | `created_at`, `updated_at`, `view_count` |
| **Highlighting** | `<mark>` tags sur `title` et `body_text` |
| **Typo tolerance** | Native (francais out-of-the-box) |
| **Performance cible** | <50ms par requete |
| **RAM estimee** | ~150 Mo pour 500 docs |

**Pourquoi Meilisearch** : <50ms, typo-tolerance native, highlighting, filtres faceted, francais natif. ~150 Mo RAM pour 500 docs. PostgreSQL FTS exclu (pas de typo-tolerance native, deal-breaker pour US-103). Elasticsearch exclu (1 Go+ RAM). ParadeDB pg_search exclu (pre-v1.0, AGPL).

### 1.6 Reverse Proxy -- Caddy v2

| Aspect | Detail |
|--------|--------|
| **Version** | v2 (image `caddy:2-alpine`) |
| **Hostname** | `plumenote.cpam92.local` |
| **HTTPS** | Auto (TLS certificates), certificats internes CPAM92 ou auto-signes |
| **Features** | Reverse proxy vers `plumenote-app:8080`, compression gzip, headers de securite |
| **RAM estimee** | ~20 Mo |

**Configuration Caddyfile** :

```caddyfile
plumenote.cpam92.local {
    reverse_proxy plumenote-app:8080

    encode gzip

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }
}
```

**Pourquoi Caddy** : HTTPS automatique, 10 lignes de configuration, SPA fallback, ~20 Mo RAM. Nginx exclu (configuration TLS manuelle, verbeux). Traefik exclu (overkill pour 1 application).

### 1.7 Infrastructure -- Docker Compose

4 containers, self-hosted sur VM interne CPAM92. RAM totale estimee : ~520 Mo (app ~50 + PG18 ~300 + Meili ~150 + Caddy ~20). Marge >1.4 Go sous le plafond de 2 Go.

---

## 2. Architecture Backend

### 2.1 Vue d'ensemble -- Monolithe Modulaire

PlumeNote est un monolithe modulaire Go. Un seul binary ~15 Mo contient l'API REST, le moteur de fraicheur, le pipeline d'import et le serveur SPA (`embed`). Les packages internes sont organises par domaine metier :

```
cmd/plumenote/
  main.go              # Entry point, config env, graceful shutdown, embed SPA
  import.go            # Sous-commande CLI "plumenote import"
  static/              # SPA React buildee (embeddee via go:embed)

internal/
  model/deps.go        # Struct Deps partagee (DB pool, Meili client, JWT secret)
  server/server.go     # Router Chi principal, middleware chain, montage sub-routers
  db/pool.go           # Factory pgxpool.Pool
  auth/                # Authentification (JWT, bcrypt, middleware)
    claims.go          # Struct Claims JWT
    context.go         # Context key + helpers (UserFromContext, withClaims)
    handler.go         # Handlers login, logout, me, changePassword
    middleware.go       # RequireAuth, RequireRole, OptionalAuth, RequireDomainWrite
    router.go          # Chi sub-router /api/auth
  document/            # CRUD documents, tags, verifications, attachments, Meili sync
    handlers.go        # Tous les handlers HTTP du module
    helpers.go         # ComputeFreshness, ExtractBodyText, GenerateSlug
    router.go          # Chi sub-router /api/documents
  search/              # Proxy Meilisearch avec enrichissement fraicheur
    auth.go            # OptionalAuth locale (JWT claims dans context)
    handler.go         # Handler recherche, batch freshness
    router.go          # Chi sub-router /api/search
  admin/               # Backoffice admin (CRUD templates, domaines, users, config)
    handler.go         # Tous les handlers admin
    router.go          # Chi sub-router /api/admin
  analytics/           # Logging des recherches et consultations
    auth.go            # OptionalAuth locale
    handler.go         # Handlers search-log, view-log, view-count
    router.go          # Chi sub-router /api/analytics
  importer/            # Pipeline d'import CLI (Pandoc, pdftotext)
    importer.go        # Logique d'import recursive (Walk, convert, insert)
    html_to_tiptap.go  # Convertisseur HTML -> TipTap JSON (ProseMirror)
```

### 2.2 Entry Point et Initialisation (`cmd/plumenote/main.go`)

Le binary supporte deux modes :

1. **Mode serveur** (defaut) : `plumenote`
2. **Mode import CLI** : `plumenote import <folder> --author-id=UUID`

Sequence d'initialisation du serveur :

1. Lecture des variables d'environnement (DATABASE_URL, MEILI_URL, MEILI_MASTER_KEY, JWT_SECRET, LISTEN_ADDR)
2. Connexion au pool PostgreSQL via `db.NewPool()` (parse config, create pool, ping)
3. Connexion a Meilisearch (health check, warning si indisponible -- non bloquant)
4. Construction de la struct `model.Deps` (DB pool, Meili client, JWT secret)
5. Extraction du filesystem SPA embarque via `embed.FS` et `fs.Sub()`
6. Creation du router HTTP via `server.New(deps, staticFS)`
7. Demarrage du serveur HTTP avec timeouts (Read: 15s, Write: 15s, Idle: 60s)
8. Goroutine de graceful shutdown sur SIGINT/SIGTERM (timeout 10s)

**Struct Deps** (injection de dependances) :

```go
type Deps struct {
    DB        *pgxpool.Pool              // Pool de connexions PostgreSQL
    Meili     meilisearch.ServiceManager  // Client Meilisearch
    JWTSecret string                      // Secret pour signer/verifier les JWT
}
```

### 2.3 Router Chi -- Middleware Chain et Groupes de Routes

Le router principal (`server.New()`) configure :

**Middleware globaux** (appliques a toutes les routes) :
1. `middleware.RequestID` -- Genere un ID unique par requete
2. `middleware.RealIP` -- Extrait l'IP reelle derriere le proxy
3. `middleware.Logger` -- Log chaque requete (methode, path, status, duree)
4. `middleware.Recoverer` -- Recupere les panics et retourne 500
5. `cors.Handler` -- CORS permissif (origines: `*`, methodes: GET/POST/PUT/PATCH/DELETE/OPTIONS, headers: Accept/Authorization/Content-Type, max-age: 300s)

**Routes publiques** (definies directement dans server.go, sans auth) :
- `GET /api/health` -- Health check
- `GET /api/domains` -- Liste des domaines avec compteurs
- `GET /api/document-types` -- Liste des types de documents
- `GET /api/config/ticket-url` -- URL du portail tickets
- `GET /api/stats` -- Statistiques globales (documents, recherches, contributeurs, mises a jour du mois)
- `GET /api/tags` -- Alias vers le router document (listTags)

**Sub-routers montes** :
- `/api/auth` -> `auth.Router(deps)` -- Authentification
- `/api/documents` -> `document.Router(deps)` -- Documents CRUD
- `/api/search` -> `search.Router(deps)` -- Recherche Meilisearch
- `/api/admin` -> `admin.Router(deps)` -- Administration
- `/api/analytics` -> `analytics.Router(deps)` -- Logging analytics

**SPA Fallback** :
Le serveur embarque les fichiers statiques React via `go:embed`. Toute requete `GET /*` qui ne correspond pas a un fichier statique existant retourne `index.html` (SPA client-side routing).

### 2.4 Authentification -- bcrypt + JWT HS256

#### Flow complet

```
1. POST /api/auth/login {username, password}
2. Backend: SELECT user FROM users WHERE username = $1
3. Backend: bcrypt.CompareHashAndPassword(hash, password)
4. Backend: generate JWT HS256 (claims: user_id, username, role, domain_id, exp: 24h, issuer: "plumenote")
5. Response: {token: "eyJ...", user: {id, username, display_name, role, domain_id}}
6. Frontend: localStorage.setItem("token", token)
7. Requetes suivantes: Header "Authorization: Bearer <token>"
```

#### Claims JWT

```go
type Claims struct {
    UserID   string `json:"user_id"`
    Username string `json:"username"`
    Role     string `json:"role"`       // "public", "dsi", "admin"
    DomainID string `json:"domain_id"`  // UUID du domaine principal
    jwt.RegisteredClaims                // IssuedAt, ExpiresAt (24h), Issuer ("plumenote")
}
```

#### Middlewares d'authentification

| Middleware | Description | Status HTTP si echec |
|-----------|-------------|---------------------|
| `RequireAuth(jwtSecret)` | Valide le JWT Bearer, injecte les claims dans le context. Rejette si absent/invalide/expire. | 401 |
| `RequireRole(roles...)` | Verifie que le role du user est dans la liste autorisee. Doit etre apres RequireAuth. | 403 |
| `OptionalAuth(jwtSecret)` | Tente d'extraire les claims JWT mais ne rejette PAS les requetes non authentifiees. UserFromContext() retourne nil. | - |
| `RequireDomainWrite` | Verifie que le user appartient au meme domaine que la ressource, ou est admin. | 403 |
| `requireAdmin` (admin package) | Verifie que le role est "admin". | 403 |

#### Modele de permissions 3 niveaux (RG-003)

| Role | Lecture | Ecriture | Admin |
|------|---------|----------|-------|
| **public** (non authentifie) | Documents `visibility = 'public'` uniquement | Non | Non |
| **dsi** (authentifie) | Tous les documents | Documents de son domaine uniquement | Non |
| **admin** | Tous les documents | Tous les documents | Oui (backoffice complet) |

### 2.5 Module Auth (`internal/auth/`)

**Fichiers** : `router.go`, `handler.go`, `middleware.go`, `claims.go`, `context.go`

**Responsabilites** :
- Login (verification bcrypt, generation JWT, mise a jour `last_login_at`)
- Logout (cote client, le serveur retourne simplement 200)
- Recuperation du profil utilisateur (`/me`)
- Changement de mot de passe (verification ancien mot de passe, minimum 8 caracteres)
- Export de `HashPassword()` et `GenerateToken()` pour les autres packages

**Configuration** : bcrypt cost 12, JWT expiration 24h, issuer "plumenote".

### 2.6 Module Document (`internal/document/`)

**Fichiers** : `router.go`, `handlers.go`, `helpers.go`

**Responsabilites** :
- CRUD complet sur les documents
- Gestion des tags (liste, creation, suppression, sync document-tags)
- Gestion des verifications de fraicheur
- Gestion des pieces jointes (upload multipart, stockage `/data/uploads/{docID}/`, 10 Mo max, PNG/JPG/GIF/WebP)
- Calcul du badge de fraicheur (green/yellow/red) base sur les seuils configurables
- Extraction du texte brut depuis l'arbre TipTap JSON (`ExtractBodyText`)
- Generation de slugs URL-friendly avec gestion des accents et unicite
- Indexation Meilisearch asynchrone (goroutine) apres chaque create/update/delete
- Configuration de l'index Meilisearch au demarrage (searchable, filterable, sortable attributes)
- Filtrage RG-006 : les utilisateurs non authentifies ne voient que les documents `visibility = 'public'`

**Badge de fraicheur** :

```
Si last_verified_at est NULL -> "red"
Si jours depuis last_verified_at < freshness_green (defaut 90) -> "green"
Si jours depuis last_verified_at <= freshness_yellow (defaut 180) -> "yellow"
Sinon -> "red"
```

**Indexation Meilisearch** :
A chaque creation ou mise a jour de document, une goroutine asynchrone :
1. Lit le document enrichi depuis PostgreSQL (JOIN users pour le nom d'auteur)
2. Recupere les tags associes
3. Envoie le document a l'index `documents` de Meilisearch
Delai cible : <10 secondes (RG-001).

### 2.7 Module Search (`internal/search/`)

**Fichiers** : `router.go`, `handler.go`, `auth.go`

**Responsabilites** :
- Proxy vers Meilisearch avec enrichissement des resultats
- Filtrage automatique `visibility = public` pour les utilisateurs non authentifies (RG-006)
- Filtrage optionnel par `domain_id` et `type_id` (validation UUID)
- Highlighting des resultats (`<mark>` tags)
- Enrichissement batch : recuperation des dates de derniere verification depuis PostgreSQL pour calculer les badges de fraicheur de chaque resultat
- Reponse structuree avec total, query, processing_time_ms

### 2.8 Module Admin (`internal/admin/`)

**Fichiers** : `router.go`, `handler.go`

**Responsabilites** :
Toutes les routes requierent `RequireAuth` + `requireAdmin` (role "admin").

- **Templates** : CRUD complet (liste triee par usage_count DESC, creation avec type_id optionnel, mise a jour, suppression)
- **Domaines** : CRUD avec protection contre la suppression de domaines contenant des documents (HTTP 409 Conflict)
- **Utilisateurs** : Liste, creation (bcrypt hash), mise a jour (display_name, role, domain_id), reset de mot de passe (generation aleatoire 12 caracteres)
- **Configuration** : Lecture/ecriture des seuils de fraicheur (green_days, yellow_days) et de l'URL tickets (GLPI). Stockage en table `config` (key-value, upsert ON CONFLICT).

### 2.9 Module Analytics (`internal/analytics/`)

**Fichiers** : `router.go`, `handler.go`, `auth.go`

**Responsabilites** :
- Logging des recherches (`search_log`) : query, result_count, clicked_document_id (nullable), user_id (nullable pour anonymes -- RG-010)
- Logging des consultations (`view_log`) : document_id, duration_seconds, user_id (nullable)
- Increment du compteur de vues (`view_count` sur `documents`)

Toutes les routes utilisent `OptionalAuth` : les utilisateurs non authentifies sont loggues avec user_id NULL.

### 2.10 Module Importer (`internal/importer/`)

**Fichiers** : `importer.go`, `html_to_tiptap.go`

**Responsabilites** :
- Pipeline d'import CLI batch (`plumenote import <folder> --author-id=UUID`)
- Parcours recursif du dossier source
- Detection des domaines par convention de nommage des sous-dossiers (ex: dossier "sci" -> domaine SCI)
- Conversion multi-format :
  - `.docx`/`.doc` : Pandoc (docx -> HTML) puis HTMLToTipTap (HTML -> TipTap JSON)
  - `.pdf` : pdftotext (extraction texte brut) puis textToTipTap (paragraphes -> TipTap JSON). Placeholder pour les PDF scannes.
  - `.txt`/`.md` : Pandoc (markdown -> HTML) puis HTMLToTipTap
- Insertion en base avec gestion des conflits de slug (ajout du PID comme suffixe)
- Rapport detaille (total, succes, echecs avec raisons, documents importes avec IDs)
- Taille maximale par fichier : 50 Mo
- Dependances externes requises : `pandoc` et `pdftotext` (poppler-utils)

**Convertisseur HTML -> TipTap JSON** (`html_to_tiptap.go`) :
Convertit un arbre HTML en arbre TipTap/ProseMirror JSON. Supporte :
- Headings (h1-h6), paragraphes, listes (ul/ol/li), blockquotes
- Code blocks (pre/code), tableaux (table/thead/tbody/tr/td/th)
- Images (img), liens (a), separateurs (hr), retours a la ligne (br)
- Marks inline : bold (strong/b), italic (em/i), code, underline (u), strike (s/del)
- Gestion correcte de l'imbrication (marks propages aux enfants)

### 2.11 Pool de Connexion PostgreSQL (`internal/db/pool.go`)

Factory minimale qui :
1. Parse la DATABASE_URL via `pgxpool.ParseConfig()`
2. Cree un pool de connexions via `pgxpool.NewWithConfig()`
3. Effectue un ping pour valider la connexion
4. Retourne le pool (ou une erreur wrappee)

---

## 3. Architecture Frontend

### 3.1 Structure Feature-Based

```
web/src/
  main.tsx              # Point d'entree React (StrictMode, BrowserRouter, AuthProvider)
  App.tsx               # Routes principales (lazy loading)
  index.css             # Tokens CSS Tailwind 4 (@theme), animations
  vite-env.d.ts         # Types Vite

  lib/
    api.ts              # Fetch wrapper avec JWT auto-injection
    auth-context.tsx     # AuthProvider (React Context + hooks)

  components/layout/
    Shell.tsx            # Layout conditionnel (homepage vs pages internes)
    Header.tsx           # En-tete
    Topbar.tsx           # Barre superieure
    Sidebar.tsx          # Barre laterale
    SidebarNew.tsx       # Variante sidebar
    SearchBar.tsx        # Barre de recherche

  features/
    auth/               # Authentification
      index.tsx          # Export par defaut (LoginPage)
      LoginPage.tsx      # Page de connexion
      ProfilePage.tsx    # Page profil utilisateur
      RouteGuard.tsx     # Protection des routes (redirect /login si non auth)

    home/               # Page d'accueil
      index.tsx          # Export par defaut (HomePage)
      HomePage.tsx       # Page d'accueil authentifiee (dashboard)
      PublicHomePage.tsx  # Page d'accueil publique (Sophie)
      DomainPage.tsx     # Page d'un domaine specifique
      DocumentsView.tsx  # Vue liste documents
      ApplicationsView.tsx # Vue applications (placeholder)
      CartographieView.tsx # Vue cartographie (placeholder)
      FreshnessBadge.tsx  # Composant badge de fraicheur (vert/jaune/rouge)
      TimeAgo.tsx         # Composant "il y a X jours/heures"

    search/             # Recherche
      index.tsx          # Export (SearchPage + SearchModal + useSearchModal)
      SearchModal.tsx    # Modale Ctrl+K (as-you-type, navigation clavier, filtres)

    reader/             # Lecture de documents
      index.tsx          # Export par defaut (ReaderPage)
      ReaderPage.tsx     # Page de lecture complete
      DocumentContent.tsx # Rendu du contenu TipTap JSON
      DocumentPreview.tsx # Previsualisation
      MetadataHeader.tsx  # En-tete metadonnees (badge fraicheur, auteur, vues, domaine)
      Breadcrumb.tsx      # Fil d'Ariane (Domaine > Document)
      TableOfContents.tsx # Sommaire lateral auto-genere (headings H2+)
      CodeBlock.tsx       # Bloc de code avec coloration et bouton copier
      DeleteModal.tsx     # Modale de confirmation de suppression

    editor/             # Editeur TipTap
      index.tsx          # Export par defaut (EditorPage)
      EditorPage.tsx     # Page editeur complete (create/edit)
      TipTapEditor.tsx   # Instance TipTap avec toutes les extensions
      Toolbar.tsx        # Barre d'outils WYSIWYG (B, I, H1, H2, listes, code, image, lien, alerte)
      SlashMenu.tsx      # Menu commande "/" (bloc code, image, tableau, alerte, lien interne, separateur)
      CodeBlockView.tsx  # Vue bloc de code dans l'editeur (coloration + selecteur langage)
      AlertBlock.tsx     # Bloc d'alerte/astuce (info, warning, danger)
      ImageUpload.tsx    # Upload d'images (drag & drop, bouton)
      InternalLink.tsx   # Lien interne [[...]] avec auto-completion
      TableContextMenu.tsx # Menu contextuel tableau (ajouter/supprimer lignes/colonnes)
      TagInput.tsx       # Champ de saisie de tags avec auto-completion
      TemplatePicker.tsx # Selecteur de template a la creation

    admin/              # Backoffice admin
      index.tsx          # Export par defaut (AdminPage)
      AdminPage.tsx      # Layout admin avec navigation
      UsersAdmin.tsx     # CRUD utilisateurs
      DomainsAdmin.tsx   # CRUD domaines
      TemplatesAdmin.tsx # CRUD templates
      ConfigAdmin.tsx    # Configuration (seuils fraicheur, URL tickets)

    profile/            # Profil utilisateur
      index.tsx          # Export par defaut (changement mot de passe)
```

### 3.2 Routing -- Routes Publiques vs Protegees

Le routing est declare dans `App.tsx` avec React Router v7 et le lazy loading :

```
/login                    -> AuthPage          (public, hors Shell)
/                         -> HomePage           (public, dans Shell)
/search                   -> SearchPage         (public, dans Shell)
/documents/:slug          -> ReaderPage         (public, dans Shell)
/domains/:slug            -> DomainPage         (public, dans Shell)
/documents/:slug/edit     -> EditorPage         (protege, RouteGuard)
/documents/new            -> EditorPage         (protege, RouteGuard)
/admin/*                  -> AdminPage          (protege, RouteGuard)
/profile                  -> ProfilePage        (protege, RouteGuard)
```

**RouteGuard** : Composant wrapper qui :
1. Verifie `loading` (attente de la verification du token au demarrage)
2. Si non authentifie, redirige vers `/login` avec `<Navigate replace />`
3. Si authentifie, rend les routes enfants via `<Outlet />`

**Shell conditionnel** : Le composant `Shell` adapte le layout selon la page :
- **Homepage** (`/`) : rend directement `<Outlet />` sans header (la homepage a son propre design full-page)
- **Autres pages** : rend un header avec logo PlumeNote, navigation (Documentation, Applications, Cartographie), zone utilisateur (nom, "+ Nouvelle page", Deconnexion ou lien Connexion), et horloge

### 3.3 State Management -- AuthContext + API Wrapper

#### AuthProvider (`lib/auth-context.tsx`)

React Context qui expose :

```typescript
interface AuthContextType {
  user: User | null          // Profil utilisateur (id, username, display_name, role, domain_id)
  token: string | null       // JWT stocke en localStorage
  loading: boolean           // True pendant la verification initiale du token
  login: (username, password) => Promise<void>
  logout: () => void
  isAuthenticated: boolean   // !!token
  isAdmin: boolean           // user?.role === 'admin'
}
```

**Comportement** :
- Au montage, si un token existe dans `localStorage`, appel `GET /api/auth/me` pour valider le token et charger le profil
- Si le token est invalide/expire, suppression du localStorage et reset du state
- `login()` : appel `POST /api/auth/login`, stockage du token, mise a jour du state
- `logout()` : suppression du token, reset du state, redirection vers `/`

#### API Wrapper (`lib/api.ts`)

Fetch wrapper qui :
1. Prefixe automatiquement `/api` a tous les chemins
2. Injecte le header `Authorization: Bearer <token>` si un token existe dans localStorage
3. Envoie `Content-Type: application/json` par defaut
4. Gere les erreurs 401 : suppression du token, redirection vers `/login`
5. Parse automatiquement la reponse JSON
6. Expose une API fluide : `api.get<T>(path)`, `api.post<T>(path, body)`, `api.put<T>(path, body)`, `api.delete<T>(path)`

### 3.4 Design System -- Tokens CSS

Definis dans `web/src/index.css` via la directive `@theme` de Tailwind CSS 4 :

**Fonts** :
| Token | Famille | Usage |
|-------|---------|-------|
| `--font-mono` | IBM Plex Mono | Corps de texte (font par defaut du body), code |
| `--font-sans` | IBM Plex Sans | Navigation, labels, boutons |
| `--font-display` | Archivo Black | Logo "PLUMENOTE", titres principaux |

**Couleurs** :
| Token | Valeur | Usage |
|-------|--------|-------|
| `--color-bg` | `#F7F6F3` | Fond de page (beige clair) |
| `--color-bg-content` | `#FBFBF9` | Fond du contenu (blanc chaud) |
| `--color-ink` | `#1C1C1C` | Texte principal (noir doux) |
| `--color-ink-70` | `rgba(28,28,28,0.7)` | Texte secondaire |
| `--color-ink-45` | `rgba(28,28,28,0.45)` | Texte desactive |
| `--color-ink-10` | `rgba(28,28,28,0.1)` | Bordures subtiles |
| `--color-ink-05` | `rgba(28,28,28,0.05)` | Fonds subtils |
| `--color-ink-hover` | `#FAFAF8` | Fond au survol |
| `--color-blue` | `#2B5797` | Accent principal (liens, bordure header, selection) |
| `--color-red` | `#C23B22` | Erreurs, badge rouge |
| `--color-amber` | `#D4952A` | Avertissements, badge jaune, accent logo |
| `--color-gray-dark` | `#404040` | Texte sombre alternatif |
| `--color-gray-mid` | `#8B8B8B` | Texte gris moyen |

**Animations** :
| Nom | Description |
|-----|-------------|
| `slideUp` | Entree de bas en haut (translateY 14px -> 0, opacity 0 -> 1) |
| `fadeIn` | Fondu d'entree (opacity 0 -> 1) |

**Selection de texte** : Fond bleu (`--color-blue`), texte blanc.

### 3.5 Configuration Vite (`web/vite.config.ts`)

```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],    // SWC + Tailwind 4 natif
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }  // Import alias @/
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true }  // Proxy API en dev
    }
  }
})
```

---

## 4. Schema de Donnees

### 4.1 Types Enumeres

```sql
CREATE TYPE user_role AS ENUM ('public', 'dsi', 'admin');
CREATE TYPE doc_visibility AS ENUM ('public', 'dsi');
```

### 4.2 Diagramme ER (texte)

```
users ──────┐
  |         |
  | 1:N     | 1:1
  v         v
documents   domains
  |  |  |
  |  |  └──── document_tags ────── tags
  |  |
  |  └──── verification_log
  |
  ├──── attachments
  ├──── search_log (clicked)
  └──── view_log

templates ──── document_types ──── documents
config (key-value)
schema_migrations
```

### 4.3 Detail des Tables

#### Table `domains`

Domaines organisationnels (SCI, Etudes & Dev, Infrastructure, Support).

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identifiant unique |
| `name` | TEXT | NOT NULL, UNIQUE | Nom du domaine (ex: "SCI") |
| `slug` | TEXT | NOT NULL, UNIQUE | Slug URL (ex: "sci") |
| `color` | TEXT | NOT NULL, DEFAULT '#6B7280' | Couleur d'affichage (hex) |
| `icon` | TEXT | NOT NULL, DEFAULT 'folder' | Nom d'icone (lucide) |
| `sort_order` | INT | NOT NULL, DEFAULT 0 | Ordre d'affichage |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de creation |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de derniere modification |

#### Table `users`

Comptes utilisateurs locaux.

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identifiant unique |
| `username` | TEXT | NOT NULL, UNIQUE | Login unique |
| `display_name` | TEXT | NOT NULL, DEFAULT '' | Nom d'affichage |
| `password_hash` | TEXT | NOT NULL | Hash bcrypt cost 12 |
| `role` | user_role | NOT NULL, DEFAULT 'dsi' | Role : public, dsi, admin |
| `domain_id` | UUID | FK domains(id) ON DELETE SET NULL | Domaine principal de l'utilisateur |
| `onboarding_completed` | BOOLEAN | NOT NULL, DEFAULT false | Premiere visite terminee |
| `last_login_at` | TIMESTAMPTZ | nullable | Derniere connexion |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de creation |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de derniere modification |

**Index** : `idx_users_role ON users(role)`

#### Table `document_types`

Types de documents configurables (Procedure technique, Guide utilisateur, FAQ, etc.).

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identifiant unique |
| `name` | TEXT | NOT NULL, UNIQUE | Nom du type |
| `slug` | TEXT | NOT NULL, UNIQUE | Slug URL |
| `icon` | TEXT | NOT NULL, DEFAULT 'file-text' | Nom d'icone |
| `sort_order` | INT | NOT NULL, DEFAULT 0 | Ordre d'affichage |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de creation |

#### Table `templates`

Templates de documents pres-remplis (contenu TipTap JSON).

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identifiant unique |
| `name` | TEXT | NOT NULL | Nom du template |
| `description` | TEXT | NOT NULL, DEFAULT '' | Description courte |
| `content` | JSONB | NOT NULL, DEFAULT '{}' | Contenu TipTap JSON du template |
| `type_id` | UUID | FK document_types(id) ON DELETE SET NULL | Type de document associe |
| `is_default` | BOOLEAN | NOT NULL, DEFAULT false | true = livre au seeding initial |
| `usage_count` | INT | NOT NULL, DEFAULT 0 | Nombre d'utilisations |
| `created_by` | UUID | FK users(id) ON DELETE SET NULL | Createur du template |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de creation |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de derniere modification |

**Index** : `idx_templates_type_id ON templates(type_id)`

#### Table `documents`

Documents de la base de connaissances. Table centrale du modele.

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identifiant unique |
| `title` | TEXT | NOT NULL | Titre du document |
| `slug` | TEXT | NOT NULL, UNIQUE | Slug URL unique |
| `body` | JSONB | NOT NULL, DEFAULT '{}' | Contenu TipTap/ProseMirror JSON |
| `body_text` | TEXT | NOT NULL, DEFAULT '' | Texte brut extrait (pour indexation Meilisearch) |
| `domain_id` | UUID | NOT NULL, FK domains(id) ON DELETE RESTRICT | Domaine du document |
| `type_id` | UUID | NOT NULL, FK document_types(id) ON DELETE RESTRICT | Type de document (RG-011) |
| `author_id` | UUID | NOT NULL, FK users(id) ON DELETE RESTRICT | Auteur du document |
| `visibility` | doc_visibility | NOT NULL, DEFAULT 'dsi' | Visibilite : public ou dsi |
| `view_count` | INT | NOT NULL, DEFAULT 0 | Compteur de vues |
| `last_verified_at` | TIMESTAMPTZ | nullable | Date de derniere verification de fraicheur |
| `last_verified_by` | UUID | FK users(id) ON DELETE SET NULL | Utilisateur ayant verifie |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de creation |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de derniere modification |

**Indexes** :
- `idx_documents_domain_id ON documents(domain_id)`
- `idx_documents_type_id ON documents(type_id)`
- `idx_documents_author_id ON documents(author_id)`
- `idx_documents_visibility ON documents(visibility)`
- `idx_documents_created_at ON documents(created_at DESC)`
- `idx_documents_updated_at ON documents(updated_at DESC)`

#### Table `tags`

Tags libres pour categoriser les documents.

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identifiant unique |
| `name` | TEXT | NOT NULL, UNIQUE | Nom du tag |
| `slug` | TEXT | NOT NULL, UNIQUE | Slug URL |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de creation |

#### Table `document_tags`

Table de jointure many-to-many entre documents et tags.

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `document_id` | UUID | PK (composite), FK documents(id) ON DELETE CASCADE | Document |
| `tag_id` | UUID | PK (composite), FK tags(id) ON DELETE CASCADE | Tag |

**Index** : `idx_document_tags_tag_id ON document_tags(tag_id)`

#### Table `verification_log`

Historique des verifications de fraicheur des documents.

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identifiant unique |
| `document_id` | UUID | NOT NULL, FK documents(id) ON DELETE CASCADE | Document verifie |
| `verified_by` | UUID | NOT NULL, FK users(id) ON DELETE RESTRICT | Verificateur |
| `note` | TEXT | NOT NULL, DEFAULT '' | Note optionnelle |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de verification |

**Indexes** :
- `idx_verification_log_document_id ON verification_log(document_id)`
- `idx_verification_log_created_at ON verification_log(created_at DESC)`

#### Table `attachments`

Pieces jointes associees aux documents (images).

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identifiant unique |
| `document_id` | UUID | NOT NULL, FK documents(id) ON DELETE CASCADE | Document parent |
| `filename` | TEXT | NOT NULL | Nom du fichier original |
| `filepath` | TEXT | NOT NULL | Chemin absolu sur le filesystem |
| `mime_type` | TEXT | NOT NULL, DEFAULT 'application/octet-stream' | Type MIME |
| `size_bytes` | BIGINT | NOT NULL, DEFAULT 0 | Taille en octets |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date d'upload |

**Index** : `idx_attachments_document_id ON attachments(document_id)`

#### Table `search_log`

Logs des recherches pour analytics (RG-010).

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identifiant unique |
| `query` | TEXT | NOT NULL | Termes recherches |
| `result_count` | INT | NOT NULL, DEFAULT 0 | Nombre de resultats |
| `clicked_document_id` | UUID | FK documents(id) ON DELETE SET NULL | Document clique (nullable) |
| `user_id` | UUID | FK users(id) ON DELETE SET NULL | Utilisateur (nullable -- NULL = anonyme) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de la recherche |

**Indexes** :
- `idx_search_log_created_at ON search_log(created_at DESC)`
- `idx_search_log_user_id ON search_log(user_id)`

#### Table `view_log`

Logs des consultations pour analytics (RG-010).

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identifiant unique |
| `document_id` | UUID | FK documents(id) ON DELETE SET NULL | Document consulte |
| `user_id` | UUID | FK users(id) ON DELETE SET NULL | Utilisateur (nullable -- NULL = anonyme) |
| `duration_seconds` | INT | NOT NULL, DEFAULT 0 | Duree de consultation |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de la consultation |

**Indexes** :
- `idx_view_log_document_id ON view_log(document_id)`
- `idx_view_log_created_at ON view_log(created_at DESC)`

#### Table `config`

Store key-value pour la configuration applicative.

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `key` | TEXT | PK | Cle de configuration |
| `value` | TEXT | NOT NULL, DEFAULT '' | Valeur |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date de modification |

**Cles par defaut** :
- `freshness_green` : `90` (jours)
- `freshness_yellow` : `180` (jours)
- `ticket_url` : `''` (URL GLPI)

#### Table `schema_migrations`

Suivi des migrations SQL appliquees.

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `version` | INT | PK | Numero de migration |
| `applied_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Date d'application |

### 4.4 Donnees Initiales (Seed -- `002_seed.sql`)

Au premier lancement, les donnees suivantes sont inserees :

| Entite | Contenu |
|--------|---------|
| **Domaines** (4) | SCI (bleu, #3B82F6), Etudes & Dev (vert, #10B981), Infrastructure (ambre, #F59E0B), Support (rouge, #EF4444) |
| **Types de documents** (11) | Procedure technique, Guide utilisateur, Architecture systeme, FAQ, Troubleshooting, Fiche applicative, Procedure d'installation, Note de version, Guide reseau, Documentation API, Autre |
| **Templates** (10) | 1 template TipTap JSON par type de document (sauf "Autre"), avec sections et placeholders |
| **Utilisateur admin** (1) | Login: `admin`, password: `Admin123!` (bcrypt cost 12), role: admin, onboarding_completed: false |
| **Config** | freshness_green: 90, freshness_yellow: 180, ticket_url: '' |

---

## 5. API Reference

Toutes les routes sont prefixees par `/api`. Les reponses sont en JSON. L'authentification se fait via le header `Authorization: Bearer <token>`.

### 5.1 Health Check

| Methode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/api/health` | Non | Retourne `{"status": "ok"}` |

### 5.2 Authentification (`/api/auth`)

| Methode | Path | Auth | Body | Response |
|---------|------|------|------|----------|
| POST | `/api/auth/login` | Non | `{"username": "...", "password": "..."}` | `{"token": "eyJ...", "user": {id, username, display_name, role, domain_id}}` |
| POST | `/api/auth/logout` | Non | - | `{"message": "logged out"}` |
| GET | `/api/auth/me` | Oui (Bearer) | - | `{id, username, display_name, role, domain_id}` |
| PUT | `/api/auth/password` | Oui (Bearer) | `{"old_password": "...", "new_password": "..."}` | `{"message": "password updated"}` |

### 5.3 Documents (`/api/documents`)

| Methode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/api/documents` | OptionalAuth | Liste des documents (filtres: domain_id, type_id, sort, limit, offset). RG-006: les non-authentifies ne voient que visibility=public. |
| GET | `/api/documents/{slug}` | OptionalAuth | Detail d'un document par slug. Incremente view_count (async). Inclut author, domain, type, tags, freshness_badge. |
| POST | `/api/documents` | Oui (Bearer) | Creer un document. Body: `{title, body, domain_id, type_id, tags[], visibility}`. Indexation Meili async. |
| PUT | `/api/documents/{id}` | Oui (Bearer) | Modifier un document. RG-003: auteur OU meme domaine OU admin. Body: `{title, body, domain_id, type_id, tags[], visibility}`. Re-indexation Meili async. |
| DELETE | `/api/documents/{id}` | Oui (Bearer) | Supprimer un document. RG-003: auteur OU meme domaine OU admin. De-indexation Meili async. |
| POST | `/api/documents/{id}/verify` | Oui (Bearer) | Marquer un document comme verifie. Body: `{note}` (optionnel). Met a jour last_verified_at/by + insere dans verification_log. |
| GET | `/api/documents/{id}/verifications` | OptionalAuth | Historique des verifications d'un document (inclut verifier_name). |
| POST | `/api/documents/{id}/attachments` | Oui (Bearer) | Upload d'une piece jointe (multipart/form-data, champ "file"). PNG/JPG/GIF/WebP, max 10 Mo. Stocke dans `/data/uploads/{docID}/`. |
| GET | `/api/documents/{id}/attachments` | OptionalAuth | Liste des pieces jointes d'un document. |
| DELETE | `/api/documents/{id}/attachments/{att_id}` | Oui (Bearer) | Supprimer une piece jointe (DB + fichier sur disque). |

### 5.4 Tags (`/api/documents/tags` et `/api/tags`)

| Methode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/api/tags` ou `/api/documents/tags` | OptionalAuth | Liste des tags. Query param `q` pour filtrage ILIKE (autocomplete, limit 10). |
| POST | `/api/documents/tags` | Oui (Bearer) | Creer un tag. Body: `{name}`. HTTP 409 si doublon. |
| DELETE | `/api/documents/tags/{id}` | Oui (Bearer) | Supprimer un tag. |

### 5.5 Recherche (`/api/search`)

| Methode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/api/search?q=...` | OptionalAuth | Recherche full-text via Meilisearch. Query params: `q` (min 2 car.), `domain` (UUID), `type` (UUID), `limit` (max 50, defaut 20), `offset`. RG-006: filtre auto visibility=public pour non-auth. Response: `{results[], total, query, processing_time_ms}`. Chaque resultat inclut: id, title, body_text_highlight, domain_id, type_id, visibility, tags[], author_name, view_count, freshness_badge, created_at. |

### 5.6 Administration (`/api/admin`)

Toutes les routes admin requierent : Bearer token + role "admin".

#### Templates

| Methode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/api/admin/templates` | Admin | Liste tous les templates (tri par usage_count DESC). |
| POST | `/api/admin/templates` | Admin | Creer un template. Body: `{name, description, content, type_id}`. |
| PUT | `/api/admin/templates/{id}` | Admin | Modifier un template. Body: `{name, description, content, type_id}`. |
| DELETE | `/api/admin/templates/{id}` | Admin | Supprimer un template. |

#### Domaines

| Methode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/api/admin/domains` | Admin | Liste des domaines (avec doc_count). |
| POST | `/api/admin/domains` | Admin | Creer un domaine. Body: `{name, color, icon}`. Slug auto-genere. |
| PUT | `/api/admin/domains/{id}` | Admin | Modifier un domaine. Body: `{name, color, icon}`. |
| DELETE | `/api/admin/domains/{id}` | Admin | Supprimer un domaine. HTTP 409 si des documents existent encore. |

#### Utilisateurs

| Methode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/api/admin/users` | Admin | Liste tous les utilisateurs (tri par created_at DESC). |
| POST | `/api/admin/users` | Admin | Creer un utilisateur. Body: `{username, display_name, password, role, domain_id}`. Password min 8 car., hash bcrypt. |
| PUT | `/api/admin/users/{id}` | Admin | Modifier un utilisateur. Body: `{display_name, role, domain_id}`. |
| POST | `/api/admin/users/{id}/reset-password` | Admin | Reset du mot de passe. Genere un mot de passe temporaire aleatoire (12 car.). Response: `{temporary_password}`. |

#### Configuration

| Methode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/api/admin/config/freshness` | Admin | Seuils de fraicheur actuels. Response: `{green_days, yellow_days}`. |
| PUT | `/api/admin/config/freshness` | Admin | Modifier les seuils. Body: `{green_days, yellow_days}`. Validation: green < yellow, > 0. |
| GET | `/api/admin/config/ticket-url` | Admin | URL du portail tickets. Response: `{url}`. |
| PUT | `/api/admin/config/ticket-url` | Admin | Modifier l'URL tickets. Body: `{url}`. |

### 5.7 Donnees Publiques (sans auth)

| Methode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/api/domains` | Non | Liste des domaines avec doc_count (tri par sort_order, name). |
| GET | `/api/document-types` | Non | Liste des types de documents (tri par sort_order, name). |
| GET | `/api/config/ticket-url` | Non | URL du portail tickets. |
| GET | `/api/stats` | Non | Statistiques globales: `{documents, searches_month, contributors, updates_month}`. |

### 5.8 Analytics (`/api/analytics`)

| Methode | Path | Auth | Description |
|---------|------|------|-------------|
| POST | `/api/analytics/search-log` | OptionalAuth | Loguer une recherche. Body: `{query, result_count, clicked_document_id?}`. user_id NULL si non auth (RG-010). |
| POST | `/api/analytics/view-log` | OptionalAuth | Loguer une consultation. Body: `{document_id, duration_seconds}`. user_id NULL si non auth. |
| POST | `/api/analytics/view-count` | OptionalAuth | Incrementer le compteur de vues. Body: `{document_id}`. |

### 5.9 Import CLI

Pas une route HTTP. Sous-commande du binary :

```bash
plumenote import <folder> --author-id=UUID
# ou
PLUMENOTE_AUTHOR_ID=UUID plumenote import <folder>
```

Necessite `DATABASE_URL` en variable d'environnement. Necessite `pandoc` et `pdftotext` installes. Formats supportes : .doc, .docx, .pdf, .txt, .md.

---

## 6. Infrastructure

### 6.1 Docker Compose -- 4 Services

```yaml
services:
  plumenote-app:        # Go binary + SPA React embeddee
    ports: 8080:8080
    depends_on: [plumenote-db (healthy), plumenote-search (healthy)]
    volumes: uploads:/data/uploads
    restart: unless-stopped

  plumenote-db:         # PostgreSQL 18 Alpine
    image: postgres:18-alpine
    ports: 5432:5432
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ../migrations:/docker-entrypoint-initdb.d:ro    # Migrations auto au 1er lancement
    healthcheck: pg_isready -U plumenote (5s interval, 5 retries)
    restart: unless-stopped

  plumenote-search:     # Meilisearch CE v1.37
    image: getmeili/meilisearch:v1.37
    ports: 7700:7700
    volumes: meilidata:/meili_data
    healthcheck: curl -f http://localhost:7700/health (5s interval, 5 retries)
    restart: unless-stopped

  plumenote-caddy:      # Caddy v2 Alpine (reverse proxy HTTPS)
    image: caddy:2-alpine
    ports: 80:80, 443:443
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [plumenote-app]
    restart: unless-stopped

volumes:
  pgdata:         # Donnees PostgreSQL persistantes
  meilidata:      # Index Meilisearch persistant
  uploads:        # Pieces jointes uploadees
  caddy_data:     # Certificats TLS Caddy
  caddy_config:   # Configuration Caddy
```

### 6.2 Dockerfile -- Multi-stage Build

```dockerfile
# Stage 1: Build React (node:22-alpine)
#   npm ci + npm run build -> /app/web/dist

# Stage 2: Build Go (golang:1.26-alpine)
#   go mod download + go build -> /plumenote
#   Copie du dist React dans cmd/plumenote/static (embed)

# Stage 3: Runtime (alpine:3.21)
#   ca-certificates + tzdata
#   Binary unique: /usr/local/bin/plumenote
#   EXPOSE 8080
```

### 6.3 Variables d'Environnement

| Variable | Description | Valeur par defaut (dev) |
|----------|-------------|------------------------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgres://plumenote:plumenote@localhost:5432/plumenote?sslmode=disable` |
| `MEILI_URL` | URL du serveur Meilisearch | `http://localhost:7700` |
| `MEILI_MASTER_KEY` | Cle API Meilisearch | `plumenote-dev-key` |
| `JWT_SECRET` | Secret pour signer les JWT HS256 | `plumenote-dev-secret-change-me` |
| `LISTEN_ADDR` | Adresse d'ecoute HTTP | `:8080` |
| `POSTGRES_DB` | Nom de la base (Docker) | `plumenote` |
| `POSTGRES_USER` | Utilisateur PG (Docker) | `plumenote` |
| `POSTGRES_PASSWORD` | Mot de passe PG (Docker) | `plumenote` |

### 6.4 Commandes Make

| Commande | Description |
|----------|-------------|
| `make dev` | Demarre l'environnement de dev : containers DB + Meili, Vite dev server (port 5173), Go run (port 8080) |
| `make build` | Build de production : npm ci + build frontend, copie dist dans static, CGO_ENABLED=0 go build |
| `make test` | Execute les tests Go (`go test ./...`) |
| `make sqlc` | Regenere le code Go depuis les queries SQL (sqlc generate) |
| `make migrate` | Message informatif (migrations auto via docker-entrypoint-initdb.d) |
| `make deploy` | Docker Compose build et up (`docker compose up -d --build`) |
| `make clean` | Nettoie bin/, static, dist, node_modules |

### 6.5 Migrations SQL

Les migrations sont appliquees automatiquement au premier demarrage de PostgreSQL via le mecanisme `docker-entrypoint-initdb.d`. Les fichiers SQL du dossier `migrations/` sont montes en read-only dans le container et executes dans l'ordre alphabetique :

1. `001_init.sql` -- Schema complet (13 tables, 2 enums, indexes)
2. `002_seed.sql` -- Donnees initiales (4 domaines, 11 types, 10 templates, 1 admin, config)

Le suivi des migrations est assure par la table `schema_migrations` (version + date).

---

## 7. Architecture Decision Records (ADR)

### ADR-001 : Monolithe Modulaire

- **Contexte** : Projet MVP, 1 developpeur principal (Alexandre + Claude), 50 utilisateurs, self-hosted 1 VM.
- **Options evaluees** : (A) Microservices Go, (B) Monolithe modulaire Go, (C) Serverless.
- **Decision** : **(B) Monolithe modulaire**. Un binary Go ~15 Mo contenant API REST, moteur fraicheur, import, serveur SPA (embed).
- **Justification** : 1 binary a deployer/debugger. Pas de reseau inter-services. Discipline d'interfaces entre packages (`internal/auth`, `internal/document`, etc.).
- **Consequences** : Refactoring en microservices possible si >500 users. Simplicite operationnelle maximale.

### ADR-002 : Auth Locale bcrypt + JWT

- **Contexte** : Self-hosted (P0). Acces postes lambda. ~20 comptes DSI.
- **Options evaluees** : (A) Keycloak, (B) Auth locale bcrypt/JWT, (C) LDAP direct.
- **Decision** : **(B) bcrypt cost 12 + JWT HS256**. Comptes crees par admin dans backoffice.
- **Justification** : Keycloak = +1 container, +512 Mo RAM pour 20 comptes. LDAP = integration AD non specifiee. Auth locale = pont fiable vers LDAP V2 (meme table users, ajout provider via interface Authenticator).
- **Consequences** : Zero dependance externe. Pas de SSO. LDAP/OIDC prevu en V2.

### ADR-003 : Meilisearch CE

- **Contexte** : Full-text <1.5s, tolerance typos (US-103), highlighting (US-104), ~500 docs.
- **Options evaluees** : (A) PostgreSQL FTS, (B) Elasticsearch, (C) Meilisearch CE, (D) ParadeDB pg_search.
- **Decision** : **(C) Meilisearch CE v1.37 (MIT)**.
- **Justification** : PG FTS sans typo-tolerance native (deal-breaker). Elasticsearch 1 Go+ RAM. ParadeDB pre-v1.0/AGPL. Meilisearch ~150 Mo RAM, <50ms, tout natif.
- **Consequences** : US-103/104/107 couverts. Pas de search semantique (V2.0). Surveiller ParadeDB.

### ADR-004 : JSONB PostgreSQL 18

- **Contexte** : TipTap 3 produit un arbre JSON ProseMirror.
- **Options evaluees** : (A) Markdown TEXT, (B) HTML TEXT, (C) JSONB.
- **Decision** : **(C) JSONB PostgreSQL 18**. PKs UUIDv7 natif.
- **Justification** : Zero conversion save/load. JSONB indexable et requetable SQL/JSON. Extraction texte pour Meilisearch via traversee arbre.
- **Consequences** : Round-trip parfait TipTap <-> PG. ~1.5x taille vs Markdown, non significatif pour 500 docs.

### ADR-005 : Pas de CRDT / Collaboration Temps Reel au MVP

- **Contexte** : 50 users, probabilite d'edition simultanee quasi nulle.
- **Decision** : Pas de Yjs/CRDT. Verrouillage optimiste last-write-wins + avertissement.
- **Consequences** : -40% complexite (pas de WebSocket). Yjs V1.0 si besoin prouve.

### ADR-006 : Caddy v2

- **Contexte** : HTTPS sur `plumenote.cpam92.local`, certificats internes.
- **Decision** : **Caddy v2**. Config 10 lignes. TLS auto/certs internes. SPA fallback.
- **Justification** : nginx = config TLS manuelle, verbeux. Caddy = HTTPS natif, HTTP/3, ~20 Mo RAM.

### ADR-007 : PostgreSQL 18 (pas 16 ni 17)

- **Contexte** : P0 mentionnait PG16. Audit mars 2026 : PG18 sorti sept. 2025, stable.
- **Decision** : **PostgreSQL 18**.
- **Justification** : AIO = jusqu'a 3x perf lectures (workload KM). UUIDv7 natif (PKs ordonnees temporellement). SQL/JSON (herite PG17) pour JSONB TipTap. OAuth2 natif (prepare V2).
- **Consequences** : Perf + DX ameliorees sans cout. Image `postgres:18-alpine` disponible.

---

## 8. Regles Metier

| ID | Regle | Description |
|----|-------|-------------|
| **RG-001** | Indexation temps reel | Document indexe dans Meilisearch < 10 secondes apres sauvegarde. Couverture: titre, corps, tags, metadonnees. |
| **RG-002** | Performance de recherche | Temps saisie -> affichage < 1.5s pour 500 docs. Debounce 200ms cote frontend. |
| **RG-003** | Permissions 3 niveaux | Public: lecture docs public. DSI: lecture tout, ecriture son domaine. Admin: tous droits + backoffice. |
| **RG-004** | Badge de fraicheur | Base sur last_verified_at. Seuils configurables (defaut: vert <90j, jaune 90-180j, rouge >180j). |
| **RG-005** | Auth locale V1 | Comptes crees par admin. bcrypt + JWT. Sessions persistantes (24h). V2: LDAP/SSO. |
| **RG-006** | Filtrage vue publique | Documents visibility="dsi" strictement invisibles pour les non-authentifies (recherche, navigation, suggestions). |
| **RG-007** | Publication immediate | Pas de brouillon. Tout document sauvegarde = publie immediatement. |
| **RG-008** | Templates subsidiaires | Templates proposes, jamais imposes. 10 templates par defaut au seeding. L'utilisateur peut tout modifier. |
| **RG-009** | Pipeline d'import | Word (.docx via Pandoc), PDF (pdftotext), TXT/MD (Pandoc). Import batch CLI. Convention dossiers pour domaines. |
| **RG-010** | Logs analytics | Stockes en PostgreSQL. Vue publique anonymisee (user_id NULL). Requetables SQL par admin. |
| **RG-011** | Types de document | Type obligatoire par document, configurable par admin. 11 types par defaut. Filtrable dans Meilisearch. |

---

## 9. Performance et Securite

### 9.1 SLA Performance

| Metrique | Cible | Implementation |
|----------|-------|----------------|
| Recherche API (p95) | < 200ms | Meili <50ms + enrichissement Go |
| CRUD API (p95) | < 100ms | PG18 AIO + pgx |
| Time to Interactive | < 2s (reseau local) | Vite code splitting + Tailwind 4 Oxide |
| Indexation post-save | < 10s | Goroutine async -> Meilisearch |
| Ouverture Ctrl+K | < 50ms | React state local, zero appel API |
| Debounce recherche | 200ms | Frontend |

### 9.2 Securite

| Domaine | Mesure |
|---------|--------|
| Auth | bcrypt cost 12, JWT HS256, secret en variable d'environnement, expiration 24h |
| Transit | TLS 1.2+ via Caddy, certificats internes CPAM92 |
| Repos | AES-256 disque VM (responsabilite Infra) |
| Mots de passe | Min 8 caracteres, hashes bcrypt, jamais en clair, reset par admin |
| Injection SQL | Requetes parametrees ($1, $2...), zero concatenation SQL |
| XSS | Contenu = arbre JSON (pas HTML brut), champs texte echappes par React |
| Headers | X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: strict-origin |
| RGPD | PII minimales (nom + login + domaine), pas d'email, logs publics anonymises |
| Backup | pg_dump quotidien (cron), rsync /data/uploads/, retention 30 jours |

### 9.3 Dimensionnement

| Metrique | Cible MVP | Horizon V1.0 |
|----------|-----------|--------------|
| Users simultanes | 30 | 50 |
| Documents indexes | 500 | 2 000 |
| Taille base PG | < 500 Mo | < 2 Go |
| RAM totale | < 600 Mo | < 1 Go |
| Infrastructure | 1 VM, 4 Go RAM, 2 vCPU | Vertical (pas de cluster) |

---

> **Document genere a partir de l'analyse exhaustive du code source et de la documentation du projet PlumeNote.**
> **Fichiers de reference** : `docs/P4_2_blueprint.md`, `docs/P4_1_backlog.md`, `docs/P0_cadrage.md`, `go.mod`, `web/package.json`, `internal/server/server.go`, `migrations/001_init.sql`, `docker/docker-compose.yml`
