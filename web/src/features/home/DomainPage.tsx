import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import FreshnessBadge from './FreshnessBadge'
import TimeAgo from './TimeAgo'
import BookmarkList from '@/features/bookmark/BookmarkList'
import BookmarkForm from '@/features/bookmark/BookmarkForm'

interface Domain {
  id: string
  name: string
  slug: string
  color: string
  doc_count: number
}

interface Doc {
  id: string
  title: string
  slug: string
  freshness_badge: 'green' | 'yellow' | 'red'
  author_name: string
  updated_at: string
  verified_at?: string
  view_count: number
}

export default function DomainPage() {
  const { slug } = useParams<{ slug: string }>()
  const { isAuthenticated } = useAuth()
  const [domain, setDomain] = useState<Domain | null>(null)
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [showBookmarkForm, setShowBookmarkForm] = useState(false)

  useEffect(() => {
    if (!slug) return
    Promise.all([
      api.get<Domain[]>('/domains').then((domains) => domains.find((d) => d.slug === slug) || null),
      api.get<Doc[]>(`/documents?domain=${slug}&sort=recent`),
    ])
      .then(([d, docList]) => {
        setDomain(d)
        setDocs(docList)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return <p className="text-ink-45">Chargement...</p>
  }

  if (!domain) {
    return <p className="text-ink-45">Domaine introuvable.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: domain.color }} />
        <h1 className="text-2xl font-bold text-ink">{domain.name}</h1>
        <span className="text-sm text-ink-45">{domain.doc_count} document{domain.doc_count !== 1 ? 's' : ''}</span>
      </div>

      {docs.length === 0 ? (
        <div className="bg-bg border border-ink-10 rounded-lg shadow-sm p-8 text-center">
          <p className="text-ink-45 mb-4">Aucun document dans ce domaine. Soyez le premier a contribuer !</p>
          <Link
            to="/documents/new"
            className="inline-flex items-center px-4 py-2 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90 transition-colors"
          >
            + Nouvelle page
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <Link
              key={doc.id}
              to={`/documents/${doc.slug}`}
              className="flex items-center justify-between bg-bg border border-ink-10 rounded-lg shadow-sm hover:shadow-md transition-shadow px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FreshnessBadge badge={doc.freshness_badge} verifiedAt={doc.verified_at} />
                <span className="text-sm font-medium text-ink truncate">{doc.title}</span>
                <span className="text-xs text-ink-45">{doc.author_name}</span>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <span className="text-xs text-ink-45">{doc.view_count} vue{doc.view_count !== 1 ? 's' : ''}</span>
                <TimeAgo date={doc.updated_at} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Liens externes */}
      {domain && (
        <div className="space-y-3 mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">Liens externes</h2>
            {isAuthenticated && (
              <button
                onClick={() => setShowBookmarkForm(true)}
                className="inline-flex items-center px-3 py-1.5 bg-blue text-white text-xs font-medium rounded-md hover:bg-blue/90 transition-colors"
              >
                + Ajouter un lien
              </button>
            )}
          </div>
          <BookmarkList domainId={domain.id} />
        </div>
      )}

      {showBookmarkForm && (
        <BookmarkForm
          onClose={() => setShowBookmarkForm(false)}
        />
      )}
    </div>
  )
}
