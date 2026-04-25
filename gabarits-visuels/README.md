# Gabarits visuels PlumeNote

Source de vérité visuelle pour PlumeNote. Ces maquettes HTML statiques calquent l'identité de l'outil **RECRUT** (palette navy / coral / cream, typographies Fraunces + Manrope + JetBrains Mono) et servent de référence pour l'implémentation React.

## Contenu

Dix gabarits HTML standalone, ouvrables directement au navigateur, plus un `index.html` sommaire qui agrège les vues :

| Fichier | Écran |
|---|---|
| `g1-login.html` | Authentification |
| `g2-accueil-dsi.html` | Accueil DSI (espace authentifié) |
| `g3-accueil-public.html` | Accueil public (vitrine) |
| `g4-recherche.html` | Recherche globale |
| `g5-lecture-document.html` | Lecture de document |
| `g6-editeur.html` | Édition TipTap |
| `g7-domaine.html` | Page domaine (liste / filtres) |
| `g8-import.html` | Import Pandoc |
| `g9-admin.html` | Back-office admin |
| `g10-compte.html` | Profil utilisateur |
| `index.html` | Sommaire |

## Usage

- **Référence produit / design** : les écrans React (`web/src/features/*`) s'alignent sur ces gabarits.
- **Tokens / primitives** : toutes les couleurs, typographies et espacements sont exposés comme tokens dans `web/src/index.css` (`@theme`) et consommés via les primitives de `web/src/components/ui/`.
- **Spec complète** : voir `docs/DESIGN_SYSTEM.md`.

## Règles

- Ne pas éditer les gabarits sans alignement produit.
- Toute modification doit rester cohérente avec l'identité RECRUT (palette, typos, espacements).
- Les gabarits sont la référence : en cas de divergence avec le code React, c'est le gabarit qui fait foi sauf arbitrage contraire.
