# Audit Fonctionnel -- Search, Home, Admin, Import, Analytics

Date : 2026-03-07
Scope : EPIC-01, EPIC-02 (partiel), EPIC-06, EPIC-07, EPIC-08, EPIC-09

---

## EPIC-01 : Recherche & Navigation

### US-101 : Modale de recherche (Ctrl+K)

**PASS** - Ctrl+K ouvre la modale (`SearchModal.tsx:46-54`). Overlay semi-transparent present (`bg-black/50`). Focus auto OK (`setTimeout(() => inputRef.current?.focus(), 0)`). Esc ferme (`handleKeyDown` ligne 182-184). Clic exterieur ferme (`handleBackdropClick` ligne 213-218). Double Ctrl+K = `setIsOpen(true)` idempotent, pas de double ouverture. Champ vide sur close (`setQuery('')` ligne 106).

**Aucune anomalie.**

---

### US-102 : Recherche full-text instantanee

**PASS** - Declenchement au 2e caractere (`query.length < 2` ligne 118). Debounce 200ms (`setTimeout(..., 200)` ligne 126). Temps affiche "N resultats en X.Xs" (`SearchModal.tsx:316`).

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-01 | Pas de flash visuel mentionne mais `isLoading` spinner minimal | MINEUR | Le spinner est un petit cercle en haut, pas de skeleton/flash. OK fonctionnellement. |

---

### US-103 : Tolerance typo (Meilisearch)

**PASS** - Aucune configuration Meilisearch desactivant la tolerance dans le handler. `SearchRequest` n'utilise pas `MatchingStrategy: "all"` ni `typoTolerance: disabled`. La tolerance par defaut de Meilisearch est active.

**Aucune anomalie.**

---

### US-104 : Metadonnees de confiance sur cartes

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-02 | Pas de label textuel sur le badge de fraicheur | MAJEUR | US-104 exige `badge + libelle "Verifie il y a X jours/mois"`. Le code n'affiche que l'emoji (`fresh.icon`) sans texte de datation. `FRESHNESS` map a des labels generiques ("A jour", "A verifier", "Obsolete") non utilises dans le rendu. Pas de `verified_at` ni de calcul de duree relative. |
| S-03 | Nombre de fichiers joints non renseigne cote backend | MAJEUR | US-104 exige "nombre de fichiers joints". Le frontend affiche `attachment_count` conditionnellement (`SearchModal.tsx:380-385`) mais le backend `searchResult` n'a PAS de champ `attachment_count` (`handler.go:15-27`). Il n'est pas extrait de Meilisearch ni calcule. Le champ sera toujours absent/0. |
| S-04 | Le symbole etoile utilise `*` au lieu de `star` | MINEUR | US-104 exige "star N vues". Le code affiche `* {result.view_count} vues` (ligne 379) -- le `*` est un caractere ASCII, pas le symbole star. Devrait etre un emoji ou un caractere unicode. |

---

### US-105 : Navigation clavier

**PASS** - ArrowDown/ArrowUp fonctionnels. Boucle dernier -> premier (`prev >= results.length - 1 ? 0 : prev + 1`). ArrowUp depuis premier -> retour au champ (`inputRef.current?.focus()`, `return -1`). Enter ouvre le resultat. Highlight visuel (`bg-blue-50 ring-1 ring-blue-200`).

**Aucune anomalie.**

---

### US-106 : Message zero resultat

**PASS** - Message "Aucun resultat pour << query >>" present (`SearchModal.tsx:324-326`). Bouton "+ Creer cette page" present (`SearchModal.tsx:328-336`). Redirige vers `/documents/new?title=...` avec query encodee.

**Aucune anomalie.**

---

### US-107 : Filtres domaine et type

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-05 | Pas de compteur filtre | MAJEUR | US-107 exige "le compteur indique 4 resultats (filtres sur INFRA)". Le compteur affiche `total resultats` mais sans mention du filtre actif. Le texte devrait indiquer "(filtres sur INFRA)" quand un filtre est actif. |
| S-06 | Types hardcodes cote frontend | MINEUR | Les types sont hardcodes dans le `<select>` (`procedure`, `guide`, `faq`, `architecture`, `runbook`) au lieu d'etre charges dynamiquement depuis l'API. Desynchronisation possible avec les `document_types` en base (11 types dans le seed). Manque "Troubleshooting", "Fiche applicative", "Note de version", etc. |
| S-07 | Injection SQL potentielle dans les filtres Meilisearch | CRITIQUE | `handler.go:62-65` : les valeurs `domain` et `docType` sont injectees directement dans la chaine de filtre Meilisearch sans sanitization : `fmt.Sprintf("domain_id = %s", domain)`. Un attaquant peut injecter des operateurs de filtre. Devrait utiliser des guillemets : `fmt.Sprintf("domain_id = \"%s\"", domain)` ou mieux, valider les UUIDs. |

