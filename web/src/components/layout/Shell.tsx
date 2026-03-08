import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { SearchModal, useSearchModal } from '../../features/search'
import { useEntityLabel } from '@/lib/hooks'
import { useSidebar } from '@/lib/sidebar-context'
import Sidebar from './Sidebar'

export default function Shell() {
  const search = useSearchModal()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const { data: entityLabelConfig } = useEntityLabel()
  const entityLabel = entityLabelConfig?.label ?? 'Fiche'
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebar()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

  // Hide sidebar on editor and admin pages
  const hideSidebar = /^\/(documents\/.+\/edit|documents\/new|admin|import|bookmarks\/new|entities\/new|entities\/.+\/edit|profile|login)/.test(location.pathname)

  return (
    <div style={{ minHeight: "100vh", background: "#F7F6F3", fontFamily: "'IBM Plex Mono', monospace", color: "#1C1C1C" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Archivo+Black&display=swap');
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
          user-select: none;
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
        .shell-body {
          display: flex;
          min-height: calc(100vh - 58px);
        }
        .shell-content {
          flex: 1;
          min-width: 0;
          background: #FBFBF9;
        }
        .shell-chevron {
          font-size: 10px;
          color: rgba(28,28,28,0.35);
          transition: transform 0.2s;
          margin-left: 4px;
        }
        @media (max-width: 900px) {
          .shell-logo-zone { min-width: auto; }
          .shell-nav-btn { padding: 0 12px; font-size: 11px; }
          .shell-header-right { display: none; }
        }
      `}</style>

      <header className="shell-header">
        <div
          className="shell-logo-zone"
          onClick={hideSidebar ? () => navigate('/') : toggleSidebar}
          title={hideSidebar ? 'Accueil' : (sidebarOpen ? 'Masquer la sidebar' : 'Afficher la sidebar')}
        >
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <rect x="0" y="0" width="14" height="14" fill="#1C1C1C" rx="1" />
            <circle cx="22.5" cy="7.5" r="7" fill="#D4952A" />
            <rect x="0" y="16" width="30" height="14" fill="#2B5797" rx="1" />
          </svg>
          <div>
            <div className="shell-logo-title">PLUMENOTE</div>
            <div className="shell-logo-sub">Gestion des connaissances</div>
          </div>
          {!hideSidebar && (
            <span className="shell-chevron" style={{ transform: sidebarOpen ? 'none' : 'rotate(180deg)' }}>
              &#9664;
            </span>
          )}
        </div>
        <nav className="shell-nav">
          <div className="shell-nav-btn" onClick={() => navigate('/')}>Documentation</div>
          <div className="shell-nav-btn" onClick={() => navigate('/')}>Applications</div>
          <div className="shell-nav-btn" onClick={() => navigate('/cartography')}>Cartographie</div>
          {isAuthenticated && user && (user.role === 'admin' || user.role === 'dsi') && (
            <div className="shell-nav-btn" onClick={() => navigate('/mindmap')}>Mind Map</div>
          )}
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
              <span style={{ cursor: "pointer" }} onClick={logout}>Deconnexion</span>
            </>
          ) : (
            <Link to="/login" style={{ color: "#2B5797", textDecoration: "none", fontWeight: 600 }}>Connexion</Link>
          )}
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{fmt(time)}</span>
        </div>
      </header>

      <div className="shell-body">
        {!hideSidebar && <Sidebar />}
        <div className="shell-content">
          <Outlet />
        </div>
      </div>

      <SearchModal isOpen={search.isOpen} onClose={search.close} />
    </div>
  )
}
