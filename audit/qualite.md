# Audit Qualite Code & Build -- PlumeNote

Date : 2026-03-07

---

## 1. Tests Go -- Erreurs de compilation

### Q-001 -- `CtxUserID` non defini dans document/handlers_test.go [CRITIQUE]
- **Fichier** : `internal/document/handlers_test.go:22,56,74`
- **Constat** : Les tests utilisent `CtxUserID` (symbole exporte) qui n'existe nulle part dans le package `document`. Le package utilise `auth.UserFromContext()` via le middleware `OptionalAuth`, pas une context key propre. Le symbole `CtxUserID` n'est defini dans aucun fichier Go du projet.
- **Impact** : `go test ./internal/document/...` **ne compile pas**. Tous les tests document sont dead.
- **Fix** : Remplacer `context.WithValue(req.Context(), CtxUserID, "user-1")` par l'injection correcte via `auth.withClaims()` (non exporte -- exporter ou creer un helper test).

### Q-002 -- search/handler_test.go attend des labels inexistants [CRITIQUE]
- **Fichier** : `internal/search/handler_test.go:134,146-161`
- **Constat** : `TestHandleSearch_Success` attend `r.FreshnessBadge == "unknown"` mais `batchFreshness()` avec `deps.DB == nil` retourne `"red"` (pas `"unknown"`). `TestComputeBadge` attend `"fresh"/"aging"/"stale"` mais `computeBadge()` retourne `"green"/"yellow"/"red"`.
- **Impact** : `go test ./internal/search/...` echoue systematiquement. 2 tests en erreur.
- **Fix** : Aligner les valeurs attendues dans les tests avec l'implementation reelle (`green/yellow/red` et `red` au lieu de `unknown`).

---

## 2. Code duplique

### Q-003 -- Triple duplication du middleware optionalAuth [MOYENNE]
- **Fichiers** :
  - `internal/auth/middleware.go:73-99` (`OptionalAuth`)
  - `internal/search/auth.go:20-47` (`optionalAuth` + `jwtClaims` duplique)
  - `internal/analytics/auth.go:15-41` (`optionalAuth` + `jwtClaims` duplique)
- **Constat** : Le middleware JWT optional et la struct `jwtClaims` sont copies-colles 3 fois avec des variantes (context keys differentes, valeur de retour `*string` vs `string`). Search et analytics ont chacun leur propre type `contextKey` et `jwtClaims`.
- **Impact** : Maintenance triple, risque de divergence si un bug est corrige a un seul endroit. Incoherence deja presente : `analytics.userIDFromCtx()` retourne `*string`, `search.userIDFromCtx()` retourne `string`.
- **Fix** : Supprimer les duplicatas dans `search/auth.go` et `analytics/auth.go`. Utiliser `auth.OptionalAuth` + `auth.UserFromContext` partout.

### Q-004 -- `writeJSON` dupliquee 4 fois [BASSE]
- **Fichiers** : `auth/handler.go:202`, `document/handlers.go:53`, `search/handler.go:229`, `analytics/handler.go:104`, `admin/handler.go:23`
- **Constat** : La meme fonction `writeJSON` est definie dans 5 packages (4 copies strictement identiques + `document` qui a aussi `writeError`).
- **Impact** : Code inutilement duplique. Pas de bug fonctionnel.
- **Fix** : Extraire dans un package `internal/httputil` ou laisser en l'etat (acceptable pour un MVP Go).

### Q-005 -- `generateSlug`/`removeAccents` dupliques [BASSE]
- **Fichiers** : `document/helpers.go` et `admin/handler.go:34-59`
- **Constat** : Meme logique slug + removeAccents copiee dans admin et document. L'importer a aussi son propre `slugify()` (moins complete, pas de gestion unicode NFD).
- **Impact** : Divergence potentielle. Si le slug algorithm change, 3 endroits a modifier.
- **Fix** : Extraire dans `internal/slug` ou utiliser `document.GenerateSlug` depuis admin.

---

## 3. Dead code

### Q-006 -- `search.userIDFromCtx` jamais appelee [BASSE]
- **Fichier** : `internal/search/auth.go:55-58`
- **Constat** : La fonction `userIDFromCtx` est definie mais jamais appelee dans le package `search`. `handleSearch` utilise `userRoleFromCtx` uniquement.
- **Impact** : Dead code.
- **Fix** : Supprimer.