---

## EPIC-02 (partiel) + EPIC-06 : Home

### US-203 : Page d'accueil authentifiee

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-08 | Message de bienvenue incomplet | MAJEUR | US-203 exige "Bonjour Didier -- X documents SCI . Y mis a jour cette semaine". Le code affiche "Bonjour {name}" + "{total} documents au total" mais PAS le nombre de documents du domaine principal de l'utilisateur, ni le nombre mis a jour cette semaine. |
| S-09 | Barre de recherche pas en focus | MINEUR | US-203 exige "barre de recherche avec focus". La barre de recherche sur la page d'accueil est un `<div onClick>` clickable, pas un input avec autofocus. Le focus fonctionne via la modale Ctrl+K mais pas directement sur la fausse barre. |
| S-10 | Hint onboarding ne mentionne pas Ctrl+K | MINEUR | US-203 exige un hint "Essayez Ctrl+K pour rechercher". Le hint actuel dit "Bienvenue ! Commencez par explorer les domaines ou creer votre premiere page." -- pas de mention de Ctrl+K. L'onboarding est lie a `user?.onboarding_completed === false` mais n'est jamais marque comme complete (pas de mecanisme pour le passer a `true`). |
| S-11 | Domaines sans couleurs visuelles distinctes | MINEUR | US-203 exige "domaines compteurs + couleurs". Les couleurs sont presentes (pastille ronde) mais les compteurs de documents sont la. OK globalement. |

---

### US-202 : Page publique (Vue Sophie)

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-12 | Bouton login absent : CONFORME | INFO | US-202 exige "sans aucune page de login". Verifie : pas de bouton login sur PublicHomePage. Conforme. |
| S-13 | Guides populaires tries par vues : OK | INFO | `sort=views` dans la requete API. Conforme. |

**Aucune anomalie sur US-202.**

---

### US-204 : Bouton ticket support

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-14 | Bouton ticket conditionnel a l'URL | MINEUR | Le bouton n'apparait que si `ticketUrl` est non vide. Si l'admin n'a pas configure l'URL, le bouton est invisible. Ce n'est pas un bug mais un choix de design raisonnable. |

**Aucune anomalie majeure.**

---

### US-601 : Navigation par domaine

**PASS** - Clic domaine -> `/domains/{slug}` -> `DomainPage.tsx` charge et affiche la liste. Badges de fraicheur presents. Compteur de vues present. Tri par date recente (`sort=recent`).

**Aucune anomalie.**

---

### US-602 : Activite recente (4-6 docs)

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-15 | Pas de compteur de vues dans l'activite recente | MAJEUR | US-602 exige "titre, badge, domaine, date relative, compteur de vues" sur chaque carte. L'interface `RecentDoc` dans `HomePage.tsx:17-26` ne contient PAS `view_count`. Le composant n'affiche que titre, badge, domaine, date relative. Le compteur de vues est absent. |

---

## EPIC-08 : Administration & Templates

### US-801 : CRUD Templates

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-16 | Pas d'editeur TipTap pour les templates | MAJEUR | US-801 exige "placeholders dans l'editeur TipTap". Le formulaire de template utilise une `<textarea>` pour du JSON brut (`TemplatesAdmin.tsx:177-182`). L'admin doit ecrire du JSON TipTap a la main au lieu d'utiliser un editeur visuel. |
| S-17 | 10 templates par defaut OK | INFO | Verifie dans `002_seed.sql` : 10 templates avec contenu TipTap JSON valide et `is_default = true`. Conforme a RG-008. |
| S-18 | Compteur d'usage affiche | INFO | `usage_count` present dans la table et affiche dans `TemplatesAdmin.tsx:126`. Conforme. |
| S-19 | Champ `type` frontend vs `type_id` backend | MAJEUR | Le formulaire template a un champ texte libre `type` (`TemplatesAdmin.tsx:8,166-173`) mais le backend attend `type_id` (un UUID vers `document_types`). Le champ `type` envoye ne correspond a rien cote backend et sera ignore ou causera une erreur. Le formulaire devrait etre un `<select>` sur les document_types. |

