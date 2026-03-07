━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 BACKLOG PRODUIT (MVP V1) — PlumeNote
État du Backlog : Prêt pour développement (post-Gate Review P4.3)
Basé sur : P2.3 (Scope Lock) · P3.4 (Concept & Flows) · P1.3 (Personas) · P2.1 (Vision)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## 1. Vue d'ensemble (Epics)

|Epic|Domaine fonctionnel|Flow P3.4 associé|Justification Scope P2.3|
|---|---|---|---|
|**EPIC-01**|Recherche & Navigation|Flow Principal "Didier en intervention"|IN SCOPE #1 — Pain point #1|
|**EPIC-02**|Authentification & Accès|Flow Onboarding + Flow Sophie|IN SCOPE #2 — Pain point #4|
|**EPIC-03**|Lecture & Consultation|Flow Principal (étapes F-G)|IN SCOPE #3 — Fraîcheur/Fiabilité|
|**EPIC-04**|Éditeur & Contribution|Flow Secondaire "Didier contribue"|IN SCOPE #4 — Coût de contribution|
|**EPIC-05**|Signaux de Fraîcheur|Transversal (Secret Sauce)|IN SCOPE #3 — Cercle vicieux|
|**EPIC-06**|Organisation du Contenu|Wireframes Vue 1 (Domaines)|IN SCOPE #5 — Point d'entrée unique|
|**EPIC-07**|Import du Patrimoine|Pré-requis transversal|IN SCOPE #6 — Migration existant|
|**EPIC-08**|Administration & Templates|Flow Contribution (templates)|IN SCOPE #4 — Validation sponsor|
|**EPIC-09**|Analytics & Mesure|Transversal (North Star)|P2.1 — KPIs mesurables dès J1|

---

## 2. Détail des User Stories (Par Epic)

---

### 📦 EPIC-01 : Recherche & Navigation

> _Le cœur du produit. Sans recherche performante, Didier reste sur le réseau informel._

---

#### US-101 : Ouvrir et fermer la modale de recherche (Ctrl+K)

**En tant que** Didier (technicien référent DSI) **Je veux** ouvrir une modale de recherche avec le raccourci Ctrl+K depuis n'importe quelle page, et la fermer avec Esc **Afin de** accéder à la recherche instantanément sans quitter mon contexte de travail

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Ouverture** :
    - **GIVEN** Didier est sur n'importe quelle page de PlumeNote (accueil, lecture, domaine)
    - **WHEN** il appuie sur `Ctrl+K`
    - **THEN** une modale de recherche s'ouvre au centre de l'écran avec un overlay semi-transparent, le curseur est en focus automatique dans le champ de saisie, et aucune autre interaction n'est possible en arrière-plan
- [ ] **Scénario — Fermeture par Esc** :
    - **GIVEN** la modale de recherche est ouverte
    - **WHEN** Didier appuie sur `Esc`
    - **THEN** la modale se ferme, le champ de saisie est vidé, et le focus revient à la page sous-jacente
- [ ] **Scénario — Fermeture par clic extérieur** :
    - **GIVEN** la modale de recherche est ouverte
    - **WHEN** Didier clique sur l'overlay (en dehors de la modale)
    - **THEN** la modale se ferme de la même manière
- [ ] **Scénario — Double appui** :
    - **GIVEN** la modale est déjà ouverte
    - **WHEN** Didier appuie à nouveau sur `Ctrl+K`
    - **THEN** le focus revient dans le champ de saisie (pas de double ouverture)

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 2 (Recherche), barre "[Ctrl+K Rechercher...]"

---

#### US-102 : Effectuer une recherche full-text instantanée (as-you-type)

**En tant que** Didier (technicien référent DSI) **Je veux** voir des résultats de recherche apparaître en temps réel dès que je tape mes mots-clés, sans appuyer sur Entrée **Afin de** trouver la bonne procédure le plus vite possible sans étape intermédiaire

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Déclenchement** :
    - **GIVEN** la modale de recherche est ouverte
    - **WHEN** Didier saisit le 2ème caractère de sa requête
    - **THEN** une requête est envoyée à Meilisearch et les résultats commencent à s'afficher
- [ ] **Scénario — Raffinement progressif** :
    - **GIVEN** Didier a saisi "con" et 15 résultats s'affichent
    - **WHEN** il continue à taper "config vpn"
    - **THEN** les résultats se réduisent progressivement aux documents pertinents, sans rechargement de page ni flash visuel
- [ ] **Scénario — Performance** :
    - **GIVEN** l'index contient 500 documents
    - **WHEN** Didier saisit n'importe quelle requête
    - **THEN** les résultats s'affichent en moins de 1,5 seconde, et le temps de réponse est visible ("3 résultats en 0.8s")
- [ ] **Scénario — Debounce** :
    - **GIVEN** Didier tape rapidement "config vpn proweb"
    - **WHEN** les caractères sont saisis à grande vitesse
    - **THEN** les requêtes sont debouncées (délai ~200ms après la dernière frappe) pour éviter de surcharger le serveur

⚙️ **Règles Métier Liées** : RG-001, RG-002 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 2, "3 résultats en 0.8s"

---

#### US-103 : Obtenir des résultats pertinents malgré les fautes de frappe

**En tant que** Didier (technicien référent DSI) **Je veux** que la recherche tolère mes fautes de frappe et me propose quand même les bons résultats **Afin de** ne pas avoir à me soucier de l'orthographe exacte quand je suis pressé sur un incident

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Typo simple** :
    - **GIVEN** un document "Configuration VPN ProWeb" existe
    - **WHEN** Didier saisit "configuraion vpn" (1 lettre manquante)
    - **THEN** le document apparaît dans les résultats
- [ ] **Scénario — Typo double** :
    - **GIVEN** un document "Configuration VPN ProWeb" existe
    - **WHEN** Didier saisit "confg proewb" (2 typos sur 2 mots)
    - **THEN** le document apparaît dans les résultats (tolérance Meilisearch)
- [ ] **Scénario — Mot totalement différent** :
    - **GIVEN** Didier saisit un mot sans aucun rapport avec les documents indexés
    - **WHEN** la recherche s'exécute
    - **THEN** aucun résultat parasite n'est affiché — la tolérance ne produit pas de faux positifs aberrants

⚙️ **Règles Métier Liées** : RG-002 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Flow Principal, étape D

---

#### US-104 : Afficher les métadonnées de confiance dans chaque résultat

**En tant que** Didier (technicien référent DSI) **Je veux** voir sur chaque résultat de recherche : le badge de fraîcheur, le domaine, l'auteur, le nombre de vues, et un extrait avec mots-clés surlignés **Afin de** juger en un coup d'œil si le résultat est pertinent et fiable avant de cliquer

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** une recherche retourne 3 résultats
    - **WHEN** les résultats s'affichent
    - **THEN** chaque carte de résultat montre : titre du document, badge de fraîcheur (🟢/🟡/🔴 + libellé "Vérifié il y a X jours/mois"), domaine (ex: "SCI"), nom de l'auteur (ex: "Didier Bottaz"), nombre de vues (ex: "★ 47 vues"), nombre de fichiers joints le cas échéant, et un extrait de 2-3 lignes avec les termes recherchés en **gras**
- [ ] **Scénario — Highlighting** :
    - **GIVEN** Didier cherche "config vpn"
    - **WHEN** les résultats s'affichent
    - **THEN** les mots "config" et "vpn" sont en gras dans l'extrait de chaque résultat (highlighting Meilisearch natif)

⚙️ **Règles Métier Liées** : RG-004 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 2, cartes de résultats

---

#### US-105 : Naviguer dans les résultats de recherche au clavier

**En tant que** Didier (technicien référent DSI) **Je veux** naviguer entre les résultats avec les flèches ↑↓ et ouvrir un résultat avec Entrée **Afin de** garder les mains sur le clavier et aller encore plus vite qu'avec la souris

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** les résultats affichent 3 documents
    - **WHEN** Didier appuie sur ↓ deux fois puis ↵ (Entrée)
    - **THEN** le 2ème résultat est sélectionné visuellement (highlight de fond), puis la page correspondante s'ouvre
- [ ] **Scénario — Boucle** :
    - **GIVEN** le dernier résultat est sélectionné
    - **WHEN** Didier appuie sur ↓
    - **THEN** la sélection revient au premier résultat
- [ ] **Scénario — Retour au champ de saisie** :
    - **GIVEN** le premier résultat est sélectionné
    - **WHEN** Didier appuie sur ↑
    - **THEN** le focus revient dans le champ de saisie

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 2, pied de page "↑↓ Naviguer · ↵ Ouvrir · Esc Fermer"

---

#### US-106 : Afficher un message contextuel quand aucun résultat n'est trouvé

**En tant que** Didier (technicien référent DSI) **Je veux** voir un message clair quand ma recherche ne retourne rien **Afin de** savoir que le contenu n'existe pas encore (et potentiellement le créer)

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Zéro résultat** :
    - **GIVEN** Didier saisit "procédure sauvegarde oracle" et aucun document ne correspond
    - **WHEN** la recherche s'exécute
    - **THEN** le message "Aucun résultat pour « procédure sauvegarde oracle ». Essayez avec d'autres mots-clés ou créez une page." s'affiche, accompagné d'un bouton "+ Créer cette page"
- [ ] **Scénario — Lien vers création** :
    - **GIVEN** le message "Aucun résultat" est affiché
    - **WHEN** Didier clique sur "+ Créer cette page"
    - **THEN** l'éditeur s'ouvre avec le titre pré-rempli "Procédure sauvegarde oracle"

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Implicite (pas dans le wireframe, mais nécessaire)

