import { useState, useEffect, useRef } from "react";

const DOCS = [
  { id: 1, title: "Installation ProWeb v4.2", service: "SCI", type: "PDF", date: "2026-03-01", tags: ["ProWeb", "installation", "configuration"] },
  { id: 2, title: "Architecture SUCRE — Schéma global", service: "DEV", type: "DOC", date: "2026-02-28", tags: ["SUCRE", "architecture", "schéma"] },
  { id: 3, title: "Procédure déploiement serveur Linux", service: "INFRA", type: "TXT", date: "2026-02-25", tags: ["Linux", "déploiement", "serveur"] },
  { id: 4, title: "Mode opératoire — Ticket N2 réseau", service: "SUPPORT", type: "PDF", date: "2026-02-20", tags: ["ticket", "réseau", "N2"] },
  { id: 5, title: "Habilitations Passeport — Matrice", service: "GOUV", type: "XLS", date: "2026-02-18", tags: ["Passeport", "habilitations", "matrice"] },
  { id: 6, title: "Documentation API BookStack", service: "DEV", type: "DOC", date: "2026-02-15", tags: ["BookStack", "API", "documentation"] },
  { id: 7, title: "Cartographie serveurs Île-de-France", service: "INFRA", type: "XLS", date: "2026-02-10", tags: ["cartographie", "serveurs", "IDF"] },
  { id: 8, title: "Guide utilisateur Portail DFC", service: "DEV", type: "PDF", date: "2026-02-08", tags: ["DFC", "portail", "utilisateur"] },
  { id: 9, title: "Script migration Windows 11", service: "INFRA", type: "TXT", date: "2026-02-05", tags: ["Windows 11", "migration", "script"] },
  { id: 10, title: "Référentiel applications locales", service: "GOUV", type: "DOC", date: "2026-01-30", tags: ["référentiel", "applications", "PAL"] },
  { id: 11, title: "Procédure PEI — Continuité activité", service: "SUPPORT", type: "PDF", date: "2026-01-28", tags: ["PEI", "continuité", "crise"] },
  { id: 12, title: "Configuration VPN accès distant", service: "INFRA", type: "TXT", date: "2026-01-22", tags: ["VPN", "accès", "distant"] },
];

const APPS = [
  { name: "ProWeb", status: "Production", habilitation: "Passeport" },
  { name: "SUCRE", status: "Production", habilitation: "Passeport" },
  { name: "BookStack", status: "Déploiement", habilitation: "Local" },
  { name: "Chanel", status: "En cours", habilitation: "Passeport" },
  { name: "RESSAC", status: "Production", habilitation: "Passeport" },
  { name: "Ameli Réseau", status: "Production", habilitation: "National" },
];

const SERVICES = [
  { code: "SCI", label: "SCI", color: "#C23B22", count: 47 },
  { code: "DEV", label: "Études & Dev", color: "#2B5797", count: 63 },
  { code: "INFRA", label: "Infrastructure", color: "#D4952A", count: 38 },
  { code: "SUPPORT", label: "Support", color: "#404040", count: 29 },
  { code: "GOUV", label: "Gouvernance", color: "#8B8B8B", count: 15 },
];

const TYPE_ICONS = { PDF: "◼", DOC: "◧", TXT: "▤", XLS: "◨", URL: "◎" };

const STATS = [
  { label: "Documents", value: 192, trend: "+12" },
  { label: "Recherches / mois", value: 847, trend: "+23%" },
  { label: "Contributeurs", value: 24 },
  { label: "Mises à jour", value: 31, trend: "mars" },
];

