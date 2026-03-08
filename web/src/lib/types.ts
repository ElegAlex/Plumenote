// === Domain ===
export interface Domain {
  id: string
  name: string
  slug: string
  color: string
  icon: string
  sort_order: number
  doc_count: number
  entity_count: number
  features_enabled: string[]
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
  entities: number
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

// === Import ===
export interface ImportResult {
  success: boolean
  document?: { id: string; title: string; slug: string }
  error?: string
}

export interface BatchImportResult {
  filename: string
  status: 'ok' | 'error'
  document?: { id: string; title: string; slug: string }
  error?: string
}

export interface BatchImportResponse {
  total: number
  success: number
  failed: number
  results: BatchImportResult[]
}

// === Bookmark ===
export interface Bookmark {
  id: string
  title: string
  url: string
  description: string
  domain_id: string
  domain_name: string
  domain_color: string
  author_id: string
  author_name: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface BookmarkCreatePayload {
  title: string
  url: string
  description?: string
  domain_id: string
  tags?: string[]
}

// === Entities (Fiches structurées) ===

export interface EntityTypeSchemaField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'url' | 'number' | 'date' | 'select'
  required: boolean
  options?: string[]
}

export interface EntityType {
  id: string
  name: string
  slug: string
  icon: string
  schema: EntityTypeSchemaField[]
  entity_count: number
  created_at: string
}

export interface EntitySummary {
  id: string
  name: string
  entity_type_id: string
  entity_type_name: string
  entity_type_icon: string
  domain_id: string
  domain_name: string
  domain_color: string
  author_name: string
  properties: Record<string, string | number>
  created_at: string
  updated_at: string
}

export interface RelationEndpoint {
  id: string
  name: string
  type_name: string
  type_icon: string
}

export interface EntityRelation {
  id: string
  relation_type: {
    name: string
    slug: string
  }
  source?: RelationEndpoint
  target?: RelationEndpoint
}

export interface LinkedDocument {
  id: string
  title: string
  slug: string
  freshness_badge: 'green' | 'yellow' | 'red'
}

export interface LinkedBookmark {
  id: string
  title: string
  url: string
}

export interface EntityDetail {
  id: string
  entity_type: {
    id: string
    name: string
    slug: string
    icon: string
    schema: EntityTypeSchemaField[]
  }
  domain: {
    id: string
    name: string
    color: string
  }
  name: string
  properties: Record<string, string | number>
  notes: Record<string, unknown> | null
  author_name: string
  created_at: string
  updated_at: string
  relations_outgoing: EntityRelation[]
  relations_incoming: EntityRelation[]
  linked_documents: LinkedDocument[]
  linked_bookmarks: LinkedBookmark[]
}

export interface EntityCreatePayload {
  entity_type_id: string
  domain_id: string
  name: string
  properties: Record<string, string | number>
  notes?: Record<string, unknown>
}

// === Relations ===

export interface RelationType {
  id: string
  name: string
  slug: string
  inverse_name: string
  inverse_slug: string
  created_at: string
}

export interface RelationCreatePayload {
  source_id: string
  target_id: string
  relation_type_id: string
}

// === Cartography ===

export interface CartographyNode {
  id: string
  name: string
  type_name: string
  type_icon: string
  type_slug: string
  domain_id: string
  domain_name: string
  domain_color: string
  properties_summary: string
  is_ghost: boolean
}

export interface CartographyEdge {
  id: string
  source: string
  target: string
  relation_name: string
  relation_slug: string
}

export interface CartographyData {
  nodes: CartographyNode[]
  edges: CartographyEdge[]
}

// === Entity Label Config ===

export interface EntityLabelConfig {
  label: string
}

// === Mind Map (V2 — tree) ===

export interface MindMapNode {
  id: string
  type: 'entity' | 'document' | 'bookmark' | 'domain'
  label: string
  icon: string
  meta: string
  domain_name: string
  domain_color: string
  freshness_badge: string | null
  url: string
  has_children: boolean
  children_count: number
  children: MindMapBranch[] | null
}

export interface MindMapBranch {
  relation: string
  relation_group: string
  items: MindMapNode[]
}

export interface MindMapTreeResponse {
  root: MindMapNode
}

export interface OrphanDocument {
  id: string
  title: string
  slug: string
  domain_name: string
  freshness_badge: string
  created_at: string
  view_count: number
}

export interface OrphansResponse {
  orphans: OrphanDocument[]
  total_documents: number
  orphan_count: number
  orphan_percent: number
}