### Q-007 -- `auth.GenerateToken` et `auth.HashPassword` exports inutilises [BASSE]
- **Fichier** : `internal/auth/handler.go:209-217`
- **Constat** : `GenerateToken` et `HashPassword` sont exportes mais ne sont importes nulle part dans le codebase. Admin fait son propre bcrypt en local.
- **Impact** : Exports inutiles ou admin devrait les utiliser au lieu de dupliquer.
- **Fix** : Soit utiliser dans admin, soit de-exporter.

### Q-008 -- sqlc configure mais output jamais genere [BASSE]
- **Fichier** : `sqlc.yaml` (output: `internal/db/sqlc`)
- **Constat** : Le dossier `internal/db/sqlc` n'existe pas. Les queries SQL dans `internal/db/queries/*.sql` existent mais `sqlc generate` n'a jamais ete execute. Le code Go fait du SQL raw partout.
- **Impact** : Toute la config sqlc est inutilisee. Les queries SQL dans `internal/db/queries/` sont dead code. Les avantages sqlc (type safety, generation) ne sont pas exploites.
- **Fix** : Soit supprimer sqlc.yaml + `internal/db/queries/`, soit executer `sqlc generate` et migrer les handlers.

---

## 4. Error handling Go

### Q-009 -- Goroutines Meili sans logging d'erreur [MOYENNE]
- **Fichier** : `internal/document/handlers.go:178,470,513-517`
- **Constat** : `go h.indexDocument(docID)` lance une goroutine qui silencieusement ignore toutes les erreurs (`return` sans log a ligne 903, `_, _ =` a ligne 925). La de-indexation (ligne 516) ignore aussi l'erreur.
- **Impact** : Si Meili est down ou si l'indexation echoue, aucun log, aucun retry. L'index Meili peut silencieusement deriver du contenu PG.
- **Fix** : Ajouter `log.Printf` dans `indexDocument` en cas d'erreur sur `AddDocuments` et le fetch DB.

### Q-010 -- `srv.Shutdown` erreur ignoree [BASSE]
- **Fichier** : `cmd/plumenote/main.go:88`
- **Constat** : `srv.Shutdown(shutdownCtx)` retourne une erreur qui est ignoree.
- **Impact** : Si le shutdown echoue (ex: connections pendantes), aucun log.
- **Fix** : `if err := srv.Shutdown(shutdownCtx); err != nil { log.Printf(...) }`.

### Q-011 -- `json.NewEncoder(w).Encode()` erreur ignoree partout [BASSE]
- **Fichiers** : Toutes les fonctions `writeJSON` (5 copies)
- **Constat** : `json.NewEncoder(w).Encode(v)` peut echouer si le writer est ferme mais l'erreur n'est jamais verifiee.
- **Impact** : Extremement improbable en pratique. Pattern standard en Go HTTP.
- **Fix** : Acceptable pour un MVP. Pattern courant dans l'ecosysteme Go.

### Q-012 -- `syncTags` ignore toutes les erreurs [MOYENNE]
- **Fichier** : `internal/document/handlers.go:877-884`
- **Constat** : Les `_, _ = h.deps.DB.Exec(...)` pour DELETE + INSERT tags ignorent silencieusement toute erreur DB.
- **Impact** : Si un tag_id est invalide ou si la DB a un probleme, le client recoit 200 mais les tags ne sont pas sauvegardes.
- **Fix** : Logger les erreurs ou retourner l'erreur au caller (et renvoyer 500 le cas echeant).

### Q-013 -- `rows.Scan` erreur silencieuse dans server.go [MOYENNE]
- **Fichier** : `internal/server/server.go:75-77`
- **Constat** : Dans le handler `/api/domains`, si `rows.Scan` echoue, le domaine est silencieusement `continue` (saute).
- **Impact** : Un domaine corrompu dispaitrait silencieusement de la liste sans aucun log.
- **Fix** : Au minimum ajouter un `log.Printf`.

---

## 5. Securite / XSS