export default function DSIHub() {
  const [search, setSearch] = useState("");
  const [activeService, setActiveService] = useState(null);
  const [activeView, setActiveView] = useState("docs");
  const [hoveredDoc, setHoveredDoc] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [time, setTime] = useState(new Date());
  const searchRef = useRef(null);

  useEffect(() => { setLoaded(true); const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "/" && document.activeElement !== searchRef.current) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") { setSearch(""); setActiveService(null); searchRef.current?.blur(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = DOCS.filter((d) => {
    const s = search.toLowerCase();
    const matchS = !s || d.title.toLowerCase().includes(s) || d.tags.some((t) => t.toLowerCase().includes(s));
    const matchSvc = !activeService || d.service === activeService;
    return matchS && matchSvc;
  });

  const fmt = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

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
        .drow { display: grid; grid-template-columns: 46px 1fr 95px 65px 88px; align-items: center; border-bottom: 1px solid rgba(28,28,28,0.04); cursor: pointer; transition: background 0.08s; }
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
        .acard { border-right: 1px solid rgba(28,28,28,0.06); border-bottom: 1px solid rgba(28,28,28,0.06); padding: 26px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; transition: all 0.12s; }
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
        .citem { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; padding: 7px 11px; border: 1px solid rgba(28,28,28,0.05); cursor: pointer; transition: all 0.1s; display: flex; align-items: center; gap: 7px; border-radius: 1px; }

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
            <div className="logo-title">DSI · HUB</div>
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
          <span style={{ fontWeight: 600, color: "#1C1C1C" }}>CPAM 92</span>
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
          {SERVICES.map(s => (
            <div key={s.code} className={`svc ${activeService === s.code ? "on" : ""}`} onClick={() => setActiveService(activeService === s.code ? null : s.code)}>
              <div className="svc-dot" style={{ background: s.color }} />
              <span className="svc-name">{s.label}</span>
              <span className="svc-n">{s.count}</span>
            </div>
          ))}
          <div className="stats">
            {STATS.map((s, i) => (
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
            {activeService && <div className="fpill" onClick={() => setActiveService(null)}>{SERVICES.find(s => s.code === activeService)?.label} ✕</div>}
          </div>

          {activeView === "docs" && (
            <div className="dlist">
              {filtered.length === 0 ? (
                <div className="empty"><div className="empty-i">∅</div><div className="empty-t">Aucun document correspondant</div></div>
              ) : filtered.map((doc, idx) => {
                const svc = SERVICES.find(s => s.code === doc.service);
                return (
                  <div key={doc.id} className="drow"
                    onMouseEnter={() => setHoveredDoc(doc.id)} onMouseLeave={() => setHoveredDoc(null)}
                    style={{ animation: loaded ? `slideUp 0.22s ease-out ${0.025 * idx}s both` : "none" }}
                  >
                    <div className="di" style={{ color: hoveredDoc === doc.id ? svc?.color : undefined }}>{TYPE_ICONS[doc.type]}</div>
                    <div className="dm">
                      <div className="dt">{doc.title}</div>
                      <div className="dtags">{doc.tags.map(t => <span key={t} className="dtag">{t}</span>)}</div>
                    </div>
                    <div className="dsvc"><div className="dsvc-d" style={{ background: svc?.color }} /><span className="dsvc-l">{doc.service}</span></div>
                    <div className="dfmt">{doc.type}</div>
                    <div className="ddate">{doc.date}</div>
                  </div>
                );
              })}
            </div>
          )}

          {activeView === "apps" && (
            <div className="agrid">
              {APPS.map((app, idx) => (
                <div key={app.name} className="acard" style={{ animation: loaded ? `fadeIn 0.25s ease-out ${0.05 * idx}s both` : "none" }}>
                  <div className="aname">{app.name}</div>
                  <div className="abadge">{app.status}</div>
                  <div className="ahab">Habilitation : {app.habilitation}</div>
                </div>
              ))}
            </div>
          )}

          {activeView === "carto" && (
            <div className="cgrid">
              {[
                { title: "SERVEURS", count: 47, color: "#D4952A", items: ["SRV-PROD-01", "SRV-DEV-02", "SRV-BOOKSTACK", "SRV-AM2CLOUD"] },
                { title: "APPLICATIFS", count: 63, color: "#2B5797", items: ["ProWeb", "SUCRE", "RESSAC", "Chanel", "BookStack"] },
                { title: "HÉBERGEMENT", count: 12, color: "#C23B22", items: ["Local CPAM 92", "AM2Cloud", "National CNAM"] },
                { title: "RÉSEAUX", count: 8, color: "#404040", items: ["LAN CPAM", "VPN Distant", "Ameli Réseau"] },
              ].map((b, i) => (
                <div key={b.title} className="cblock" style={{
                  borderRight: i % 2 === 0 ? "1px solid rgba(28,28,28,0.07)" : "none",
                  borderBottom: i < 2 ? "1px solid rgba(28,28,28,0.07)" : "none",
                  animation: loaded ? `fadeIn 0.3s ease-out ${0.07 * i}s both` : "none",
                }}>
                  <div className="chead">
                    <div className="csw" style={{ background: b.color }} />
                    <span className="ctitle">{b.title}</span>
                    <span className="ccnt">{b.count}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {b.items.map(item => (
                      <div key={item} className="citem"
                        onMouseEnter={e => { e.currentTarget.style.background = b.color; e.currentTarget.style.color = b.color === "#D4952A" ? "#1C1C1C" : "#FAFAF8"; e.currentTarget.style.borderColor = b.color; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#1C1C1C"; e.currentTarget.style.borderColor = "rgba(28,28,28,0.05)"; }}
                      >
                        <span style={{ fontSize: 4, opacity: 0.3 }}>●</span> {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}