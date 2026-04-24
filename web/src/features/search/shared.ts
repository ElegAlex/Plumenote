/**
 * Utilitaires partagés entre SearchPage et SearchModal.
 *
 * - Types miroir de l'API /api/search (handler.go :: searchResponse).
 * - `sanitizeHighlight` : n'autorise que les balises <mark> dans le HTML Meili.
 * - `normalizeDomain` / `normalizeType` : mapping string libre → clés stables
 *   attendues par DomainChip / TypeChip / le mapping d'icônes.
 */

export type FreshnessBadge = 'green' | 'yellow' | 'red'

export interface SearchResult {
  id: string
  title: string
  body_text_highlight: string
  domain_id: string
  type_id: string
  visibility: string
  tags: string[] | null
  author_name: string
  view_count: number
  freshness_badge: FreshnessBadge
  created_at: string
  slug?: string
  attachment_count?: number
  object_type?: 'document' | 'bookmark' | 'entity'
  url?: string
  domain_name?: string
  domain_color?: string
  entity_type_name?: string
  entity_type_icon?: string
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
  processing_time_ms: number
}

export interface Domain {
  id: string
  name: string
  slug: string
  color: string
}

export interface DocType {
  id: string
  name: string
}

/**
 * N'autorise que les balises <mark> (fermées ou non). Toute autre balise est
 * échappée pour éviter l'injection via le highlighting Meilisearch.
 */
export function sanitizeHighlight(html: string): string {
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi, (match, tag) => {
    if (tag.toLowerCase() === 'mark') return match
    return match.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  })
}

/* ==========================================================================
   Normalisation domaine / type
   Les domaines et types sont créés via l'UI admin (pas seedés), donc on match
   sur des racines sémantiques tolérantes aux accents / pluriels.
   ========================================================================== */

export type DomainKey = 'infra' | 'support' | 'sci' | 'etudes' | 'data' | 'neutral'

export function normalizeDomain(name?: string | null): DomainKey {
  if (!name) return 'neutral'
  const n = name.toLowerCase()
  if (n.includes('infra')) return 'infra'
  if (n.includes('support') || n.includes('assistance')) return 'support'
  if (n.includes('sci') || n.includes('correspondant')) return 'sci'
  if (n.includes('etud') || n.includes('étud') || n.includes('dev')) return 'etudes'
  if (n.includes('data') || n.includes('donn')) return 'data'
  return 'neutral'
}

export type DocTypeKey = 'proc' | 'mo' | 'faq' | 'arch' | 'ref' | 'guide'

export function normalizeType(name?: string | null): DocTypeKey {
  if (!name) return 'guide'
  const n = name.toLowerCase()
  if (n.includes('proc') || n.includes('procédur')) return 'proc'
  if (n.includes('mode op') || n.includes('opérat')) return 'mo'
  if (n.includes('faq')) return 'faq'
  if (n.includes('arch')) return 'arch'
  if (n.includes('ref') || n.includes('réf')) return 'ref'
  return 'guide'
}

/**
 * Libellé court pour l'affichage (domain-chip, breadcrumb).
 * Renvoie le nom brut si fourni, sinon le nom par défaut de la clé.
 */
export const DOMAIN_LABEL: Record<DomainKey, string> = {
  infra: 'Infrastructure',
  support: 'Support',
  sci: 'SCI',
  etudes: 'Études',
  data: 'Data',
  neutral: 'Documents',
}

export const DOMAIN_SHORT: Record<DomainKey, string> = {
  infra: 'Infra',
  support: 'Support',
  sci: 'SCI',
  etudes: 'Études',
  data: 'Data',
  neutral: 'Doc',
}

export const TYPE_LABEL: Record<DocTypeKey, string> = {
  proc: 'Procédure',
  mo: 'Mode opératoire',
  faq: 'FAQ',
  arch: 'Architecture',
  ref: 'Référence',
  guide: 'Guide',
}

/* ==========================================================================
   Freshness — mapping API (green/yellow/red) → FreshBadge (ok/warn/danger)
   ========================================================================== */

export function freshStatus(badge: FreshnessBadge): 'ok' | 'warn' | 'danger' {
  if (badge === 'green') return 'ok'
  if (badge === 'yellow') return 'warn'
  return 'danger'
}

export function freshLabel(badge: FreshnessBadge): string {
  if (badge === 'green') return 'À jour'
  if (badge === 'yellow') return 'À vérifier'
  return 'Périmé'
}

/* ==========================================================================
   Fonds / couleurs des icônes par domaine (g4 .result-icon / .ck-ico)
   ========================================================================== */

export const DOMAIN_ICON_BG: Record<DomainKey, string> = {
  infra: 'bg-coral-bg text-coral',
  support: 'bg-success-bg text-success',
  sci: 'bg-navy-50 text-navy-700',
  etudes: 'bg-plum-bg text-plum',
  data: 'bg-warn-bg text-warn',
  neutral: 'bg-cream text-navy-800',
}
