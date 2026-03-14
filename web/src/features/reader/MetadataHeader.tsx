interface Tag {
  id: string
  name: string
}

interface Author {
  id: string
  display_name: string
}

interface MetadataHeaderProps {
  title: string
  author: Author
  visibility: string
  viewCount: number
  tags: Tag[]
  freshnessBadge: 'green' | 'yellow' | 'red'
  lastVerifiedAt: string | null
  lastVerifiedBy: string | null
  updatedAt: string
  domainName?: string
  domainColor?: string
  onEdit: () => void
  onVerify: () => void
  onDelete: () => void
  onMindMap?: () => void
  onHistory?: () => void
  canEdit: boolean
  canVerify: boolean
  canDelete: boolean
}

const freshnessConfig = {
  green: { icon: '\uD83D\uDFE2', label: 'A jour' },
  yellow: { icon: '\uD83D\uDFE1', label: 'A verifier' },
  red: { icon: '\uD83D\uDD34', label: 'Obsolete' },
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "aujourd'hui"
  if (diffDays === 1) return 'hier'
  if (diffDays < 30) return `il y a ${diffDays} jours`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `il y a ${diffMonths} mois`
  const diffYears = Math.floor(diffDays / 365)
  return `il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function MetadataHeader({
  title,
  viewCount,
  tags,
  freshnessBadge,
  lastVerifiedAt,
  lastVerifiedBy,
  updatedAt,
  domainName,
  domainColor,
  onEdit,
  onVerify,
  onDelete,
  onMindMap,
  onHistory,
  canEdit,
  canVerify,
  canDelete,
}: MetadataHeaderProps) {
  const freshness = freshnessConfig[freshnessBadge] || freshnessConfig.red

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-ink mb-3">{title}</h1>

      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-70 mb-3">
        <span className="inline-flex items-center gap-1">
          <span>{freshness.icon}</span>
          <span>{freshness.label}</span>
          {lastVerifiedAt && lastVerifiedBy && (
            <span className="text-ink-45">
              {' '}
              - Verifie par {lastVerifiedBy} le {formatDate(lastVerifiedAt)}
            </span>
          )}
        </span>

        <span className="text-ink-45">|</span>

        {domainName && (
          <>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: domainColor || '#6B7280' }}
            >
              {domainName}
            </span>
            <span className="text-ink-45">|</span>
          </>
        )}

        <span className="inline-flex items-center gap-1">
          <span className="text-yellow-500">&#9733;</span>
          <span>{viewCount} vues</span>
        </span>

        <span className="text-ink-45">|</span>

        <span>Derniere modif: {relativeDate(updatedAt)}</span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-block px-2 py-0.5 bg-ink-05 text-ink-70 text-xs rounded-full"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {onHistory && (
          <button
            onClick={onHistory}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-ink-05 text-ink-70 rounded-md hover:bg-ink-10 transition-colors"
          >
            Historique
          </button>
        )}
        {onMindMap && (
          <button
            onClick={onMindMap}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-ink-05 text-ink-70 rounded-md hover:bg-ink-10 transition-colors"
          >
            Mind Map
          </button>
        )}
        {canEdit && (
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue/10 text-blue rounded-md hover:bg-blue/10 transition-colors"
          >
            Modifier
          </button>
        )}
        {canVerify && (
          <button
            onClick={onVerify}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-[#2D8B4E]/10 text-[#2D8B4E] rounded-md hover:bg-[#2D8B4E]/10 transition-colors"
          >
            Marquer comme verifie
          </button>
        )}
        {canDelete && (
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red/10 text-red rounded-md hover:bg-red/10 transition-colors"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  )
}