---

#### US-107 : Filtrer les résultats de recherche par domaine et par type

**En tant que** Didier (technicien référent DSI) **Je veux** filtrer les résultats de recherche par domaine (SCI, Infra, Support, Études) et par type de document (Procédure, Guide, FAQ, Architecture…) **Afin de** réduire le bruit quand je cherche une procédure spécifique à mon service ou d'un type particulier

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Filtre domaine** :
    - **GIVEN** une recherche "déploiement" affiche 12 résultats de 3 domaines
    - **WHEN** Didier sélectionne le filtre "INFRA"
    - **THEN** seuls les résultats INFRA s'affichent, le compteur indique "4 résultats (filtrés sur INFRA)"
- [ ] **Scénario — Filtre type** :
    - **GIVEN** une recherche "vpn" affiche 8 résultats de types variés
    - **WHEN** Didier sélectionne le filtre type "Procédure"
    - **THEN** seuls les documents de type "Procédure" s'affichent, le compteur est mis à jour
- [ ] **Scénario — Combinaison domaine + type** :
    - **GIVEN** Didier a filtré par domaine "SCI"
    - **WHEN** il ajoute le filtre type "FAQ"
    - **THEN** seuls les résultats SCI de type FAQ s'affichent, les deux filtres sont visibles et indépendamment désactivables
- [ ] **Scénario — Retour "Tous"** :
    - **GIVEN** le filtre domaine est sur "INFRA" et le filtre type sur "Procédure"
    - **WHEN** Didier sélectionne "Tous domaines" et "Tous types"
    - **THEN** tous les résultats réapparaissent
- [ ] **Scénario — Combinaison recherche + filtres** :
    - **GIVEN** Didier a saisi "vpn" et filtré sur "SCI" + "Procédure"
    - **WHEN** il change sa saisie en "vpn proweb"
    - **THEN** les résultats sont raffinés en gardant les deux filtres actifs

⚙️ **Règles Métier Liées** : RG-003, RG-011 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 2, "Filtres: [Tous ▾] [Tous domaines ▾]"

---

### 📦 EPIC-02 : Authentification & Accès

> _L'accès universel depuis n'importe quel poste. Auth locale en V1, LDAP SSO en V2._

---

#### US-201 : Se connecter avec un compte local (login/mot de passe)

**En tant que** Didier (technicien référent DSI) **Je veux** me connecter à PlumeNote avec un identifiant et un mot de passe créés par l'admin **Afin de** accéder à l'outil en attendant l'intégration LDAP/SSO

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier a un compte local (créé par Alexandre en admin)
    - **WHEN** il ouvre `plumenote.cpam92.local`, saisit son login et son mot de passe, et clique "Se connecter"
    - **THEN** la connexion s'effectue en moins de 2 secondes et il est redirigé vers la page d'accueil personnalisée
- [ ] **Scénario — Identifiants incorrects** :
    - **GIVEN** Didier est sur la page de connexion
    - **WHEN** il saisit un login ou mot de passe incorrect
    - **THEN** un message rouge "Identifiants invalides" s'affiche, sans préciser si c'est le login ou le mot de passe
