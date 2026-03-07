# Audit Securite & Auth -- PlumeNote MVP

Date : 2026-03-07
Scope : Auth, permissions, JWT, bcrypt, SQL injection, XSS, CSRF, secrets, CORS

---

## Constats

### BLOQUANT -- Auth bypass sur toutes les routes document (POST/PUT/DELETE)

**Ref specs** : US-201 / RG-003 / RG-005 / ADR-002
**Fichier(s)** : `internal/document/router.go:14`
**Constat** : Le router document utilise `auth.OptionalAuth` comme unique middleware pour TOUTES les routes, y compris POST `/`, PUT `/{id}`, DELETE `/{id}`, POST `/{id}/verify`, POST `/{id}/attachments`, DELETE `/{id}/attachments/{att_id}`, POST `/tags`, DELETE `/tags/{id}`. Les handlers individuels verifient `getUserID(r.Context()) == ""` et retournent 401, mais cette verification est faite au niveau handler et non middleware. Cela signifie :
1. Il n'y a aucune protection middleware contre les requetes non authentifiees sur les routes d'ecriture.
2. La logique d'auth est dispersee dans chaque handler au lieu d'etre centralisee.
3. Un oubli dans un handler (ex: `listDocuments`, `getDocument`, `listVerifications`, `listAttachments`, `listTags`) expose les donnees sans aucun controle.

En pratique, `curl GET /api/documents` et `curl GET /api/documents/{slug}` retournent TOUS les documents (y compris DSI) sans aucun filtre de visibilite pour les anonymes.
**Impact** : Un utilisateur anonyme peut lire tous les documents DSI via l'API document (contournement de RG-003 et RG-006). Les routes d'ecriture sont protegees au niveau handler mais de facon fragile.
**Fix** : Separer le router en deux groupes : routes publiques (GET avec OptionalAuth + filtre visibility) et routes protegees (POST/PUT/DELETE avec RequireAuth middleware). Appliquer le filtre `visibility = 'public'` dans `buildListQuery` et `getDocument` pour les anonymes.

---

### BLOQUANT -- Pas de filtre visibility sur GET /api/documents pour les anonymes (RG-006)

**Ref specs** : RG-006 / US-202
**Fichier(s)** : `internal/document/handlers.go:244-271` (buildListQuery), `internal/document/handlers.go:274-360` (getDocument)
**Constat** : La fonction `buildListQuery` ne filtre JAMAIS sur la colonne `visibility`. Un anonyme qui appelle `GET /api/documents` recoit tous les documents, y compris ceux avec `visibility='dsi'`. De meme, `getDocument` (GET par slug) retourne n'importe quel document sans verifier la visibilite ni l'authentification. RG-006 specifie : "Les documents DSI et Admin sont strictement invisibles -- ni recherche, ni suggestions, ni navigation" pour les anonymes.

Note : le handler search (Meilisearch) applique correctement le filtre `visibility = public` pour les anonymes (`internal/search/handler.go:58-60`), mais le contournement est trivial via l'API document directe.
**Impact** : Fuite de donnees DSI internes vers tout utilisateur non authentifie via `GET /api/documents` ou `GET /api/documents/{slug}`.
**Fix** : Dans `buildListQuery`, si l'utilisateur n'est pas authentifie (role vide), ajouter `AND d.visibility = 'public'`. Dans `getDocument`, verifier que le document est public si l'utilisateur est anonyme.

---

### BLOQUANT -- bcrypt cost 10 au lieu de 12 (ADR-002)

**Ref specs** : ADR-002
**Fichier(s)** : `internal/auth/handler.go:159`, `internal/auth/handler.go:215`, `internal/admin/handler.go:464`, `internal/admin/handler.go:525`
**Constat** : Les 4 appels a `bcrypt.GenerateFromPassword` utilisent `bcrypt.DefaultCost` qui vaut 10 dans la bibliotheque Go standard. ADR-002 et le blueprint NFR Securite specifient explicitement "bcrypt cost 12". Le seed SQL (`migrations/002_seed.sql:81`) utilise bien un hash `$2a$12$`, mais tout nouveau mot de passe cree ou change en runtime sera hashe avec cost 10.
**Impact** : Les nouveaux mots de passe sont environ 4x plus rapides a bruteforcer que specifie. Violation de ADR-002.
**Fix** : Remplacer `bcrypt.DefaultCost` par la constante `12` dans les 4 occurrences. Definir une constante `const bcryptCost = 12` dans le package auth et l'utiliser partout.

---

### BLOQUANT -- CORS AllowedOrigins: * avec AllowCredentials: true