### Q-014 -- `dangerouslySetInnerHTML` avec HTML Meili non sanitise [HAUTE]
- **Fichier** : `web/src/features/search/SearchModal.tsx:362,392`
- **Constat** : `result.title` et `result.body_text_highlight` proviennent des reponses Meilisearch avec balises `<mark>` et sont injectes via `dangerouslySetInnerHTML`. Si un document contient du JS dans son titre (ex: `<img onerror=alert(1)>`), Meili le retourne tel quel dans `_formatted`.
- **Impact** : XSS stockee via le titre ou le body_text d'un document. Un auteur malveillant peut injecter du JS visible pour tous les utilisateurs qui cherchent.
- **Fix** : Sanitiser le HTML avant injection (ex: DOMPurify) ou n'autoriser que les balises `<mark>` dans le highlight.

### Q-015 -- CORS AllowedOrigins: "*" avec AllowCredentials: true [HAUTE]
- **Fichier** : `internal/server/server.go:31-36`
- **Constat** : `AllowedOrigins: []string{"*"}` combine avec `AllowCredentials: true`. Selon la spec CORS, les navigateurs refusent cette combinaison, mais certaines libs forcent le reflect-origin, ce qui revient a permettre toute origine avec credentials.
- **Impact** : Toute page web tierce pourrait envoyer des requetes authentifiees vers l'API PlumeNote.
- **Fix** : Remplacer `"*"` par l'URL de production specifique, ou mettre `AllowCredentials: false`.

---

## 6. TypeScript -- Zero `any`

- **Constat** : Aucun `any` explicite dans le codebase frontend (`web/src/**`). Aucun `as any` cast. Les props et types API sont tous types.
- **Resultat** : **Excellent**.

---

## 7. Console.log -- Aucun

- **Constat** : Aucun `console.log`, `console.warn`, `console.error`, ou `console.debug` dans `web/src/**`.
- **Resultat** : **Propre**.

---

## 8. TODO/FIXME/HACK -- Aucun

- **Constat** : Aucun commentaire `TODO`, `FIXME`, `HACK`, ou `XXX` dans aucun fichier source.
- **Resultat** : **Propre**.

---

## 9. Hardcoded values

### Q-016 -- Seuils freshness hardcodes en double [BASSE]
- **Fichiers** : `document/handlers.go:22-23` (30, 180), `search/handler.go:196-202` (30, 180), `admin/handler.go:556-574` (defaults 30, 90)
- **Constat** : Les seuils green/yellow sont hardcodes a 3 endroits differents (30/180 dans document et search, 30/90 dans admin). La config admin permet de modifier via DB mais les handlers document/search ignorent la config et utilisent des constantes.
- **Impact** : Modifier les seuils dans l'admin n'a aucun effet. Incoherence 180 vs 90 pour le seuil yellow.
- **Fix** : Lire les seuils depuis la table `config` dans les handlers, ou au minimum rendre les constantes coherentes.

### Q-017 -- Types de documents hardcodes dans le frontend [BASSE]
- **Fichier** : `web/src/features/editor/EditorPage.tsx:33-39`, `web/src/features/search/SearchModal.tsx:293-298`
- **Constat** : Les types de documents (Procedure, Guide, FAQ, Architecture, Runbook) sont hardcodes dans le frontend. La table `document_types` existe en DB mais le frontend n'a pas d'endpoint pour les lister dynamiquement.
- **Impact** : Ajouter un type en DB ne suffit pas, il faut modifier le frontend.
- **Fix** : Ajouter un endpoint `GET /api/document-types` et le consommer dans le frontend.

### Q-018 -- Chemin upload hardcode `/data/uploads` [BASSE]
- **Fichier** : `internal/document/handlers.go:24`
- **Constat** : `uploadBasePath = "/data/uploads"` est hardcode, pas configurable via env.
- **Impact** : En dev local, les uploads vont dans `/data/uploads` ce qui necessite des permissions root ou n'existe pas. Le Dockerfile ne cree pas ce dossier ni ne monte un volume.
- **Fix** : Rendre configurable via env `UPLOAD_PATH` avec fallback a `./uploads` en dev.

---

## 10. Bundle size / Lazy loading

### Q-019 -- Shiki charge codeToHtml dans DocumentContent (non lazy) [MOYENNE]
- **Fichier** : `web/src/features/reader/DocumentContent.tsx:12`
- **Constat** : `import { codeToHtml } from 'shiki'` est un import statique dans `DocumentContent`. Shiki est une lib lourde (~1-2 MB). Bien que le `ReaderPage` est lazy-loaded via `React.lazy()` dans `App.tsx`, Shiki sera dans le chunk reader, pas dans un chunk separe.
- **Impact** : Le chunk reader sera lourd. Les pages sans code blocks chargeront quand meme Shiki.
- **Fix** : Utiliser `import('shiki').then(...)` dynamique dans le `useEffect` au lieu de l'import statique. Le code le fait deja de facon asynchrone (`async` dans le forEach), il suffit de rendre l'import dynamique.

