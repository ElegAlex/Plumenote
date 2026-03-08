import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { SearchModal, useSearchModal } from '../../features/search'
import { useEntityLabel } from '@/lib/hooks'

export default function Shell() {
  const search = useSearchModal()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const { data: entityLabelConfig } = useEntityLabel()
  const entityLabel = entityLabelConfig?.label ?? 'Fiche'
  const isHomepage = location.pathname === '/'
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

  // Homepage renders its own full layout
  if (isHomepage) {
    return (
      <>
        <Outlet />
        <SearchModal isOpen={search.isOpen} onClose={search.close} />
      </>
    )
  }

  // All other pages: same maquette header + content area
  return (
    <div style={{ minHeight: "100vh", background: "#F7F6F3", fontFamily: "'IBM Plex Mono', monospace", color: "#1C1C1C" }}>
      <style>{`
        .shell-header {
          display: flex; align-items: stretch;
          background: #F7F6F3;
          border-bottom: 3px solid #2B5797;
          height: 58px; position: relative; z-index: 10;
        }
        .shell-logo-zone {
          display: flex; align-items: center; gap: 14px;
          padding: 0 24px;
          border-right: 1px solid rgba(28,28,28,0.08);
          min-width: 240px; cursor: pointer;
        }
        .shell-logo-title { font-family: 'Archivo Black', sans-serif; font-size: 17px; letter-spacing: 2px; line-height: 1; color: #1C1C1C; }
        .shell-logo-sub { font-family: 'IBM Plex Mono', monospace; font-size: 8px; letter-spacing: 2.5px; color: rgba(28,28,28,0.65); margin-top: 2px; text-transform: uppercase; }
        .shell-nav { display: flex; align-items: stretch; }
        .shell-nav-btn {
          padding: 0 22px; display: flex; align-items: center;
          font-family: 'IBM Plex Sans', sans-serif; font-size: 12.5px; font-weight: 600;
          letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer;
          border-right: 1px solid rgba(28,28,28,0.05);
          transition: all 0.12s; user-select: none; color: rgba(28,28,28,0.7); position: relative;
          text-decoration: none;
        }
        .shell-nav-btn:hover { color: #1C1C1C; }
        .shell-header-right {
          margin-left: auto; display: flex; align-items: center; padding: 0 24px; gap: 16px;
          border-left: 1px solid rgba(28,28,28,0.05);
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(28,28,28,0.7);
        }
        .shell-content {
          min-height: calc(100vh - 58px);
          background: #FBFBF9;
        }
        @media (max-width: 900px) {
          .shell-logo-zone { min-width: auto; }
          .shell-nav-btn { padding: 0 12px; font-size: 11px; }
          .shell-header-right { display: none; }
        }
      `}</style>

      <header className="shell-header">
        <div className="shell-logo-zone" onClick={() => navigate('/')}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <rect x="0" y="0" width="14" height="14" fill="#1C1C1C" rx="1" />
            <circle cx="22.5" cy="7.5" r="7" fill="#D4952A" />
            <rect x="0" y="16" width="30" height="14" fill="#2B5797" rx="1" />
          </svg>
          <div>
            <div className="shell-logo-title">PLUMENOTE</div>
            <div className="shell-logo-sub">Gestion des connaissances</div>
          </div>
        </div>
        <nav className="shell-nav">
          <div className="shell-nav-btn" onClick={() => navigate('/')}>Documentation</div>
          <div className="shell-nav-btn" onClick={() => navigate('/')}>Applications</div>
          <div className="shell-nav-btn" onClick={() => navigate('/')}>Cartographie</div>
        </nav>
        <div className="shell-header-right">
          {isAuthenticated ? (
            <>
              <span style={{ fontWeight: 600, color: "#1C1C1C" }}>{user?.display_name || user?.username}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ cursor: "pointer" }} onClick={() => navigate("/documents/new")}>+ Nouvelle page</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ cursor: "pointer" }} onClick={() => navigate("/entities/new")}>+ {entityLabel}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ cursor: "pointer" }} onClick={() => navigate("/import")}>Importer</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ cursor: "pointer" }} onClick={() => navigate("/bookmarks/new")}>Ajouter un lien</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ cursor: "pointer" }} onClick={logout}>Déconnexion</span>
            </>
          ) : (
            <Link to="/login" style={{ color: "#2B5797", textDecoration: "none", fontWeight: 600 }}>Connexion</Link>
          )}
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{fmt(time)}</span>
        </div>
      </header>

      <div className="shell-content">
        <Outlet />
      </div>

      <SearchModal isOpen={search.isOpen} onClose={search.close} />
    </div>
  )
}
