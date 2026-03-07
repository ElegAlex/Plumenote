# Projet de structuration documentaire DSI - Réunion de lancement

## 📋 Informations

- **Date :** 26/01/2026
- **Participants :**
	- Alexandre Berge (Animateur)
	- Didier Bottaz
	- Christophe Redjil
	- Lilian Hammache
	- Mathieu Messe
	- Mohamed Diagana
	- Mohamed Zemouche
	- Kevin Brisson
	- Carine Raffin
	- Fella Ishak
- **Périmètre :** Structuration et mutualisation des outils de gestion documentaire technique de la DSI

---

## 🎯 Synthèse

La DSI dispose de ressources documentaires éparses (procédures Word, cartographies Excel, liens, macros) réparties dans des arborescences difficilement exploitables. Trois initiatives de structuration existent déjà : un outil Excel/VBA développé par le SCI pour centraliser l'accès aux procédures et ressources métier, une solution web BookStack en cours de déploiement par le service Études et Développement pour la documentation utilisateur, et une réflexion personnelle de l'Alexandre Berge sur un outil de documentation.

L'objectif est de converger vers un outil unique couvrant l'ensemble des besoins DSI : accès simplifié et ergonomique à la documentation technique, fonction de recherche transversale, gestion des permissions, capacité d'import automatisé de formats variés (Word, PDF, Excel), et accessibilité depuis n'importe quel poste sans authentification admin. La possibilité d'exposer certains contenus aux clients internes (DFC) sans création de compte constitue une exigence spécifique du service Études et Développement. L'accessibilité élargie répond également à un enjeu de continuité d'activité (situation de crise type pandémie).

Une analyse consolidée des besoins et des contraintes techniques sera produite pour arbitrer entre une solution unique (BookStack étendu) ou une approche hybride intégrant les fonctionnalités spécifiques de chaque initiative existante. Le projet s'inscrit dans une durée de plusieurs mois.

---

## 📍 Sujets Traités

### 1. État des lieux - Outil du SCI (Excel/VBA)

#### Contexte et situation actuelle
Le service SCI a développé un fichier Excel avec macros VBA et userforms permettant de centraliser l'accès à l'ensemble des ressources documentaires du service : procédures, fichiers Excel de travail quotidien, liens vers sites web métier, macros outils.

#### Fonctionnalités de l'outil
- Sélection d'une application métier (ex: ProWeb) via boutons → affichage des documents associés
- Ajout dynamique de catégories et de ressources documentaires
- Fonction de recherche par mots-clés dans les descriptions indexées
- Liens vers fichiers locaux ou URLs externes
- Copie automatique optionnelle des documents vers un répertoire structuré par application

#### Constats et problématiques
- L'outil répond au besoin de contournement des limites de la recherche Windows dans les arborescences
- Limitation identifiée : incompatibilité avec les anciens formats .doc (images non chargées, erreur mémoire) - résolu en enregistrant en .docx
- Format Excel = dépendance au réseau, problèmes d'accès concurrents
- L'outil constitue un POC fonctionnel démontrant l'adhésion au concept, mais pas une cible long terme

#### Points d'attention
- L'indexation repose sur les descriptions saisies manuellement lors de l'ajout de documents
- La maintenance des liens vers sources externes (Ameli Réseau) nécessite une mise à jour manuelle si les URLs changent

---

### 2. État des lieux - Solution BookStack (Études et Développement)

#### Contexte et situation actuelle
Le service Études et Développement travaille sur BookStack, solution Open Source de documentation web, initialement pour rendre accessible la documentation utilisateur (SUCRE) qui souffrait d'un déficit d'utilisation par la MOA sous format Word.