---

### US-802 : CRUD Domaines

**PASS** - CRUD complet. Compteur de documents (`doc_count`). Suppression bloquee si docs existent (409 Conflict, `handler.go:376-381`).

**Aucune anomalie.**

---

### US-803 : Seuils de fraicheur

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-20 | Seuils par defaut incorrects dans le seed | MAJEUR | RG-004 et US-803 specifient les seuils par defaut : vert < 1 mois (30j), jaune 1-6 mois (180j). Le seed `002_seed.sql:85` definit `freshness_green = 90` (3 mois) au lieu de 30. Le seuil vert par defaut ne correspond pas a la spec. |
| S-21 | Seuils non utilises par le calcul de fraicheur dans la recherche | CRITIQUE | Le handler de recherche `internal/search/handler.go:193-203` utilise des seuils HARDCODES (`days <= 30` et `days <= 180`) dans `computeBadge()` au lieu de lire les valeurs configurables depuis la table `config`. Modifier les seuils dans l'admin n'a AUCUN EFFET sur les badges affiches dans les resultats de recherche. Violation de US-803 "tous les badges recalcules immediatement avec les nouveaux seuils". |
| S-22 | Seulement 2 champs editables au lieu de 3 | MINEUR | US-803 exige "3 champs seuils editables". Le `ConfigAdmin.tsx` expose 2 champs (green_days, yellow_days), le seuil rouge est derive automatiquement (> yellow_days). C'est un choix de design raisonnable (3 seuils serait redondant). |
| S-23 | Validation "orange > vert" OK | INFO | `ConfigAdmin.tsx:43` verifie `green_days >= yellow_days` cote frontend. `handler.go:591` verifie `GreenDays >= YellowDays` cote backend. Conforme. |

---

### US-804 : Gestion utilisateurs

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-24 | Champ `domain_name` manquant dans la reponse API users | MINEUR | Le frontend attend `domain_name` (`UsersAdmin.tsx:10`) mais le backend `handleListUsers` (`handler.go:419-447`) ne fait PAS de JOIN avec la table `domains` pour recuperer le nom du domaine. Le champ `domain_id` est renvoye mais `domain_name` sera `undefined`. L'affichage montre "-" au lieu du nom du domaine. |
| S-25 | MDP reset affiche une seule fois : OK | INFO | Le mot de passe temporaire est affiche dans une modale ephemere avec avertissement "Ce mot de passe ne sera plus affiche". Conforme. |
| S-26 | Reponse reset MDP utilise `temporary_password` au lieu de `password` | MINEUR | Le backend renvoie `{"temporary_password": "..."}` (`handler.go:540`) mais le frontend attend `result.password` (`UsersAdmin.tsx:57,122`). Le mot de passe ne s'affichera pas dans la modale. |

---

### US-805 : URL ticket support

**PASS** - Champ URL editable dans `ConfigAdmin.tsx`. Sauvegarde via `PUT /admin/config/ticket-url`. Route publique GET presente dans `server.go:87`. Le bouton dans `PublicHomePage.tsx` l'utilise.

**Aucune anomalie.**

---

## EPIC-07 : Import CLI

### US-701 : Import Word (.doc/.docx)

**PASS** - Commande CLI presente (`cmd/plumenote/import.go`). Pandoc appele (`runPandoc`). Conversion HTML -> TipTap JSON (`HTMLToTipTap`). Titres, listes, tableaux preserves dans `html_to_tiptap.go` (h1-h6, ul/ol, table). Nom fichier = titre (`titleFromFilename`).

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-27 | Images non extraites | MAJEUR | US-701 exige "images extraites et incluses". Le convertisseur HTML->TipTap gere les balises `<img>` (`html_to_tiptap.go:159-165`) mais les images embarquees dans un .docx ne sont PAS extraites par pandoc (pandoc genere des refs base64 ou des chemins locaux). Il n'y a pas de logique d'upload/stockage des images extraites. Les refs `src` dans les nodes `image` seront invalides. |
| S-28 | .doc (ancien format) non teste | MINEUR | Le code supporte `.doc` dans `isSupportedExtension` et appelle `convertWord` mais pandoc necessite des dependances specifiques pour l'ancien format .doc. Pas un bug en soi mais un risque operationnel. |

