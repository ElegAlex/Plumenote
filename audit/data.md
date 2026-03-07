# Audit Data & Migrations -- PlumeNote

Date : 2026-03-07
Auditeur : Agent Data & Migrations

---

## Findings

---

### [CRITIQUE] -- UUIDv7 non implemente : gen_random_uuid() produit du UUIDv4
**Ref specs** : ADR-004 / ADR-007 / P4.2 section 5 "Note PG18"
**Fichier(s)** : migrations/001_init.sql:2, migrations/001_init.sql:12
**Constat** : Le commentaire de la migration dit "UUIDv7 behavior in PG18" mais `gen_random_uuid()` genere du UUIDv4 (RFC 4122) dans **toutes** les versions de PostgreSQL, y compris PG18. PG18 n'a PAS ajoute de fonction `uuidv7()` native. Le blueprint (ligne 377) affirme "toutes les PKs utilisent `uuidv7()` natif" -- c'est factuellement faux. Il n'existe aucune extension ni fonction custom dans le schema.
**Impact** : Les PKs ne sont pas ordonnees temporellement. L'indexage B-tree est sous-optimal (fragmentation due a l'aleatoire UUIDv4). Le tri chronologique par PK est impossible. Violation directe de l'ADR-004 et ADR-007.
**Fix** : Deux options : (A) Installer l'extension `pg_uuidv7` et utiliser `uuid_generate_v7()`. (B) Generer les UUIDv7 cote Go avant insertion (library `github.com/google/uuid` v1.6+ supporte UUIDv7). L'option B est plus portable et ne depend pas d'une extension PG.

---

### [HAUTE] -- Seed non idempotent : pas de ON CONFLICT, re-execution echoue
**Ref specs** : P4.2 section 6 "Strategie de Seeding"
**Fichier(s)** : migrations/002_seed.sql:7-88
**Constat** : Toutes les INSERT du seed utilisent des UUIDs fixes mais aucun n'a de clause `ON CONFLICT DO NOTHING` ou `ON CONFLICT DO UPDATE`. La re-execution de la migration echouera avec une erreur de cle primaire dupliquee. Le blueprint specifie explicitement un mecanisme de detection "deja seede" base sur `SELECT count(*)`.
**Impact** : Si la migration 002 est rejouee (reset, re-deploiement), elle echoue completement. Le `schema_migrations` empeche normalement la re-execution, mais en cas de reset de la table de migrations ou de re-initialisation manuelle, le seed casse.
**Fix** : Ajouter `ON CONFLICT (id) DO NOTHING` sur chaque INSERT du seed, ou `ON CONFLICT DO UPDATE SET name = EXCLUDED.name` pour un upsert complet. Alternativement, encapsuler dans un `DO $$ BEGIN IF NOT EXISTS ... END $$`.

---

### [HAUTE] -- Document types du seed ne correspondent pas au blueprint P4.2
**Ref specs** : RG-011 / P4.2 section 6 "Strategie de Seeding"
**Fichier(s)** : migrations/002_seed.sql:14-25
**Constat** : Le blueprint section 6 liste ces 10 types + Autre :
1. Procedure technique
2. Guide utilisateur
3. Architecture systeme
4. FAQ
5. Troubleshooting
6. Fiche applicative
7. Procedure d'installation
8. Note de version
9. Guide reseau
10. Documentation d'API
11. Autre

Le brief de l'audit (issus du P4.1 backlog RG-011) liste ces 10 types :
1. Procedure
2. Guide utilisateur
3. FAQ
4. Note technique
5. Tutoriel
6. Compte-rendu
7. Cahier des charges
8. Fiche reflexe
9. Modele type
10. Documentation API

Le seed implemente la liste du P4.2 (post-Gate Review), pas celle du P4.1. **C'est en fait coherent avec le blueprint actuel (v3.0)**, mais il y a une divergence entre P4.1 et P4.2 qu'il faut trancher officiellement.
**Impact** : Risque de confusion si quelqu'un se refere au P4.1. Le P4.2 fait autorite (post-Gate Review).
**Fix** : Confirmer formellement que le P4.2 section 6 remplace le P4.1 RG-011. Mettre a jour le P4.1 backlog pour refleter les types finaux, ou ajouter une note de traceabilite.