- [ ] **Scénario — Session persistante** :
    - **GIVEN** Didier s'est connecté il y a 4 heures
    - **WHEN** il revient sur PlumeNote dans le même navigateur
    - **THEN** il est toujours connecté (session persistante avec token, durée de vie configurable par l'admin)

⚙️ **Règles Métier Liées** : RG-005 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Flow Onboarding, étape B (adapté auth locale)

---

#### US-202 : Consulter la documentation publique sans compte (Vue Sophie)

**En tant que** Sophie (collaboratrice MOA/DFC) **Je veux** accéder à la documentation applicative publique sans avoir besoin de me connecter **Afin de** trouver la réponse à ma question sans dépendre de la DSI

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Sophie ouvre `plumenote.cpam92.local` depuis son poste (sans session DSI)
    - **WHEN** la page se charge
    - **THEN** elle voit la page d'accueil publique avec : la barre de recherche, les guides populaires classés par nombre de consultations, et le message "Pas besoin de compte pour consulter" — sans aucune page de login
- [ ] **Scénario — Contenu filtré** :
    - **GIVEN** Sophie est sur la vue publique
    - **WHEN** elle effectue une recherche
    - **THEN** seuls les documents tagués "public" apparaissent. Les procédures internes DSI sont strictement invisibles — ni dans les résultats, ni dans les suggestions, ni dans la navigation par domaine.
- [ ] **Scénario — Tentative d'édition** :
    - **GIVEN** Sophie consulte un document public
    - **WHEN** elle regarde la page
    - **THEN** les boutons "Modifier", "Marquer comme vérifié" ne sont pas visibles. Le bouton "📩 Ouvrir un ticket support" est affiché en fallback.
- [ ] **Scénario — Guides populaires** :
    - **GIVEN** 4 documents publics existent avec des compteurs de vues différents
    - **WHEN** Sophie arrive sur la page d'accueil publique
    - **THEN** les documents sont affichés par ordre de popularité (plus consulté en premier) sous forme de cartes avec titre et compteur de consultations

⚙️ **Règles Métier Liées** : RG-003, RG-006 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 5 (Accueil Public), Flow Tertiaire

---

#### US-203 : Voir la page d'accueil personnalisée après connexion

**En tant que** Didier (technicien référent DSI) **Je veux** voir un tableau de bord avec mon domaine, les documents récents, et la barre de recherche proéminente **Afin de** savoir immédiatement ce qui a changé et pouvoir chercher en un geste

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier se connecte
    - **WHEN** la page d'accueil s'affiche
    - **THEN** il voit : un message de bienvenue "Bonjour Didier — X documents SCI · Y mis à jour cette semaine", une barre de recherche avec focus, la section "Activité récente" avec les 4-6 documents les plus récemment modifiés (badges de fraîcheur + compteurs de vues), et les domaines cliquables avec compteurs de documents
- [ ] **Scénario — Hint contextuel (première visite)** :
    - **GIVEN** c'est la toute première connexion de Didier
    - **WHEN** la page d'accueil s'affiche
    - **THEN** un hint discret "Essayez Ctrl+K pour rechercher" apparaît une seule fois (stocké en cookie/localStorage), sans bloquer la navigation

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 1 (Page d'Accueil / Dashboard)

---

#### US-204 : Accéder au CTA de fallback "Ouvrir un ticket support"

**En tant que** Sophie (collaboratrice MOA/DFC) **Je veux** pouvoir ouvrir un ticket support si la documentation ne répond pas à ma question **Afin de** ne pas rester bloquée si la doc ne couvre pas mon problème

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Sophie est sur la page d'accueil publique ou sur un document public
    - **WHEN** elle clique sur "📩 Ouvrir un ticket support"
    - **THEN** elle est redirigée vers l'URL du portail de tickets (GLPI) configurée par l'admin

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 5, "Vous ne trouvez pas ? [📩 Ouvrir un ticket support]"

---

#### US-205 : Se déconnecter

**En tant que** Didier (technicien référent DSI) **Je veux** me déconnecter de PlumeNote via le menu utilisateur **Afin de** protéger mon accès quand je quitte un poste partagé ou en intervention

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier est connecté et clique sur ses initiales "[D.B]" en haut à droite
    - **WHEN** il clique sur "Déconnexion"
    - **THEN** le token JWT est invalidé côté client (suppression du token stocké), Didier est redirigé vers la page de connexion, et toute tentative d'accès à une page protégée renvoie vers le login
- [ ] **Scénario — Expiration de session** :
    - **GIVEN** le token JWT de Didier a expiré (durée de vie configurable — RG-005)
    - **WHEN** il tente d'accéder à une page protégée ou effectue une action (sauvegarde, recherche authentifiée)
    - **THEN** il est redirigé vers la page de connexion avec un message "Session expirée — veuillez vous reconnecter"
- [ ] **Scénario — Accès public préservé après déconnexion** :
    - **GIVEN** Didier vient de se déconnecter
    - **WHEN** il navigue vers `plumenote.cpam92.local`
    - **THEN** il voit la vue publique (comme Sophie), pas une page d'erreur

⚙️ **Règles Métier Liées** : RG-005 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 1, menu "[D.B]" → "déconnexion"

---

#### US-206 : Changer son mot de passe

**En tant que** Didier (technicien référent DSI) **Je veux** pouvoir changer mon mot de passe depuis mon profil **Afin de** sécuriser mon compte sans dépendre de l'administrateur

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier est connecté et accède à son profil via le menu "[D.B]"
    - **WHEN** il saisit son mot de passe actuel, un nouveau mot de passe (≥8 caractères) et sa confirmation, puis valide
    - **THEN** le mot de passe est mis à jour (hashé bcrypt), un feedback "Mot de passe modifié ✓" s'affiche, et la session reste active
- [ ] **Scénario — Mot de passe actuel incorrect** :
    - **GIVEN** Didier est sur le formulaire de changement de mot de passe
    - **WHEN** il saisit un mot de passe actuel erroné
    - **THEN** un message rouge "Mot de passe actuel incorrect" s'affiche et le changement est refusé
- [ ] **Scénario — Confirmation ne correspond pas** :
    - **GIVEN** Didier saisit un nouveau mot de passe et une confirmation différente
    - **WHEN** il tente de valider
    - **THEN** un message rouge "Les mots de passe ne correspondent pas" s'affiche et le changement est refusé
- [ ] **Scénario — Mot de passe trop court** :
    - **GIVEN** Didier saisit un nouveau mot de passe de 5 caractères
    - **WHEN** il tente de valider
    - **THEN** un message "Le mot de passe doit contenir au moins 8 caractères" s'affiche et le changement est refusé

⚙️ **Règles Métier Liées** : RG-005 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 1, menu "[D.B]" → "profil"

---

### 📦 EPIC-03 : Lecture & Consultation

> _Le moment de vérité : Didier ouvre la procédure et décide en 5 secondes s'il peut lui faire confiance._

---

#### US-301 : Lire un document avec sommaire latéral auto-généré

**En tant que** Didier (technicien référent DSI) **Je veux** voir un sommaire latéral généré automatiquement à partir des titres de section **Afin de** naviguer rapidement dans un long document sans scroller 10 pages

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier ouvre un document contenant 4 sections H2
    - **WHEN** la page s'affiche
    - **THEN** un sommaire latéral à gauche liste les 4 titres de section
- [ ] **Scénario — Navigation** :
    - **GIVEN** le sommaire affiche 4 sections
    - **WHEN** Didier clique sur la 3ème entrée
    - **THEN** la page scrolle jusqu'à la section correspondante, et l'entrée du sommaire est visuellement marquée comme active
- [ ] **Scénario — Scroll synchronisé** :
    - **GIVEN** Didier scrolle manuellement dans le document
    - **WHEN** il passe d'une section à l'autre
    - **THEN** l'entrée active du sommaire se met à jour automatiquement
- [ ] **Scénario — Document court** :
    - **GIVEN** un document ne contient aucun titre H2
    - **WHEN** la page s'affiche
    - **THEN** le sommaire latéral n'est pas affiché (pas de panneau vide)

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 3, panneau "SOMMAIRE"

---

#### US-302 : Copier un bloc de code en un clic (sans caractères parasites)

**En tant que** Didier (technicien référent DSI) **Je veux** copier le contenu d'un bloc de code en cliquant sur le bouton [📋] et obtenir un texte brut propre **Afin de** coller la commande directement dans mon terminal sans nettoyage

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** la procédure contient un bloc `bash` avec `ping -c 4 srv-proweb.cpam92.local`
    - **WHEN** Didier clique sur le bouton [📋]
    - **THEN** le texte exact `ping -c 4 srv-proweb.cpam92.local` est copié dans le presse-papier, sans `\r\n` parasites, sans retour à la ligne Windows, sans formatage Word caché
- [ ] **Scénario — Feedback visuel** :
    - **GIVEN** Didier clique sur [📋]
    - **WHEN** la copie est effectuée
    - **THEN** le bouton change temporairement en "✓ Copié" pendant 2 secondes, puis revient à [📋]
- [ ] **Scénario — Bloc multi-lignes** :
    - **GIVEN** un bloc de code contient 5 lignes de commandes
    - **WHEN** Didier clique sur [📋]
    - **THEN** les 5 lignes sont copiées avec des `\n` Unix propres (pas de `\r\n`)

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 3, boutons [📋]

---

#### US-303 : Voir la coloration syntaxique des blocs de code

**En tant que** Didier (technicien référent DSI) **Je veux** que les blocs de code affichent une coloration syntaxique adaptée au langage (bash, PowerShell, SQL...) **Afin de** lire les commandes plus facilement grâce au formatage visuel

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** un document contient un bloc de code avec le langage `bash` spécifié
    - **WHEN** la page s'affiche
    - **THEN** le bloc est rendu avec coloration syntaxique bash, sur un fond distinct (gris clair ou foncé), en police monospace
- [ ] **Scénario — Langages supportés** :
    - **GIVEN** les langages bash, powershell, sql, python, json, xml sont utilisés
    - **WHEN** les blocs s'affichent
    - **THEN** chaque langage a sa coloration spécifique
- [ ] **Scénario — Pas de langage spécifié** :
    - **GIVEN** un bloc de code ne spécifie aucun langage
    - **WHEN** il s'affiche
    - **THEN** il est rendu en texte brut monospace sans coloration, sur fond distinct

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 3, blocs de code

---

#### US-304 : Voir les métadonnées de confiance en en-tête d'un document

**En tant que** Didier (technicien référent DSI) **Je veux** voir clairement en haut de chaque document : badge de fraîcheur, auteur du dernier contrôle, domaine, nombre de vues, et date de dernière modification **Afin de** décider en un coup d'œil si je peux faire confiance à ce que je lis

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Document frais** :
    - **GIVEN** Didier ouvre "Configuration VPN ProWeb", vérifié il y a 12 jours par D. Bottaz
    - **WHEN** la page s'affiche
    - **THEN** sous le titre, il voit : 🟢 "Vérifié par D. Bottaz · 12 mars 2026" | "SCI" | "★ 47 vues" | "📝 Dernière modif: 1 mars"
- [ ] **Scénario — Document obsolète** :
    - **GIVEN** un document n'a pas été vérifié depuis 8 mois
    - **WHEN** Didier l'ouvre
    - **THEN** le badge affiche 🔴 "Pas revu depuis 8 mois" accompagné de la mention "⚠️ Revue nécessaire"

⚙️ **Règles Métier Liées** : RG-004 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 3, en-tête du document

---

#### US-305 : Naviguer via le fil d'Ariane (Breadcrumb)

**En tant que** Didier (technicien référent DSI) **Je veux** voir un fil d'Ariane en haut de page indiquant le chemin (ex: SCI > VPN > Configuration) **Afin de** comprendre où je suis et remonter facilement dans la hiérarchie

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier est sur le document "Configuration VPN ProWeb" du domaine SCI
    - **WHEN** il regarde l'en-tête
    - **THEN** un breadcrumb "SCI > Configuration VPN ProWeb" est affiché, chaque segment est cliquable
- [ ] **Scénario — Clic sur le domaine** :
    - **GIVEN** le breadcrumb affiche "SCI > Configuration VPN ProWeb"
    - **WHEN** Didier clique sur "SCI"
    - **THEN** il est redirigé vers la liste des documents du domaine SCI

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 3, barre "SCI > VPN > Configuration"

---

#### US-306 : Cliquer sur un lien interne entre documents PlumeNote

**En tant que** Didier (technicien référent DSI) **Je veux** cliquer sur un lien interne (ex: "[Installation VPN →]") pour naviguer vers l'autre document **Afin de** suivre les connexions entre procédures sans repasser par la recherche

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** un document contient un lien interne vers une autre page PlumeNote
    - **WHEN** Didier clique sur le lien
    - **THEN** la page cible s'ouvre, le breadcrumb se met à jour, et le bouton retour navigateur fonctionne
- [ ] **Scénario — Lien cassé** :
    - **GIVEN** un lien interne pointe vers un document qui a été supprimé
    - **WHEN** Didier clique sur le lien
    - **THEN** un message "Ce document n'existe plus ou a été déplacé" s'affiche, sans erreur serveur

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 3, "Voir: [Installation VPN →]"

---

#### US-307 : Prévisualiser un document avant publication

**En tant que** Didier (technicien référent DSI) **Je veux** voir le rendu final de mon document avant de le publier **Afin de** vérifier la mise en forme (blocs de code, tableaux, images)

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier est dans l'éditeur avec du contenu rédigé
    - **WHEN** il clique sur [👁 Prévisualiser]
    - **THEN** le rendu final s'affiche exactement comme en mode lecture (sommaire, coloration syntaxique, badges)

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 4, bouton [👁 Prévisualiser]

---

### 📦 EPIC-04 : Éditeur & Contribution

> _P1.4 Pattern #1 : "Le KM meurt par le coût de contribution." <5 minutes pour une procédure simple._

---

#### US-401 : Créer une nouvelle page vierge

**En tant que** Didier (technicien référent DSI) **Je veux** créer une nouvelle page en quelques clics (bouton "+ Nouvelle page" ou commande "/new" dans Ctrl+K) **Afin de** formaliser une procédure immédiatement après avoir résolu un incident

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Via le bouton** :
    - **GIVEN** Didier est connecté sur n'importe quelle page
    - **WHEN** il clique sur "+ Nouvelle page"
    - **THEN** l'éditeur s'ouvre avec : le curseur en focus sur le champ titre, le domaine de Didier pré-sélectionné, le type "Procédure technique" pré-sélectionné (modifiable via dropdown — RG-011), une page vierge, et un hint "Tapez / pour insérer un bloc, ou choisissez un template"
- [ ] **Scénario — Via Ctrl+K /new** :
    - **GIVEN** la modale de recherche est ouverte
    - **WHEN** Didier tape "/new"
    - **THEN** l'option "Créer une nouvelle page" apparaît en suggestion, un clic l'amène à l'éditeur vierge
- [ ] **Scénario — Choix du domaine** :
    - **GIVEN** l'éditeur est ouvert pour une nouvelle page
    - **WHEN** Didier change le domaine via le menu déroulant
    - **THEN** le domaine sélectionné est associé à la page

⚙️ **Règles Métier Liées** : RG-003, RG-007, RG-011 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 4, Flow Secondaire étapes B-C

---

#### US-402 : Créer une page à partir d'un template

**En tant que** Didier (technicien référent DSI) **Je veux** choisir un template à la création d'une page pour bénéficier d'une structure pré-remplie **Afin de** gagner du temps avec un squelette adapté au type de document

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier crée une nouvelle page et 10 templates sont configurés
    - **WHEN** il voit le bandeau de suggestion
    - **THEN** les 4-5 templates les plus utilisés sont affichés en raccourci + un lien "[+ Voir tous les templates]" pour les autres. Un clic injecte la structure du template avec des placeholders.
- [ ] **Scénario — Modification libre** :
    - **GIVEN** le template "Procédure" est injecté avec 4 sections pré-remplies
    - **WHEN** Didier supprime ou réorganise des sections
    - **THEN** les modifications sont acceptées — le template est un accélérateur, jamais une contrainte
- [ ] **Scénario — Page vierge malgré les templates** :
    - **GIVEN** des templates sont disponibles
    - **WHEN** Didier ignore le bandeau et commence à écrire
    - **THEN** la page reste vierge, le bandeau disparaît au premier caractère saisi

⚙️ **Règles Métier Liées** : RG-008 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 4, bandeau templates

---

#### US-403 : Formater du texte avec la barre d'outils WYSIWYG

**En tant que** Didier (technicien référent DSI) **Je veux** mettre en forme mon texte via une barre d'outils visuelle (gras, italique, titres, listes) **Afin de** structurer ma procédure sans connaître la syntaxe Markdown

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Gras** :
    - **GIVEN** Didier est dans l'éditeur et sélectionne un mot
    - **WHEN** il clique sur [B]
    - **THEN** le mot passe en gras. Un deuxième clic sur [B] retire le gras.
- [ ] **Scénario — Titres** :
    - **GIVEN** le curseur est sur une ligne de texte
    - **WHEN** Didier clique sur [H1] ou [H2]
    - **THEN** la ligne se transforme en titre de niveau correspondant
- [ ] **Scénario — Listes** :
    - **GIVEN** Didier a sélectionné 3 lignes de texte
    - **WHEN** il clique sur [•] (liste à puces) ou [1.] (liste numérotée)
    - **THEN** les 3 lignes deviennent une liste ordonnée ou non ordonnée
- [ ] **Scénario — Barre d'outils complète** :
    - **GIVEN** Didier est dans l'éditeur
    - **WHEN** il regarde la barre d'outils
    - **THEN** les options suivantes sont disponibles : B, I, H1, H2, liste à puces, liste numérotée, bloc code, pièce jointe, lien, bloc alerte

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 4, "[B] [I] [H1] [H2] [•] [1.] [</>] [📎] [🔗] [💡] [...]"

---

#### US-404 : Rédiger en Markdown natif avec auto-conversion

**En tant que** Mohamed (technicien Infra, habitué des .txt et du Markdown) **Je veux** taper du Markdown brut dans l'éditeur et voir la conversion automatique en texte formaté **Afin de** écrire à ma manière sans être obligé d'utiliser la souris

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Titre H2** :
    - **GIVEN** Mohamed est dans l'éditeur sur une ligne vide
    - **WHEN** il tape `## Ma section` puis Entrée
    - **THEN** le texte se transforme automatiquement en titre H2 formaté visuellement
- [ ] **Scénario — Liste** :
    - **GIVEN** Mohamed tape `- premier point` puis Entrée
    - **WHEN** il appuie sur Entrée
    - **THEN** une nouvelle puce est automatiquement créée pour la ligne suivante
- [ ] **Scénario — Gras / Italique** :
    - **GIVEN** Mohamed tape `**important**`
    - **WHEN** la conversion est appliquée
    - **THEN** le mot "important" s'affiche en gras, les `**` disparaissent
- [ ] **Scénario — Bloc de code inline** :
    - **GIVEN** Mohamed tape `` `commande` ``
    - **WHEN** la conversion est appliquée
    - **THEN** le mot "commande" s'affiche en police monospace sur fond distinct

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 4, "Markdown natif pour les habitués"

---

#### US-405 : Insérer un bloc de code avec coloration syntaxique dans l'éditeur

**En tant que** Didier (technicien référent DSI) **Je veux** insérer un bloc de code en spécifiant le langage pour obtenir la coloration syntaxique **Afin de** documenter des commandes techniques lisibles et copiables proprement

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Via Markdown** :
    - **GIVEN** Didier est dans l'éditeur
    - **WHEN** il tape ` ``` ` suivi de `bash`
    - **THEN** un bloc de code bash s'ouvre avec coloration syntaxique, prêt pour la saisie
- [ ] **Scénario — Via commande slash** :
    - **GIVEN** Didier tape `/` sur une ligne vide
    - **WHEN** il sélectionne "Bloc de code" dans le menu
    - **THEN** un bloc de code est inséré avec un sélecteur de langage
- [ ] **Scénario — Sélecteur de langage** :
    - **GIVEN** un bloc de code est inséré
    - **WHEN** Didier choisit "PowerShell" dans le sélecteur
    - **THEN** la coloration syntaxique bascule en PowerShell

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 4, insertion de blocs

---

#### US-406 : Utiliser le menu commande slash (/) pour insérer des blocs

**En tant que** Didier (technicien référent DSI) **Je veux** taper "/" sur une ligne vide pour ouvrir un menu contextuel d'insertion de blocs **Afin de** insérer rapidement des éléments structurés sans quitter le clavier

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier est dans l'éditeur sur une ligne vide
    - **WHEN** il tape "/"
    - **THEN** un menu déroulant s'affiche avec les options : Bloc de code, Image, Tableau, Alerte/Astuce, Lien interne, Séparateur
- [ ] **Scénario — Filtrage** :
    - **GIVEN** le menu slash est ouvert
    - **WHEN** Didier tape "/code"
    - **THEN** seule l'option "Bloc de code" est visible (filtrage par saisie)
- [ ] **Scénario — Fermeture** :
    - **GIVEN** le menu slash est ouvert
    - **WHEN** Didier appuie sur Esc
    - **THEN** le menu se ferme et le "/" est supprimé de la ligne

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 4, "/ pour insérer un bloc"

---

#### US-407 : Insérer et afficher des images dans un document

**En tant que** Didier (technicien référent DSI) **Je veux** insérer des captures d'écran dans ma procédure par upload ou drag & drop **Afin de** illustrer les étapes visuellement (menus, fenêtres, messages d'erreur)

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Upload via barre d'outils** :
    - **GIVEN** Didier est dans l'éditeur
    - **WHEN** il clique sur [📎] et sélectionne une image PNG
    - **THEN** l'image est uploadée, stockée côté serveur, et affichée inline dans le document
- [ ] **Scénario — Drag & Drop** :
    - **GIVEN** Didier a une capture d'écran sur son bureau
    - **WHEN** il la glisse-dépose dans la zone d'édition
    - **THEN** l'image est uploadée et insérée à la position du curseur
- [ ] **Scénario — Formats acceptés** :
    - **GIVEN** Didier tente d'insérer une image
    - **WHEN** le fichier est un PNG, JPG, GIF ou WebP de moins de 10 Mo
    - **THEN** l'upload est accepté. Au-delà de 10 Mo, un message "Fichier trop volumineux (max 10 Mo)" s'affiche.

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 3, "Étapes numérotées avec captures d'écran"

---

#### US-408 : Insérer un bloc d'alerte / astuce

**En tant que** Didier (technicien référent DSI) **Je veux** insérer des blocs visuels de type "Astuce", "Attention", "Info" **Afin de** mettre en évidence les informations critiques dans mes procédures

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier tape "/" et sélectionne "Alerte/Astuce"
    - **WHEN** il choisit le type "💡 Astuce"
    - **THEN** un bloc visuellement distinct (fond coloré, icône 💡) est inséré, prêt pour la saisie
- [ ] **Scénario — Types disponibles** :
    - **GIVEN** Didier insère un bloc alerte
    - **WHEN** il regarde les options
    - **THEN** 3 types sont disponibles : 💡 Astuce (bleu), ⚠️ Attention (orange), 🔴 Danger (rouge)

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 3, bloc "💡 Astuce"

---

#### US-409 : Insérer un tableau dans l'éditeur

**En tant que** Didier (technicien référent DSI) **Je veux** insérer et éditer un tableau directement dans l'éditeur **Afin de** documenter des paramètres de configuration, des comparaisons, ou des matrices

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier tape "/" et sélectionne "Tableau"
    - **WHEN** il choisit 3 colonnes × 2 lignes
    - **THEN** un tableau vide s'insère avec les cellules éditables, navigation par Tab entre les cellules
- [ ] **Scénario — Ajout de ligne/colonne** :
    - **GIVEN** un tableau de 3×2 est inséré
    - **WHEN** Didier fait un clic droit sur le tableau
    - **THEN** les options "Ajouter une ligne", "Ajouter une colonne", "Supprimer la ligne", "Supprimer la colonne" sont disponibles

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 4, menu commande slash

---

#### US-410 : Insérer un lien interne vers un autre document PlumeNote

**En tant que** Didier (technicien référent DSI) **Je veux** créer un lien vers une autre page PlumeNote en tapant son nom avec auto-complétion **Afin de** relier les procédures entre elles et faciliter la navigation

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier est dans l'éditeur
    - **WHEN** il tape `[[` ou utilise le bouton [🔗] puis commence à taper un titre de document
    - **THEN** une liste déroulante auto-complétée affiche les documents correspondants. Un clic insère un lien cliquable vers la page sélectionnée.
- [ ] **Scénario — Document inexistant** :
    - **GIVEN** Didier tape `[[Procédure backup Oracle]]` et ce document n'existe pas
    - **WHEN** il valide
    - **THEN** le lien est créé en rouge/italique, signalant un document manquant (préfigure la création à la demande)

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 3, "[Installation VPN →]"

---

#### US-411 : Ajouter des tags à un document avec auto-complétion

**En tant que** Didier (technicien référent DSI) **Je veux** ajouter des tags à mon document avec des suggestions automatiques **Afin de** catégoriser mon document sans effort et faciliter sa découverte

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Auto-complétion** :
    - **GIVEN** les tags "VPN", "ProWeb", "réseau" existent dans le système
    - **WHEN** Didier tape "VP" dans le champ tags
    - **THEN** la suggestion "VPN" apparaît, un clic ou Entrée l'ajoute
- [ ] **Scénario — Nouveau tag** :
    - **GIVEN** Didier tape un tag qui n'existe pas
    - **WHEN** il appuie sur Entrée
    - **THEN** le nouveau tag est créé et associé au document
- [ ] **Scénario — Suppression** :
    - **GIVEN** le document a 3 tags
    - **WHEN** Didier clique sur le [×] d'un tag
    - **THEN** le tag est retiré du document (pas supprimé du système global)

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 4, "Tags : [+ ajouter un tag ▾]"

---

#### US-412 : Sauvegarder et publier un document (Ctrl+S)

**En tant que** Didier (technicien référent DSI) **Je veux** sauvegarder avec Ctrl+S et que le document soit immédiatement publié et trouvable **Afin de** rendre ma procédure disponible sans workflow de validation

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier a rédigé une procédure
    - **WHEN** il appuie sur `Ctrl+S` ou clique sur [💾 Publier]
    - **THEN** le document est sauvegardé, indexé dans Meilisearch dans les 5 secondes, le badge 🟢 "Créé aujourd'hui" s'affiche, un feedback "Sauvegardé ✓" apparaît pendant 2 secondes
- [ ] **Scénario — Trouvable immédiatement** :
    - **GIVEN** Didier vient de sauvegarder un document sur "Backup Oracle"
    - **WHEN** un collègue cherche "backup oracle" dans les 10 secondes suivantes
    - **THEN** le document apparaît dans les résultats
- [ ] **Scénario — Pas de brouillon** :
    - **GIVEN** Didier sauvegarde
    - **WHEN** il quitte l'éditeur
    - **THEN** le document est visible par tous les utilisateurs ayant les droits — pas d'état brouillon

⚙️ **Règles Métier Liées** : RG-001, RG-007 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Flow Secondaire étape E

---

#### US-413 : Modifier un document existant

**En tant que** Didier (technicien référent DSI) **Je veux** cliquer sur "Modifier" pour basculer en mode édition sur un document existant **Afin de** corriger ou mettre à jour une procédure sans recréer un document

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier consulte un document de son domaine (SCI, droits d'écriture)
    - **WHEN** il clique sur [✏️ Modifier]
    - **THEN** la vue lecture bascule vers l'éditeur TipTap avec le contenu chargé
- [ ] **Scénario — Pas de droits** :
    - **GIVEN** Didier consulte un document du domaine INFRA (droits lecture seule)
    - **WHEN** il regarde les boutons
    - **THEN** le bouton [✏️ Modifier] n'est pas visible
- [ ] **Scénario — Annulation** :
    - **GIVEN** Didier a modifié du contenu en mode édition
    - **WHEN** il clique sur [✖ Annuler]
    - **THEN** les modifications sont abandonnées, le document revient à sa dernière version sauvegardée

⚙️ **Règles Métier Liées** : RG-003 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 3, bouton [✏️ Modifier]

---

#### US-414 : Supprimer un document

**En tant que** Didier (technicien référent DSI) **Je veux** pouvoir supprimer un document de mon domaine **Afin de** retirer une procédure obsolète, erronée ou publiée par erreur

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier consulte un document de son domaine (SCI, droits d'écriture)
    - **WHEN** il clique sur [🗑 Supprimer] puis confirme dans la modale de confirmation "Êtes-vous sûr ? Cette action est irréversible."
    - **THEN** le document est supprimé de PostgreSQL, retiré de l'index Meilisearch dans les 10 secondes (RG-001), et Didier est redirigé vers la liste du domaine
- [ ] **Scénario — Confirmation obligatoire** :
    - **GIVEN** Didier clique sur [🗑 Supprimer]
    - **WHEN** la modale de confirmation s'affiche
    - **THEN** le titre du document est affiché dans la modale, et deux boutons sont disponibles : "Annuler" (focus par défaut) et "Supprimer définitivement" (rouge)
- [ ] **Scénario — Pas de droits** :
    - **GIVEN** Didier consulte un document du domaine INFRA (lecture seule)
    - **WHEN** il regarde les boutons
    - **THEN** le bouton [🗑 Supprimer] n'est pas visible
- [ ] **Scénario — Impact sur les liens internes** :
    - **GIVEN** 2 autres documents contiennent des liens internes vers le document supprimé
    - **WHEN** le document est supprimé
    - **THEN** les liens dans les autres documents deviennent des liens cassés (comportement US-306 scénario "Lien cassé" : message "Ce document n'existe plus ou a été déplacé")
- [ ] **Scénario — Impact sur les logs** :
    - **GIVEN** le document supprimé avait des entrées dans SEARCH_LOG et VIEW_LOG
    - **WHEN** le document est supprimé
    - **THEN** les logs historiques sont conservés (pas de suppression en cascade) — les analytics restent exploitables
- [ ] **Scénario — Admin peut supprimer tout document** :
    - **GIVEN** Alexandre (admin) consulte un document de n'importe quel domaine
    - **WHEN** il regarde les boutons
    - **THEN** le bouton [🗑 Supprimer] est visible (les admins ont tous les droits — RG-003)

⚙️ **Règles Métier Liées** : RG-001, RG-003 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 3 (bouton à ajouter au wireframe)

---

### 📦 EPIC-05 : Signaux de Fraîcheur

> _La Secret Sauce de PlumeNote — le seul différenciateur que personne n'a (P3.2)._

---

#### US-501 : Afficher le badge de fraîcheur sur chaque document

**En tant que** Didier (technicien référent DSI) **Je veux** voir un badge visuel coloré (🟢/🟡/🔴) sur chaque document, partout où il apparaît **Afin de** savoir instantanément si je peux faire confiance à ce que je lis

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Document frais** :
    - **GIVEN** un document a été vérifié il y a 12 jours et le seuil vert est configuré à <1 mois
    - **WHEN** il s'affiche (résultat de recherche, page d'accueil, ou en lecture)
    - **THEN** le badge affiche 🟢 "Vérifié il y a 12 jours"
- [ ] **Scénario — Document vieillissant** :
    - **GIVEN** un document a été vérifié il y a 3 mois et le seuil jaune est configuré à 1-6 mois
    - **WHEN** il s'affiche
    - **THEN** le badge affiche 🟡 "Vérifié il y a 3 mois"
- [ ] **Scénario — Document obsolète** :
    - **GIVEN** un document n'a pas été vérifié depuis 8 mois et le seuil rouge est >6 mois
    - **WHEN** il s'affiche
    - **THEN** le badge affiche 🔴 "Pas revu depuis 8 mois" + "⚠️ Revue nécessaire"
- [ ] **Scénario — Document jamais vérifié** :
    - **GIVEN** un document importé n'a jamais été vérifié explicitement
    - **WHEN** il s'affiche
    - **THEN** la date de dernière modification est utilisée comme proxy pour le calcul
- [ ] **Scénario — Seuils configurés** :
    - **GIVEN** l'admin a configuré les seuils à 🟢 <2 mois, 🟡 2-9 mois, 🔴 >9 mois
    - **WHEN** un document vérifié il y a 7 mois s'affiche
    - **THEN** le badge est 🟡 (pas 🔴) conformément aux seuils personnalisés

⚙️ **Règles Métier Liées** : RG-004 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Toutes les vues (transversal)

---

#### US-502 : Marquer un document comme vérifié en 1 clic

**En tant que** Didier (technicien référent DSI) **Je veux** cliquer sur "Marquer comme vérifié" après relecture d'une procédure **Afin de** réinitialiser le badge en 1 seconde et signaler aux collègues que c'est à jour

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier consulte un document 🟡 "Vérifié il y a 3 mois"
    - **WHEN** il clique sur [🔄 Marquer comme vérifié]
    - **THEN** le badge passe à 🟢 "Vérifié aujourd'hui par D. Bottaz", la date est mise à jour en base, feedback "Marqué comme vérifié ✓" pendant 2 secondes
- [ ] **Scénario — Droits insuffisants** :
    - **GIVEN** Sophie (vue publique) ou un utilisateur DSI sans droits d'écriture sur ce domaine consulte un document
    - **WHEN** il regarde les boutons
    - **THEN** le bouton [🔄 Marquer comme vérifié] n'est pas visible
- [ ] **Scénario — Historique des vérifications** :
    - **GIVEN** un document a été vérifié 4 fois par 2 personnes
    - **WHEN** on consulte les métadonnées détaillées
    - **THEN** l'historique est visible : date + auteur pour chaque vérification

⚙️ **Règles Métier Liées** : RG-004, RG-003 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 3, bouton [🔄 Marquer comme vérifié]

---

### 📦 EPIC-06 : Organisation du Contenu

> _5 services × 5 logiques → 1 point d'entrée unique structuré par domaines._

---

#### US-601 : Naviguer par domaine depuis la page d'accueil

**En tant que** Didier (technicien référent DSI) **Je veux** cliquer sur un domaine depuis la page d'accueil pour voir ses documents **Afin de** explorer la documentation de mon service ou d'un autre

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** la page d'accueil affiche les domaines avec compteurs (ex: "■ SCI: 47")
    - **WHEN** Didier clique sur "SCI"
    - **THEN** la liste de tous les documents SCI s'affiche, triés par dernière modification (récent en haut), avec badges de fraîcheur et compteurs de vues
- [ ] **Scénario — Domaine vide** :
    - **GIVEN** le domaine "Support Parc" n'a aucun document
    - **WHEN** Didier clique dessus
    - **THEN** message "Aucun document dans ce domaine. Soyez le premier à contribuer !" + bouton "+ Nouvelle page"

⚙️ **Règles Métier Liées** : RG-003 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 1, "📁 DOMAINES"

---

#### US-602 : Voir les documents récemment modifiés sur l'accueil

**En tant que** Didier (technicien référent DSI) **Je veux** voir les 4-6 documents les plus récemment modifiés sur la page d'accueil **Afin de** savoir ce qui a changé sans chercher

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** 5 documents ont été modifiés cette semaine
    - **WHEN** Didier est sur la page d'accueil, section "Activité récente"
    - **THEN** les documents sont affichés en cartes : titre, badge de fraîcheur, domaine, date relative ("Modifié 2j"), compteur de vues

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 1, "📊 ACTIVITÉ RÉCENTE"

---

### 📦 EPIC-07 : Import du Patrimoine

> _Sans migration, l'outil démarre vide et n'a aucune valeur (P2.3, IN SCOPE #6)._

---

#### US-701 : Importer des documents Word (.doc/.docx) en lot

**En tant que** Alexandre (responsable DSI) **Je veux** importer en masse des documents Word avec conversion automatique **Afin de** démarrer avec le patrimoine existant au lieu d'un outil vide

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Alexandre lance le script d'import batch sur un dossier de 50 fichiers .docx
    - **WHEN** le pipeline Pandoc s'exécute
    - **THEN** chaque fichier est converti en page PlumeNote (TipTap), les titres/listes/tableaux préservés, les images extraites et incluses, chaque page indexée dans Meilisearch
- [ ] **Scénario — Rapport d'import** :
    - **GIVEN** l'import est terminé
    - **WHEN** Alexandre consulte le rapport
    - **THEN** il voit : fichiers importés avec succès, fichiers en échec avec nom + raison, total de pages créées
- [ ] **Scénario — Fichier corrompu** :
    - **GIVEN** un .doc est corrompu dans le lot
    - **WHEN** le pipeline tente la conversion
    - **THEN** le fichier est ignoré, l'erreur logguée, et les autres fichiers continuent normalement
- [ ] **Scénario — Attribution domaine** :
    - **GIVEN** Alexandre importe depuis un sous-dossier nommé "SCI"
    - **WHEN** le pipeline traite les fichiers
    - **THEN** les pages créées sont automatiquement rattachées au domaine "SCI" (convention de nommage des dossiers)

⚙️ **Règles Métier Liées** : RG-009 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Architecture Système, Pipeline Pandoc

---

#### US-702 : Importer des fichiers PDF (extraction texte)

**En tant que** Alexandre (responsable DSI) **Je veux** importer des PDF en extrayant leur contenu textuel **Afin de** rendre cherchables les procédures nationales du Support

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — PDF textuel** :
    - **GIVEN** Alexandre importe un PDF de 10 pages avec du texte sélectionnable
    - **WHEN** le pipeline traite le fichier
    - **THEN** le texte est extrait, converti en page PlumeNote, la structure préservée au mieux, le contenu indexé dans Meilisearch
- [ ] **Scénario — PDF image (scan)** :
    - **GIVEN** un PDF ne contient que des images scannées
    - **WHEN** le pipeline tente l'extraction
    - **THEN** avertissement loggé "PDF image — extraction limitée", page créée avec placeholder "Contenu scanné — transcription manuelle recommandée"

⚙️ **Règles Métier Liées** : RG-009 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Architecture Système, Pipeline Pandoc

---

#### US-703 : Importer des fichiers TXT bruts

**En tant que** Alexandre (responsable DSI) **Je veux** importer les fichiers .txt du serveur Infra **Afin de** unifier la documentation Infra avec le reste de la base

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Alexandre importe un fichier .txt de 200 lignes
    - **WHEN** le pipeline le traite
    - **THEN** le contenu est interprété comme Markdown (titres # détectés si présents), indexé dans Meilisearch, nom de fichier = titre de la page

⚙️ **Règles Métier Liées** : RG-009 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Architecture Système, Pipeline Pandoc

---

### 📦 EPIC-08 : Administration & Templates

> _Console admin : domaines, templates, utilisateurs, seuils de fraîcheur, URL de tickets._

---

#### US-801 : Gérer les templates de documents (CRUD Admin)

**En tant que** Alexandre (admin) **Je veux** créer, modifier et supprimer des templates depuis le backoffice **Afin de** proposer des structures adaptées aux besoins de chaque service

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Création** :
    - **GIVEN** Alexandre est dans le backoffice, section Templates
    - **WHEN** il crée un template "Procédure" avec des sections et placeholders dans l'éditeur TipTap
    - **THEN** le template est sauvegardé et proposé aux utilisateurs lors de la création d'une page
- [ ] **Scénario — Modification** :
    - **GIVEN** le template "Procédure" existe
    - **WHEN** Alexandre ajoute une section "Prérequis"
    - **THEN** les nouvelles pages créées à partir de ce template incluent cette section. Les pages existantes ne sont pas impactées.
- [ ] **Scénario — Suppression** :
    - **GIVEN** le template "Architecture" a été utilisé par 5 documents
    - **WHEN** Alexandre le supprime
    - **THEN** le template n'est plus proposé. Les documents existants ne sont pas impactés.
- [ ] **Scénario — 10 templates pré-configurés** :
    - **GIVEN** PlumeNote est installé pour la première fois
    - **WHEN** Alexandre accède à la section Templates
    - **THEN** 10 templates par défaut sont disponibles (cf. RG-008)

⚙️ **Règles Métier Liées** : RG-008 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Section 5, "Module Admin Templates"

---

#### US-802 : Gérer les domaines (CRUD Admin)

**En tant que** Alexandre (admin) **Je veux** créer, renommer et archiver des domaines **Afin de** structurer la base selon l'organisation de la DSI

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Création** :
    - **GIVEN** Alexandre est dans le backoffice, section Domaines
    - **WHEN** il crée "Support Parc"
    - **THEN** le domaine apparaît dans les filtres de recherche, le sélecteur de l'éditeur, et la page d'accueil
- [ ] **Scénario — Suppression protégée** :
    - **GIVEN** "SCI" contient 47 documents
    - **WHEN** Alexandre tente de le supprimer
    - **THEN** avertissement "Ce domaine contient 47 documents. Voulez-vous les migrer vers un autre domaine ou archiver ?"

⚙️ **Règles Métier Liées** : RG-003 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 1, "📁 DOMAINES"

---

#### US-803 : Configurer les seuils de fraîcheur dans la console admin

**En tant que** Alexandre (admin) **Je veux** configurer les seuils temporels des badges (🟢/🟡/🔴) depuis la console d'administration **Afin de** adapter les durées à la réalité de nos documents

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Modification des seuils globaux** :
    - **GIVEN** Alexandre est dans le backoffice, section Paramètres > Fraîcheur
    - **WHEN** il modifie les seuils à 🟢 <2 mois, 🟡 2-9 mois, 🔴 >9 mois et sauvegarde
    - **THEN** tous les badges de l'application sont recalculés immédiatement avec les nouveaux seuils
- [ ] **Scénario — Valeurs par défaut** :
    - **GIVEN** PlumeNote est installé pour la première fois
    - **WHEN** Alexandre consulte les paramètres de fraîcheur
    - **THEN** les seuils par défaut sont : 🟢 <1 mois, 🟡 1-6 mois, 🔴 >6 mois
- [ ] **Scénario — Validation des saisies** :
    - **GIVEN** Alexandre saisit un seuil 🟡 inférieur au seuil 🟢
    - **WHEN** il tente de sauvegarder
    - **THEN** un message d'erreur "Le seuil orange doit être supérieur au seuil vert" s'affiche et la sauvegarde est bloquée

⚙️ **Règles Métier Liées** : RG-004 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Points restants #1

---

#### US-804 : Gérer les utilisateurs et leurs rôles

**En tant que** Alexandre (admin) **Je veux** créer des comptes locaux, attribuer un rôle (DSI/Admin) et un domaine principal **Afin de** contrôler qui peut modifier quoi dans PlumeNote

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Création de compte** :
    - **GIVEN** Alexandre est dans le backoffice, section Utilisateurs
    - **WHEN** il crée un compte pour "Didier Bottaz" avec login, mot de passe temporaire, rôle "DSI", domaine "SCI"
    - **THEN** Didier peut se connecter et a accès en lecture à tout + écriture sur SCI
- [ ] **Scénario — Liste des utilisateurs** :
    - **GIVEN** 20 comptes existent
    - **WHEN** Alexandre consulte la liste
    - **THEN** il voit : nom, login, rôle, domaine principal, date de dernière connexion
- [ ] **Scénario — Changement de rôle** :
    - **GIVEN** Didier a le rôle "DSI"
    - **WHEN** Alexandre lui attribue "Admin"
    - **THEN** Didier accède au backoffice dès sa prochaine connexion
- [ ] **Scénario — Réinitialisation mot de passe** :
    - **GIVEN** un utilisateur a oublié son mot de passe
    - **WHEN** Alexandre clique sur "Réinitialiser le mot de passe"
    - **THEN** un nouveau mot de passe temporaire est généré et affiché une seule fois

⚙️ **Règles Métier Liées** : RG-003, RG-005 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Permissions 3 niveaux

---

#### US-805 : Configurer l'URL du portail de tickets (GLPI)

**En tant que** Alexandre (admin) **Je veux** configurer l'URL de redirection du bouton "Ouvrir un ticket support" depuis la console admin **Afin de** que Sophie soit redirigée vers le bon portail si l'URL change

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Alexandre est dans le backoffice, section Paramètres
    - **WHEN** il saisit l'URL `https://glpi.cpam92.local/front/ticket.form.php` et sauvegarde
    - **THEN** le bouton "📩 Ouvrir un ticket support" de la vue publique redirige vers cette URL

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 5, CTA de fallback

---

### 📦 EPIC-09 : Analytics & Mesure

> _La North Star Metric (Search-to-View Rate) doit être mesurable dès le jour 1._

---

#### US-901 : Afficher le compteur de vues sur chaque document

**En tant que** Didier (technicien référent DSI) **Je veux** voir le nombre de consultations de chaque document **Afin de** savoir que mes contributions sont utiles (reconnaissance silencieuse)

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** "Configuration VPN ProWeb" a été consulté 47 fois ce mois
    - **WHEN** il s'affiche (recherche, accueil, ou lecture)
    - **THEN** le compteur "★ 47 vues" est visible
- [ ] **Scénario — Comptage** :
    - **GIVEN** le document affiche 47 vues
    - **WHEN** Didier ouvre le document
    - **THEN** le compteur passe à 48

⚙️ **Règles Métier Liées** : — 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Vue 1, Vue 2, Vue 3

---

#### US-902 : Enregistrer les logs de recherche

**En tant que** Alexandre (admin) **Je veux** que chaque recherche soit logguée (termes, nb résultats, clic ou non) **Afin de** mesurer la North Star Metric et identifier les recherches infructueuses

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario — Recherche avec clic** :
    - **GIVEN** Didier cherche "config vpn proweb" et clique sur le 1er résultat
    - **WHEN** la recherche est effectuée
    - **THEN** un log contient : terme, timestamp, nb résultats, ID du résultat cliqué, identifiant utilisateur
- [ ] **Scénario — Recherche sans clic** :
    - **GIVEN** Sophie cherche "bordereau SUCRE" en vue publique et ne clique sur rien
    - **WHEN** elle ferme la recherche
    - **THEN** le log enregistre la recherche avec "aucun clic" (signal de contenu manquant)

⚙️ **Règles Métier Liées** : RG-010 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Analytics intégrés

---

#### US-903 : Enregistrer les logs de consultation

**En tant que** Alexandre (admin) **Je veux** que chaque consultation de document soit logguée (page, durée, utilisateur) **Afin de** identifier les documents populaires et ceux jamais consultés

✅ **Critères d'Acceptance (BDD)** :

- [ ] **Scénario Nominal** :
    - **GIVEN** Didier ouvre "Configuration VPN ProWeb" et y reste 45 secondes
    - **WHEN** il quitte la page
    - **THEN** un log contient : ID document, timestamp d'ouverture, durée approximative, identifiant utilisateur

⚙️ **Règles Métier Liées** : RG-010 🔥 **Priorité** : MUST HAVE 🔗 **Lien Maquette** : P3.4 — Analytics intégrés

---

## 3. Référentiel des Règles Métier (Business Rules)

|ID|Règle|Description Logique|Stories Impactées|
|---|---|---|---|
|**RG-001**|Indexation temps réel|Tout document sauvegardé doit être indexé dans Meilisearch dans un délai max de 10 secondes. L'index couvre : titre, corps, tags, métadonnées (auteur, domaine).|US-102, US-412|
|**RG-002**|Performance de recherche|Temps de réponse search (saisie → affichage résultats) < 1,5 seconde pour un index de 500 documents. Au-delà de 3 secondes, le produit a échoué (P1.4). Debounce de 200ms pour les requêtes as-you-type.|US-102, US-103|
|**RG-003**|Modèle de permissions 3 niveaux|**Public** : lecture seule sur les documents "public" (pas d'auth requise). **DSI** : lecture sur tous les docs, écriture sur les docs de son domaine uniquement. **Admin** : tous les droits + backoffice. Un utilisateur DSI ne peut modifier QUE les documents de son domaine principal.|US-107, US-202, US-401, US-413, US-502, US-601, US-802, US-804|
|**RG-004**|Calcul du badge de fraîcheur|Basé sur la date de dernière vérification (ou date de dernière modification si jamais vérifié). **Seuils par défaut** : 🟢 <1 mois, 🟡 1-6 mois, 🔴 >6 mois. **Les seuils sont configurables dans la console admin** (US-803). Le calcul est purement temporel. Pas de logique RH ni lien avec l'auteur.|US-104, US-304, US-501, US-502, US-803|
|**RG-005**|Authentification locale (V1)|En V1, les comptes sont créés manuellement par l'admin dans le backoffice. Login + mot de passe hashé en base (bcrypt). Sessions persistantes avec token JWT (durée configurable). **V2 : migration vers LDAP/SSO.**|US-201, US-804|
|**RG-006**|Filtrage automatique vue publique|La vue publique filtre automatiquement sur les documents de visibilité "public". Les documents "DSI" et "Admin" sont strictement invisibles — ni recherche, ni suggestions, ni navigation.|US-202|
|**RG-007**|Publication immédiate|Pas d'état "brouillon". Tout document sauvegardé est immédiatement publié et visible par les utilisateurs ayant les droits d'accès. Pas de workflow de validation ni d'approbation.|US-401, US-412|
|**RG-008**|Templates subsidiaires|Les templates sont proposés, jamais imposés. Page vierge par défaut. Un template = un document TipTap avec sections et placeholders. L'utilisateur peut tout modifier après application. **10 templates pré-configurés au 1er lancement** : 1) Procédure technique, 2) Guide utilisateur, 3) Architecture système, 4) FAQ, 5) Résolution d'incident / Troubleshooting, 6) Fiche applicative, 7) Procédure d'installation, 8) Note de version / Changelog, 9) Guide de dépannage réseau, 10) Documentation d'API / Service.|US-402, US-801|
|**RG-009**|Pipeline d'import|3 formats : Word (.doc/.docx via Pandoc), PDF (extraction texte), TXT (interprété Markdown). Import = script batch CLI. Nom du fichier = titre par défaut. Images embarquées extraites et stockées. Fichiers en erreur n'interrompent pas le lot. Convention de nommage des dossiers pour attribution automatique de domaine.|US-701, US-702, US-703|
|**RG-010**|Logs analytics|Logs stockés dans PostgreSQL. Pas de dashboard visible au MVP (requêtables SQL par l'admin). Logs vue publique anonymisés (pas d'identifiant utilisateur).|US-902, US-903|
|**RG-011**|Types de document|Chaque document a un type obligatoire parmi une liste configurable par l'admin. **Types par défaut au 1er lancement** : Procédure technique, Guide utilisateur, Architecture système, FAQ, Troubleshooting, Fiche applicative, Procédure d'installation, Note de version, Guide réseau, Documentation d'API. Aligné sur les 10 templates (RG-008). Le type est filtrable dans la recherche (Meilisearch `filterableAttributes`). Le type est affiché sur les cartes de résultat (US-104) et dans les métadonnées (US-304). Un type "Autre" existe pour les documents qui ne rentrent dans aucune catégorie. L'admin peut ajouter/modifier les types dans le backoffice.|US-107, US-104, US-304, US-401|

---

## 4. Matrice de Priorisation (MoSCoW)

### 🔴 MUST HAVE (V1) — Tout le backlog est MUST sauf LDAP SSO

|US|Titre|Epic|
|---|---|---|
|US-101|Modale de recherche Ctrl+K|EPIC-01|
|US-102|Recherche full-text as-you-type|EPIC-01|
|US-103|Tolérance fautes de frappe|EPIC-01|
|US-104|Métadonnées dans résultats|EPIC-01|
|US-105|Navigation clavier résultats|EPIC-01|
|US-106|Message "aucun résultat"|EPIC-01|
|US-107|Filtres par domaine/type|EPIC-01|
|US-201|Connexion compte local|EPIC-02|
|US-202|Accès public sans login|EPIC-02|
|US-203|Page d'accueil personnalisée|EPIC-02|
|US-204|CTA fallback tickets|EPIC-02|
|US-205|Déconnexion|EPIC-02|
|US-206|Changement de mot de passe|EPIC-02|
|US-301|Sommaire latéral auto-généré|EPIC-03|
|US-302|Copier bloc de code (1 clic)|EPIC-03|
|US-303|Coloration syntaxique|EPIC-03|
|US-304|Métadonnées de confiance|EPIC-03|
|US-305|Breadcrumb|EPIC-03|
|US-306|Liens internes|EPIC-03|
|US-307|Prévisualisation|EPIC-03|
|US-401|Créer page vierge|EPIC-04|
|US-402|Créer page depuis template|EPIC-04|
|US-403|Barre d'outils WYSIWYG|EPIC-04|
|US-404|Markdown natif auto-conversion|EPIC-04|
|US-405|Blocs de code dans l'éditeur|EPIC-04|
|US-406|Menu commande slash (/)|EPIC-04|
|US-407|Insertion images|EPIC-04|
|US-408|Blocs alerte/astuce|EPIC-04|
|US-409|Insertion tableaux|EPIC-04|
|US-410|Liens internes (éditeur)|EPIC-04|
|US-411|Tags auto-complétion|EPIC-04|
|US-412|Sauvegarder/publier (Ctrl+S)|EPIC-04|
|US-413|Modifier document existant|EPIC-04|
|US-414|Supprimer un document|EPIC-04|
|US-501|Badge de fraîcheur|EPIC-05|
|US-502|Marquer comme vérifié|EPIC-05|
|US-601|Navigation par domaine|EPIC-06|
|US-602|Documents récents (accueil)|EPIC-06|
|US-701|Import Word|EPIC-07|
|US-702|Import PDF|EPIC-07|
|US-703|Import TXT|EPIC-07|
|US-801|Admin Templates (CRUD)|EPIC-08|
|US-802|Admin Domaines (CRUD)|EPIC-08|
|US-803|Admin Seuils de fraîcheur|EPIC-08|
|US-804|Admin Utilisateurs & Rôles|EPIC-08|
|US-805|Admin URL tickets (GLPI)|EPIC-08|
|US-901|Compteur de vues|EPIC-09|
|US-902|Logs de recherche|EPIC-09|
|US-903|Logs de consultation|EPIC-09|

**Total V1 : 48 stories MUST HAVE**

---

### 🟡 V2 — Intégration LDAP SSO

|Fonctionnalité|Description|
|---|---|
|**Authentification LDAP/SSO**|Remplacement de l'auth locale par une intégration LDAP Active Directory. SSO transparent si l'utilisateur est déjà connecté au domaine Windows. Synchronisation automatique des comptes.|

---

### ⚪ WON'T HAVE — Explicitement exclu (P2.3)

|Fonctionnalité|Raison|Jalon cible|
|---|---|---|
|Graphe d'exploration / backlinks|Should Have latent, Jalon 2|V1.0 (Jalon 2)|
|Supertags / objets typés|Jalon 3, complexité trop élevée|V2.0 (Jalon 3)|
|Collaboration temps réel (CRDT)|Over-engineering pour 50 pers.|V1.0 (si besoin prouvé)|
|Dashboard de santé documentaire|Besoin latent, nécessite du volume|V1.0|
|Workflow de validation|Friction qui tue l'adoption|V1.0 (si demandé)|
|Notifications / emails|50 pers. qui se voient quotidiennement|V1.0|
|Export PDF / impression|Nice to have|V1.0|
|Commentaires sur les documents|Feedback oral pour 50 pers.|V1.0|
|Versionnement avec diff visuel|Historique en PostgreSQL, diff = luxe|V1.0|
|Import PPTX / XLS|Formats secondaires|V1.0|
|Module RAG / chatbot IA|Moonshot, Jalon 3|V2.0|

---

## 5. Templates Pré-Configurés (Détail — RG-008)

Les 10 templates livrés au premier lancement de PlumeNote :

### T-01 : Procédure Technique

> _Le template le plus utilisé — pour toute opération à réaliser étape par étape._

**Structure :**

```
# [Titre de la procédure]

## Objectif
[Décrivez en 1-2 phrases ce que cette procédure permet d'accomplir]

## Prérequis
- [Accès requis]
- [Outils nécessaires]
- [Conditions préalables]

## Étapes
### 1. [Première étape]
[Description détaillée]

### 2. [Deuxième étape]
[Description détaillée]

### 3. [Troisième étape]
[Description détaillée]

## Vérification
[Comment vérifier que la procédure a été exécutée correctement]

## En cas de problème
[Que faire si ça ne fonctionne pas — lien vers troubleshooting]
```

---

### T-02 : Guide Utilisateur

> _Documentation applicative destinée aux utilisateurs finaux (MOA/DFC)._

**Structure :**

```
# [Nom de l'application] — Guide utilisateur

## Présentation
[À quoi sert cette application, qui l'utilise]

## Accès
[URL, identifiants, prérequis de connexion]

## Fonctionnalités principales
### [Fonctionnalité 1]
[Description + captures d'écran]

### [Fonctionnalité 2]
[Description + captures d'écran]

## Questions fréquentes
- [Question 1] → [Réponse]
- [Question 2] → [Réponse]

## En cas de problème
[Lien vers le support / ouverture de ticket]
```

---

### T-03 : Architecture Système

> _Description technique d'un composant d'infrastructure._

**Structure :**

```
# [Nom du système / serveur / service]

## Vue d'ensemble
[Rôle, criticité, environnement (prod/preprod/dev)]

## Caractéristiques techniques
| Paramètre | Valeur |
|-----------|--------|
| Hostname  | [...]  |
| OS        | [...]  |
| RAM / CPU | [...]  |
| Stockage  | [...]  |
| Réseau    | [...]  |

## Dépendances
- Héberge : [applications]
- Dépend de : [services amont]
- Utilisé par : [équipes / services]

## Accès & habilitations
[Qui a accès, comment, avec quels droits]

## Procédures liées
- [Lien vers procédure de redémarrage]
- [Lien vers procédure de backup]
```

---

### T-04 : FAQ

> _Réponses aux questions les plus fréquentes sur un sujet._

**Structure :**

```
# FAQ — [Sujet]

## [Question 1 ?]
[Réponse concise]

## [Question 2 ?]
[Réponse concise]

## [Question 3 ?]
[Réponse concise]

---
Vous ne trouvez pas la réponse ? [Ouvrir un ticket support]
```

---

### T-05 : Résolution d'Incident / Troubleshooting

> _Guide de diagnostic et résolution pour un problème récurrent._

**Structure :**

```
# Troubleshooting — [Nom du problème]

## Symptômes
[Ce que l'utilisateur observe — messages d'erreur, comportement anormal]

## Diagnostic
### Étape 1 : Vérifier [...]
[Commande ou action de vérification]

### Étape 2 : Vérifier [...]
[Commande ou action de vérification]

## Solutions
### Si [condition A]
[Action corrective]

### Si [condition B]
[Action corrective]

## Escalade
[Si non résolu → qui contacter, quel ticket ouvrir]
```

---

### T-06 : Fiche Applicative

> _Carte d'identité d'une application métier._

**Structure :**

```
# [Nom de l'application]

## Informations générales
| Champ | Valeur |
|-------|--------|
| Éditeur | [...] |
| Version | [...] |
| Environnement | [Prod / Preprod] |
| URL d'accès | [...] |
| Responsable DSI | [...] |

## Description fonctionnelle
[À quoi sert l'application, qui l'utilise, quel processus métier]

## Architecture technique
[Serveur(s), base de données, flux réseau]

## Procédures liées
- [Installation]
- [Mise à jour]
- [Sauvegarde / Restauration]

## Contacts
[Éditeur, support N2, référent interne]
```

---

### T-07 : Procédure d'Installation

> _Guide d'installation d'un logiciel ou service._

**Structure :**

```
# Installation — [Nom du logiciel/service]

## Prérequis
- [OS compatible]
- [Espace disque requis]
- [Dépendances à installer]

## Téléchargement
[URL ou chemin réseau du package d'installation]

## Étapes d'installation
### 1. [Étape]
[Commandes ou actions]

### 2. [Étape]
[Commandes ou actions]

## Configuration post-installation
[Paramètres à ajuster, fichiers de config]

## Vérification
[Comment confirmer que l'installation est fonctionnelle]

## Désinstallation
[Procédure de retour arrière si nécessaire]
```

---

### T-08 : Note de Version / Changelog

> _Historique des évolutions d'une application ou d'un service._

**Structure :**

```
# Notes de version — [Nom de l'application]

## Version X.Y.Z — [Date]

### Nouveautés
- [Fonctionnalité ajoutée]

### Corrections
- [Bug corrigé]

### Changements techniques
- [Migration, mise à jour de dépendance]

### Impact utilisateur
[Ce que les utilisateurs doivent savoir / faire]

---

## Version X.Y.Z-1 — [Date précédente]
[...]
```

---

### T-09 : Guide de Dépannage Réseau

> _Procédure de diagnostic pour les problèmes réseau récurrents._

**Structure :**

````
# Dépannage réseau — [Type de problème]

## Contexte
[Quel segment réseau, quel service impacté]

## Diagnostic rapide
### 1. Vérifier la connectivité
```bash
ping -c 4 [adresse]
````

### 2. Vérifier la résolution DNS

```bash
nslookup [nom_hôte]
```

### 3. Vérifier les ports

```bash
telnet [adresse] [port]
```

## Causes fréquentes

|Symptôme|Cause probable|Action|
|---|---|---|
|[Timeout]|[Firewall]|[Vérifier règle X]|
|[DNS fail]|[Serveur DNS]|[Relancer service]|

## Escalade

[Si non résolu → équipe Infra, ticket P2]

```

---

### T-10 : Documentation d'API / Service
> *Description technique d'un endpoint ou service interne.*

**Structure :**
```

# API / Service — [Nom]

## Description

[Ce que fait le service, dans quel contexte il est appelé]

## Endpoints

### GET /[endpoint]

- **Description** : [...]
- **Paramètres** : [...]
- **Réponse** : [...]

### POST /[endpoint]

- **Description** : [...]
- **Body** : [...]
- **Réponse** : [...]

## Authentification

[Token, API Key, certificat]

## Exemples

```bash
curl -X GET https://[...] -H "Authorization: Bearer [...]"
```

## Erreurs courantes

|Code|Signification|Action|
|---|---|---|
|401|Non autorisé|Vérifier le token|
|500|Erreur serveur|Consulter les logs|

```

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_Livrable : P4.1-Backlog.md — Projet PlumeNote — Version 3.0 (post-Gate Review P4.3) — Mars 2026_
_Modifications v3.0 : +US-205 (Déconnexion), +US-206 (Changement MDP), +US-414 (Suppression document), US-107 corrigée (filtre type), +RG-011 (Types de document). Total : 48 US._
_Prochaine étape : P4.2 — Spécifications Techniques (mise à jour modèle de données)_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```