**Ref specs** : ADR-002 / NFR Securite
**Fichier(s)** : `internal/server/server.go:30-37`
**Constat** : La configuration CORS accepte toutes les origines (`AllowedOrigins: []string{"*"}`) tout en activant `AllowCredentials: true`. Les navigateurs modernes bloquent cette combinaison (la spec CORS interdit wildcard avec credentials). Selon le middleware chi/cors, cela peut soit etre ignore, soit casser silencieusement les requetes cross-origin avec credentials.
**Impact** : Soit les requetes cross-origin echouent silencieusement (bug fonctionnel), soit si le middleware contourne la restriction, n'importe quel site peut faire des requetes authentifiees vers l'API PlumeNote.
**Fix** : Puisque l'app est self-hosted et le SPA est servi par le meme serveur, supprimer le CORS wildcard. Soit retirer `AllowCredentials: true`, soit configurer `AllowedOrigins` avec le domaine reel de deploiement (ex: `https://plumenote.cpam92.fr`).

---

### MAJEUR -- Secrets en clair dans docker-compose.yml

**Ref specs** : NFR Securite / ADR-002
**Fichier(s)** : `docker/docker-compose.yml:10-14`, `docker/docker-compose.yml:26-28`, `docker/docker-compose.yml:45`
**Constat** : Les secrets suivants sont en clair dans le fichier de configuration :
- `JWT_SECRET: plumenote-jwt-secret-change-me`
- `MEILI_MASTER_KEY: plumenote-master-key-change-me`
- `POSTGRES_PASSWORD: plumenote`
- `DATABASE_URL` contient le mot de passe en clair

Bien que les noms contiennent "change-me", il n'y a aucun mecanisme pour forcer le changement. Le fichier sera probablement commite dans git.
**Impact** : Si deploye tel quel, le JWT secret est previsible et un attaquant peut forger des tokens JWT admin. Le mot de passe PostgreSQL par defaut est trivial.
**Fix** : Utiliser des variables d'environnement avec `.env` file (ajoute au .gitignore) ou Docker secrets. Documenter le changement obligatoire des secrets avant premier deploiement. Ajouter une verification au demarrage de l'app Go qui refuse de demarrer si JWT_SECRET contient "change-me".

---

### MAJEUR -- Pas de validation min 8 chars a la creation de compte admin

**Ref specs** : US-206 / NFR Securite
**Fichier(s)** : `internal/admin/handler.go:456-458`
**Constat** : Le handler `handleCreateUser` verifie uniquement que username et password ne sont pas vides (`req.Username == "" || req.Password == ""`), mais ne valide pas la longueur minimale du mot de passe. Le handler `handleChangePassword` (`internal/auth/handler.go:140`) applique correctement `len(req.NewPassword) < 8`. Le handler `handleResetPassword` genere un mot de passe temporaire de 12 chars (OK). Seule la creation de compte est vulnerable.
**Impact** : Un admin peut creer des comptes avec des mots de passe d'un seul caractere, violant la politique de securite.
**Fix** : Ajouter `if len(req.Password) < 8` dans `handleCreateUser` avant le hachage.

---

### MAJEUR -- XSS potentiel via dangerouslySetInnerHTML sur les resultats de recherche

**Ref specs** : NFR Securite (XSS)
**Fichier(s)** : `web/src/features/search/SearchModal.tsx:362`, `web/src/features/search/SearchModal.tsx:392`
**Constat** : Le composant SearchModal utilise `dangerouslySetInnerHTML` pour afficher le titre et l'extrait des resultats de recherche (`result.title` et `result.body_text_highlight`). Ces champs proviennent de Meilisearch qui injecte des balises `<mark>` pour le highlighting. Cependant, si un document a un titre contenant du HTML malveillant (ex: `<img onerror=alert(1)>`), Meilisearch le retournera tel quel avec les balises de highlighting, et le navigateur executera le script.
**Impact** : Un utilisateur DSI authentifie qui insere du HTML malveillant dans un titre de document peut executer du code JavaScript dans le navigateur des autres utilisateurs lors d'une recherche (stored XSS).
**Fix** : Sanitiser le HTML retourne par Meilisearch en n'autorisant que la balise `<mark>`. Utiliser une bibliotheque comme DOMPurify avec `ALLOWED_TAGS: ['mark']` avant d'injecter dans `dangerouslySetInnerHTML`, ou echapper le HTML puis ne reautoriser que `<mark>`.

---

### MAJEUR -- RequireDomainWrite s'appuie sur un header X-Resource-Domain manipulable