---

### [HAUTE] -- Colonne doc_count manquante dans la table domains
**Ref specs** : P4.2 section 5, entity DOMAIN
**Fichier(s)** : migrations/001_init.sql:11-20
**Constat** : Le blueprint specifie `int doc_count` dans l'entite DOMAIN. La table `domains` dans 001_init.sql n'a pas cette colonne. Le code Go (internal/admin/handler.go:261, internal/server/server.go:49) calcule `doc_count` dynamiquement via une sous-requete `COALESCE((SELECT count(*) FROM documents WHERE domain_id = d.id), 0)`.
**Impact** : Fonctionnellement OK (le calcul dynamique est meme plus fiable qu'un compteur cache), mais c'est une divergence schema vs spec. Le compteur dynamique a un cout O(n) par domaine lors de chaque list -- acceptable pour 500 docs mais moins pour la scalabilite.
**Fix** : Deux options : (A) Declarer officiellement que `doc_count` est calcule et non stocke (mettre a jour le blueprint). (B) Ajouter la colonne et la maintenir via trigger ou au moment de l'insert/delete document. Option A est preferable au MVP.

---

### [HAUTE] -- SQL inline dans handlers.go : sqlc genere est ignore
**Ref specs** : ADR sur sqlc + pgx / P4.2 section 2
**Fichier(s)** : internal/document/handlers.go:161-166, :205, :295-304, :321, :405-407, :454-460, :506, :553-556, :564-565, :682-686, :743-744, :755, :775-778, :820-822, :838, :858-864, :878-883, :894-901, :909-910
**Constat** : Le package `internal/document/handlers.go` fait **100% de SQL inline** via `h.deps.DB.QueryRow()` / `h.deps.DB.Query()` / `h.deps.DB.Exec()` avec des strings SQL codees en dur. Les queries sqlc dans `internal/db/queries/*.sql` definissent les memes operations (CreateDocument, GetDocumentBySlug, etc.) mais ne sont **jamais utilisees** dans ce handler.
**Impact** :
- Perte de la type-safety sqlc (le code compile meme si les requetes SQL sont invalides)
- Risque de divergence schema/queries : si le schema evolue, les queries inline ne seront pas verifiees par `sqlc generate`
- Duplication : chaque operation existe deux fois (sqlc + inline)
- Maintenance plus difficile : les struct anonymes dans chaque handler reproduisent manuellement le mapping que sqlc genere automatiquement
**Fix** : Migrer progressivement les handlers pour utiliser les queries sqlc generees (`internal/db/sqlc/`). Injecter le `Queries` sqlc dans le handler au lieu du pool pgx brut. Cela ne bloque pas le MVP mais c'est un risque croissant.

---

### [HAUTE] -- view_log CASCADE sur document DELETE : les logs analytics sont perdus
**Ref specs** : P4.2 section 5, RG-010 / US-902/903
**Fichier(s)** : migrations/001_init.sql:147 (`ON DELETE CASCADE`)
**Constat** : `view_log.document_id` est `NOT NULL REFERENCES documents(id) ON DELETE CASCADE`. Quand un document est supprime, TOUS les view_log associes sont supprimes en cascade. Les logs de consultation sont des donnees analytics qui devraient etre **conservees** meme apres suppression du document (RG-010 : analytics requetables par admin).
**Impact** : Perte definitive des statistiques de consultation pour les documents supprimes. L'admin perd la trace du nombre de consultations historiques.
**Fix** : Changer `ON DELETE CASCADE` en `ON DELETE SET NULL` et rendre `document_id` nullable, OU ajouter une soft-delete sur les documents au lieu d'un DELETE physique. La premiere option est la plus simple. Appliquer le meme raisonnement a `search_log.clicked_document_id` (deja `ON DELETE SET NULL` -- correct).

---

### [MOYENNE] -- Meilisearch v1.12 dans docker-compose au lieu de v1.35
**Ref specs** : P4.2 section 2 "Meilisearch CE v1.35"
**Fichier(s)** : docker/docker-compose.yml:42
**Constat** : L'image Meilisearch est `getmeili/meilisearch:v1.12`. Le blueprint specifie v1.35. La difference est de 23 versions mineures.
**Impact** : Fonctionnellement, v1.12 supporte les features utilisees (filterable/searchable/sortable attributes, typo tolerance). Mais les optimisations de performance et les corrections de bugs des versions 1.13-1.35 sont manquantes. Certaines features futures pourraient ne pas etre disponibles.
**Fix** : Mettre a jour l'image vers `getmeili/meilisearch:v1.12` -> `getmeili/meilisearch:v1.35` (ou `latest` en dev). Verifier qu'aucun breaking change ne s'applique (Meili est generalement backward-compatible dans les mineures).

---

### [MOYENNE] -- Caddy sans version pinned
**Ref specs** : P4.2 section 2 "Caddy v2.11"
**Fichier(s)** : docker/docker-compose.yml:58
**Constat** : L'image Caddy est `caddy:2-alpine` (tag flottant). Le blueprint specifie v2.11. Le tag `2-alpine` peut pointer vers n'importe quelle version 2.x.
**Impact** : Risque de build non-reproductible. Une mise a jour automatique de l'image pourrait introduire des breaking changes.
**Fix** : Pinner l'image a `caddy:2.11-alpine` pour la reproductibilite.

---

### [MOYENNE] -- ExtractBodyText ne gere pas les nodes table, alert, codeBlock correctement
**Ref specs** : P4.2 ADR-004 "Extraction texte pour Meilisearch via traversee arbre"
**Fichier(s)** : internal/document/helpers.go:29-64
**Constat** : Test mental avec un document contenant : heading H2, paragraph, codeBlock, table avec texte, alerte avec texte, image.
- **heading H2** : contient `content` avec un node `text` -> extrait OK (concatenation sans separateur)
- **paragraph** : idem -> OK
- **codeBlock** : contient `content` avec un node `text` -> extrait OK
- **table** : structure `table > tableRow > tableHeader/tableCell > paragraph > text`. La fonction traverse recursivement `content` -> OK, mais les cellules sont concatenees SANS espace ni separateur entre elles (ex: "col1col2col3" au lieu de "col1 col2 col3"). Le switch ne traite pas `table`, `tableRow`, `tableCell`, `tableHeader` comme des types block.
- **alerte/callout** : si l'extension utilise un type custom (ex: `alert`), la traversee fonctionne si le node a un `content`. OK.
- **image** : `type: "image"`, pas de `content` ni `text` -> retourne "" -> correct (pas de texte).

Le probleme principal est la **concatenation sans separateur** pour les nodes non-listes dans le switch par defaut (ligne 63). `tableCell`, `tableRow`, `heading`, `paragraph` utilisent tous le cas par defaut `strings.Join(parts, "")`.
**Impact** : Le texte extrait d'une table sera "mot1mot2mot3" au lieu de "mot1 mot2 mot3". La recherche Meilisearch ne trouvera pas les mots individuels dans une cellule de table.
**Fix** : Ajouter `table`, `tableRow`, `tableCell`, `tableHeader`, `heading`, `paragraph`, `codeBlock` au switch pour les joindre avec `" "` ou `"\n"`. Suggestion :
```go
case "doc", "bulletList", "orderedList", "blockquote", "table", "tableRow":
    return strings.Join(parts, "\n")
case "paragraph", "heading", "tableCell", "tableHeader", "codeBlock":
    return strings.Join(parts, " ")
```

---

### [MOYENNE] -- Freshness default 30j (green) au lieu de 90j (config seed)
**Ref specs** : RG-004 / P4.2 section 6
**Fichier(s)** : internal/document/handlers.go:22 vs migrations/002_seed.sql:85
**Constat** : Le handler utilise `defaultGreenDays = 30` (ligne 22) tandis que le seed insere `freshness_green = '90'` dans la table config (ligne 85). Le handler ne lit PAS la table config -- il utilise une constante codee en dur. Les deux valeurs different (30 vs 90).
**Impact** : Un document verifie il y a 45 jours sera affiche en jaune alors que la config dit qu'il devrait etre vert (<90j). Le seed est inutile car la config n'est jamais lue par le code.
**Fix** : Lire les seuils de fraicheur depuis la table config au demarrage (ou a chaque requete avec cache). Le `defaultGreenDays` ne devrait etre qu'un fallback si la config est absente.

---

### [MOYENNE] -- Pas de transaction pour create/update document + tags + Meili
**Ref specs** : P4.2 Flow 2 "Contribution"
**Fichier(s)** : internal/document/handlers.go:161-180
**Constat** : La creation d'un document fait :
1. INSERT document (ligne 161)
2. syncTags avec DELETE + INSERT individuels (lignes 173-175, 878-883)
3. indexDocument via goroutine async (ligne 178)

Les etapes 1 et 2 ne sont PAS dans une transaction. Si le syncTags echoue a mi-chemin (ex: FK invalide), certains tags seront ajoutes et d'autres non, avec le document deja committe.
**Impact** : Etat inconsistant possible (document sans tous ses tags). La goroutine Meili est acceptable en async (si Meili est down, le doc est en PG).
**Fix** : Encapsuler les etapes 1 et 2 dans une transaction PG explicite (`pool.Begin()` / `tx.Commit()`). L'indexation Meili peut rester async (best-effort avec retry).

---

### [MOYENNE] -- verification_log.created_at au lieu de verified_at
**Ref specs** : P4.2 section 5, entity VERIFICATION_LOG
**Fichier(s)** : migrations/001_init.sql:107-113
**Constat** : Le blueprint specifie `timestamp verified_at` dans VERIFICATION_LOG. Le schema utilise `created_at` a la place. Semantiquement c'est la meme chose (la creation du log = la verification), mais c'est une divergence de nommage vs spec.
**Impact** : Mineur fonctionnellement, mais le code et les queries referenceront `created_at` au lieu de `verified_at`, creant une confusion avec les colonnes `created_at` des autres tables qui ont un sens different.
**Fix** : Renommer la colonne en `verified_at` pour correspondre au blueprint, ou documenter le choix de `created_at` dans un commentaire SQL.

---

### [BASSE] -- search_log.clicked_document_id vs clicked_doc_id (nommage)
**Ref specs** : P4.2 section 5, entity SEARCH_LOG
**Fichier(s)** : migrations/001_init.sql:136
**Constat** : Le blueprint specifie `clicked_doc_id`. L'implementation utilise `clicked_document_id`. Divergence de nommage.
**Impact** : Aucun impact fonctionnel. Le nommage `clicked_document_id` est en fait plus coherent avec les autres colonnes du schema (`document_id`).
**Fix** : Mettre a jour le blueprint pour refleter le nommage choisi, ou vice-versa. Pas de changement code necessaire.

---

### [BASSE] -- Colonnes supplementaires non specifiees dans le blueprint
**Ref specs** : P4.2 section 5
**Fichier(s)** : migrations/001_init.sql
**Constat** : Plusieurs colonnes ajoutees qui ne sont pas dans le blueprint :
- `domains.color` (init:15), `domains.icon` (init:16), `domains.sort_order` (init:17), `domains.updated_at` (init:19)
- `users.updated_at` (init:33) -- blueprint a `created_at` et `last_login` seulement
- `document_types.slug` (init:42), `document_types.icon` (init:43)
- `templates.description` (init:51), `templates.type_id` (init:54)
- `documents.body_text` (init:70) -- necessaire pour Meili mais non dans le blueprint
- `tags.slug` (init:93)
- `verification_log.note` (init:112)
- `attachments.size_bytes` (init:125)
**Impact** : Toutes ces colonnes sont des enrichissements utiles et coherents avec les besoins fonctionnels. Ce n'est pas un defaut, mais le blueprint devrait etre mis a jour pour refleter le schema reel.
**Fix** : Mettre a jour la section 5 du P4.2 pour documenter les colonnes ajoutees.

---

### [BASSE] -- users.username vs blueprint login
**Ref specs** : P4.2 section 5, entity USER
**Fichier(s)** : migrations/001_init.sql:25
**Constat** : Le blueprint specifie `string login UK`. L'implementation utilise `username`. Le seed cree le compte admin avec `username = 'admin'` (conforme au blueprint qui dit "login: admin").
**Impact** : Divergence de nommage. Aucun impact fonctionnel.
**Fix** : Aligner le blueprint ou le code. `username` est un nommage plus standard.

---

### [INFO] -- Pas de mecanisme de re-indexation complete Meilisearch
**Ref specs** : RG-001 / RG-004
**Fichier(s)** : internal/document/handlers.go:886-926
**Constat** : L'indexation Meili est faite document par document en goroutine async. Si Meili est reinitialise (perte de volume, upgrade), il n'y a pas de commande/endpoint pour re-indexer tous les documents depuis PG. Le configureMeiliIndex() configure les attributs mais ne re-indexe pas le contenu.
**Impact** : Apres un reset Meili, la recherche ne retournera aucun resultat jusqu'a ce que chaque document soit modifie individuellement.
**Fix** : Ajouter une commande CLI ou un endpoint admin `/api/admin/reindex` qui parcourt tous les documents PG et les re-indexe dans Meili.

---

### [INFO] -- sqlc.yaml correctement configure
**Ref specs** : P4.2 section 2
**Fichier(s)** : sqlc.yaml
**Constat** : La configuration sqlc est correcte :
- Engine PostgreSQL
- Queries dans `internal/db/queries`
- Schema reference `migrations/001_init.sql`
- Generation Go avec package pgx/v5, JSON tags, interfaces, empty slices
- Output dans `internal/db/sqlc`
Les 10 fichiers de queries couvrent bien les 11 tables du schema (auth, document, tag, template, domain, type, freshness, analytics, config, attachment).
**Impact** : Positif -- le setup sqlc est professionnel et complet.
**Fix** : Aucun. Mais le code genere doit etre effectivement utilise (cf. finding SQL inline).

---

### [INFO] -- Docker volumes persistants correctement declares
**Ref specs** : P4.2 section 2
**Fichier(s)** : docker/docker-compose.yml:72-76
**Constat** : 4 volumes declares : `pgdata`, `meilidata`, `caddy_data`, `caddy_config`. Les migrations sont montees en read-only dans le container PG via `/docker-entrypoint-initdb.d:ro`.
**Impact** : Positif -- les donnees survivent aux redemarrages. Le montage des migrations en initdb.d assure l'execution automatique au premier lancement.
**Fix** : Aucun.

---

### [INFO] -- Meilisearch filterableAttributes et searchableAttributes correctement configures
**Ref specs** : P4.2 section 5 relations cles
**Fichier(s)** : internal/document/handlers.go:928-936
**Constat** :
- `filterableAttributes` : domain_id, type_id, visibility -- conforme
- `searchableAttributes` : title, body_text, tags -- conforme
- `sortableAttributes` : created_at, updated_at, view_count -- bonus non specifie mais utile
**Impact** : Positif.
**Fix** : Aucun.

---

## Resume

| Severite | Count | Findings |
|----------|-------|----------|
| CRITIQUE | 1     | UUIDv7 non implemente |
| HAUTE    | 5     | Seed non idempotent, types P4.1 vs P4.2, doc_count manquant, SQL inline, view_log CASCADE |
| MOYENNE  | 5     | Meili version, Caddy version, ExtractBodyText tables, Freshness config ignoree, pas de transaction, verified_at nommage |
| BASSE    | 3     | clicked_doc_id nommage, colonnes supplementaires, username vs login |
| INFO     | 3     | Pas de re-index, sqlc OK, Docker OK, Meili config OK |

**Total : 17 findings** dont 1 critique et 5 hautes.

Les 3 priorites immediates :
1. **UUIDv7** : corriger gen_random_uuid() -> UUIDv7 (extension PG ou generation Go)
2. **SQL inline** : migrer vers sqlc genere pour la type-safety
3. **Freshness config** : lire la table config au lieu de constantes codees en dur
