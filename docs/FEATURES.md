# PlumeNote -- Reference des Features

> **Version** : 1.0 -- 8 mars 2026
> **Statut** : Document de reference produit
> **Source** : P0 Cadrage, P3.4 Concept, P4.1 Backlog, notes de lancement (26/01/2026), suivi KM (03/03/2026), design domaines/features (08/03/2026)

---

## Table des matieres

1. [Vision produit](#1-vision-produit)
2. [Domaines](#2-domaines)
3. [Feature Documents](#3-feature-documents)
4. [Feature Applications](#4-feature-applications)
5. [Feature Cartographie](#5-feature-cartographie)
6. [Recherche](#6-recherche)
7. [Editeur](#7-editeur)
8. [Signaux de fraicheur](#8-signaux-de-fraicheur)
9. [Authentification et acces](#9-authentification-et-acces)
10. [Import](#10-import)
11. [Administration](#11-administration)
12. [Analytics](#12-analytics)
13. [Homepage](#13-homepage)

---

## 1. Vision produit

### Ce que PlumeNote est

PlumeNote est une plateforme web self-hosted de Knowledge Management concue pour la DSI de la CPAM 92. C'est un "Google interne de la DSI" : un point d'entree unique, rapide et visuel qui unifie toute la documentation technique dans une interface web accessible depuis n'importe quel navigateur, y compris depuis le poste d'un agent en intervention.

### Pourquoi il existe

La DSI disposait de ressources documentaires eparses : procedures Word, cartographies Excel, PDF nationaux, fichiers .txt, liens web, macros VBA. Trois initiatives paralleles non coordonnees coexistaient avant le lancement du projet (26/01/2026) :

- **Outil SCI (Excel/VBA -- Didier Bottaz)** : fichier Excel avec macros centralisant l'acces aux procedures du SCI, recherche par mots-cles sur descriptions indexees manuellement, limite par le format Excel (acces concurrent, dependance reseau).
- **BookStack (Etudes & Dev -- Lilian Hammache)** : solution open-source de documentation web, organisation hierarchique, recherche full-text, gestion des droits, initialement destinee aux clients internes (DFC, MOA).
- **Reflexion personnelle (Alexandre Berge)** : vision d'un outil de documentation inspire d'Obsidian, Logseq, Linear et Tana.

La reunion du 26 janvier 2026 a acte le besoin de convergence. Le sponsor a tranche pour une trajectoire unique : PlumeNote est un developpement from scratch, pas un fork ni une extension de BookStack.

### Quel probleme il resout

1. **Recherche inefficace** : la recherche Windows dans les arborescences est inutilisable pour des recherches transversales. PlumeNote offre une recherche full-text tolerante aux fautes de frappe en moins de 1,5 seconde.
2. **Documentation non fiable** : aucun outil du marche n'affiche la fiabilite temporelle d'un document. PlumeNote est le seul outil ou un technicien sait en un coup d'oeil s'il peut faire confiance a ce qu'il lit (signaux de fraicheur).
3. **Cout de contribution prohibitif** : les documents Word sont lourds a creer et maintenir. PlumeNote cible moins de 5 minutes pour formaliser une procedure simple.
4. **Accessibilite limitee** : les documents sont sur des serveurs partages, inaccessibles depuis un poste utilisateur lambda en intervention. PlumeNote est accessible via navigateur, sans dependance reseau fichier.
5. **Connaissance tacite non formalisee** : notamment au Support Parc, pas de documentation procedurale. PlumeNote reduit la barriere a l'entree pour la formalisation.

### Secret Sauce

Les **signaux de fraicheur natifs** : badges vert/jaune/rouge sur chaque document, bases sur la date de derniere verification. C'est le white space identifie en phase d'analyse concurrentielle -- aucun outil du marche (BookStack, Docmost, Outline, XWiki) ne propose cette fonctionnalite. Le badge de fraicheur casse le cercle vicieux de non-consultation : "je ne consulte pas la doc parce que je ne sais pas si elle est a jour."

---

## 2. Domaines

### Concept

Un domaine n'est pas un simple filtre ou tag. C'est un **espace a part entiere** qui, a sa creation, peut activer 1 a 3 features independantes : Documents, Applications, Cartographie. Chaque feature activee a sa propre interface, ses propres donnees, sa propre logique.

### Domaines prevus

| Domaine | Description | Features envisagees |
|---------|-------------|---------------------|
| **SCI** | Service du Controle Interne. Procedures, outils, macros, documentation applicative metier | Documents, Applications |
| **Etudes & Dev** | Pole developpement. Documentation utilisateur MOA, guides applicatifs, API, changelogs | Documents, Applications |
| **Infrastructure** | Serveurs, reseaux, deploiements. Fichiers .txt, PDF nationaux, architectures | Documents, Cartographie |
| **Support** | Support technique et Support Parc. Modes operatoires, troubleshooting, PEI | Documents |
| **Gouvernance** | Vision transversale. Cartographie applicative globale, habilitations, registre des outils | Applications, Cartographie |

### Activation des features par domaine

A la creation d'un domaine dans la console admin, l'administrateur choisit quelles features activer parmi les trois disponibles. Un domaine peut avoir uniquement "Documents", ou "Documents + Cartographie", ou les trois. Cette activation est modifiable apres creation.

### Permissions par domaine

Le modele de permissions est lie aux domaines : un utilisateur DSI a acces en lecture a tous les domaines, mais en ecriture uniquement sur son domaine principal (attribue par l'admin). Les administrateurs ont tous les droits sur tous les domaines.

### User stories concernees

- **US-601** : Naviguer par domaine depuis la page d'accueil
- **US-802** : Gerer les domaines (CRUD Admin)
- **US-107** : Filtrer les resultats de recherche par domaine

### Regles metier

- **RG-003** : Modele de permissions 3 niveaux (Public / DSI / Admin). Un utilisateur DSI ne peut modifier QUE les documents de son domaine principal.
- La suppression d'un domaine contenant des documents declenche un avertissement et propose la migration vers un autre domaine ou l'archivage.

### Interactions avec les autres features

- La recherche (Feature 6) utilise les domaines comme filtre (`filterableAttributes` dans Meilisearch).
- L'editeur (Feature 7) pre-selectionne le domaine de l'utilisateur a la creation d'un document.
- L'administration (Feature 11) permet le CRUD des domaines avec activation/desactivation des features.
- La homepage (Feature 13) affiche les domaines avec compteurs de documents.

### Etat d'implementation

**Implemente.** Le backend dispose de requetes SQL pour les domaines (`internal/db/queries/domain.sql`), le frontend a un composant `DomainPage.tsx` et l'admin a un `DomainsAdmin.tsx`. L'activation des features par domaine (Documents/Applications/Cartographie) est en cours de design (brouillon du 08/03/2026) et n'est pas encore implementee dans le modele de donnees.

---

## 3. Feature Documents

### Description fonctionnelle

La feature Documents est le coeur de PlumeNote. Elle offre une arborescence hierarchique de documentation au sein de chaque domaine. Chaque document est un contenu TipTap JSON stocke en JSONB dans PostgreSQL, indexe dans Meilisearch, et associe a un domaine, un type, des tags, et des metadonnees de fraicheur.

### Arborescence documentaire

Chaque domaine qui active la feature Documents dispose de sa propre arborescence. Les documents sont organises par :

- **Domaine** : l'espace de rattachement (SCI, Infra, etc.)
- **Type de document** : classification obligatoire parmi une liste configurable
- **Tags** : categorisation libre avec auto-completion
- **Sous-dossiers** : organisation en profondeur au sein d'un domaine (point ouvert sur le modele de stockage : nested set, adjacency list ou materialized path)

### Types de documents

10 types pre-configures au premier lancement (RG-011), alignes sur les 10 templates (RG-008) :

| # | Type | Usage |
|---|------|-------|
| 1 | Procedure technique | Operations etape par etape (installations, configurations) |
| 2 | Guide utilisateur | Documentation applicative destinee aux utilisateurs finaux (MOA/DFC) |
| 3 | Architecture systeme | Description technique d'un composant d'infrastructure |
| 4 | FAQ | Reponses aux questions frequentes sur un sujet |
| 5 | Troubleshooting | Guide de diagnostic et resolution pour un probleme recurrent |
| 6 | Fiche applicative | Carte d'identite d'une application metier |
| 7 | Procedure d'installation | Guide d'installation d'un logiciel ou service |
| 8 | Note de version / Changelog | Historique des evolutions d'une application |
| 9 | Guide de depannage reseau | Procedure de diagnostic pour les problemes reseau |
| 10 | Documentation d'API / Service | Description technique d'un endpoint ou service interne |

Un type "Autre" existe pour les documents qui ne rentrent dans aucune categorie. L'admin peut ajouter/modifier les types dans le backoffice.

### Templates

10 templates pre-configures (RG-008), chacun correspondant a un type de document. Un template est un document TipTap avec des sections pre-remplies et des placeholders. Les templates sont **subsidiaires** : proposes a la creation d'une page, jamais imposes. L'utilisateur peut toujours partir d'une page vierge.

Structure des templates livres :

- **T-01 Procedure technique** : Objectif, Prerequis, Etapes numerotees, Verification, En cas de probleme
- **T-02 Guide utilisateur** : Presentation, Acces, Fonctionnalites principales, Questions frequentes, En cas de probleme
- **T-03 Architecture systeme** : Vue d'ensemble, Caracteristiques techniques (tableau), Dependances, Acces & habilitations, Procedures liees
- **T-04 FAQ** : Liste de questions/reponses avec lien fallback vers le support
- **T-05 Troubleshooting** : Symptomes, Diagnostic (etapes), Solutions conditionnelles, Escalade
- **T-06 Fiche applicative** : Informations generales (tableau), Description fonctionnelle, Architecture technique, Procedures liees, Contacts
- **T-07 Procedure d'installation** : Prerequis, Telechargement, Etapes d'installation, Configuration post-installation, Verification, Desinstallation
- **T-08 Note de version** : Nouveautes, Corrections, Changements techniques, Impact utilisateur (par version)
- **T-09 Guide de depannage reseau** : Contexte, Diagnostic rapide (commandes), Causes frequentes (tableau), Escalade
- **T-10 Documentation d'API** : Description, Endpoints (GET/POST), Authentification, Exemples curl, Erreurs courantes (tableau)

### Hierarchie et sous-dossiers

La navigation au sein d'un domaine suit une hierarchie : Domaine > (sous-dossier optionnel) > Document. Le fil d'Ariane (breadcrumb) reflete cette hierarchie et chaque segment est cliquable. Le modele de stockage de l'arborescence (nested set, adjacency list ou materialized path) est un point ouvert a trancher.

### User stories concernees

- **US-401** : Creer une nouvelle page vierge
- **US-402** : Creer une page a partir d'un template
- **US-412** : Sauvegarder et publier un document (Ctrl+S)
- **US-413** : Modifier un document existant
- **US-414** : Supprimer un document
- **US-601** : Naviguer par domaine depuis la page d'accueil
- **US-602** : Voir les documents recemment modifies sur l'accueil
- **US-301** : Lire un document avec sommaire lateral auto-genere
- **US-302** : Copier un bloc de code en un clic
- **US-303** : Coloration syntaxique des blocs de code
- **US-304** : Metadonnees de confiance en en-tete
- **US-305** : Naviguer via le breadcrumb
- **US-306** : Liens internes entre documents
- **US-307** : Previsualiser un document avant publication

### Regles metier

- **RG-007** : Publication immediate. Pas d'etat brouillon. Tout document sauvegarde est immediatement publie et visible.
- **RG-008** : Templates subsidiaires. Page vierge par defaut. 10 templates pre-configures au premier lancement.
- **RG-011** : Types de document. Chaque document a un type obligatoire parmi une liste configurable. 10 types par defaut + "Autre".
- **RG-001** : Indexation temps reel. Tout document sauvegarde doit etre indexe dans Meilisearch dans un delai max de 10 secondes.

### Interactions avec les autres features

- **Recherche** : chaque document sauvegarde est indexe dans Meilisearch (titre, corps, tags, metadonnees). Le type est filtrable.
- **Signaux de fraicheur** : chaque document porte un badge de fraicheur base sur sa date de derniere verification.
- **Editeur** : le contenu est cree et modifie via l'editeur TipTap (Feature 7).
- **Cartographie** : les documents peuvent etre lies a des noeuds du graphe via des liens internes.
- **Analytics** : chaque consultation est logguee, le compteur de vues est visible.
- **Import** : les documents existants (Word, PDF, TXT) sont convertis en documents PlumeNote.

### Etat d'implementation

**Implemente.** Le backend dispose de handlers CRUD complets (`internal/document/handlers.go`), de requetes SQL (`internal/db/queries/document.sql`, `tag.sql`, `type.sql`, `template.sql`), et d'un pipeline d'indexation Meilisearch. Le frontend a un `ReaderPage.tsx` complet (sommaire lateral, breadcrumb, metadonnees, blocs de code copiables) et un `EditorPage.tsx` avec TipTap, templates, tags, slash commands. Les sous-dossiers hierarchiques ne sont pas encore implementes.

---

## 4. Feature Applications

### Description fonctionnelle

La feature Applications est un **registre applicatif** -- un catalogue/annuaire des outils et applications utilises par l'organisme. Ce n'est pas de la documentation au sens classique : ce sont des **fiches de presentation** structurees.

Chaque fiche applicative contient :

- **Informations generales** : editeur, version, environnement (prod/preprod), URL d'acces, responsable DSI
- **Description fonctionnelle** : a quoi sert l'application, qui l'utilise, quel processus metier
- **Architecture technique** : serveur(s), base de donnees, flux reseau
- **Statut** : en production, en cours de deploiement, en fin de vie, etc.
- **Habilitations** : qui a acces, via quel mecanisme (Passeport, acces direct, etc.)
- **Liens** : URL d'acces, documentation associee, procedures liees
- **Contacts** : editeur, support N2, referent interne

Cette feature repond au besoin identifie lors de la reunion de lancement : "vision consolidee des elements interconnectes (serveurs, applicatifs, hebergement)" et comble partiellement le role que l'application Chanel (PAL) devait jouer pour la gouvernance applicative.

### User stories concernees

Pas de user stories dediees dans le backlog MVP (P4.1). La feature Applications est identifiee dans le design domaines/features du 08/03/2026 comme un element a ideationnner : format exact des fiches, champs, navigation. Le template T-06 "Fiche applicative" du backlog MVP sert de base structurelle.

### Regles metier

- Le format exact des fiches applicatives est a definir (champs obligatoires, champs optionnels, structure).
- La difference entre une "fiche applicative" (document de type T-06) et une entree du registre applicatif (feature Applications) doit etre clarifiee : le registre est un objet structure avec des champs typos, pas un document libre.

### Interactions avec les autres features

- **Documents** : une fiche du registre applicatif peut etre liee a des documents (procedures d'installation, guides utilisateur, troubleshooting).
- **Cartographie** : une application est un noeud potentiel dans le graphe (hebergee sur un serveur, depend d'un service, utilisee par un domaine).
- **Recherche** : les fiches applicatives doivent etre trouvables via la recherche globale.

### Etat d'implementation

**Partiel.** Le frontend a un composant `ApplicationsView.tsx` dans la feature home, ce qui indique qu'une vue basique existe. Le backend ne dispose pas de handlers dedies pour un registre applicatif structure -- les fiches sont actuellement des documents classiques utilisant le template T-06 "Fiche applicative". La modelisation en tant qu'objets structures avec des champs types (version, URL, statut, habilitations) n'est pas implementee.

---

## 5. Feature Cartographie

### Description fonctionnelle

La feature Cartographie est un **graphe interactif** de relations entre entites de l'ecosysteme technique de la DSI. C'est la transposition dans PlumeNote de ce qui etait auparavant maintenu dans 4 fichiers Excel separos (cartographie applicative, cartographie serveurs, architecture reseau, matrice d'hebergement).

### Composants du graphe

- **Nodes (noeuds)** : serveurs, applications, hebergements, reseaux, services, bases de donnees, equipements reseau. Chaque noeud a un type, un label, des proprietes et une description textuelle.
- **Edges (aretes)** : relations typees entre noeuds. Exemples : "heberge", "depend de", "connecte a", "administre par", "documente par".
- **Bidirectionnalite** : si l'application X est hebergee sur le serveur Y, les deux noeuds se connaissent. La relation est navigable dans les deux sens.
- **Backlinks** : depuis n'importe quelle entite, voir tout ce qui la reference. Inspire d'Obsidian/Logseq.

### Exploration visuelle

- Navigation par clic : cliquer sur un noeud ouvre ses relations et ses proprietes.
- Graphe interactif avec mise en page force-directed (lib frontend a choisir : D3.js, Cytoscape.js ou force-graph).
- Chaque noeud peut avoir une partie textuelle (description, notes).
- Filtrage par type de noeud, par domaine.

### User stories concernees

Pas de user stories dediees dans le backlog MVP (P4.1). La cartographie est explicitement classee **WON'T HAVE MVP** et positionnee au **Jalon 2 (V1.0)**, 3 a 5 mois apres le MVP. Le backlog la liste dans les fonctionnalites exclues du MVP avec la mention "Should Have latent, pas un Must".

Le design domaines/features du 08/03/2026 identifie les points ouverts :

- Quelle lib frontend pour le graphe ? (D3.js, Cytoscape.js, force-graph)
- Quel stockage backend ? (table edges relationnelle, ou graph DB type Apache AGE)
- Navigation quand on entre dans un domaine : comment basculer entre ses features activees

### Regles metier

- Les relations sont bidirectionnelles par defaut.
- Les backlinks sont generes automatiquement.
- Le graphe doit pouvoir representer les interconnexions serveurs/applications/hebergement qui etaient dans les cartographies Excel.

### Interactions avec les autres features

- **Documents** : un noeud du graphe (serveur, application) peut etre lie a des documents (procedures, architectures). Les liens internes dans les documents (Feature 3) prefigurent ces connexions.
- **Applications** : les fiches applicatives du registre sont des noeuds naturels du graphe.
- **Recherche** : les noeuds et leurs descriptions doivent etre trouvables via la recherche globale.
- **Domaines** : chaque domaine peut activer ou non la feature Cartographie.

### Etat d'implementation

**Partiel.** Le frontend a un composant `CartographieView.tsx` dans la feature home, indiquant qu'une vue placeholder existe. Le backend ne dispose pas de modele de donnees pour les noeuds, aretes et relations du graphe. Le choix technique (table edges vs Apache AGE, lib de visualisation) n'est pas arrete. La cartographie reste un objectif Jalon 2.

---

## 6. Recherche

### Description fonctionnelle

La recherche est le **coeur du produit**. C'est la fonctionnalite qui justifie l'existence de PlumeNote : permettre a un technicien de trouver la bonne procedure en moins de 10 secondes depuis n'importe quel poste. La promesse est "plus rapide que de demander au collegue d'a cote".

La recherche repose sur **Meilisearch CE**, un moteur de recherche full-text typo-tolerant, self-hosted, avec des temps de reponse inforieurs a 100ms sur l'index.

### Modale Ctrl+K

- Accessible depuis n'importe quelle page via le raccourci `Ctrl+K`.
- Ouvre une modale au centre de l'ecran avec overlay semi-transparent.
- Focus automatique dans le champ de saisie.
- Fermeture par `Esc` ou clic sur l'overlay.
- Si la modale est deja ouverte, un second `Ctrl+K` remet le focus dans le champ.

### Recherche as-you-type

- Les resultats commencent a apparaitre des le 2eme caractere saisi.
- Requetes debouncees a 200ms apres la derniere frappe pour eviter la surcharge.
- Raffinement progressif : les resultats se reduisent au fur et a mesure de la saisie.
- Temps de reponse affiche ("3 resultats en 0.8s").

### Tolerance aux fautes de frappe

- Meilisearch gere nativement la typo-tolerance.
- 1 lettre manquante ou changee : le document est trouve (ex: "configuraion" -> "Configuration").
- 2 typos sur 2 mots : le document est trouve (ex: "confg proewb" -> "Configuration VPN ProWeb").
- Pas de faux positifs aberrants sur des mots totalement differents.

### Resultats

Chaque carte de resultat affiche :

- Titre du document
- Badge de fraicheur (vert/jaune/rouge + libelle "Verifie il y a X jours/mois")
- Domaine (ex: "SCI")
- Nom de l'auteur
- Nombre de vues (ex: "47 vues")
- Nombre de fichiers joints le cas echeant
- Extrait de 2-3 lignes avec les termes recherches en **gras** (highlighting Meilisearch natif)

### Filtres

- **Par domaine** : SCI, Infra, Support, Etudes, etc.
- **Par type de document** : Procedure, Guide, FAQ, Architecture, etc.
- Les filtres sont combinables (domaine + type).
- Un filtre actif affiche le compteur filtre ("4 resultats (filtres sur INFRA)").
- Retour a "Tous" pour desactiver les filtres.

### Navigation clavier

- `flèche bas / flèche haut` : naviguer entre les resultats.
- `Entree` : ouvrir le resultat selectionne.
- `Esc` : fermer la modale.
- Boucle cyclique : apres le dernier resultat, retour au premier.
- Depuis le premier resultat, `flèche haut` remet le focus dans le champ de saisie.

### Message "aucun resultat"

- Si aucun document ne correspond : message "Aucun resultat pour << [requete] >>. Essayez avec d'autres mots-cles ou creez une page."
- Bouton "+ Creer cette page" qui ouvre l'editeur avec le titre pre-rempli.

### Vue publique

- La recherche en vue publique (sans authentification) filtre automatiquement sur les documents de visibilite "public" (RG-006).
- Les documents internes DSI sont strictement invisibles.

### User stories concernees

- **US-101** : Ouvrir et fermer la modale de recherche (Ctrl+K) -- MUST HAVE
- **US-102** : Effectuer une recherche full-text instantanee (as-you-type) -- MUST HAVE
- **US-103** : Obtenir des resultats pertinents malgre les fautes de frappe -- MUST HAVE
- **US-104** : Afficher les metadonnees de confiance dans chaque resultat -- MUST HAVE
- **US-105** : Naviguer dans les resultats au clavier -- MUST HAVE
- **US-106** : Afficher un message contextuel quand aucun resultat -- MUST HAVE
- **US-107** : Filtrer les resultats par domaine et par type -- MUST HAVE

### Regles metier

- **RG-001** : Indexation temps reel. Tout document sauvegarde doit etre indexe dans Meilisearch dans un delai max de 10 secondes. L'index couvre : titre, corps, tags, metadonnees (auteur, domaine).
- **RG-002** : Performance de recherche. Temps de reponse < 1,5 seconde pour un index de 500 documents. Au-dela de 3 secondes, le produit a echoue. Debounce de 200ms.
- **RG-006** : Filtrage automatique vue publique. La vue publique filtre sur les documents "public" uniquement.

### Interactions avec les autres features

- **Documents** : la recherche indexe tous les documents (titre, corps, tags, type, domaine).
- **Signaux de fraicheur** : le badge est affiche dans chaque resultat de recherche.
- **Analytics** : chaque recherche est logguee (termes, nb resultats, clic ou non).
- **Authentification** : determine si la recherche filtre sur "public" ou sur tous les documents.
- **Domaines** : utilises comme attribut filtrable.

### Etat d'implementation

**Implemente.** Le backend dispose d'un module search complet (`internal/search/handler.go`, `router.go`, `auth.go`) avec proxy Meilisearch. Le frontend a un composant `SearchModal.tsx` dans la feature search. L'indexation est declenchee a la sauvegarde des documents. Les filtres par domaine et type, la navigation clavier, le highlighting et la typo-tolerance sont fonctionnels via Meilisearch.

---

## 7. Editeur

### Description fonctionnelle

L'editeur est base sur **TipTap 3**, un framework d'editeur riche extensible construit sur ProseMirror. Il offre un mode dual : barre d'outils WYSIWYG pour les utilisateurs standards, et syntaxe Markdown native avec auto-conversion pour les power users. L'objectif est un cout de contribution inferieur a 5 minutes pour une procedure simple.

### Barre d'outils WYSIWYG

Boutons disponibles : Gras (B), Italique (I), Titre H1, Titre H2, Liste a puces, Liste numerotee, Bloc de code, Piece jointe/image, Lien, Bloc alerte, et menu etendu (...).

### Markdown natif

Auto-conversion en temps reel :

- `## Ma section` + Entree -> titre H2 formate
- `- premier point` + Entree -> liste a puces
- `**important**` -> texte en gras
- `` `commande` `` -> code inline monospace
- ```` ``` bash ```` -> bloc de code avec coloration syntaxique

### Slash commands (/)

Taper `/` sur une ligne vide ouvre un menu contextuel d'insertion :

- Bloc de code (avec selecteur de langage)
- Image
- Tableau
- Alerte/Astuce (3 types : Astuce bleu, Attention orange, Danger rouge)
- Lien interne
- Separateur

Le menu est filtrable par saisie (ex: `/code` ne montre que "Bloc de code"). Fermeture par `Esc`.

### Blocs de code avec coloration syntaxique

- Langages supportes : bash, PowerShell, SQL, Python, JSON, XML
- Fond distinct, police monospace
- Selecteur de langage modifiable apres insertion
- Bouton copier `[copier]` en un clic, texte brut sans caracteres parasites (`\n` Unix, pas de `\r\n`)

### Images

- Upload via bouton ou drag & drop
- Formats acceptes : PNG, JPG, GIF, WebP
- Taille max : 10 Mo
- Stockage cote serveur, affichage inline

### Tableaux

- Insertion via slash command avec choix colonnes x lignes
- Navigation par Tab entre cellules
- Ajout/suppression de lignes et colonnes via clic droit

### Blocs d'alerte

3 types visuellement distincts :

- **Astuce** (bleu, icone ampoule) : informations utiles, tips
- **Attention** (orange, icone avertissement) : precautions, points d'attention
- **Danger** (rouge, icone danger) : risques, actions destructives

### Liens internes

- Insertion via `[[` ou bouton lien, avec auto-completion sur les titres de documents existants.
- Un lien vers un document inexistant est affiche en rouge/italique, signalant un document manquant.
- Prefigure les backlinks du Jalon 2 (Cartographie).

### Tags

- Champ tags avec auto-completion sur les tags existants.
- Creation de nouveaux tags a la volee.
- Suppression d'un tag du document sans le supprimer du systeme global.

### Sauvegarde et publication

- `Ctrl+S` ou bouton "Publier" : sauvegarde + indexation Meilisearch dans les 5 secondes.
- Publication immediate, pas de brouillon, pas de workflow de validation (RG-007).
- Feedback "Sauvegarde reussie" pendant 2 secondes.
- Le document est trouvable en recherche dans les 10 secondes suivant la sauvegarde.

### User stories concernees

- **US-401** : Creer une nouvelle page vierge -- MUST HAVE
- **US-402** : Creer une page a partir d'un template -- MUST HAVE
- **US-403** : Formater du texte avec la barre d'outils WYSIWYG -- MUST HAVE
- **US-404** : Rediger en Markdown natif avec auto-conversion -- MUST HAVE
- **US-405** : Inserer un bloc de code avec coloration syntaxique -- MUST HAVE
- **US-406** : Utiliser le menu commande slash (/) -- MUST HAVE
- **US-407** : Inserer et afficher des images -- MUST HAVE
- **US-408** : Inserer un bloc d'alerte/astuce -- MUST HAVE
- **US-409** : Inserer un tableau -- MUST HAVE
- **US-410** : Inserer un lien interne vers un autre document -- MUST HAVE
- **US-411** : Ajouter des tags avec auto-completion -- MUST HAVE
- **US-412** : Sauvegarder et publier (Ctrl+S) -- MUST HAVE
- **US-413** : Modifier un document existant -- MUST HAVE
- **US-414** : Supprimer un document -- MUST HAVE

### Regles metier

- **RG-007** : Publication immediate. Pas de brouillon.
- **RG-008** : Templates subsidiaires. Page vierge par defaut.
- **RG-001** : Indexation temps reel (< 10 secondes).
- **RG-003** : Le bouton "Modifier" n'est visible que pour les utilisateurs avec droits d'ecriture sur le domaine du document.

### Interactions avec les autres features

- **Documents** : l'editeur produit le contenu TipTap JSON stocke en base.
- **Recherche** : la sauvegarde declenche l'indexation Meilisearch.
- **Signaux de fraicheur** : un document sauvegarde recoit le badge vert "Cree aujourd'hui".
- **Templates** : les templates sont injectes dans l'editeur a la creation.
- **Import** : les documents importes (Word/PDF/TXT) sont convertis en contenu TipTap editable.

### Etat d'implementation

**Implemente.** Le frontend dispose de composants complets : `TipTapEditor.tsx`, `Toolbar.tsx`, `SlashMenu.tsx`, `CodeBlockView.tsx`, `AlertBlock.tsx`, `ImageUpload.tsx`, `InternalLink.tsx`, `TableContextMenu.tsx`, `TagInput.tsx`, `TemplatePicker.tsx`. L'`EditorPage.tsx` orchestre l'ensemble. Le backend gere le stockage JSONB et l'indexation.

---

## 8. Signaux de fraicheur

### Description fonctionnelle

Les signaux de fraicheur sont le **differenciateur unique** de PlumeNote. Chaque document affiche un badge visuel colore indiquant sa fiabilite temporelle :

- **Vert** : "Verifie il y a X jours" -- le document a ete relu et valide recemment.
- **Jaune** : "Verifie il y a X mois" -- le document vieillit, une revue serait bienvenue.
- **Rouge** : "Pas revu depuis X mois" + mention "Revue necessaire" -- obsolescence probable.

### Calcul du badge

Le badge est calcule a partir de la **date de derniere verification** (ou la date de derniere modification si le document n'a jamais ete verifie explicitement). Le calcul est purement temporel -- pas de logique metier specifique, pas de lien avec l'auteur, pas de logique RH.

### Seuils par defaut

| Badge | Seuil par defaut | Signification |
|-------|-----------------|---------------|
| Vert | < 1 mois | Document frais, fiable |
| Jaune | 1 a 6 mois | Document vieillissant |
| Rouge | > 6 mois | Obsolescence probable |

Les seuils sont **configurables** par l'administrateur dans la console admin (US-803). La question de seuils par domaine (une architecture reseau ne change pas tous les mois) est un point ouvert identifie en P3.4.

### Verification en 1 clic

Le bouton "Marquer comme verifie" est le mecanisme anti-obsolescence central :

- Un clic reinitialise le badge a vert.
- La date de verification et l'identite du verificateur sont enregistrees.
- Cout : 1 seconde. C'est le ratio effort/valeur le plus eleve de tout le produit.
- L'historique des verifications est conserve (date + auteur pour chaque verification).
- Le bouton n'est visible que pour les utilisateurs avec droits d'ecriture sur le domaine.

### Ubiquite

Le badge de fraicheur est affiche **partout** ou un document apparait :

- Resultats de recherche
- Page d'accueil (activite recente)
- Liste des documents d'un domaine
- En-tete du document en mode lecture
- Vue publique (pour les documents publics)

### User stories concernees

- **US-501** : Afficher le badge de fraicheur sur chaque document -- MUST HAVE
- **US-502** : Marquer un document comme verifie en 1 clic -- MUST HAVE
- **US-803** : Configurer les seuils de fraicheur dans la console admin -- MUST HAVE
- **US-104** : Afficher les metadonnees de confiance dans chaque resultat -- MUST HAVE
- **US-304** : Voir les metadonnees de confiance en en-tete d'un document -- MUST HAVE

### Regles metier

- **RG-004** : Calcul du badge de fraicheur. Base sur la date de derniere verification (ou date de derniere modification si jamais verifie). Seuils par defaut : vert < 1 mois, jaune 1-6 mois, rouge > 6 mois. Seuils configurables dans la console admin. Calcul purement temporel.
- **RG-003** : Seuls les utilisateurs avec droits d'ecriture sur le domaine peuvent marquer un document comme verifie.

### Interactions avec les autres features

- **Documents** : chaque document porte un badge de fraicheur. La verification est une action distincte de la modification.
- **Recherche** : le badge est affiche dans les resultats.
- **Administration** : les seuils sont configurables dans le backoffice.
- **Analytics** : les verifications sont tracables dans l'historique.

### Etat d'implementation

**Implemente.** Le backend dispose de requetes SQL dediees (`internal/db/queries/freshness.sql`) et d'une table `verification_log` pour l'historique des verifications. Le frontend a un composant `FreshnessBadge.tsx` utilise dans les vues home, search et reader. Les seuils sont stockes dans la table `config` et configurables via l'admin (`ConfigAdmin.tsx`).

---

## 9. Authentification et acces

### Description fonctionnelle

PlumeNote implemente un modele d'acces a 3 niveaux, concu pour couvrir deux populations distinctes : les techniciens DSI (qui contribuent et consultent) et les clients internes MOA/DFC (qui consultent uniquement la documentation publique sans compte).

### 3 niveaux d'acces

| Niveau | Authentification | Lecture | Ecriture | Backoffice |
|--------|-----------------|---------|----------|------------|
| **Public** | Aucune (pas de login) | Documents tagges "public" uniquement | Aucune | Non |
| **DSI** | Login + mot de passe local | Tous les documents | Documents de son domaine uniquement | Non |
| **Admin** | Login + mot de passe local | Tous les documents | Tous les documents, tous les domaines | Oui |

### Acces public sans compte

C'est un **Must Have** explicite. L'acces public permet a Sophie (collaboratrice MOA/DFC) de consulter la documentation applicative publique sans creation de compte, directement dans son navigateur. La vue publique :

- Affiche uniquement les documents de visibilite "public".
- Masque completement les procedures internes DSI (ni recherche, ni suggestions, ni navigation).
- N'affiche pas les boutons "Modifier" ni "Marquer comme verifie".
- Propose un CTA de fallback "Ouvrir un ticket support" redirigant vers GLPI (URL configurable par l'admin).
- Affiche les guides populaires classes par nombre de consultations.

### Authentification locale (V1)

- Comptes crees manuellement par l'administrateur dans le backoffice.
- Login + mot de passe hashe en base (bcrypt).
- Session persistante avec token JWT HS256 (duree configurable).
- Message d'erreur generique sur identifiants incorrects ("Identifiants invalides" sans preciser login ou mot de passe).
- Deconnexion via menu utilisateur (initiales en haut a droite).
- A l'expiration du token : redirection vers la page de connexion avec message "Session expiree".
- Apres deconnexion, l'utilisateur voit la vue publique (pas une page d'erreur).

### Changement de mot de passe

- Accessible depuis le profil utilisateur.
- Necessite le mot de passe actuel + nouveau mot de passe (minimum 8 caracteres) + confirmation.
- La session reste active apres changement.

### V2 : LDAP/SSO

L'authentification LDAP Active Directory est prevue en V2. SSO transparent si l'utilisateur est deja connecte au domaine Windows. Synchronisation automatique des comptes. Explicitement hors scope du MVP.

### User stories concernees

- **US-201** : Se connecter avec un compte local -- MUST HAVE
- **US-202** : Consulter la documentation publique sans compte -- MUST HAVE
- **US-203** : Voir la page d'accueil personnalisee apres connexion -- MUST HAVE
- **US-204** : Acceder au CTA de fallback "Ouvrir un ticket support" -- MUST HAVE
- **US-205** : Se deconnecter -- MUST HAVE
- **US-206** : Changer son mot de passe -- MUST HAVE

### Regles metier

- **RG-003** : Modele de permissions 3 niveaux. Un utilisateur DSI ne peut modifier QUE les documents de son domaine principal.
- **RG-005** : Authentification locale (V1). Comptes crees par l'admin, bcrypt, JWT. Duree de session configurable. V2 : LDAP/SSO.
- **RG-006** : Filtrage automatique vue publique. Les documents "DSI" et "Admin" sont strictement invisibles en vue publique.

### Interactions avec les autres features

- **Recherche** : le niveau d'acces determine le scope de la recherche (public vs tous les documents).
- **Editeur** : le bouton "Modifier" n'apparait que pour les utilisateurs avec droits d'ecriture.
- **Signaux de fraicheur** : le bouton "Marquer comme verifie" n'apparait que pour les utilisateurs avec droits d'ecriture.
- **Administration** : seuls les admins accedent au backoffice.
- **Analytics** : les logs de consultation en vue publique sont anonymises (RG-010).

### Etat d'implementation

**Implemente.** Le backend dispose d'un module auth complet (`internal/auth/handler.go`, `middleware.go`, `claims.go`, `context.go`) avec JWT HS256, bcrypt, et middleware de verification. Le frontend a `LoginPage.tsx`, `ProfilePage.tsx`, `RouteGuard.tsx` et un `auth-context.tsx` dans les libs. La vue publique (`PublicHomePage.tsx`) est fonctionnelle. Les modules search et analytics disposent chacun d'un fichier `auth.go` pour le filtrage par niveau d'acces.

---

## 10. Import

### Description fonctionnelle

L'import permet de migrer le patrimoine documentaire existant vers PlumeNote. Sans migration, l'outil demarre vide et n'a aucune valeur. Le pipeline d'import repose sur **Pandoc** pour la conversion multi-formats et s'execute en mode batch (script CLI).

### Formats supportes

| Format | Pipeline | Traitement |
|--------|----------|------------|
| **Word (.doc/.docx)** | Pandoc | Conversion en HTML puis en TipTap JSON. Titres, listes, tableaux preserves. Images extraites et incluses. |
| **PDF** | Pandoc / extraction texte | Texte selectionnable : extraction et conversion en page PlumeNote. PDF image (scan) : avertissement logge, page avec placeholder "Contenu scanne -- transcription manuelle recommandee". |
| **TXT** | Interpretation Markdown | Contenu interprete comme Markdown (titres `#` detectes si presents). Nom du fichier = titre de la page. |

### Import en lot

- Script batch CLI executab;e sur un dossier complet.
- Convention de nommage des dossiers pour attribution automatique de domaine (ex: sous-dossier "SCI" -> domaine SCI).
- Fichiers corrompus ignores sans interrompre le lot.
- Rapport d'import en fin d'execution : fichiers importes, fichiers en echec (nom + raison), total de pages creees.
- Chaque page creee est automatiquement indexee dans Meilisearch.

### Formats exclus du MVP

- **PPTX** : format secondaire, patrimoine critique en Word/PDF/TXT. Cible : V1.0.
- **XLS/XLSX** : les tableaux Excel de gestion de parc restent dans leur format natif. Seules les metadonnees pourraient etre importees en V1.0.
- **URL web** : capture de contenu web. Cible : V1.0.

### User stories concernees

- **US-701** : Importer des documents Word (.doc/.docx) en lot -- MUST HAVE
- **US-702** : Importer des fichiers PDF (extraction texte) -- MUST HAVE
- **US-703** : Importer des fichiers TXT bruts -- MUST HAVE

### Regles metier

- **RG-009** : Pipeline d'import. 3 formats : Word (Pandoc), PDF (extraction texte), TXT (Markdown). Import = script batch CLI. Nom du fichier = titre par defaut. Images embarquees extraites et stockees. Fichiers en erreur n'interrompent pas le lot. Convention de nommage des dossiers pour attribution automatique de domaine.
- **RG-001** : Chaque document importe est indexe dans Meilisearch dans les 10 secondes.

### Interactions avec les autres features

- **Documents** : l'import cree des documents standards PlumeNote, editables et indexes.
- **Signaux de fraicheur** : les documents importes utilisent leur date de derniere modification comme date de reference pour le badge (jamais verifie explicitement).
- **Recherche** : les documents importes sont trouvables des leur indexation.
- **Domaines** : l'attribution au domaine se fait par convention de nommage des dossiers.

### Etat d'implementation

**Implemente.** Le backend dispose d'un module importer complet (`internal/importer/importer.go`, `html_to_tiptap.go`) avec pipeline Pandoc pour la conversion Word -> HTML -> TipTap JSON. Les tests unitaires couvrent la conversion HTML vers TipTap (`html_to_tiptap_test.go`, `importer_test.go`). L'import PDF et TXT est egalement gere.

---

## 11. Administration

### Description fonctionnelle

La console d'administration (backoffice) est reservee aux utilisateurs de role "Admin". Elle permet de gerer les elements structurants de PlumeNote : templates, domaines (avec activation de features), utilisateurs, seuils de fraicheur, et configuration globale.

### Templates CRUD

- Creer, modifier et supprimer des templates de documents.
- Un template = un document TipTap avec sections pre-remplies et placeholders.
- 10 templates pre-configures au premier lancement (RG-008).
- La modification d'un template n'impacte pas les documents existants crees a partir de ce template.
- La suppression d'un template n'impacte pas les documents existants.

### Domaines CRUD

- Creer, renommer et archiver des domaines.
- A la creation, choisir quelles features activer (Documents, Applications, Cartographie).
- Suppression protegee : si le domaine contient des documents, avertissement avec proposition de migration ou archivage.
- Un domaine cree apparait dans les filtres de recherche, le selecteur de l'editeur, et la page d'accueil.

### Utilisateurs

- Creer des comptes locaux (login, mot de passe temporaire, role DSI/Admin, domaine principal).
- Lister les utilisateurs (nom, login, role, domaine, date de derniere connexion).
- Changer le role d'un utilisateur (DSI -> Admin ou inverse).
- Reinitialiser un mot de passe (generation d'un mot de passe temporaire affiche une seule fois).

### Configuration seuils de fraicheur

- Modifier les seuils globaux (vert, jaune, rouge).
- Valeurs par defaut : vert < 1 mois, jaune 1-6 mois, rouge > 6 mois.
- Validation : le seuil jaune doit etre superieur au seuil vert.
- Recalcul immediat de tous les badges apres modification.

### Configuration URL tickets (GLPI)

- Saisir l'URL de redirection du bouton "Ouvrir un ticket support" de la vue publique.
- Utilise par le CTA de fallback de la vue Sophie.

### User stories concernees

- **US-801** : Gerer les templates (CRUD Admin) -- MUST HAVE
- **US-802** : Gerer les domaines (CRUD Admin) -- MUST HAVE
- **US-803** : Configurer les seuils de fraicheur -- MUST HAVE
- **US-804** : Gerer les utilisateurs et leurs roles -- MUST HAVE
- **US-805** : Configurer l'URL du portail de tickets -- MUST HAVE

### Regles metier

- **RG-003** : Seuls les admins accedent au backoffice.
- **RG-004** : Seuils configurables. Recalcul immediat.
- **RG-005** : Comptes crees par l'admin. Bcrypt. JWT.
- **RG-008** : 10 templates pre-configures au premier lancement.

### Interactions avec les autres features

- **Documents** : les templates et types de documents sont geres ici.
- **Domaines** : la creation et l'activation des features par domaine sont gerees ici.
- **Signaux de fraicheur** : les seuils sont configures ici.
- **Authentification** : les comptes et roles sont geres ici.
- **Vue publique** : l'URL des tickets est configuree ici.

### Etat d'implementation

**Implemente.** Le backend dispose d'un module admin (`internal/admin/handler.go`, `router.go`) et de requetes SQL pour les templates (`template.sql`), domaines (`domain.sql`), config (`config.sql`), et auth (`auth.sql`). Le frontend a une page admin complete avec onglets : `AdminPage.tsx`, `TemplatesAdmin.tsx`, `DomainsAdmin.tsx`, `UsersAdmin.tsx`, `ConfigAdmin.tsx`. L'activation des features par domaine (Documents/Applications/Cartographie) est en cours de design et n'est pas encore implementee dans l'interface admin.

---

## 12. Analytics

### Description fonctionnelle

Les analytics permettent de mesurer l'adoption et l'utilisation de PlumeNote. La **North Star Metric** du produit est le **Search-to-View Rate** : le pourcentage de recherches qui aboutissent a une consultation de document. Cette metrique doit etre mesurable des le jour 1.

### Compteur de vues

- Chaque document affiche un compteur de consultations visible partout (recherche, accueil, lecture).
- Chaque ouverture de document incremente le compteur.
- Le compteur sert de reconnaissance silencieuse pour les contributeurs (besoin latent identifie en P1.3).
- Les documents populaires sont mis en avant sur la page d'accueil publique.

### Logs de recherche

Chaque recherche est enregistree :

- Termes de la requete
- Timestamp
- Nombre de resultats
- ID du resultat clique (ou "aucun clic" si la modale est fermee sans clic)
- Identifiant utilisateur (anonymise en vue publique)

Les recherches sans clic sont un signal de contenu manquant exploitable pour identifier les trous documentaires.

### Logs de consultation

Chaque consultation de document est enregistree :

- ID du document
- Timestamp d'ouverture
- Duree approximative de consultation
- Identifiant utilisateur (anonymise en vue publique)

### Dashboard admin

Au MVP, les logs ne sont pas visualises dans un dashboard graphique. Ils sont stockes dans PostgreSQL et requetables en SQL par l'administrateur. Un dashboard de sante documentaire (% de couverture par domaine, documents jamais consultes, documents > 6 mois sans revue) est prevu au Jalon 2.

### User stories concernees

- **US-901** : Afficher le compteur de vues sur chaque document -- MUST HAVE
- **US-902** : Enregistrer les logs de recherche -- MUST HAVE
- **US-903** : Enregistrer les logs de consultation -- MUST HAVE

### Regles metier

- **RG-010** : Logs analytics. Stockes dans PostgreSQL (tables `search_log` et `view_log`). Pas de dashboard visible au MVP (requetables SQL par l'admin). Logs vue publique anonymises (pas d'identifiant utilisateur).

### Interactions avec les autres features

- **Recherche** : chaque recherche genere un log.
- **Documents** : chaque consultation genere un log et incremente le compteur de vues.
- **Authentification** : le niveau d'acces determine si le log est anonymise.
- **Homepage** : les documents populaires (par nombre de vues) sont affiches en priorite.
- **Vue publique** : les guides populaires sont classes par nombre de consultations.

### Etat d'implementation

**Implemente.** Le backend dispose d'un module analytics complet (`internal/analytics/handler.go`, `router.go`, `auth.go`) et de requetes SQL dediees (`internal/db/queries/analytics.sql`). Le schema de base de donnees inclut les tables `search_log` et `view_log`. Le compteur de vues est affiche dans les composants frontend (recherche, accueil, lecture).

---

## 13. Homepage

### Description fonctionnelle

La homepage est le point d'entree de PlumeNote. Elle existe en deux variantes selon le niveau d'acces :

### Homepage authentifiee (Didier)

Affiche apres connexion :

- **Message de bienvenue** personnalise : "Bonjour Didier -- X documents SCI . Y mis a jour cette semaine"
- **Barre de recherche** proeminente avec focus automatique
- **Hint contextuel** (premiere visite uniquement) : "Essayez Ctrl+K pour rechercher" (stocke en localStorage, affiche une seule fois)
- **Activite recente** : 4-6 documents les plus recemment modifies, sous forme de cartes avec titre, badge de fraicheur, domaine, date relative, compteur de vues
- **Domaines** : blocs cliquables avec compteurs de documents (ex: "SCI: 47", "Etudes: 63", "Infra: 38", "Support: 29")
- **Pied de page** : version PlumeNote, nombre total de documents, derniere synchronisation

### Homepage publique (Sophie)

Affichee sans authentification :

- **Message d'accueil** : "Bienvenue sur la documentation DSI -- Trouvez la reponse a votre question applicative"
- **Barre de recherche** proeminente
- **Guides populaires** : documents publics classes par nombre de consultations, sous forme de cartes avec titre et compteur
- **CTA de fallback** : "Vous ne trouvez pas ? Ouvrir un ticket support" (redirige vers GLPI, URL configurable)
- **Mention** : "Pas besoin de compte pour consulter"

### Dashboard agrege (vision cible)

Le design actuel de la homepage est un placeholder. La vision cible est un dashboard agrege du contenu tous domaines confondus, potentiellement avec 3 onglets ou vues :

- **Documentation** : activite recente, documents par domaine
- **Applications** : registre applicatif, fiches recentes
- **Cartographie** : vue graphe, noeuds recemment modifies

Le design final du dashboard doit etre realise apres que les scopes des domaines et de leurs features soient stabilises. Ce n'est pas la priorite : si le reste (recherche, editeur, fraicheur) est solide, la homepage suivra.

### User stories concernees

- **US-203** : Voir la page d'accueil personnalisee apres connexion -- MUST HAVE
- **US-202** : Consulter la documentation publique sans compte (vue Sophie) -- MUST HAVE
- **US-601** : Naviguer par domaine depuis la page d'accueil -- MUST HAVE
- **US-602** : Voir les documents recemment modifies sur l'accueil -- MUST HAVE

### Regles metier

- **RG-006** : La vue publique ne montre que les documents "public".
- Le hint "Essayez Ctrl+K" est affiche une seule fois par utilisateur.
- Les documents recents sont tries par date de derniere modification (recent en haut).
- Les guides populaires sont tries par nombre de consultations (plus consulte en premier).

### Interactions avec les autres features

- **Recherche** : la barre de recherche de la homepage ouvre la modale Ctrl+K.
- **Documents** : les documents recents et les compteurs par domaine proviennent de la base documentaire.
- **Signaux de fraicheur** : les badges sont affiches sur les cartes de documents recents.
- **Analytics** : le classement des guides populaires repose sur les compteurs de vues.
- **Authentification** : le niveau d'acces determine quelle homepage est affichee.
- **Domaines** : les blocs domaines avec compteurs sont affiches sur la homepage authentifiee.

### Etat d'implementation

**Partiel.** Le frontend dispose de `HomePage.tsx` (vue authentifiee), `PublicHomePage.tsx` (vue publique), `DomainPage.tsx` (page de domaine), et de vues placeholder pour les trois features : `DocumentsView.tsx`, `ApplicationsView.tsx`, `CartographieView.tsx`. Le composant `FreshnessBadge.tsx` et `TimeAgo.tsx` sont utilises pour l'affichage des cartes. Le dashboard agrege final (avec les trois onglets/vues) n'est pas encore designe -- le design actuel est un exemple visuel, pas la version finale.

---

## Annexe A -- Synthese des User Stories par feature

| Feature | User Stories | Total |
|---------|-------------|-------|
| Recherche | US-101, US-102, US-103, US-104, US-105, US-106, US-107 | 7 |
| Authentification & Acces | US-201, US-202, US-203, US-204, US-205, US-206 | 6 |
| Lecture & Consultation | US-301, US-302, US-303, US-304, US-305, US-306, US-307 | 7 |
| Editeur & Contribution | US-401 a US-414 | 14 |
| Signaux de Fraicheur | US-501, US-502 | 2 |
| Organisation du Contenu | US-601, US-602 | 2 |
| Import | US-701, US-702, US-703 | 3 |
| Administration & Templates | US-801, US-802, US-803, US-804, US-805 | 5 |
| Analytics | US-901, US-902, US-903 | 3 |
| **Total MVP** | | **49** |

---

## Annexe B -- Synthese des Regles Metier

| ID | Regle | Features impactees |
|----|-------|--------------------|
| RG-001 | Indexation temps reel (< 10s dans Meilisearch) | Documents, Recherche, Import |
| RG-002 | Performance de recherche (< 1,5s, debounce 200ms) | Recherche |
| RG-003 | Permissions 3 niveaux (Public / DSI / Admin) | Toutes |
| RG-004 | Calcul badge de fraicheur (seuils configurables) | Signaux de fraicheur, Administration |
| RG-005 | Authentification locale V1 (bcrypt, JWT) | Authentification, Administration |
| RG-006 | Filtrage automatique vue publique | Recherche, Homepage |
| RG-007 | Publication immediate (pas de brouillon) | Documents, Editeur |
| RG-008 | Templates subsidiaires (10 pre-configures) | Documents, Editeur, Administration |
| RG-009 | Pipeline d'import (Word, PDF, TXT via Pandoc) | Import |
| RG-010 | Logs analytics (PostgreSQL, anonymises en public) | Analytics |
| RG-011 | Types de document (10 par defaut + "Autre") | Documents, Recherche, Administration |

---

## Annexe C -- Etat d'implementation global

| Feature | Etat | Detail |
|---------|------|--------|
| Domaines | Implemente (partiel pour activation features) | CRUD OK, activation Documents/Applications/Cartographie en design |
| Documents | Implemente | CRUD complet, indexation Meilisearch, types, tags. Sous-dossiers non implemente |
| Applications | Partiel | Vue placeholder, pas d'objets structures dedies |
| Cartographie | Partiel | Vue placeholder, pas de modele graphe ni lib de visualisation |
| Recherche | Implemente | Modale Ctrl+K, Meilisearch, filtres, highlighting, navigation clavier |
| Editeur | Implemente | TipTap 3, toolbar, slash commands, code blocks, images, tableaux, alertes, liens internes, tags |
| Signaux de fraicheur | Implemente | Badge vert/jaune/rouge, verification 1 clic, seuils configurables |
| Authentification | Implemente | Login/logout, JWT, bcrypt, vue publique, changement MDP, RouteGuard |
| Import | Implemente | Pandoc Word->TipTap, PDF, TXT. Script CLI batch |
| Administration | Implemente | Templates, domaines, utilisateurs, config. Activation features par domaine non implemente |
| Analytics | Implemente | Compteur vues, logs recherche, logs consultation. Dashboard non implemente (SQL brut) |
| Homepage | Partiel | Vues auth et publique OK. Dashboard agrege en design |

---

## Annexe D -- Fonctionnalites hors scope MVP (Jalons 2 et 3)

| Fonctionnalite | Jalon | Justification de l'exclusion |
|----------------|-------|------------------------------|
| Graphe d'exploration / backlinks | V1.0 (Jalon 2) | Should Have latent, pas un Must. Consomme du temps sur Apache AGE |
| Dashboard de sante documentaire | V1.0 (Jalon 2) | Besoin latent, necessite du volume pour etre utile |
| Versionnement avec diff visuel | V1.0 (Jalon 2) | L'historique est dans PostgreSQL. Un diff visuel est du luxe |
| Notifications / emails | V1.0 (Jalon 2) | 50 personnes qui se voient quotidiennement |
| Commentaires inline | V1.0 (Jalon 2) | Feedback oral pour 50 personnes |
| Export PDF / impression | V1.0 (Jalon 2) | Nice to have |
| Import PPTX / XLS | V1.0 (Jalon 2) | Formats secondaires |
| API publique documentee | V1.0 (Jalon 2) | Endpoints REST pour integration avec d'autres outils |
| Workflow de validation | V1.0 (si demande) | Friction qui tue l'adoption |
| Collaboration temps reel (CRDT/Yjs) | V1.0 (si besoin prouve) | Over-engineering pour 50 personnes |
| Authentification LDAP/SSO | V2.0 | Remplacement auth locale par LDAP AD |
| Supertags / objets types | V2.0 (Jalon 3) | Complexite trop elevee, moonshot Tana-like |
| Vues dynamiques (Dataview-like) | V2.0 (Jalon 3) | Requetes sur les objets types |
| Module RAG / chatbot IA | V2.0 (Jalon 3) | "Cerveau DSI" comme couche d'augmentation |

---

_Document genere le 8 mars 2026 -- PlumeNote v1 -- Reference unique des features produit_
