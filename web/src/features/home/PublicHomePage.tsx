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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">PlumeNote</h1>
        <p className="text-sm text-gray-500">Pas besoin de compte pour consulter les guides</p>
      </div>

      <div
        onClick={() => navigate('/search')}
        className="flex items-center px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-400 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all"
      >
        <kbd className="text-xs bg-gray-100 rounded px-1.5 py-0.5 mr-3 font-mono text-gray-500">Ctrl+K</kbd>
        Rechercher dans la base de connaissances...
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Guides populaires</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun guide disponible pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {docs.map((doc) => (
              <Link
                key={doc.id}
                to={`/documents/${doc.slug}`}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <FreshnessBadge badge={doc.freshness_badge} />
                  <span className="text-sm font-medium text-gray-900 truncate">{doc.title}</span>
                </div>
                <p className="text-xs text-gray-500">{doc.view_count} consultation{doc.view_count !== 1 ? 's' : ''}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {ticketUrl && (
        <section className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-600 mb-3">Vous ne trouvez pas ce que vous cherchez ?</p>
          <a
            href={ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Ouvrir un ticket support
          </a>
        </section>
      )}
    </div>
  )
}
