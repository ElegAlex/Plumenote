import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import FreshnessBadge from './FreshnessBadge'

interface PublicDoc {
  id: string
  title: string
  slug: string
  freshness_badge: 'green' | 'yellow' | 'red'
  view_count: number
}

export default function PublicHomePage() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState<PublicDoc[]>([])
  const [ticketUrl, setTicketUrl] = useState<string | null>(null)

  useEffect(() => {
    api.get<PublicDoc[]>('/documents?visibility=public&sort=views&limit=6').then(setDocs).catch(() => {})
    api.get<{ url: string }>('/config/ticket-url')
      .then((res) => { if (res.url) setTicketUrl(res.url) })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-ink mb-1">PlumeNote</h1>
        <p className="text-sm text-ink-45">Pas besoin de compte pour consulter les guides</p>
      </div>

      <div
        onClick={() => navigate('/search')}
        className="flex items-center px-4 py-3 bg-bg border border-ink-10 rounded-lg text-sm text-ink-45 cursor-pointer hover:border-ink-10 hover:shadow-sm transition-all"
      >
        <kbd className="text-xs bg-ink-05 rounded px-1.5 py-0.5 mr-3 font-mono text-ink-45">Ctrl+K</kbd>
        Rechercher dans la base de connaissances...
      </div>

      <section>
        <h2 className="text-lg font-semibold text-ink mb-4">Guides populaires</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-ink-45">Aucun guide disponible pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {docs.map((doc) => (
              <Link
                key={doc.id}
                to={`/documents/${doc.slug}`}
                className="bg-bg border border-ink-10 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <FreshnessBadge badge={doc.freshness_badge} />
                  <span className="text-sm font-medium text-ink truncate">{doc.title}</span>
                </div>
                <p className="text-xs text-ink-45">{doc.view_count} consultation{doc.view_count !== 1 ? 's' : ''}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {ticketUrl && (
        <section className="bg-bg border border-ink-10 rounded-lg p-6 text-center">
          <p className="text-sm text-ink-70 mb-3">Vous ne trouvez pas ce que vous cherchez ?</p>
          <a
            href={ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90 transition-colors"
          >
            Ouvrir un ticket support
          </a>
        </section>
      )}
    </div>
  )
}
