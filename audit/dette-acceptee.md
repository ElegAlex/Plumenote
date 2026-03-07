# Dette Technique Acceptee -- PlumeNote MVP

Date : 2026-03-07

---

## MINEURS non fixes (acceptes pour le MVP)

### Securite

| ID | Sujet | Justification |
|----|-------|---------------|
| SEC-M01 | Pas de force-change MDP au premier login | Le champ `onboarding_completed` existe. Le flux obligatoire de changement est une feature V2. Le mot de passe admin du seed est connu mais le deploiement doit changer les secrets (documente dans .env.example). |
| SEC-M02 | CSRF non implemente | Naturellement mitige par l'usage de JWT en header Authorization (pas de cookie). Documente comme non-applicable. |

### Data

| ID | Sujet | Justification |
|----|-------|---------------|
| DAT-C01 | UUIDv7 non implemente (gen_random_uuid = UUIDv4) | Fonctionnellement OK. L'optimisation B-tree UUIDv7 est un gain de performance non bloquant au MVP. Peut etre corrige en V2 via extension pg_uuidv7 ou generation cote Go. |
| DAT-M01 | Types P4.1 vs P4.2 -- divergence documentaire | Le seed suit le P4.2 (post-Gate Review) qui fait autorite. A documenter formellement. |
| DAT-M02 | doc_count absent de la table domains | Calcule dynamiquement (plus fiable). Acceptable au MVP. Documenter dans le blueprint. |
| DAT-M03 | SQL inline au lieu de sqlc genere | Le code est correct et parametre (pas d'injection). La migration vers sqlc est un refactoring planifie pour V2. |
| DAT-M04 | Pas de transaction pour create/update document + tags | Risque d'inconsistance faible en pratique. A corriger en V2. |
| DAT-M05 | verification_log.created_at au lieu de verified_at | Meme semantique. A documenter. |
| DAT-M06 | Meilisearch v1.12 au lieu de v1.35 | Fonctionnellement OK. Mise a jour de version non bloquante. |
| DAT-M07 | Caddy non pinne (tag flottant 2-alpine) | A pinner en production. Non bloquant en dev. |
| DAT-M08 | ExtractBodyText: concatenation sans espace pour tableaux | Impact mineur sur la recherche dans les cellules de tableaux. |
| DAT-B01-B03 | Nommages divergents (clicked_doc_id, username, colonnes extra) | Documentaire uniquement. Code correct. |

### Editeur / Reader

| ID | Sujet | Justification |
|----|-------|---------------|
| ANO-E01 | Types hardcodes (5/11) dans le frontend | Les types backend sont corrects. Un endpoint GET /api/document-types est a ajouter en V2 pour charger dynamiquement. |
| ANO-E02 | Type non pre-selectionne a la creation | UX mineure. |
| ANO-E03 | Hint placeholder non conforme | Cosmetique. |
| ANO-E05 | Toast sauvegarde texte non conforme | Cosmetique. |
| ANO-E06 | Bouton "Sauvegarder" au lieu de "Publier" | Corrige dans cette iteration. |
| ANO-E08 | Slash menu "/" debut de ligne seulement | Conforme a l'intention "ligne vide". |
| ANO-E09 | Esc ne supprime pas le "/" du slash menu | UX mineure. A ameliorer en V2. |
| ANO-E10 | lowlight au lieu de Shiki dans l'editeur | Acceptable au MVP (coloration presente). |
| ANO-E11 | Pas de selecteur de langage pour les blocs code | Feature non bloquante. A implementer en V2. |
| ANO-E12 | Tableau insere en 3x3 fixe | Fonctionnel. Grid picker a implementer en V2. |
| ANO-E13 | Pas de menu contextuel tableau | Feature avancee. A implementer en V2 via BubbleMenu. |
| ANO-E14 | Lien interne casse non signale visuellement | Feature non bloquante. |
| ANO-E17 | Reader: liens internes casses non geres inline | UX d'erreur acceptable (page 404). |
| ANO-E18-E19 | Bouton Copier: texte non conforme, invisible mobile | Cosmetique. |
| ANO-E20 | verifyDocument ne verifie pas les droits domaine | Risque faible (tout auth peut verifier). A renforcer en V2. |
| ANO-E21 | deleteDocument: incoherence front/back politique domaine | Le backend est plus permissif (domaine = droit). Aligner en V2. |
| ANO-E22-E25 | Textes non conformes (modale suppression, icones, toasts) | Cosmetique. |
| ANO-E26-E27 | Badge fraicheur: pas de duree relative, pas de "Revue necessaire" | Feature d'affichage. A ameliorer en V2. |
| ANO-E28 | Sommaire a droite au lieu de gauche | Choix de design acceptable. |

### Search / Home / Admin

| ID | Sujet | Justification |
|----|-------|---------------|
| S-01 | Pas de flash/skeleton dans la recherche | UX mineure, spinner present. |
| S-02 | Pas de label textuel de fraicheur sur les cartes | Feature d'affichage. A ameliorer en V2. |
| S-03 | attachment_count non renseigne cote backend | Donnee non critique dans les cartes de recherche. |
| S-04 | Symbole etoile "* N vues" au lieu de unicode star | Cosmetique. |
| S-05 | Pas de compteur filtre | UX mineure. |
| S-06 | Types hardcodes dans le filtre recherche | Meme que ANO-E01. |
| S-08 | Message bienvenue incomplet | Feature d'affichage. |
| S-09 | Barre de recherche pas en focus direct | Focus via Ctrl+K suffit. |
| S-10 | Hint onboarding ne mentionne pas Ctrl+K | Cosmetique. |
| S-16 | Templates: textarea JSON au lieu d'editeur TipTap | Feature admin avancee. A ameliorer en V2. |
| S-19 | type vs type_id dans les templates | Mapping a corriger en V2. |
| S-22 | 2 champs seuils au lieu de 3 | Design raisonnable (3e derive). |
| S-24 | domain_name manquant dans reponse users | Affichage admin non critique. |
| S-26 | temporary_password vs password dans reset MDP | Bug mineur. A corriger en V2. |
| S-27 | Images non extraites dans l'import Word | Limitation pandoc. A ameliorer en V2. |
| S-28 | .doc ancien format non teste | Risque operationnel. A documenter. |
| S-31 | Duration non mesuree cote frontend | Le composant ReaderPage a bien une mesure via beforeunload. Fonctionnel. |

### Qualite Code

| ID | Sujet | Justification |
|----|-------|---------------|
| Q-003 | Triple duplication optionalAuth | Refactoring a planifier en V2. Code fonctionnel. |
| Q-004 | writeJSON dupliquee 5 fois | Pattern courant Go. Acceptable. |
| Q-005 | generateSlug duplique | A extraire en V2. |
| Q-006-Q-008 | Dead code (search.userIDFromCtx, exports inutilises, sqlc non genere) | Pas de risque fonctionnel. Nettoyage V2. |
| Q-010-Q-011 | Erreurs ignorees (shutdown, json.Encode) | Patterns standards Go HTTP. |
| Q-013 | rows.Scan erreur silencieuse dans domains | Risque faible. |
| Q-016 | Seuils freshness hardcodes en double | Corrige : les handlers lisent maintenant la config DB. |
| Q-017 | Types documents hardcodes frontend | Meme que ANO-E01. |
| Q-018 | Upload path hardcode | A rendre configurable en V2. |
| Q-019-Q-020 | Shiki statique, lowlight duplique | Optimisations de bundle non bloquantes. |
| Q-027 | make dev laisse Vite orphelin | Dev workflow non critique. |
