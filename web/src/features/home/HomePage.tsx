import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import FreshnessBadge from './FreshnessBadge'
import TimeAgo from './TimeAgo'

interface Domain {
  id: string
  name: string
  slug: string
  color: string
  icon: string
  doc_count: number
}

interface RecentDoc {
  id: string
  title: string
  slug: string
  freshness_badge: 'green' | 'yellow' | 'red'
  domain_name: string
  domain_color: string
  updated_at: string
  verified_at?: string
}

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [domains, setDomains] = useState<Domain[]>([])
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([])

  useEffect(() => {
    api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
    api.get<RecentDoc[]>('/documents?limit=6&sort=recent').then(setRecentDocs).catch(() => {})
  }, [])

  const showOnboarding = user?.onboarding_completed === false

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Bonjour {user?.display_name || user?.username}
        </h1>
        <p className="text-sm text-gray-500">
          {domains.reduce((sum, d) => sum + d.doc_count, 0)} documents au total
        </p>
      </div>

      {showOnboarding && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          Bienvenue ! Commencez par explorer les domaines ou creer votre premiere page.
        </div>
      )}

      <div
        onClick={() => navigate('/search')}
        className="flex items-center px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-400 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all"
      >
        <kbd className="text-xs bg-gray-100 rounded px-1.5 py-0.5 mr-3 font-mono text-gray-500">Ctrl+K</kbd>
        Rechercher dans la base de connaissances...
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Domaines</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {domains.map((d) => (
            <Link
              key={d.id}
              to={`/domains/${d.slug}`}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="font-medium text-gray-900">{d.name}</span>
              </div>
              <p className="text-sm text-gray-500">{d.doc_count} document{d.doc_count !== 1 ? 's' : ''}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activite recente</h2>
        {recentDocs.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun document recent.</p>
        ) : (
          <div className="space-y-2">
            {recentDocs.map((doc) => (
              <Link
                key={doc.id}
                to={`/documents/${doc.slug}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FreshnessBadge badge={doc.freshness_badge} verifiedAt={doc.verified_at} />
                  <span className="text-sm font-medium text-gray-900 truncate">{doc.title}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: doc.domain_color + '20', color: doc.domain_color }}
                  >
                    {doc.domain_name}
                  </span>
                </div>
                <TimeAgo date={doc.updated_at} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
