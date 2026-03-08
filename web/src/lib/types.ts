// === Domain ===
export interface Domain {
  id: string
  name: string
  slug: string
  color: string
  icon: string
  sort_order: number
  doc_count: number
  created_at: string
  updated_at: string
}

// === Document (list item) ===
export interface DocumentSummary {
  id: string
  title: string
  slug: string
  domain_id: string
  domain_name: string
  domain_color: string
  type_name: string
  type_slug: string
  author_name: string
  visibility: 'public' | 'dsi'
  view_count: number
  freshness_badge: 'green' | 'yellow' | 'red'
  tags: string[]
  updated_at: string
  created_at: string
}

// === Feed item (same shape as DocumentSummary) ===
export type FeedItem = DocumentSummary

// === Review item (same shape + needs_review) ===
export interface ReviewItem extends DocumentSummary {
  needs_review: boolean
}

// === Stats ===
export interface Stats {
  documents: number
  searches_month: number
  contributors: number
  updates_month: number
}

// === Stats Health (Wave 3) ===
export interface StatsHealth {
  total: number
  green: number
  yellow: number
  red: number
}

// === Search Gap (Wave 3) ===
export interface SearchGap {
  query: string
  count: number
  last_searched: string
}

// === Flag Review request ===
export interface FlagReviewRequest {
  needs_review: boolean
}

// === Flag Review response ===
export interface FlagReviewResponse {
  status: string
  needs_review: boolean
}
