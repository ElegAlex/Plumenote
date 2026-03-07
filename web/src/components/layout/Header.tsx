import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

interface Props {
  activeView: string
  onViewChange: (view: string) => void
}

const VIEWS = [
  { key: 'docs', label: 'Documentation' },
  { key: 'apps', label: 'Applications' },
  { key: 'carto', label: 'Cartographie' },
]

export default function Header({ activeView, onViewChange }: Props) {
  const { user, isAuthenticated, logout } = useAuth()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  return (
    <header
      className="flex items-stretch bg-bg h-[58px] relative z-10"
      style={{ borderBottom: '3px solid #2B5797', animation: 'fadeIn 0.35s ease-out' }}
    >
      {/* Logo zone */}
      <div className="flex items-center gap-3.5 px-6 border-r border-ink-05 min-w-[240px]">
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <rect x="0" y="0" width="14" height="14" fill="#1C1C1C" rx="1" />
          <circle cx="22.5" cy="7.5" r="7" fill="#D4952A" />
          <rect x="0" y="16" width="30" height="14" fill="#2B5797" rx="1" />
        </svg>
        <div>
          <div className="font-display text-[17px] tracking-[2px] leading-none text-ink">
            PLUMENOTE
          </div>
          <div className="font-mono text-[8px] tracking-[2.5px] text-ink-45 mt-0.5 uppercase">
            Gestion des connaissances
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex items-stretch">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => onViewChange(v.key)}
            className={`px-5 flex items-center font-sans text-[12.5px] font-semibold tracking-[1.5px] uppercase cursor-pointer border-r border-ink-05 transition-all duration-100 select-none relative ${
              activeView === v.key ? 'text-ink' : 'text-ink-70 hover:text-ink'
            }`}
          >
            {v.label}
            {activeView === v.key && (
              <span className="absolute bottom-[-3px] left-0 right-0 h-[3px] bg-red" />
            )}
          </button>
        ))}
      </nav>

      {/* Right */}
      <div className="ml-auto flex items-center px-6 gap-3 border-l border-ink-05 font-mono text-[11px] text-ink-70 max-md:hidden">
        {isAuthenticated ? (
          <>
            <Link
              to="/documents/new"
              className="font-sans text-[11px] font-semibold tracking-wider uppercase px-3 py-1.5 bg-blue text-white no-underline hover:bg-blue/90 transition-colors"
            >
              + Nouvelle page
            </Link>
            <span className="opacity-40">&middot;</span>
            <span className="font-semibold text-ink">{user?.display_name || user?.username}</span>
            <button onClick={logout} className="text-ink-45 hover:text-ink cursor-pointer transition-colors">
              &times;
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="font-sans text-[11px] font-semibold tracking-wider uppercase text-blue no-underline hover:text-ink transition-colors">
              Connexion
            </Link>
          </>
        )}
        <span className="opacity-40">&middot;</span>
        <span>{fmt(time)}</span>
      </div>
    </header>
  )
}
