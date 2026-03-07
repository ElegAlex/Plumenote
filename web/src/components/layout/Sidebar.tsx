import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'

interface Domain {
  id: string
  name: string
  slug: string
  color: string
  icon: string
  doc_count: number
}

export default function Sidebar() {
  const location = useLocation()
  const { isAdmin, isAuthenticated } = useAuth()
  const [domains, setDomains] = useState<Domain[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 lg:hidden w-8 h-8 flex items-center justify-center bg-bg border border-ink-10 rounded-md text-ink-70"
        aria-label="Menu"
      >
        {mobileOpen ? '\u2715' : '\u2630'}
      </button>

      <aside className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-64 bg-bg border-r border-ink-10 flex flex-col transition-transform`}>
        <div className="p-4 border-b border-ink-10">
          <Link to="/" className="font-display text-xl text-ink">
            PlumeNote
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <Link
            to="/"
            className={`block px-3 py-2 rounded-md text-sm font-medium ${
              location.pathname === '/' ? 'bg-ink-05 text-ink' : 'text-ink-70 hover:bg-ink-05'
            }`}
          >
            Accueil
          </Link>

          <div className="pt-4 pb-2">
            <p className="px-3 font-sans text-[9px] font-bold tracking-[3px] uppercase text-ink-45">Domaines</p>
          </div>

          {domains.map((d) => {
            const isActive = location.pathname === `/domains/${d.slug}`
            return (
              <Link
                key={d.slug}
                to={`/domains/${d.slug}`}
                className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                  isActive ? 'bg-ink-05 text-ink font-medium' : 'text-ink-70 hover:bg-ink-05'
                }`}
              >
                <span className="flex items-center min-w-0">
                  <span
                    className="w-2 h-2 rounded-full mr-3 flex-shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="truncate">{d.name}</span>
                </span>
                <span className="text-xs text-ink-45 ml-2 flex-shrink-0">{d.doc_count}</span>
              </Link>
            )
          })}

          {isAuthenticated && isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 font-sans text-[9px] font-bold tracking-[3px] uppercase text-ink-45">Administration</p>
              </div>
              <Link
                to="/admin"
                className={`block px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname.startsWith('/admin') ? 'bg-ink-05 text-ink' : 'text-ink-70 hover:bg-ink-05'
                }`}
              >
                Admin
              </Link>
            </>
          )}
        </nav>
      </aside>
    </>
  )
}