#### Fonctionnalités de l'outil
- Organisation hiérarchique : Domaines → Manuels → Pages
- Double barre de recherche : locale (manuel courant) et globale (toute la documentation visible par l'utilisateur)
- Recherche full-text : titres, descriptions, contenus, métadonnées
- Gestion des permissions par profils : lecture, édition, création, par domaine et par manuel
- Système de versionnement : brouillons, historique, restauration de versions antérieures
- Éditeur intégré type WYSIWYG/Markdown avec Draw.io intégré
- Solution self-hosted : aucune donnée ne sort de l'infrastructure locale
- API complète permettant l'automatisation

#### Script d'import automatisé
- Développement Python utilisant Pandoc pour import massif de documents Word
- Import par lot depuis un répertoire : création automatique des pages selon la structure du sommaire Word
- Prérequis : documents Word structurés avec sommaire dynamique (titres de chapitres formatés)
- Adaptable pour d'autres formats (PDF) moyennant développement
- **Automatisation confirmée** : possibilité de planifier l'import via tâche de fond Python (exécution périodique sans intervention manuelle)

#### Constats et problématiques
- Destiné initialement aux clients internes (accès sans compte pour consultation)
- Permet d'éviter les documents Word lourds en fractionnant par sujet
- L'import automatisé nécessite des documents source correctement structurés (sommaire dynamique)
- Fork/customisation profonde déconseillée pour rester compatible avec les mises à jour

---

### 3. Initiative personnelle - Réflexion outil documentaire

#### Contexte
Alexandre Berge a également engagé une réflexion personnelle et commencé à travailler sur un outil de documentation, préalablement à la découverte des initiatives SCI et Études/Développement.

#### Implication
- Trois initiatives parallèles existaient avant cette réunion de coordination
- L'objectif de la réunion est précisément d'éviter la dispersion d'énergie sur des développements en silos
- Les travaux personnels seront intégrés à l'analyse consolidée

---

### 4. Besoins Infrastructure et Support

#### Contexte et situation actuelle
L'équipe Infrastructure utilise des fichiers texte bruts (.txt, bloc-notes) pour les procédures techniques (commandes d'installation). Ce choix délibéré évite les problèmes de caractères parasites (tirets longs, méta-caractères) lors du copier-coller de commandes. La documentation est stockée sur un serveur dédié et organisée par type (Linux, Windows...).

L'équipe dispose également de nombreux PDF fournis par le national, livrés dans des packages compressés à chaque objet de diffusion.

#### Constats et problématiques
- L'organisation actuelle fonctionne pour les équipes habituées, mais manque d'intuitivité pour les nouveaux arrivants ou les recherches transversales
- La documentation nationale arrive sous forme de packages compressés → difficulté d'alimentation automatique d'un outil centralisé
- Présence de scripts de déploiement contenant des credentials → nécessité de segmentation fine des accès
- Besoin identifié : accès depuis un poste utilisateur lambda (sans compte admin) lors des interventions support
- Question ouverte : automatisation possible de l'import à chaque nouvelle version nationale ?

