import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import Header from '@/components/layout/Header'
import SearchBar from '@/components/layout/SearchBar'
import SidebarNew from '@/components/layout/SidebarNew'
import DocumentsView from './DocumentsView'
import ApplicationsView from './ApplicationsView'
import CartographieView from './CartographieView'
import PublicHomePage from './PublicHomePage'

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
  tags: string[]
  domain_id: string
  domain_name: string
  domain_color: string
  type_name: string
  type_slug: string
  updated_at: string
  freshness_badge: string
  view_count: number
}

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <PublicHomePage />
  return <AuthenticatedHome />
}

function AuthenticatedHome() {
  const [activeView, setActiveView] = useState('docs')
  const [activeService, setActiveService] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [domains, setDomains] = useState<Domain[]>([])
  const [docs, setDocs] = useState<Doc[]>([])

  useEffect(() => {
    api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
    api.get<Doc[]>('/documents?limit=200&sort=recent').then(setDocs).catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    let list = docs
    if (activeService) {
      list = list.filter((d) => d.domain_id === activeService)
    }
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(s) ||
          d.tags?.some((t) => t.toLowerCase().includes(s))
      )
    }
    return list
  }, [docs, activeService, search])

  const apps = useMemo(
    () => filtered.filter((d) => d.type_slug === 'fiche-applicative'),
    [filtered]
  )

  const activeDomain = activeService
    ? domains.find((d) => d.id === activeService)
    : null

  return (
    <div className="min-h-screen bg-bg font-mono text-ink relative">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.015]"
        style={{
          backgroundImage:
            'linear-gradient(#1C1C1C 1px, transparent 1px), linear-gradient(90deg, #1C1C1C 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      <Header activeView={activeView} onViewChange={setActiveView} />

      <SearchBar value={search} onChange={setSearch} resultCount={filtered.length} />

      <div
        className="grid grid-cols-[240px_1fr] max-md:grid-cols-1 min-h-[calc(100vh-110px)]"
        style={{ animation: 'fadeIn 0.4s ease-out 0.08s both' }}
      >
        <SidebarNew activeService={activeService} onServiceChange={setActiveService} />

        <main className="flex flex-col bg-bg-content">
          {/* Tabs */}
          <div className="flex items-center border-b border-ink-05 bg-bg">
            {(['docs', 'apps', 'carto'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                className={`font-sans text-[11.5px] font-semibold tracking-wider uppercase px-5 py-3 cursor-pointer border-r border-ink-05 transition-all duration-100 select-none relative ${
                  activeView === v
                    ? 'text-ink bg-bg-content'
                    : 'text-ink-45 hover:text-ink'
                }`}
              >
                {v === 'docs' ? 'Documents' : v === 'apps' ? 'Applications' : 'Cartographie'}
                {activeView === v && (
                  <span className="absolute top-0 left-0 right-0 h-0.5 bg-blue" />
                )}
              </button>
            ))}
            {activeDomain && (
              <div
                className="ml-auto px-5 font-mono text-[10px] text-ink-45 cursor-pointer flex items-center gap-1.5 hover:text-red transition-colors"
                onClick={() => setActiveService(null)}
              >
                {activeDomain.name} &#x2715;
              </div>
            )}
          </div>

          {activeView === 'docs' && <DocumentsView docs={filtered} />}
          {activeView === 'apps' && <ApplicationsView apps={apps} />}
          {activeView === 'carto' && <CartographieView domains={domains} docs={filtered} />}
        </main>
      </div>
    </div>
  )
}
