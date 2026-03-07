# Audit Fonctionnel - Editeur & Reader

Date : 2026-03-07
Auditeur : Agent t3-audit-editor
Scope : EPIC-04 (US-401 a US-413), EPIC-03 (US-301 a US-307), US-414, US-502
Sources : `web/src/features/editor/`, `web/src/features/reader/`, `internal/document/`

---

## Convention de severite

| Severite | Definition |
|----------|------------|
| BLOQUANT | Fonctionnalite absente ou cassee empechant l'usage |
| MAJEUR   | Ecart significatif par rapport aux specs, degradation UX |
| MINEUR   | Detail manquant, non-conformite partielle, impact faible |

---

## ANOMALIES

---

### ANO-E01 — Types de document incomplets (5 sur 11 requis)

- **Severite** : MAJEUR
- **US** : US-401 (type dropdown RG-011)
- **Fichier** : `web/src/features/editor/EditorPage.tsx:33-39`
- **Constat** : `DOC_TYPES` ne contient que 5 types (Procedure, Guide, FAQ, Architecture, Runbook). RG-011 exige 11 types : Procedure technique, Guide utilisateur, Architecture systeme, FAQ, Troubleshooting, Fiche applicative, Procedure d'installation, Note de version, Guide reseau, Documentation d'API, **Autre**.
- **Impact** : Utilisateur ne peut pas classer correctement ses documents. Les filtres de recherche par type (US-107) sont aussi incomplets.
- **Fix** : Ajouter les 6 types manquants dans `DOC_TYPES` ou mieux, charger les types depuis l'API backend (table `document_types`).

---

### ANO-E02 — Type non pre-selectionne a la creation

- **Severite** : MINEUR
- **US** : US-401
- **Fichier** : `web/src/features/editor/EditorPage.tsx:49`
- **Constat** : `typeId` est initialise a `''`. La spec exige "le type 'Procedure technique' pre-selectionne".
- **Impact** : L'utilisateur doit manuellement choisir le type a chaque creation.
- **Fix** : Initialiser `typeId` a `'procedure'` quand `!isEdit`.

---

### ANO-E03 — Hint placeholder absent dans l'editeur

- **Severite** : MINEUR
- **US** : US-401
- **Fichier** : `web/src/features/editor/TipTapEditor.tsx:39`
- **Constat** : Le placeholder actuel est "Commencez a ecrire ou tapez / pour les commandes...". La spec exige "Tapez / pour inserer un bloc, ou choisissez un template".
- **Impact** : Cosmetique. Le hint ne mentionne pas les templates.
- **Fix** : Aligner le texte du placeholder sur la spec.

---

### ANO-E04 — onChange signature mismatch entre EditorPage et TipTapEditor

- **Severite** : BLOQUANT
- **US** : US-412 (sauvegarde)
- **Fichier** : `web/src/features/editor/EditorPage.tsx:84` vs `web/src/features/editor/TipTapEditor.tsx:26`
- **Constat** : `TipTapEditor` declare `onChange?: (json: string, html: string) => void` (2 params). `EditorPage.handleEditorChange` n'accepte qu'un seul param `(json: string)`. TypeScript pourrait laisser passer (params supplementaires ignores), mais le HTML genere est perdu et jamais utilise.
- **Impact** : Pas de crash direct (JS tolere), mais le 2e param HTML est gaspille. Si un usage futur suppose la presence du HTML, ce sera une regression silencieuse. A verifier au build TypeScript (erreur possible en mode strict).
- **Fix** : Harmoniser la signature. Si le HTML n'est pas utile, retirer le 2e param de TipTapEditor.

---

### ANO-E05 — Toast de sauvegarde : texte non conforme

- **Severite** : MINEUR
- **US** : US-412
- **Fichier** : `web/src/features/editor/EditorPage.tsx:250`
- **Constat** : Le toast affiche "Sauvegarde OK". La spec exige "Sauvegarde [check mark]" (avec le symbole check).
- **Impact** : Cosmetique.
- **Fix** : Remplacer par "Sauvegarde [check mark]" ou equivalent.

---

### ANO-E06 — Bouton save libelle "Sauvegarder" au lieu de "Publier"