---

### US-702 : Import PDF

**PASS** - PDF textuels extraits via `pdftotext`. PDF image (texte vide) -> placeholder "Contenu scanne -- transcription manuelle recommandee" (`importer.go:251-253`).

**Aucune anomalie.**

---

### US-703 : Import TXT

**PASS** - `.txt` et `.md` interpretes comme Markdown via pandoc (`convertMarkdown`). Nom fichier = titre (`titleFromFilename`).

**Aucune anomalie.**

---

### RG-009 : Convention dossiers -> domaines

**PASS** - `resolveDomain` (`importer.go:195-214`) utilise le premier sous-dossier comme hint de domaine. Match insensible a la casse avec le slug ou le nom du domaine.

**Aucune anomalie.**

---

### Rapport et resilience

**PASS** - Rapport avec total/success/failed (`import.go:63-82`). Fichier corrompu ne casse pas le lot (erreur loggee, `return nil` dans le Walk, les autres continuent).

**Aucune anomalie.**

---

## EPIC-09 : Analytics & Mesure

### US-901 : Compteur de vues

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-29 | Compteur non incremente cote frontend | MAJEUR | US-901 exige "Didier ouvre le document -> le compteur passe a 48". Le backend expose `POST /analytics/view-count` mais il n'y a aucun appel automatique a cette API dans le code frontend quand un document est ouvert. L'incrementation depend d'un appel explicite qui semble absent du reader/document page. Le compteur ne s'incrementera jamais automatiquement. |
| S-30 | Compteur de vues absent de l'accueil authentifiee | MAJEUR | US-901 exige le compteur "star N vues" visible dans "recherche, accueil, ou lecture". Le compteur est visible dans la recherche (`SearchModal.tsx:379`) et dans DomainPage, mais PAS dans HomePage (activite recente). Voir aussi S-15. |

---

### US-902 : Logs de recherche

**PASS** - `handleSearchLog` (`analytics/handler.go:25-49`) enregistre query, result_count, clicked_document_id, user_id. Le frontend appelle `/analytics/search-log` sur fermeture sans clic (`SearchModal.tsx:152-158`) et sur clic resultat (`SearchModal.tsx:165-170`). user_id nullable via `optionalAuth` (RG-010 : anonyme si non connecte).

**Aucune anomalie.**

---

### US-903 : Logs de consultation

| # | Anomalie | Severite | Detail |
|---|----------|----------|--------|
| S-31 | Duration non mesuree cote frontend | MAJEUR | US-903 exige "duree approximative" de consultation. Le backend accepte `duration_seconds` dans `viewLogRequest`. Mais il n'y a pas d'evidence d'un appel frontend a `POST /analytics/view-log` avec mesure de duree (timer au montage/demontage du composant document). Le log de consultation avec duree n'est vraisemblablement pas implemente cote frontend. |

---

## Resume des anomalies

| Severite | Count | IDs |
|----------|-------|-----|
| CRITIQUE | 2 | S-07, S-21 |
| MAJEUR | 9 | S-02, S-03, S-05, S-08, S-15, S-16, S-19, S-27, S-29, S-30, S-31 |
| MINEUR | 8 | S-01, S-04, S-06, S-09, S-10, S-22, S-24, S-26, S-28 |

### Top 5 a corriger en priorite

1. **S-07 (CRITIQUE)** -- Injection dans les filtres Meilisearch : sanitizer les valeurs `domain` et `type` dans `handler.go:62-65`
2. **S-21 (CRITIQUE)** -- Seuils de fraicheur hardcodes dans la recherche : lire les valeurs depuis la table `config` au lieu des constantes 30/180
3. **S-29 (MAJEUR)** -- Compteur de vues jamais incremente : ajouter un appel `POST /analytics/view-count` a l'ouverture d'un document dans le frontend
4. **S-02 (MAJEUR)** -- Label textuel de fraicheur absent des cartes de recherche : afficher "Verifie il y a X jours" au lieu du simple emoji
5. **S-19/S-26 (MAJEUR)** -- Mappings frontend/backend casses : `type` vs `type_id` dans les templates, `password` vs `temporary_password` dans le reset MDP