#### Exigences fonctionnelles identifiées
- Import facilité de PDF
- Modification rapide des documents (versions fréquentes)
- Lien vers documentation externe plutôt que copie locale (évite l'obsolescence)
- Moteur de recherche performant pour identifier rapidement la bonne ressource

---

### 5. Besoins Support Parc (Gestion de Parc)

#### Contexte et situation actuelle
L'équipe Gestion de Parc travaille principalement sur la base de connaissances empiriques sans procédures formalisées. Les outils de travail reposent essentiellement sur des tableaux Excel multiples.

#### Constats et problématiques
- Absence de documentation procédurale formalisée
- Connaissance tacite non explicite = risque de perte en cas de turnover
- Multiplicité de fichiers Excel non centralisés
- Intégration des formats Excel dans un outil de documentation = contrainte technique identifiée

#### Orientations
- Travail de formalisation des procédures à planifier (non prioritaire à court terme)
- Les tableaux Excel de gestion de parc pourront faire l'objet d'une réflexion séparée, potentiellement hors scope de l'outil documentaire principal

---

### 6. Exigences fonctionnelles transversales identifiées

#### Accessibilité et ergonomie
- Interface web privilégiée (accessible depuis n'importe quel poste, pas de dépendance réseau fichier)
- Accès possible depuis session utilisateur standard
- Documentation publique consultable sans compte pour les clients internes DSI (DFC notamment)
- Ergonomie et attractivité visuelle = facteurs d'adhésion utilisateur
- **Continuité d'activité** : accessibilité élargie permettant le dépannage en situation de crise (ex: pandémie)

#### Fonctionnalités de recherche
- Recherche transversale sur l'ensemble de la documentation DSI
- Recherche dans les contenus, titres, descriptions, métadonnées
- Dépassement des limites de la recherche Windows dans les arborescences

#### Gestion des contenus
- Support multi-formats : Word, PDF, Excel (liens), TXT, URLs externes
- Import automatisé/massif souhaité, avec possibilité de planification périodique
- Gestion des liens vers ressources externes (Ameli Réseau, documentation nationale)
- Facilité d'alimentation et de mise à jour = condition sine qua non d'adoption
- Versionnement et historique des modifications

#### Gestion des droits
- Au sein de la DSI : pas de segmentation nécessaire sauf données sensibles (credentials, scripts avec secrets)
- Droits de lecture ouverts, droits de modification restreints aux propriétaires du domaine
- Exclusion des credentials et secrets des contenus accessibles

#### Couverture fonctionnelle élargie
- Cartographie applicative
- Cartographie serveurs
- Architecture technique globale
- Vision consolidée des éléments interconnectés (serveurs ↔ applicatifs ↔ hébergement)

---

### 7. Orientations stratégiques et arbitrages

#### Décisions actées
- **Objectif cible** : un outil unique pour l'ensemble de la DSI, évitant la multiplication des solutions par service
- **Approche** : consolidation des trois initiatives existantes plutôt que développement from scratch
- **Réalisme** : acceptation que des contraintes techniques puissent imposer le maintien de solutions complémentaires

#### Pistes d'architecture envisagées
1. **Option BookStack étendu** : vérifier si BookStack peut couvrir l'ensemble des besoins (liens, import multi-formats, accès sans compte, accès sur autre poste que celui de l'utilisateur)
2. **Option hybride** : BookStack pour documentation structurée + outil type SCI pour accès rapide aux ressources techniques et liens
3. **Option développement web dédié** : web app reprenant les features de l'outil SCI (recherche indexée, liens) sans les contraintes Excel

#### Contraintes identifiées
- Fork profond de BookStack = charge de maintenance prohibitive (éviter de devenir mainteneur d'une branche dédiée)
- Formats Excel difficilement intégrables dans une solution web documentaire
- Authentification : nécessité potentielle d'un système propre au portail (pas SSO/LDAP) pour accès depuis postes utilisateurs

---

## ⚡ Vue d'ensemble

### Dépendances et risques majeurs
- **Risque d'adoption** : Si l'outil est difficile à alimenter, il ne sera pas maintenu → obsolescence rapide
- **Formats hétérogènes** : La diversité des formats existants (doc, docx, PDF, Excel, txt, liens) complexifie l'unification
- **Structuration préalable** : L'import automatisé BookStack nécessite des documents Word structurés → travail de mise en conformité à prévoir
- **Accès hors poste utilisateur** : Exigence technique nécessitant une solution d'authentification dédiée et/ou des contenus publics
- **Durée projet** : Estimation de plusieurs mois → maintien des solutions existantes en parallèle pendant la transition
- **Dispersion des efforts** : Trois initiatives parallèles identifiées → coordination indispensable pour éviter les doublons

### Points en suspens nécessitant arbitrage
- Quelle solution pour la documentation nationale livrée en packages compressés ?
- Les cartographies Excel (applicative, serveurs) entrent-elles dans le scope de l'outil documentaire ou font-elles l'objet d'un projet séparé ?
- Quel niveau de segmentation des droits réellement nécessaire au sein de la DSI ?
- Quelle priorité pour la formalisation des procédures Support Parc ?

---