### Q-020 -- lowlight importe 2 fois (editor + reader) [BASSE]
- **Fichier** : `TipTapEditor.tsx:12` et `DocumentContent.tsx:11`
- **Constat** : `createLowlight(common)` est instancie dans les deux composants. lowlight est une dependency de CodeBlockLowlight.
- **Impact** : Duplication mineure dans 2 chunks. Vite devrait les deduper dans un shared chunk.
- **Fix** : Pas bloquant.

### Q-021 -- Lazy loading correctement configure [OK]
- **Fichier** : `web/src/App.tsx:6-14`
- **Constat** : Toutes les pages (Auth, Home, Search, Reader, Editor, Admin, Profile, Domain) sont lazy-loadees via `React.lazy()` avec `Suspense` fallback.
- **Resultat** : **Bon** -- code splitting actif.

---

## 11. Docker

### Q-022 -- Pas de .dockerignore [MOYENNE]
- **Constat** : Aucun fichier `.dockerignore` a la racine ou dans `docker/`.
- **Impact** : Le `COPY . .` dans le stage backend copie `node_modules/`, `web/node_modules/`, `.git/`, etc. dans le build context Docker. Cela ralentit enormement le build et augmente la taille du context.
- **Fix** : Creer `.dockerignore` avec : `node_modules/`, `.git/`, `bin/`, `web/dist/`, `web/node_modules/`, `*.md`.

### Q-023 -- Dockerfile multi-stage correct [OK]
- **Fichier** : `docker/Dockerfile`
- **Constat** : 3 stages (frontend node:22-alpine, backend golang:1.24-alpine, final alpine:3.21). Le binaire est compile avec `CGO_ENABLED=0`. L'image finale est alpine avec ca-certificates et tzdata.
- **Resultat** : **Bon**.

### Q-024 -- Volume uploads non monte dans docker-compose [MOYENNE]
- **Fichier** : `docker/docker-compose.yml`
- **Constat** : Le handler upload ecrit dans `/data/uploads` mais aucun volume n'est monte pour ce chemin dans docker-compose. Les uploads sont perdus a chaque restart du conteneur.
- **Impact** : Les pieces jointes ne survivent pas a un redemarrage.
- **Fix** : Ajouter `- uploads:/data/uploads` dans les volumes de `plumenote-app`.

---

## 12. Coherence imports Go

### Q-025 -- Module path coherent [OK]
- **Constat** : `go.mod` declare `github.com/alexmusic/plumenote`. Tous les imports internes utilisent `github.com/alexmusic/plumenote/internal/...`. Pas d'import circulaire.
- **Resultat** : **Bon**.

### Q-026 -- Pas d'imports circulaires [OK]
- **Constat** : La dependance est lineaire : `cmd/plumenote` -> `internal/server` -> `internal/{auth,document,search,admin,analytics}` -> `internal/model`. Le package `auth` est importe par `document`, `admin`, `search`, `analytics` pour les context helpers et middleware, mais aucun cycle inverse.
- **Resultat** : **Bon**.

---

## 13. Makefile

### Q-027 -- `make dev` lance le frontend en background sans cleanup [BASSE]
- **Fichier** : `Makefile:6`
- **Constat** : `cd web && npm run dev &` lance Vite en arriere-plan. Quand `go run` se termine, le processus Vite reste orphelin.
- **Impact** : Processus zombie possible en dev.
- **Fix** : Utiliser `trap` ou un outil comme `overmind`/`hivemind`.

### Q-028 -- `make build` copie static dans cmd/plumenote/static [OK]
- **Fichier** : `Makefile:10-12`
- **Constat** : `cp -r web/dist cmd/plumenote/static` puis `go build`. Coherent avec l'embed `//go:embed all:static` dans `main.go`.
- **Resultat** : **Bon** -- le build pipeline est correct.