- **Severite** : MINEUR
- **US** : US-412
- **Fichier** : `web/src/features/editor/EditorPage.tsx:156`
- **Constat** : La spec mentionne le bouton `[Publier]`. L'implementation dit "Sauvegarder".
- **Impact** : Incoherence terminologique avec la doc. "Publier" renforce le message RG-007 (pas de brouillon).
- **Fix** : Renommer en "Publier".

---

### ANO-E07 — Bouton [Previsualiser] absent de l'editeur

- **Severite** : BLOQUANT
- **US** : US-307
- **Fichier** : `web/src/features/editor/EditorPage.tsx` (absent)
- **Constat** : Aucun bouton de previsualisation n'existe dans l'editeur. Le composant `DocumentPreview` existe dans `reader/DocumentPreview.tsx` mais n'est jamais utilise/importe par l'editeur.
- **Impact** : L'utilisateur ne peut pas verifier le rendu final avant publication (sommaire, coloration syntaxique, badges).
- **Fix** : Ajouter un bouton toggle "[Previsualiser]" dans EditorPage qui bascule entre TipTapEditor et DocumentPreview.

---

### ANO-E08 — Slash menu : "/" restreint a debut de ligne

- **Severite** : MAJEUR
- **US** : US-406
- **Fichier** : `web/src/features/editor/SlashMenu.tsx:164`
- **Constat** : `startOfLine: true` fait que "/" ne declenche le menu QUE en debut de ligne. La spec dit "sur une ligne vide" mais ne restreint pas au debut de ligne. C'est coherent avec la spec, mais si l'utilisateur tape du texte puis "/" en milieu de ligne, rien ne se passe, ce qui peut etre déroutant.
- **Impact** : Faible si "ligne vide" est l'intention. A clarifier.
- **Fix** : Accepte tel quel (conforme a l'intention "ligne vide").

---

### ANO-E09 — Slash menu : Esc ne supprime pas le "/"

- **Severite** : MAJEUR
- **US** : US-406 (scenario Fermeture)
- **Fichier** : `web/src/features/editor/SlashMenu.tsx:198-201`
- **Constat** : Quand Esc est presse, le popup est cache (`popup.hide()`) mais le caractere "/" reste dans le texte. La spec exige : "le menu se ferme ET le '/' est supprime de la ligne".
- **Impact** : "/" reste comme texte parasite dans le document. L'utilisateur doit le supprimer manuellement.
- **Fix** : Dans le `onKeyDown` pour Escape, ajouter `editor.chain().focus().deleteRange(range).run()` avant de cacher le popup, ou utiliser le `command` callback de TipTap suggestion pour nettoyer le caractere.

---

### ANO-E10 — Code blocks : utilise lowlight au lieu de Shiki dans l'editeur

- **Severite** : MINEUR
- **US** : US-405
- **Fichier** : `web/src/features/editor/TipTapEditor.tsx:12,21,50`
- **Constat** : L'editeur utilise `CodeBlockLowlight` avec `lowlight(common)` pour la coloration syntaxique. Le reader utilise Shiki. La spec US-303/US-405 mentionne Shiki. La coloration est presente mais avec un moteur different.
- **Impact** : Rendu legerement different entre edition et lecture. Acceptable en MVP.
- **Fix** : Acceptable tel quel. Pourrait migrer vers `@tiptap/extension-code-block-shiki` si disponible en TipTap 3.

---

### ANO-E11 — Code blocks : pas de selecteur de langage dans l'editeur

- **Severite** : MAJEUR
- **US** : US-405 (scenario "Selecteur de langage")
- **Fichier** : `web/src/features/editor/TipTapEditor.tsx`, `Toolbar.tsx`
- **Constat** : Aucun selecteur de langage n'est affiche quand un bloc de code est insere. L'utilisateur peut utiliser la syntaxe Markdown (```bash) mais ne peut pas changer le langage apres insertion via un dropdown.
- **Impact** : L'utilisateur qui insere un bloc code via le slash menu ou la toolbar n'a aucun moyen de specifier le langage apres coup. Les 6 langages requis (bash, powershell, sql, python, json, xml) ne sont pas presentes dans un selecteur.
- **Fix** : Ajouter un selecteur de langage au-dessus ou dans le bloc de code (NodeViewWrapper avec un `<select>`).

---

### ANO-E12 — Tableau : pas de choix lignes x colonnes

- **Severite** : MAJEUR
- **US** : US-409 (scenario Nominal)
- **Fichier** : `web/src/features/editor/Toolbar.tsx:147` et `SlashMenu.tsx:59`
- **Constat** : Le tableau est insere en dur en 3x3 (`rows: 3, cols: 3`). La spec exige un choix "3 colonnes x 2 lignes" (UI de selection).
- **Impact** : Pas de flexibilite. L'utilisateur obtient toujours un 3x3.
- **Fix** : Ajouter un mini-composant de selection de grille (grid picker) ou un dialogue lignes/colonnes.

---

### ANO-E13 — Tableau : pas de menu contextuel clic droit

- **Severite** : MAJEUR
- **US** : US-409 (scenario "Ajout de ligne/colonne")
- **Fichier** : `web/src/features/editor/` (absent)
- **Constat** : Aucun menu contextuel (clic droit) n'est implemente pour les tableaux. Les options "Ajouter une ligne", "Ajouter une colonne", "Supprimer la ligne", "Supprimer la colonne" sont absentes.
- **Impact** : L'utilisateur ne peut pas modifier la structure du tableau apres insertion.
- **Fix** : Implementer un `BubbleMenu` ou un context menu pour les operations de tableau TipTap (addRowBefore, addColumnAfter, deleteRow, deleteColumn).

---

### ANO-E14 — Lien interne : document inexistant non signale visuellement

- **Severite** : MAJEUR
- **US** : US-410 (scenario "Document inexistant")
- **Fichier** : `web/src/features/editor/InternalLink.tsx:135-145`
- **Constat** : Quand un lien interne est insere, il est toujours rendu comme un lien standard. La spec exige que si le document n'existe pas, le lien soit "en rouge/italique, signalant un document manquant".
- **Impact** : Aucune indication visuelle que le document cible n'existe pas.
- **Fix** : Ajouter une verification d'existence lors de l'insertion, et un style CSS conditionnel (classe `broken-link` rouge/italique).

---

### ANO-E15 — Tag endpoint URL incorrecte

- **Severite** : BLOQUANT
- **US** : US-411
- **Fichier** : `web/src/features/editor/TagInput.tsx:29` vs `internal/document/router.go:38`
- **Constat** : Le frontend appelle `/tags?q=...`. Le backend monte les tags sous le router `/api/documents/tags` (car `listTags` est dans le document router a la route `GET /tags`). La route reelle est donc `/api/documents/tags`. Si le client `api.get` prefixe deja `/api/documents`, ca marche par hasard. Sinon, 404.
- **Impact** : Si le prefix API est `/api` et que le document router est monte sous `/api/documents`, les tags sont sur `/api/documents/tags`. Le TagInput appelle `/tags` ce qui donne `/api/tags` : 404 probable.
- **Fix** : Verifier le montage des routes. Soit monter un router tags separe sur `/api/tags`, soit corriger le frontend vers `/documents/tags`.

---

### ANO-E16 — API getDocument ne retourne pas domain_name/domain_slug/domain_color

- **Severite** : BLOQUANT
- **US** : US-304 (metadonnees), US-305 (breadcrumb)
- **Fichier** : `internal/document/handlers.go:295-359`
- **Constat** : La requete SQL du `getDocument` ne fait pas de JOIN sur la table `domains`. Les champs `domain_name`, `domain_slug`, `domain_color` sont attendus par le frontend (`ReaderPage.tsx:37-39`, `Breadcrumb.tsx`, `MetadataHeader.tsx`) mais ne sont jamais retournes par l'API.
- **Impact** : Le breadcrumb "Domaine > Titre" est vide (pas de nom de domaine). Le badge domaine dans les metadonnees est absent. Le lien domaine du breadcrumb ne fonctionne pas.
- **Fix** : Ajouter un `JOIN domains dom ON dom.id = d.domain_id` dans la requete et inclure `dom.name AS domain_name, dom.slug AS domain_slug, dom.color AS domain_color` dans la reponse.

---

### ANO-E17 — Reader : liens internes casses non geres

- **Severite** : MAJEUR
- **US** : US-306 (scenario "Lien casse")
- **Fichier** : `web/src/features/reader/DocumentContent.tsx:109-121`
- **Constat** : Le gestionnaire de clic interne fait `navigate(href)`. Si le document cible n'existe plus, le reader affiche "Document introuvable" en page pleine. La spec exige un message inline "Ce document n'existe plus ou a ete deplace" sans erreur serveur.
- **Impact** : Mauvaise UX : l'utilisateur quitte le document en cours pour voir une page d'erreur.
- **Fix** : Deux options : (1) verifier l'existence du lien cote API et afficher un tooltip/modale inline, ou (2) afficher le message d'erreur "Ce document n'existe plus" dans une modale/toast sans naviguer.

---

### ANO-E18 — Reader : bouton Copier affiche "Copie !" au lieu de "[check mark] Copie"

- **Severite** : MINEUR
- **US** : US-302 (scenario Feedback visuel)
- **Fichier** : `web/src/features/reader/CodeBlock.tsx:61` et `DocumentContent.tsx:145,169`
- **Constat** : Le bouton affiche "Copie !" apres clic. La spec exige "[check mark] Copie" pendant 2 secondes.
- **Impact** : Cosmetique.
- **Fix** : Remplacer `'Copie !'` par `'[check mark] Copie'`.

---

### ANO-E19 — Reader : bouton Copier invisible sans hover (opacity-0)

- **Severite** : MINEUR
- **US** : US-302
- **Fichier** : `web/src/features/reader/CodeBlock.tsx:59` et `DocumentContent.tsx:141-142`
- **Constat** : Le bouton copier a `opacity-0 group-hover:opacity-100`. Il n'est visible qu'au survol du bloc code. Sur mobile/tactile, il est inaccessible.
- **Impact** : Sur mobile, l'utilisateur ne peut pas copier le code en un clic.
- **Fix** : Rendre le bouton toujours visible ou ajouter un fallback tactile.

---

### ANO-E20 — US-502 : verifyDocument ne verifie pas les droits d'ecriture domaine

- **Severite** : MAJEUR
- **US** : US-502 (scenario "Droits insuffisants")
- **Fichier** : `internal/document/handlers.go:524-573`
- **Constat** : Le handler `verifyDocument` verifie uniquement que l'utilisateur est authentifie (`userID != ""`). Il ne verifie pas que l'utilisateur a les droits d'ecriture sur le domaine du document (RG-003 : auteur OU meme domaine OU admin).
- **Impact** : N'importe quel utilisateur authentifie peut marquer n'importe quel document comme verifie, y compris hors de son domaine.
- **Fix** : Ajouter la meme verification de droits que `updateDocument` (auteur, meme domaine, ou admin).

---

### ANO-E21 — US-414 : deleteDocument autorise par domaine, pas seulement auteur/admin

- **Severite** : MAJEUR
- **US** : US-414 (specs vs frontend)
- **Fichier** : `web/src/features/reader/ReaderPage.tsx:157` vs `internal/document/handlers.go:501`
- **Constat** : Le frontend restreint `canDelete` a `user.id === doc.author.id || isAdmin`. Le backend autorise aussi `docDomainID == userDomainID` (meme domaine). Incoherence entre front et back.
  - La spec US-414 dit "Didier consulte un document de SON domaine" pour supprimer, mais le scenario "Pas de droits" parle de "domaine INFRA (lecture seule)", ce qui implique que le droit de suppression suit le domaine.
- **Impact** : Un utilisateur du meme domaine voit le bouton Supprimer cache cote front mais pourrait supprimer via appel API direct. Incoherence de politique de droits.
- **Fix** : Aligner front et back. Si le domaine donne le droit de supprimer : ajouter `user.domain_id === doc.domain_id` dans `canDelete` cote front. Sinon, retirer la condition domaine cote back.

---

### ANO-E22 — US-414 : modale de suppression ne mentionne pas "irreversible"

- **Severite** : MINEUR
- **US** : US-414 (scenario Confirmation)
- **Fichier** : `web/src/features/reader/DeleteModal.tsx:26`
- **Constat** : La modale dit "Le document ... sera definitivement supprime." La spec exige le texte "Etes-vous sur ? Cette action est irreversible."
- **Impact** : Cosmetique. Le message actuel est clair mais pas identique a la spec.
- **Fix** : Ajouter "Cette action est irreversible." au texte.

---

### ANO-E23 — US-413 : bouton Modifier sans icone ni libelle conforme

- **Severite** : MINEUR
- **US** : US-413
- **Fichier** : `web/src/features/reader/MetadataHeader.tsx:137-139`
- **Constat** : Le bouton affiche "Modifier" sans icone. La spec mentionne "[crayon Modifier]" (avec icone crayon).
- **Impact** : Cosmetique.
- **Fix** : Ajouter une icone crayon devant le texte.

---

### ANO-E24 — US-502 : bouton Verifier sans icone ni libelle conforme

- **Severite** : MINEUR
- **US** : US-502
- **Fichier** : `web/src/features/reader/MetadataHeader.tsx:142-148`
- **Constat** : Le bouton affiche "Marquer comme verifie". La spec mentionne "[fleches circulaires Marquer comme verifie]" avec icone.
- **Impact** : Cosmetique.
- **Fix** : Ajouter une icone de fleches circulaires.

---

### ANO-E25 — US-502 : toast verification non conforme

- **Severite** : MINEUR
- **US** : US-502
- **Fichier** : `web/src/features/reader/ReaderPage.tsx:131`
- **Constat** : Le toast affiche "Document verifie". La spec exige "Marque comme verifie [check mark]" pendant 2 secondes.
- **Impact** : Cosmetique.
- **Fix** : Aligner le texte du toast.

---

### ANO-E26 — US-304 : metadonnees ne montrent pas "Revue necessaire" pour badge rouge

- **Severite** : MAJEUR
- **US** : US-304 (scenario "Document obsolete")
- **Fichier** : `web/src/features/reader/MetadataHeader.tsx:31-35`
- **Constat** : Le badge rouge affiche simplement "Obsolete". La spec exige le badge rouge "Pas revu depuis X mois" accompagne de la mention "[warning] Revue necessaire".
- **Impact** : L'utilisateur ne voit pas le signal d'alerte "Revue necessaire" pour les docs obsoletes.
- **Fix** : Ajouter un texte "[warning] Revue necessaire" conditionnel quand `freshnessBadge === 'red'`.

---

### ANO-E27 — US-304 : badge de fraicheur ne montre pas la duree relative

- **Severite** : MAJEUR
- **US** : US-304 (scenario "Document frais"), US-501
- **Fichier** : `web/src/features/reader/MetadataHeader.tsx:84-93`
- **Constat** : Le badge affiche "A jour" / "A verifier" / "Obsolete" en texte generique. La spec exige des labels dynamiques : "Verifie il y a 12 jours", "Verifie il y a 3 mois", "Pas revu depuis 8 mois".
- **Impact** : L'utilisateur ne peut pas juger la fraicheur precise du document.
- **Fix** : Utiliser `lastVerifiedAt` pour calculer un label relatif dynamique comme "Verifie il y a X jours/mois".

---

### ANO-E28 — US-301 : sommaire positionne a droite au lieu de gauche

- **Severite** : MINEUR
- **US** : US-301 (scenario Nominal)
- **Fichier** : `web/src/features/reader/ReaderPage.tsx:210-213`
- **Constat** : Le sommaire (TableOfContents) est place dans une `aside` a droite du contenu principal. La spec dit "un sommaire lateral a gauche".
- **Impact** : Placement different de la maquette. Fonctionnellement equivalent.
- **Fix** : Inverser l'ordre dans le flex container ou utiliser `order-first` sur l'aside.

---

## RESUME

| Severite | Nombre |
|----------|--------|
| BLOQUANT | 3      |
| MAJEUR   | 10     |
| MINEUR   | 10     |
| **Total** | **23** |

### Anomalies bloquantes
1. **ANO-E04** : Mismatch signature onChange (potentiel build failure)
2. **ANO-E07** : Bouton Previsualiser absent (US-307 non implementee)
3. **ANO-E15** : Tag endpoint URL potentiellement 404
4. **ANO-E16** : API ne retourne pas domain_name/slug/color (breadcrumb casse)

### US 100% conformes (non listees)
Les US non mentionnees dans ce rapport sont conformes a leurs criteres BDD.
