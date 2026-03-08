import { useState, useEffect, useRef } from 'react'
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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const actionsMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) setActionsMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Hide sidebar on editor and admin pages
  const hideSidebar = /^\/(documents\/.+\/edit|documents\/new|admin|import|bookmarks\/new|entities\/new|entities\/.+\/edit|profile|login)/.test(location.pathname)

  const isAdmin = user?.role === 'admin'

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
        .shell-search {
          flex: 1; display: flex; align-items: center;
          padding: 0 20px; gap: 10px; min-width: 0;
          border-right: 1px solid rgba(28,28,28,0.08);
          cursor: pointer; transition: background 0.1s;
        }
        .shell-search:hover { background: rgba(28,28,28,0.02); }
        .shell-search-icon { font-size: 14px; color: rgba(28,28,28,0.4); flex-shrink: 0; }
        .shell-search-text { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: rgba(28,28,28,0.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .shell-search-kbd { font-family: 'IBM Plex Mono', monospace; font-size: 10px; border: 1.5px solid rgba(28,28,28,0.15); padding: 1px 6px; border-radius: 2px; color: rgba(28,28,28,0.45); flex-shrink: 0; margin-left: auto; }
        .shell-header-right {
          display: flex; align-items: center; padding: 0 16px; gap: 10px;
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(28,28,28,0.7);
        }
        .shell-btn {
          font-family: 'IBM Plex Sans', sans-serif; font-size: 11px; font-weight: 600;
          letter-spacing: 0.8px; text-transform: uppercase; cursor: pointer;
          padding: 6px 12px; border: none; background: none;
          color: rgba(28,28,28,0.7); transition: all 0.1s; white-space: nowrap;
        }
        .shell-btn:hover { color: #1C1C1C; background: rgba(28,28,28,0.04); }
        .shell-btn-primary {
          font-family: 'IBM Plex Sans', sans-serif; font-size: 11px; font-weight: 600;
          letter-spacing: 0.8px; text-transform: uppercase; cursor: pointer;
          padding: 6px 14px; border: none;
          background: #2B5797; color: #fff; transition: all 0.1s; white-space: nowrap;
        }
        .shell-btn-primary:hover { background: #1e4070; }
        .shell-dropdown {
          position: absolute; top: 100%; right: 0; margin-top: 4px;
          background: #FAFAF8; border: 1px solid rgba(28,28,28,0.1);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08); min-width: 180px; z-index: 100;
        }
        .shell-dropdown-item {
          display: block; width: 100%; text-align: left;
          font-family: 'IBM Plex Sans', sans-serif; font-size: 12px;
          padding: 10px 16px; border: none; background: none;
          color: #1C1C1C; cursor: pointer; text-decoration: none;
          transition: background 0.08s;
        }
        .shell-dropdown-item:hover { background: rgba(28,28,28,0.04); }
        .shell-dropdown-divider { height: 1px; background: rgba(28,28,28,0.08); margin: 0; }
        .shell-user-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(28,28,28,0.08); display: flex; align-items: center; justify-content: center;
          font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; font-weight: 600;
          color: rgba(28,28,28,0.6); cursor: pointer; transition: background 0.1s;
          border: none; flex-shrink: 0;
        }
        .shell-user-avatar:hover { background: rgba(28,28,28,0.14); }
        .shell-body { display: flex; min-height: calc(100vh - 58px); }
        .shell-content { flex: 1; min-width: 0; background: #FBFBF9; }
        .shell-chevron {
          font-size: 10px; color: rgba(28,28,28,0.35);
          transition: transform 0.2s; margin-left: 4px;
        }
        @media (max-width: 900px) {
          .shell-logo-zone { min-width: auto; padding: 0 14px; }
          .shell-search-text { display: none; }
          .shell-header-right { padding: 0 10px; gap: 6px; }
          .shell-btn { display: none; }
        }
      `}</style>

      <header className="shell-header">
        {/* Left — Logo + sidebar toggle */}
        <div
          className="shell-logo-zone"
          onClick={hideSidebar ? () => navigate('/') : toggleSidebar}
          title={hideSidebar ? 'Accueil' : (sidebarOpen ? 'Masquer la sidebar' : 'Afficher la sidebar')}
        >
          <img src="/plumenote.png" alt="PlumeNote" width="30" height="30" style={{ objectFit: 'contain' }} />
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

        {/* Center — Search bar */}
        <div className="shell-search" onClick={search.open}>
          <span className="shell-search-icon">&#8981;</span>
          <span className="shell-search-text">Rechercher dans la documentation...</span>
          <span className="shell-search-kbd">Ctrl+K</span>
        </div>

        {/* Right — Actions + Admin + User */}
        <div className="shell-header-right">
          {isAuthenticated ? (
            <>
              {/* Actions dropdown */}
              <div ref={actionsMenuRef} style={{ position: 'relative' }}>
                <button
                  className="shell-btn-primary"
                  onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
                >
                  + Creer &#9662;
                </button>
                {actionsMenuOpen && (
                  <div className="shell-dropdown">
                    <Link to="/documents/new" className="shell-dropdown-item" onClick={() => setActionsMenuOpen(false)}>
                      + Nouvelle page
                    </Link>
                    <Link to="/entities/new" className="shell-dropdown-item" onClick={() => setActionsMenuOpen(false)}>
                      + {entityLabel}
                    </Link>
                    <div className="shell-dropdown-divider" />
                    <Link to="/import" className="shell-dropdown-item" onClick={() => setActionsMenuOpen(false)}>
                      Importer
                    </Link>
                    <Link to="/bookmarks/new" className="shell-dropdown-item" onClick={() => setActionsMenuOpen(false)}>
                      + Lien
                    </Link>
                  </div>
                )}
              </div>

              {/* Admin link */}
              {isAdmin && (
                <button className="shell-btn" onClick={() => navigate('/admin')}>
                  Admin
                </button>
              )}

              {/* User dropdown */}
              <div ref={userMenuRef} style={{ position: 'relative' }}>
                <button
                  className="shell-user-avatar"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  title={user?.display_name || user?.username}
                >
                  {user?.display_name?.[0] || user?.username?.[0] || '?'}
                </button>
                {userMenuOpen && (
                  <div className="shell-dropdown">
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(28,28,28,0.08)' }}>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>
                        {user?.display_name || user?.username}
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'rgba(28,28,28,0.5)', textTransform: 'capitalize' }}>
                        {user?.role}
                      </div>
                    </div>
                    <Link to="/profile" className="shell-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                      Mon profil
                    </Link>
                    <div className="shell-dropdown-divider" />
                    <button className="shell-dropdown-item" onClick={() => { logout(); setUserMenuOpen(false) }}>
                      Deconnexion
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link to="/login" style={{ color: "#2B5797", textDecoration: "none", fontWeight: 600, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12 }}>
              Connexion
            </Link>
          )}
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