### Q-029 -- `make sqlc` appelle `sqlc generate` mais pas de generated code [INFO]
- **Fichier** : `Makefile:17-18`
- **Constat** : La commande est definie mais n'a jamais ete executee (voir Q-008).
- **Resultat** : Coherent avec Q-008.

---

## 14. Tests Go -- Couverture

| Package | Fichiers _test.go | Tests reels | Compilent | Cas d'erreur testes |
|---------|------------------|-------------|-----------|---------------------|
| auth | handler_test.go, middleware_test.go | 15 tests | Oui | Oui (token expire, mauvais secret, missing header, mauvais role, domain mismatch, password trop court) |
| document | handlers_test.go, helpers_test.go | 14 tests | **NON** (Q-001) | Oui (missing title, no auth, invalid visibility, missing domain) |
| search | handler_test.go | 4 tests | Oui, mais **echouent** (Q-002) | Oui (query trop courte, filtre domaine) |
| analytics | handler_test.go | 5 tests | Oui | Oui (missing query, invalid body, missing document_id) |
| admin | handler_test.go | 8 tests | Oui | Oui (no auth, slug, password gen, freshness validation) |
| importer | importer_test.go, html_to_tiptap_test.go | 19 tests | Oui | Oui (slugify, HTML parsing, empty input, nested marks) |

**Bilan** : 65 tests ecrits. Seul le package `auth` compile et passe completement. `document` ne compile pas (Q-001). `search` compile mais 2 tests echouent (Q-002). Les tests sont de vrais tests (pas des stubs vides) avec des cas d'erreur varies.

---

## 15. Recapitulatif des anomalies par severite

| Severite | ID | Fichier | Resume |
|----------|-----|---------|--------|
| CRITIQUE | Q-001 | document/handlers_test.go | `CtxUserID` non defini -- tests ne compilent pas |
| CRITIQUE | Q-002 | search/handler_test.go | Valeurs attendues incorrectes (unknown/fresh/aging/stale vs green/yellow/red) |
| HAUTE | Q-014 | SearchModal.tsx:362,392 | XSS via dangerouslySetInnerHTML sur des highlights Meili non sanitises |
| HAUTE | Q-015 | server.go:31-36 | CORS `"*"` + AllowCredentials -- toute origine peut faire des requetes authentifiees |
| MOYENNE | Q-003 | search/auth.go, analytics/auth.go | Triple duplication du middleware optionalAuth + jwtClaims |
| MOYENNE | Q-009 | document/handlers.go:178,903,925 | Goroutines Meili sans log d'erreur -- index peut deriver silencieusement |
| MOYENNE | Q-012 | document/handlers.go:877-884 | syncTags ignore toutes les erreurs DB |
| MOYENNE | Q-013 | server.go:75-77 | rows.Scan erreur silencieuse dans le listing domains |
| MOYENNE | Q-016 | handlers.go, handler.go | Seuils freshness hardcodes et incoherents (180 vs 90) |
| MOYENNE | Q-019 | DocumentContent.tsx:12 | Shiki importe statiquement -- chunk reader inutilement lourd |
| MOYENNE | Q-022 | racine | Pas de .dockerignore -- build Docker lent |
| MOYENNE | Q-024 | docker-compose.yml | Volume uploads non monte -- donnees perdues au restart |
| BASSE | Q-004 | 5 packages | writeJSON dupliquee 5 fois |
| BASSE | Q-005 | document + admin + importer | generateSlug dupliquee 3 fois |
| BASSE | Q-006 | search/auth.go:55 | userIDFromCtx dead code |
| BASSE | Q-007 | auth/handler.go:209-217 | Exports GenerateToken/HashPassword inutilises |
| BASSE | Q-008 | sqlc.yaml | sqlc configure mais jamais execute |
| BASSE | Q-010 | main.go:88 | srv.Shutdown erreur ignoree |
| BASSE | Q-011 | 5 writeJSON | json.Encode erreur ignoree (pattern standard) |
| BASSE | Q-017 | EditorPage.tsx, SearchModal.tsx | Types documents hardcodes dans le frontend |
| BASSE | Q-018 | document/handlers.go:24 | Upload path hardcode /data/uploads |
| BASSE | Q-020 | TipTapEditor.tsx, DocumentContent.tsx | lowlight instancie 2 fois |
| BASSE | Q-027 | Makefile:6 | make dev laisse Vite orphelin |