**Ref specs** : RG-003
**Fichier(s)** : `internal/auth/middleware.go:101-125`
**Constat** : Le middleware `RequireDomainWrite` lit le `domain_id` de la ressource depuis le header HTTP `X-Resource-Domain` (`r.Header.Get("X-Resource-Domain")`). Ce header peut etre forge par le client. De plus, ce middleware n'est utilise nulle part dans le code -- les handlers document (`updateDocument`, `deleteDocument`) implementent la verification de domaine directement en comparant `docDomainID != userDomainID` depuis la base de donnees, ce qui est correct.
**Impact** : Le middleware est inutilise (pas de risque immediat), mais s'il etait utilise, il serait trivialement contournable en ajoutant `X-Resource-Domain: <mon-domain-id>` dans la requete HTTP.
**Fix** : Supprimer `RequireDomainWrite` qui est du code mort et dangereux. La verification de domaine dans les handlers document est correctement implementee via requete DB.

---

### MAJEUR -- Tag CRUD accessible sans authentification

**Ref specs** : RG-003 / RG-005
**Fichier(s)** : `internal/document/router.go:37-39`, `internal/document/handlers.go:804-848`
**Constat** : Les routes `POST /api/documents/tags` et `DELETE /api/documents/tags/{id}` n'ont aucune verification d'authentification dans leurs handlers (`createTag` et `deleteTag`). Contrairement aux handlers de creation/modification de document, ils ne verifient pas `getUserID()`. Le router utilise `OptionalAuth` uniquement.
**Impact** : Un anonyme peut creer et supprimer des tags via l'API, polluant ou detruisant la taxonomie de l'application.
**Fix** : Ajouter une verification `getUserID(r.Context()) == ""` dans `createTag` et `deleteTag`, ou mieux, grouper ces routes sous `RequireAuth` dans le router.

---

### MINEUR -- Pas de mecanisme de changement obligatoire du mot de passe admin au premier login

**Ref specs** : US-206 / RG-005
**Fichier(s)** : `migrations/002_seed.sql:81`
**Constat** : Le compte admin est cree avec `onboarding_completed = false` et un mot de passe hardcode dans le seed SQL. Le champ `onboarding_completed` existe dans la base et est retourne par l'API `/auth/me`. Cependant, il n'y a aucune logique cote backend ni frontend qui force le changement de mot de passe lors du premier login. Le frontend verifie `onboarding_completed` dans `HomePage.tsx` mais uniquement pour afficher un message de bienvenue, pas pour forcer un changement de mot de passe.
**Impact** : Le mot de passe admin par defaut peut rester inchange indefiniment. Risque eleve si le mot de passe seed est connu (il est dans le code source).
**Fix** : Ajouter dans le middleware auth ou le frontend un flux obligatoire de changement de mot de passe si `onboarding_completed = false` pour les utilisateurs admin.

---

### MINEUR -- CSRF non implemente malgre specification NFR

**Ref specs** : NFR Securite ("CSRF : Token sur mutations, Double-submit cookie ou header X-CSRF-Token")
**Fichier(s)** : `internal/server/server.go` (absent)
**Constat** : Le blueprint NFR Securite specifie "Double-submit cookie ou header X-CSRF-Token" pour la protection CSRF. Aucune protection CSRF n'est implementee. Cependant, comme l'authentification utilise JWT via le header `Authorization` (pas de cookie httpOnly), le risque CSRF est naturellement attenue : un site malveillant ne peut pas inclure le header Authorization dans une requete cross-origin.
**Impact** : Risque faible en pratique grace a l'utilisation de JWT en header. Non-conformite avec la specification NFR.
**Fix** : Soit documenter que CSRF est naturellement mitige par l'usage de JWT en header Authorization (et mettre a jour la spec NFR), soit implementer une protection CSRF si des cookies sont envisages en V2.

---

## Resume

| Severite | Count | Constats |
|----------|-------|----------|
| BLOQUANT | 4     | Auth bypass document routes, pas de filtre visibility, bcrypt cost 10, CORS wildcard+credentials |
| MAJEUR   | 4     | Secrets docker-compose, pas de validation mdp creation user, XSS search results, tag CRUD sans auth |
| MINEUR   | 2     | Pas de force-change mdp premier login, CSRF non implemente |

## Points positifs

- **JWT** : HS256 correctement implemente, verification de la methode de signature (pas de "none" algo), expiration 24h configuree.
- **SQL injection** : Toutes les requetes SQL utilisent des parametres (`$1`, `$2`). Le `buildListQuery` utilise `fmt.Sprintf` mais uniquement pour les numeros de parametres et `orderBy` qui est derive d'une valeur hardcodee (pas d'input utilisateur direct). Les queries sqlc sont toutes parametrees.
- **Admin routes** : Correctement protegees par `RequireAuth` + `requireAdmin` middleware.
- **Search visibility filter** : Correctement implemente dans le handler Meilisearch (filtre `visibility = public` pour anonymes).
- **Password change** : Validation min 8 chars presente dans `handleChangePassword`.
- **Token generation** : Claims complets (user_id, role, domain_id), expiration, issuer.
