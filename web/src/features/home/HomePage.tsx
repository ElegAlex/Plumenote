import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useStatsHealth } from "@/lib/hooks/useStatsHealth";
import FeedPanel from "./FeedPanel";
import ReviewPanel from "./ReviewPanel";

interface Domain { id: string; name: string; slug: string; color: string; doc_count: number }
interface Stats { documents: number; searches_month: number; contributors: number; updates_month: number }
interface Doc {
  id: string; title: string; slug: string; tags?: string[];
  domain_id: string; domain_name: string; domain_color: string;
  type_name: string; type_slug: string; updated_at: string;
  freshness_badge: string; view_count: number;
  needs_review?: boolean;
}

const TYPE_ICONS: Record<string, string> = { PDF: "◼", DOC: "◧", TXT: "▤", XLS: "◨", URL: "◎" };

const TYPE_FORMAT: Record<string, string> = {
  "procedure-technique": "PDF", "guide-utilisateur": "DOC", "architecture-systeme": "DOC",
  "faq": "TXT", "troubleshooting": "TXT", "fiche-applicative": "DOC",
  "procedure-dinstallation": "PDF", "note-de-version": "TXT", "guide-reseau": "DOC",
  "documentation-api": "DOC", "autre": "TXT",
};

export default function HomePage() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeService, setActiveService] = useState<string | null>(null);
  const [activeView, setActiveView] = useState("docs");
  const [hoveredDoc, setHoveredDoc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [time, setTime] = useState(new Date());
  const searchRef = useRef<HTMLInputElement>(null);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const { data: health } = useStatsHealth();

  useEffect(() => { setLoaded(true); const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    api.get<Domain[]>("/domains").then(setDomains).catch(() => {});
    api.get<Doc[]>("/documents?limit=200&sort=recent").then(setDocs).catch(() => {});
    api.get<Stats>("/stats").then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchRef.current && !["INPUT", "TEXTAREA"].includes((document.activeElement as HTMLElement)?.tagName)) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") { setSearch(""); setActiveService(null); searchRef.current?.blur(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const services = useMemo(() => domains.map(d => ({
    code: d.id, label: d.name, color: d.color, count: d.doc_count,
  })), [domains]);

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      const s = search.toLowerCase();
      const matchS = !s || d.title.toLowerCase().includes(s) || d.tags?.some((t) => t.toLowerCase().includes(s));
      const matchSvc = !activeService || d.domain_id === activeService;
      return matchS && matchSvc;
    });
  }, [docs, search, activeService]);

  const apps = useMemo(() => docs.filter(d => d.type_slug === "fiche-applicative"), [docs]);

  const statsData = [
    { label: "Documents", value: stats?.documents ?? 0, trend: stats ? `+${stats.updates_month}` : undefined },
    { label: "Recherches / mois", value: stats?.searches_month ?? 0 },
    { label: "Contributeurs", value: stats?.contributors ?? 0 },
    { label: "Mises à jour", value: stats?.updates_month ?? 0, trend: "mars" },
  ];

  const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <div style={{ minHeight: "100vh", background: "#F7F6F3", fontFamily: "'IBM Plex Mono', monospace", color: "#1C1C1C", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Archivo+Black&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #2B5797; color: #fff; }
        @keyframes slideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .header {
          display: flex; align-items: stretch;
          background: #F7F6F3;
          border-bottom: 3px solid #2B5797;
          height: 58px; position: relative; z-index: 10;
        }
        .logo-zone {
          display: flex; align-items: center; gap: 14px;
          padding: 0 24px;
          border-right: 1px solid rgba(28,28,28,0.08);
          min-width: 240px;
        }
        .logo-title { font-family: 'Archivo Black', sans-serif; font-size: 17px; letter-spacing: 2px; line-height: 1; color: #1C1C1C; }
        .logo-sub { font-family: 'IBM Plex Mono', monospace; font-size: 8px; letter-spacing: 2.5px; color: rgba(28,28,28,0.65); margin-top: 2px; text-transform: uppercase; }
        .nav { display: flex; align-items: stretch; }
        .nav-btn {
          padding: 0 22px; display: flex; align-items: center;
          font-family: 'IBM Plex Sans', sans-serif; font-size: 12.5px; font-weight: 600;
          letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer;
          border-right: 1px solid rgba(28,28,28,0.05);
          transition: all 0.12s; user-select: none; color: rgba(28,28,28,0.7); position: relative;
        }
        .nav-btn:hover { color: #1C1C1C; }
        .nav-btn.active { color: #1C1C1C; }
        .nav-btn.active::after { content: ''; position: absolute; bottom: -3px; left: 0; right: 0; height: 3px; background: #C23B22; }
        .header-right {
          margin-left: auto; display: flex; align-items: center; padding: 0 24px; gap: 16px;
          border-left: 1px solid rgba(28,28,28,0.05);
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(28,28,28,0.7);
        }

        .search-bar {
          display: flex; align-items: stretch;
          border-bottom: 1px solid rgba(28,28,28,0.1);
          background: #F7F6F3; height: 50px;
        }
        .search-icon { width: 50px; display: flex; align-items: center; justify-content: center; border-right: 1px solid rgba(28,28,28,0.06); color: rgba(28,28,28,0.45); font-size: 15px; }
        .search-input { flex: 1; border: none; background: transparent; font-family: 'IBM Plex Mono', monospace; font-size: 13.5px; color: #1C1C1C; padding: 0 20px; outline: none; }
        .search-input::placeholder { color: rgba(28,28,28,0.45); }
        .search-meta { display: flex; align-items: center; padding: 0 16px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: rgba(28,28,28,0.5); border-left: 1px solid rgba(28,28,28,0.05); }
        .search-meta kbd { border: 1.5px solid rgba(28,28,28,0.12); padding: 1px 6px; font-size: 10px; margin-left: 4px; border-radius: 2px; }
        .search-count { display: flex; align-items: center; justify-content: center; padding: 0 20px; min-width: 100px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(28,28,28,0.6); border-left: 1px solid rgba(28,28,28,0.08); }

        .layout { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 110px); }
        .sidebar { border-right: 1px solid rgba(28,28,28,0.1); display: flex; flex-direction: column; background: #F7F6F3; }
        .sb-label { font-family: 'IBM Plex Sans', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: rgba(28,28,28,0.6); padding: 20px 20px 10px; }
        .svc { display: flex; align-items: center; gap: 11px; padding: 11px 20px; cursor: pointer; border-bottom: 1px solid rgba(28,28,28,0.03); transition: all 0.1s; user-select: none; }
        .svc:hover { background: rgba(28,28,28,0.025); }
        .svc.on { background: #1C1C1C; color: #FAFAF8; }
        .svc-dot { width: 12px; height: 12px; border-radius: 2px; border: 2px solid #1C1C1C; flex-shrink: 0; }
        .svc.on .svc-dot { border-color: rgba(250,250,248,0.35); }
        .svc-name { font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; font-weight: 600; flex: 1; }
        .svc-n { font-family: 'IBM Plex Mono', monospace; font-size: 10px; opacity: 0.5; }

        .stats { margin-top: auto; border-top: 2px solid rgba(28,28,28,0.1); display: grid; grid-template-columns: 1fr 1fr; }
        .st { padding: 14px 16px; display: flex; flex-direction: column; gap: 1px; border-bottom: 1px solid rgba(28,28,28,0.04); }
        .st:nth-child(odd) { border-right: 1px solid rgba(28,28,28,0.04); }
        .st-v { font-family: 'Archivo Black', sans-serif; font-size: 24px; line-height: 1; }
        .st-l { font-family: 'IBM Plex Mono', monospace; font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(28,28,28,0.5); }
        .st-t { font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: #2B5797; }

        .content { display: flex; flex-direction: column; background: #FBFBF9; }
        .tabs { display: flex; align-items: center; border-bottom: 1px solid rgba(28,28,28,0.07); background: #F7F6F3; }
        .tab { font-family: 'IBM Plex Sans', sans-serif; font-size: 11.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; padding: 12px 22px; cursor: pointer; color: rgba(28,28,28,0.6); border-right: 1px solid rgba(28,28,28,0.04); transition: all 0.1s; user-select: none; position: relative; }
        .tab:hover { color: #1C1C1C; }
        .tab.on { color: #1C1C1C; background: #FBFBF9; }
        .tab.on::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: #2B5797; }
        .fpill { margin-left: auto; padding: 0 20px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: rgba(28,28,28,0.6); cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .fpill:hover { color: #C23B22; }

        .dlist { flex: 1; overflow-y: auto; }
        .drow { display: grid; grid-template-columns: 46px 1fr 95px 65px 88px; align-items: center; border-bottom: 1px solid rgba(28,28,28,0.04); cursor: pointer; transition: background 0.08s; text-decoration: none; color: inherit; }
        .drow:hover { background: rgba(28,28,28,0.02); }
        .drow:hover .dt { text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1.5px; }
        .di { display: flex; align-items: center; justify-content: center; font-size: 14px; padding: 13px 0; color: rgba(28,28,28,0.25); transition: color 0.1s; }
        .drow:hover .di { color: rgba(28,28,28,0.4); }
        .dm { padding: 13px 16px; }
        .dt { font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; font-weight: 600; color: #1C1C1C; }
        .dtags { display: flex; gap: 4px; margin-top: 3px; flex-wrap: wrap; }
        .dtag { font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: 0.8px; color: rgba(28,28,28,0.5); background: rgba(28,28,28,0.06); padding: 1px 5px; text-transform: uppercase; }
        .dsvc { display: flex; align-items: center; gap: 6px; padding: 13px 8px; }
        .dsvc-d { width: 7px; height: 7px; border-radius: 1px; border: 1.5px solid #1C1C1C; flex-shrink: 0; }
        .dsvc-l { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: rgba(28,28,28,0.55); }
        .dfmt { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 1.5px; color: rgba(28,28,28,0.4); text-align: center; }
        .ddate { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: rgba(28,28,28,0.4); text-align: right; padding-right: 20px; }

        .agrid { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); }
        .acard { border-right: 1px solid rgba(28,28,28,0.06); border-bottom: 1px solid rgba(28,28,28,0.06); padding: 26px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; transition: all 0.12s; text-decoration: none; color: inherit; }
        .acard:hover { background: #1C1C1C; color: #FAFAF8; }
        .acard:hover .abadge { border-color: rgba(250,250,248,0.25); color: rgba(250,250,248,0.6); }
        .acard:hover .ahab { color: rgba(250,250,248,0.3); }
        .aname { font-family: 'Archivo Black', sans-serif; font-size: 26px; letter-spacing: 1px; line-height: 1.1; }
        .abadge { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; border: 1.5px solid rgba(28,28,28,0.25); padding: 3px 9px; align-self: flex-start; transition: all 0.12s; }
        .ahab { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: rgba(28,28,28,0.5); margin-top: auto; transition: color 0.12s; }

        .cgrid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .cblock { padding: 24px; display: flex; flex-direction: column; gap: 14px; }
        .chead { display: flex; align-items: center; gap: 10px; }
        .csw { width: 11px; height: 11px; border-radius: 2px; border: 2px solid #1C1C1C; }
        .ctitle { font-family: 'Archivo Black', sans-serif; font-size: 17px; letter-spacing: 2px; }
        .ccnt { font-family: 'IBM Plex Mono', monospace; font-size: 10px; opacity: 0.45; margin-left: auto; }
        .citem { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; padding: 7px 11px; border: 1px solid rgba(28,28,28,0.05); cursor: pointer; transition: all 0.1s; display: flex; align-items: center; gap: 7px; border-radius: 1px; text-decoration: none; color: inherit; }

        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 10px; padding: 60px; }
        .empty-i { font-family: 'Archivo Black', sans-serif; font-size: 48px; color: rgba(28,28,28,0.12); }
        .empty-t { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: rgba(28,28,28,0.4); }

        @media (max-width: 900px) {
          .layout { grid-template-columns: 1fr; }
          .sidebar { display: none; }
          .drow { grid-template-columns: 40px 1fr 70px; }
          .dfmt, .ddate { display: none; }
          .agrid { grid-template-columns: 1fr 1fr; }
          .logo-zone { min-width: auto; }
          .nav-btn { padding: 0 12px; font-size: 11px; }
          .header-right { display: none; }
        }
      `}</style>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.015, backgroundImage: "linear-gradient(#1C1C1C 1px, transparent 1px), linear-gradient(90deg, #1C1C1C 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

      <header className="header" style={{ animation: loaded ? "fadeIn 0.35s ease-out" : "none" }}>
        <div className="logo-zone">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <rect x="0" y="0" width="14" height="14" fill="#1C1C1C" rx="1" />
            <circle cx="22.5" cy="7.5" r="7" fill="#D4952A" />
            <rect x="0" y="16" width="30" height="14" fill="#2B5797" rx="1" />
          </svg>
          <div>
            <div className="logo-title">PLUMENOTE</div>
            <div className="logo-sub">Gestion des connaissances</div>
          </div>
        </div>
        <nav className="nav">
          {["docs", "apps", "carto"].map(v => (
            <div key={v} className={`nav-btn ${activeView === v ? "active" : ""}`} onClick={() => setActiveView(v)}>
              {v === "docs" ? "Documentation" : v === "apps" ? "Applications" : "Cartographie"}
            </div>
          ))}
        </nav>
        <div className="header-right">
          {isAuthenticated ? (
            <>
              <span style={{ fontWeight: 600, color: "#1C1C1C" }}>{user?.display_name || user?.username}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ cursor: "pointer" }} onClick={() => navigate("/documents/new")}>+ Nouvelle page</span>
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

      <div className="search-bar" style={{ animation: loaded ? "fadeIn 0.35s ease-out 0.04s both" : "none" }}>
        <div className="search-icon">⌕</div>
        <input ref={searchRef} className="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dans la documentation DSI..." />
        {search
          ? <div className="search-meta" style={{ cursor: "pointer" }} onClick={() => { setSearch(""); searchRef.current?.focus(); }}>✕</div>
          : <div className="search-meta">Raccourci <kbd>/</kbd></div>
        }
        <div className="search-count">{filtered.length} résultat{filtered.length !== 1 ? "s" : ""}</div>
      </div>

      <div className="layout" style={{ animation: loaded ? "fadeIn 0.4s ease-out 0.08s both" : "none" }}>
        <aside className="sidebar">
          <div className="sb-label">Services</div>
          {services.map(s => (
            <div key={s.code} className={`svc ${activeService === s.code ? "on" : ""}`} onClick={() => setActiveService(activeService === s.code ? null : s.code)}>
              <div className="svc-dot" style={{ background: s.color }} />
              <span className="svc-name">{s.label}</span>
              <span className="svc-n">{s.count}</span>
            </div>
          ))}
          {health && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(28,28,28,0.08)' }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(28,28,28,0.6)', marginBottom: 8 }}>
                Santé documentaire
              </div>
              <div style={{ display: 'flex', height: 6, borderRadius: 1, overflow: 'hidden', background: 'rgba(28,28,28,0.06)' }}>
                {health.total > 0 && (
                  <>
                    <div style={{ width: `${(health.green / health.total) * 100}%`, background: '#22C55E' }} />
                    <div style={{ width: `${(health.yellow / health.total) * 100}%`, background: '#EAB308' }} />
                    <div style={{ width: `${(health.red / health.total) * 100}%`, background: '#C23B22' }} />
                  </>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'rgba(28,28,28,0.5)' }}>
                <span>{health.green} vert{health.green !== 1 ? 's' : ''}</span>
                <span>{health.yellow} jaune{health.yellow !== 1 ? 's' : ''}</span>
                <span>{health.red} rouge{health.red !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}
          <div className="stats">
            {statsData.map((s, i) => (
              <div key={i} className="st">
                <div className="st-v">{s.value}</div>
                <div className="st-l">{s.label}</div>
                {s.trend && <div className="st-t">{s.trend}</div>}
              </div>
            ))}
          </div>
        </aside>

        <main className="content">
          <div className="tabs">
            {["docs", "apps", "carto"].map(v => (
              <div key={v} className={`tab ${activeView === v ? "on" : ""}`} onClick={() => setActiveView(v)}>
                {v === "docs" ? "Documents" : v === "apps" ? "Applications" : "Cartographie"}
              </div>
            ))}
            {activeService && <div className="fpill" onClick={() => setActiveService(null)}>{services.find(s => s.code === activeService)?.label} ✕</div>}
          </div>

          {activeView === "docs" && (
            <div className="dlist">
              {filtered.length === 0 ? (
                <div className="empty"><div className="empty-i">∅</div><div className="empty-t">Aucun document correspondant</div></div>
              ) : filtered.map((doc, idx) => {
                const svc = services.find(s => s.code === doc.domain_id);
                const fmt2 = TYPE_FORMAT[doc.type_slug] || "DOC";
                return (
                  <div key={doc.id} className="drow" onClick={() => navigate(`/documents/${doc.slug}`)}
                    onMouseEnter={() => setHoveredDoc(doc.id)} onMouseLeave={() => setHoveredDoc(null)}
                    style={{ animation: loaded ? `slideUp 0.22s ease-out ${0.025 * idx}s both` : "none" }}
                  >
                    <div className="di" style={{ color: hoveredDoc === doc.id ? svc?.color : undefined }}>{TYPE_ICONS[fmt2] || "○"}</div>
                    <div className="dm">
                      <div className="dt">
                        {doc.title}
                        {doc.needs_review && (
                          <span style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: 8,
                            letterSpacing: 0.8,
                            color: '#C23B22',
                            background: 'rgba(194,59,34,0.08)',
                            padding: '1px 5px',
                            textTransform: 'uppercase' as const,
                            marginLeft: 6,
                          }}>À réviser</span>
                        )}
                      </div>
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="dtags">{doc.tags.map(t => <span key={t} className="dtag">{t}</span>)}</div>
                      )}
                    </div>
                    <div className="dsvc"><div className="dsvc-d" style={{ background: svc?.color }} /><span className="dsvc-l">{svc?.label || doc.domain_name}</span></div>
                    <div className="dfmt">{fmt2}</div>
                    <div className="ddate">{doc.updated_at ? new Date(doc.updated_at).toLocaleDateString("fr-FR") : ""}</div>
                  </div>
                );
              })}
            </div>
          )}

          {activeView === "apps" && (
            <div className="agrid">
              {apps.map((app, idx) => (
                <div key={app.id} className="acard" onClick={() => navigate(`/documents/${app.slug}`)} style={{ animation: loaded ? `fadeIn 0.25s ease-out ${0.05 * idx}s both` : "none" }}>
                  <div className="aname">{app.title}</div>
                  <div className="abadge">{app.freshness_badge === "green" ? "Production" : app.freshness_badge === "yellow" ? "En cours" : "A vérifier"}</div>
                  <div className="ahab">{app.domain_name} · {app.view_count} vue{app.view_count !== 1 ? "s" : ""}</div>
                </div>
              ))}
              {apps.length === 0 && (
                <div className="empty"><div className="empty-i">∅</div><div className="empty-t">Aucune fiche applicative</div></div>
              )}
            </div>
          )}

          {activeView === "carto" && (
            <div className="cgrid">
              {domains.slice(0, 4).map((d, i) => {
                const domDocs = docs.filter(doc => doc.domain_id === d.id).slice(0, 6);
                return (
                  <div key={d.id} className="cblock" style={{
                    borderRight: i % 2 === 0 ? "1px solid rgba(28,28,28,0.07)" : "none",
                    borderBottom: i < 2 ? "1px solid rgba(28,28,28,0.07)" : "none",
                    animation: loaded ? `fadeIn 0.3s ease-out ${0.07 * i}s both` : "none",
                  }}>
                    <div className="chead">
                      <div className="csw" style={{ background: d.color }} />
                      <span className="ctitle">{d.name.toUpperCase()}</span>
                      <span className="ccnt">{d.doc_count}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {domDocs.map(item => (
                        <div key={item.id} className="citem"
                          onClick={() => navigate(`/documents/${item.slug}`)}
                          onMouseEnter={e => { e.currentTarget.style.background = d.color; e.currentTarget.style.color = d.color === "#D4952A" ? "#1C1C1C" : "#FAFAF8"; e.currentTarget.style.borderColor = d.color; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#1C1C1C"; e.currentTarget.style.borderColor = "rgba(28,28,28,0.05)"; }}
                        >
                          <span style={{ fontSize: 4, opacity: 0.3 }}>●</span> {item.title}
                        </div>
                      ))}
                      {domDocs.length === 0 && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "rgba(28,28,28,0.4)", padding: "8px 0" }}>Aucun document</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: isAuthenticated ? '1fr 1fr' : '1fr',
            borderTop: '2px solid rgba(28,28,28,0.1)',
            background: '#FBFBF9',
          }}>
            <div style={{ borderRight: isAuthenticated ? '1px solid rgba(28,28,28,0.07)' : 'none', padding: '20px' }}>
              <FeedPanel domainId={activeService || undefined} />
            </div>
            {isAuthenticated && (
              <div style={{ padding: '20px' }}>
                <ReviewPanel domainId={activeService || undefined} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
