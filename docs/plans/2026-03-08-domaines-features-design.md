# Architecture Domaines & Features — Design à consolider

> **Statut** : Brouillon de cadrage — à affiner en session dédiée

## Contexte

La homepage actuelle (maquette DSI Hub) est un exemple visuel, pas le design final. Le vrai travail porte sur l'architecture des domaines et leurs features scopées.

## Compréhension actuelle

### Domaine = Espace activable

Chaque domaine (SCI, Études & Dev, Infrastructure, Support, Gouvernance) n'est pas un simple filtre ou tag. C'est un **espace** à part entière qui, **à sa création**, peut activer 1 à 3 features indépendantes :

### Feature 1 — Documents

- Arborescence hiérarchique de documentation
- Sous-dossiers, pages, organisation en profondeur
- Procédures, guides, FAQ, troubleshooting, etc.
- Chaque domaine qui active cette feature a sa propre arborescence

### Feature 2 — Applications

- Catalogue / registre applicatif
- Pas de la documentation au sens classique — plutôt des **fiches de présentation**
- Recueil de liens, statuts, habilitations
- Plus un annuaire qu'une base documentaire
- **À idéationner** : le format exact des fiches, les champs, la navigation

### Feature 3 — Cartographie

- **Graphe interactif** de relations entre entités
- Nodes : serveurs, applications, hébergements, réseaux, etc.
- Edges : relations typées (héberge, dépend de, connecté à, etc.)
- Navigation entre nœuds : clic sur un nœud ouvre ses relations
- Bidirectionnel : si App X est sur Serveur Y, les deux nœuds se connaissent
- Backlinks : depuis n'importe quelle entité, voir tout ce qui la référence
- Inspiré d'Obsidian/Logseq — "knowledge exploration graph"
- Intègre aussi une partie textuelle (description des nœuds)

### Activation par domaine

- À la création d'un domaine, le user avec les droits de création choisit quelles features activer
- Un domaine peut avoir juste "Documents", ou "Documents + Cartographie", ou les 3
- Chaque feature activée a sa propre interface, ses propres données, sa propre logique

## Homepage

- Dashboard agrégé du contenu (tous domaines confondus)
- Le design actuel (3 onglets Documentation/Applications/Cartographie) est un placeholder
- Le vrai dashboard doit être designé après les scopes domaines
- Ce n'est pas la priorité — si le reste est solide, la homepage suivra

## Points ouverts à traiter

1. **Modèle de données** : comment stocker l'arborescence Documents ? (nested set, adjacency list, materialized path ?)
2. **Graphe** : quelle lib frontend ? (D3.js, Cytoscape.js, force-graph ?) — quel stockage backend ? (table edges, ou graph DB type?)
3. **Applications** : quel format de fiche ? Quels champs obligatoires ? Quelle différence avec un document de type "fiche-applicative" ?
	- C'est justement sur cette feature, ce que l'on peut y mettre que l'on doit le plus travailler
		- Quelle serait cette feature ni de la stricte gestion documentaire, ni de la cartographie qui serait un putin de facteur différenciant de l'app avec une plus value de dingue
4. **Activation features** : UI admin pour activer/désactiver les features par domaine
5. **Navigation** : quand on entre dans un domaine, comment switch entre ses features activées ?
	- Comme le design le montre, par le jeu des onglets actuellement nommés "documents", "applications", "cartographie"
6. **Permissions** : les permissions sont-elles par feature ou par domaine ?
	- Les permissions sont à la fois par droits de créations/lectures qui peut un droit de créations de domaines, et dans un domaine un droits de création au sein des features activées
	- Et aussi des permissions par domaine, mais c'est un autre jeu de permission, celui plus par un choix de groupes et/ou user par le créateur à la cération du domaine et bien sûr modifiable aposteriori
7. **Homepage** : quel contenu dashboard ? (activité récente, stats, raccourcis domaines ?)

## Références

- `préparation/homepage1_code.md` — Maquette homepage (exemple visuel)
- `docs/P0_cadrage.md` — Scope projet, "knowledge exploration graph with bidirectional links"
- `docs/P3_4_concept.md` — User flows, wireframes, design guidelines
- `docs/P4_1_backlog.md` — 48 user stories, 9 Epics
- `docs/P4_2_blueprint.md` — Architecture, data model, ADRs
- `préparation/2026_01_26_LANCEMENT.md` — Décisions réunion lancement
- `préparation/2026_03_03_KM_SUIVI.md` — Suivi KM, cartographies
