# PlumeNote Design System — spec de référence

Brief partagé à tous les sous-agents des vagues de migration. Source de vérité
visuelle : les dix gabarits HTML dans `gabarits-visuels/`.

## 1. Identité visuelle

- Calquée sur l'outil interne RECRUT (palette navy + coral + cream).
- Fontes : Manrope (sans / UI), Fraunces (serif / titres), JetBrains Mono (code / réfs).
- Esprit : éditorial sobre, ombres subtiles, radius généreux (16 à 18 px pour les panels).
- Accents italiques en coral dans les titres (ex. `<em>pour la connaissance</em>`).
- Préfixe `§` coral sur les H2 (.prose / .ProseMirror).
- Aucune dépendance UI externe (pas de clsx, cva, shadcn, radix). Tailwind 4 + utilitaire `cn()` maison.

## 2. Tokens disponibles

Définis dans `web/src/index.css` sous `@theme` (Tailwind 4). Chaque token `--color-*`
génère automatiquement les utilitaires `bg-*`, `text-*`, `border-*`.

### 2.1 Typographie

| Token | Usage | Utilitaire Tailwind |
|---|---|---|
| `--font-sans` (Manrope) | UI, corps de texte | `font-sans` |
| `--font-serif` (Fraunces) | Titres, KPIs, card-title | `font-serif` |
| `--font-mono` (JetBrains Mono) | Code, refs applicatives, logs | `font-mono` |
| `--font-display` | Alias Fraunces (code legacy) | `font-display` |

### 2.2 Palette

| Token | Hex | Utilitaires |
|---|---|---|
| `--color-navy-900` | `#14235C` | `bg-navy-900`, `text-navy-900`, `border-navy-900` |
| `--color-navy-800` | `#1E2D6B` | `bg-navy-800`, `text-navy-800`, … |
| `--color-navy-700` | `#263688` | `bg-navy-700`, … |
| `--color-navy-600` | `#2E42A0` | `bg-navy-600`, … |
| `--color-navy-500` | `#4A5AB8` | `bg-navy-500`, … |
| `--color-coral` | `#E8845C` | `bg-coral`, `text-coral`, `border-coral` |
| `--color-coral-soft` | `#F3B69A` | `bg-coral-soft`, … |
| `--color-coral-bg` | `#FCEEE4` | `bg-coral-bg`, … |
| `--color-cream` | `#F4E9D8` | `bg-cream`, … |
| `--color-cream-light` | `#FAF3E6` | `bg-cream-light`, … |
| `--color-bg` | `#F7F4EC` | `bg-bg` |
| `--color-bg-content` | `#FFFFFF` | `bg-bg-content` |
| `--color-white` | `#FFFFFF` | `bg-white` |
| `--color-ink-hover` | `#FAF3E6` | `bg-ink-hover` |

### 2.3 Texte et bordures

| Token | Hex / valeur | Utilitaires |
|---|---|---|
| `--color-ink` | `#1A1F3A` | `text-ink` |
| `--color-ink-soft` | `#5A6380` | `text-ink-soft` |
| `--color-ink-muted` | `#8B93AE` | `text-ink-muted` |
| `--color-ink-70` | `rgba(26,31,58,0.7)` | `text-ink-70` |
| `--color-ink-45` | `rgba(26,31,58,0.45)` | `text-ink-45` |
| `--color-ink-25` | `rgba(26,31,58,0.25)` | `text-ink-25` |
| `--color-ink-10` | `rgba(26,31,58,0.1)` | `text-ink-10` |
| `--color-ink-05` | `rgba(26,31,58,0.05)` | `text-ink-05` |
| `--color-line` | `#E4DBC9` | `border-line` |
| `--color-line-soft` | `#EFE8D6` | `border-line-soft` |

### 2.4 Sémantiques

| Token | Hex | Utilitaires |
|---|---|---|
| `--color-success` | `#2F7D5B` | `bg-success`, `text-success`, `border-success` |
| `--color-success-bg` | `#E3F0E9` | `bg-success-bg` |
| `--color-warn` | `#C97B1A` | `bg-warn`, `text-warn` |
| `--color-warn-bg` | `#FBEBD0` | `bg-warn-bg` |
| `--color-danger` | `#B1304A` | `bg-danger`, `text-danger` |
| `--color-danger-bg` | `#F9DFE4` | `bg-danger-bg` |
| `--color-plum` | `#7A3E8C` | `bg-plum`, `text-plum` |
| `--color-plum-bg` | `#F0E5F3` | `bg-plum-bg` |

### 2.5 Alias de compatibilité (à éliminer)

Mappent les anciens noms vers la palette. Ne plus utiliser dans le code nouveau.

| Alias | Pointe vers |
|---|---|
| `--color-blue` | navy-800 |
| `--color-red` | danger |
| `--color-amber` | warn |
| `--color-gray-dark` | ink-soft |
| `--color-gray-mid` | ink-muted |

## 3. Primitives (`web/src/components/ui/`)

Barrel : `@/components/ui`.

| Composant | Rôle | Variantes / API notable | Gabarit de référence |
|---|---|---|---|
| `Avatar` + `AvatarStack` | Identité utilisateur ronde gradientée | 4 tailles (xs, sm, md, xl), 6 gradients (a..f), stack avec `+N` | g2 user-chip, g10 identity |
| `Breadcrumb` | Fil d'ariane react-router | Items `{label, href?}`, dernier = strong Fraunces | g2, g4, g5, g7, g9 |
| `Button` | Bouton polymorphe | 6 variantes (primary, secondary, ghost, cta, danger, thumb), 2 tailles (sm, md), slots left/rightIcon | g1, g2 btn-cta, g5 btn-thumb, g8 btn-secondary/danger, g10 |
| `Callout` | Bloc d'attention | 5 variantes (tip, info, warn, danger, success) | .prose blockquote, g5 |
| `Card` + `CardHead` + `CardTitle` + `CardBody` + `CardFoot` | Conteneur structuré | `compact` (head), `padded` (body), foot cream-light | g2 panels, g5 meta-card, g10 cards |
| `DomainChip` | Pastille par domaine DSI | infra, support, sci, etudes, data, neutral | g7, g9 |
| `TypeChip` | Pastille par type de document | proc, mo, faq, arch, ref, guide | g5, g6 |
| `FilterChip` | Filtre actif avec bouton × | `label` + `value` + `onRemove` | g4, g9 |
| `Dialog` + `DialogHead` + `DialogBody` + `DialogFoot` | Modale portée dans body | `open`, `onClose`, Escape, lock body scroll, portal | g4 Ctrl+K |
| `Field` + `FieldLabel` + `FieldHint` + `FieldError` + `InlineMsg` | Wrapper formulaire | `required` (astérisque coral), `hintInline`, 3 variantes InlineMsg | g1, g10 |
| `FreshBadge` + `computeFreshStatus` | Fraîcheur d'un document | status ok / warn / danger, calcul automatique | g5, g7 |
| `IconButton` + `IconButtonDot` | Bouton carré 38×38 + badge | `aria-label` obligatoire, `badge` slot | g2 header |
| `Input` | Champ texte | `leftIcon`, `rightSlot`, `invalid` | g1, g2 search, g9 |
| `Kbd` | Touche clavier | — | g2, g4, g6 |
| `PageHeader` | Bandeau sticky top | `breadcrumb`, `actions`, min-h 68 px | motif commun g2/g4/g5/g7/g9 |
| `PageTitle` + `TitleEyebrow` | Titre de page | `eyebrow`, `description`, `<em>` coral | g1, g4, g7 |
| `Select` | Select natif stylé | Chevron SVG inline verbatim g6, `invalid` | g4, g6 tb-select, g7, g9 |
| `SidePanel` | Colonne sticky droite | `stickyTop` (default 78 px), max-height calc-100vh | g5 meta-panel, g6 meta-side |
| `Stepper` + `Step` | Workflow horizontal | `columns`, status done/current/todo, pulse sur current | g8 |
| `Switch` | Toggle 38×22 | Controlled (`on`, `onChange`), off=line, on=success | g10 pref-row |
| `Table` + `THead` + `TBody` + `Tr` + `Th` + `Td` | Table stylée | Tr selected / overdue, Th sortable / sorted | g9 |
| `Tabs` + `Tab` | Onglets plats | `active`, `icon`, `badge` (nombre) | g10 tabs-bar |
| `Textarea` | Zone multiligne | `invalid`, min-h 96 px, resize vertical | g10 bio |
| `Timeline` + `TimelineEvent` | Historique vertical | status done/current/upcoming/refused | g5 |
| `Toolbar` + `ToolbarGroup` + `ToolbarSeparator` + `ToolbarButton` + `ToolbarSelect` | Toolbar éditeur TipTap | `stickyTop` (default 68), `active` sur button | g6 |

## 4. Conventions de migration

- Tout import via `@/components/ui` (barrel).
- Utilitaire `cn()` via `@/lib/cn` (pas de clsx / classnames).
- Icônes : `lucide-react` uniquement. Jamais de SVG inline, sauf illustrations décoratives ponctuelles (graphe, plume identitaire, illustration 404).
- Pas de `style={{ ... }}` hors cas décoratifs ponctuels (gradient sur mesure, background-image avec data-URI).
- Fraunces pour : h1, h2, h3, h4, KPI value, card-title, tl-step-label, step-title, doc-card h3.
- Manrope pour : tout le reste (UI, corps de texte).
- JetBrains Mono pour : code, refs applicatives (ex. `INF-VPN-001`), logs SSE, logins, timecodes.
- Radius : 16 à 18 px pour les panels (rounded-2xl = 16 px, Dialog = 18 px), 10 à 12 px pour les contrôles (rounded-lg = 8 px, rounded-xl = 12 px), 999px pour les chips / pills (`rounded-full`).
- Focus ring contrôles de formulaire : `rgba(46,66,160,0.12)` sur 3 px (navy) ou `rgba(177,48,74,0.12)` sur 3 px en état invalide.
- Palette de hover standard : `bg-cream-light` + `border-navy-800` + `text-navy-800`.
- aria-label obligatoire sur tout IconButton et IconButton-like.

## 5. Mapping gabarit → route

| Gabarit | Route | Fichier TSX principal |
|---|---|---|
| g1-login | `/login` | `features/auth/LoginPage.tsx` |
| g2-accueil-dsi | `/` (authentifié) | `features/home/index.tsx` |
| g3-accueil-public | `/` (non auth) | `features/home/PublicHomePage.tsx` |
| g4-recherche | `/search` | `features/search/index.tsx` + `SearchModal.tsx` |
| g5-lecture-document | `/documents/:slug` | `features/reader/*` |
| g6-editeur | `/documents/:slug/edit`, `/documents/new` | `features/editor/*` |
| g7-domaine | `/domains/:slug` | `features/home/DomainPage.tsx` |
| g8-import | `/import` | `features/import/*` |
| g9-admin | `/admin/*` | `features/admin/*` |
| g10-compte | `/profile` | `features/profile/*` ou `ProfilePage.tsx` |

## 6. Non négociable

- Aucun hexa en dur dans les TSX. Uniquement via tokens (classes Tailwind ou `var(--color-*)`).
  Exception tolérée : hover / shadow avec alpha non exprimable en token (ex. `rgba(20,35,92,0.22)`), commenté dans le code.
- Aucune référence à IBM Plex, Archivo, `#2B5797`, `#1C1C1C`. Les pages legacy qui en contiennent (audit Vague 0 : 122 matches, essentiellement `features/home/FeedPanel.tsx`, `ReviewPanel.tsx`, `NotFoundPage.tsx`, `HomePage.tsx`, `DocumentsView.tsx`) doivent être migrées par les Vagues 1+.
- Pas d'ajout de dépendance UI sans discussion préalable (clsx, cva, radix, shadcn, headlessui interdits).
- Build vert à chaque commit (`cd web && npm run build`).

## 7. Checklist d'une migration de page

1. Lire le gabarit HTML de référence en entier avant d'écrire la première ligne.
2. Remplacer tous les `style={{ ... }}` par des classes utilitaires Tailwind tokenisées.
3. Remplacer les chaînes de classes répétées par une primitive de `@/components/ui`. Si une primitive n'existe pas, proposer son ajout plutôt que de recoller du balisage.
4. Vérifier focus visible, aria-label sur IconButton, rôles ARIA sur Dialog / Tabs / Table.
5. `npm run build` passe sans erreur TS ni CSS.
6. Grep final : aucune nouvelle occurrence de IBM Plex / Archivo / hexa hors tokens.
