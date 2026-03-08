import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import FeedPanel from "./FeedPanel";
import ReviewPanel from "./ReviewPanel";
import CartographyView from "@/features/entity/CartographyView";

interface Domain { id: string; name: string; slug: string; color: string; doc_count: number; entity_count: number; features_enabled: string[] }
interface Doc {
  id: string; title: string; slug: string; tags?: string[];
  domain_id: string; domain_name: string; domain_color: string;
  type_name: string; type_slug: string; updated_at: string;
  freshness_badge: string; view_count: number;
  needs_review?: boolean;
}

const TYPE_ICONS: Record<string, string> = { PDF: "\u25FC", DOC: "\u25E7", TXT: "\u25A4", XLS: "\u25E8", URL: "\u25CE" };

const TYPE_FORMAT: Record<string, string> = {
  "procedure-technique": "PDF", "guide-utilisateur": "DOC", "architecture-systeme": "DOC",
  "faq": "TXT", "troubleshooting": "TXT", "fiche-applicative": "DOC",
  "procedure-dinstallation": "PDF", "note-de-version": "TXT", "guide-reseau": "DOC",
  "documentation-api": "DOC", "autre": "TXT",
};

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState("docs");
  const [hoveredDoc, setHoveredDoc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => { setLoaded(true); }, []);

  useEffect(() => {
    api.get<Domain[]>("/domains").then(setDomains).catch(() => {});
    api.get<Doc[]>("/documents?limit=200&sort=recent").then(setDocs).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchRef.current && !["INPUT", "TEXTAREA"].includes((document.activeElement as HTMLElement)?.tagName)) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") { setSearch(""); searchRef.current?.blur(); }
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
      return matchS;
    });
  }, [docs, search]);

  const apps = useMemo(() => docs.filter(d => d.type_slug === "fiche-applicative"), [docs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 58px)", fontFamily: "'IBM Plex Mono', monospace", color: "#1C1C1C" }}>
      <style>{`
        @keyframes slideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .hp-search-bar {
          display: flex; align-items: stretch;
          border-bottom: 1px solid rgba(28,28,28,0.1);
          background: #F7F6F3; height: 50px;
        }
        .hp-search-icon { width: 50px; display: flex; align-items: center; justify-content: center; border-right: 1px solid rgba(28,28,28,0.06); color: rgba(28,28,28,0.45); font-size: 15px; }
        .hp-search-input { flex: 1; border: none; background: transparent; font-family: 'IBM Plex Mono', monospace; font-size: 13.5px; color: #1C1C1C; padding: 0 20px; outline: none; }
        .hp-search-input::placeholder { color: rgba(28,28,28,0.45); }
        .hp-search-meta { display: flex; align-items: center; padding: 0 16px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: rgba(28,28,28,0.5); border-left: 1px solid rgba(28,28,28,0.05); }
        .hp-search-meta kbd { border: 1.5px solid rgba(28,28,28,0.12); padding: 1px 6px; font-size: 10px; margin-left: 4px; border-radius: 2px; }
        .hp-search-count { display: flex; align-items: center; justify-content: center; padding: 0 20px; min-width: 100px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(28,28,28,0.6); border-left: 1px solid rgba(28,28,28,0.08); }

        .hp-tabs { display: flex; align-items: center; border-bottom: 1px solid rgba(28,28,28,0.07); background: #F7F6F3; }
        .hp-tab { font-family: 'IBM Plex Sans', sans-serif; font-size: 11.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; padding: 12px 22px; cursor: pointer; color: rgba(28,28,28,0.6); border-right: 1px solid rgba(28,28,28,0.04); transition: all 0.1s; user-select: none; position: relative; }
        .hp-tab:hover { color: #1C1C1C; }
        .hp-tab.on { color: #1C1C1C; background: #FBFBF9; }
        .hp-tab.on::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: #2B5797; }

        .hp-dlist { flex: 1; overflow-y: auto; }
        .hp-drow { display: grid; grid-template-columns: 46px 1fr 95px 65px 88px; align-items: center; border-bottom: 1px solid rgba(28,28,28,0.04); cursor: pointer; transition: background 0.08s; text-decoration: none; color: inherit; }
        .hp-drow:hover { background: rgba(28,28,28,0.02); }
        .hp-drow:hover .hp-dt { text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1.5px; }
        .hp-di { display: flex; align-items: center; justify-content: center; font-size: 14px; padding: 13px 0; color: rgba(28,28,28,0.25); transition: color 0.1s; }
        .hp-drow:hover .hp-di { color: rgba(28,28,28,0.4); }
        .hp-dm { padding: 13px 16px; }
        .hp-dt { font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; font-weight: 600; color: #1C1C1C; }
        .hp-dtags { display: flex; gap: 4px; margin-top: 3px; flex-wrap: wrap; }
        .hp-dtag { font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: 0.8px; color: rgba(28,28,28,0.5); background: rgba(28,28,28,0.06); padding: 1px 5px; text-transform: uppercase; }
        .hp-dsvc { display: flex; align-items: center; gap: 6px; padding: 13px 8px; }
        .hp-dsvc-d { width: 7px; height: 7px; border-radius: 1px; border: 1.5px solid #1C1C1C; flex-shrink: 0; }
        .hp-dsvc-l { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: rgba(28,28,28,0.55); }
        .hp-dfmt { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 1.5px; color: rgba(28,28,28,0.4); text-align: center; }
        .hp-ddate { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: rgba(28,28,28,0.4); text-align: right; padding-right: 20px; }

        .hp-agrid { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); }
        .hp-acard { border-right: 1px solid rgba(28,28,28,0.06); border-bottom: 1px solid rgba(28,28,28,0.06); padding: 26px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; transition: all 0.12s; text-decoration: none; color: inherit; }
        .hp-acard:hover { background: #1C1C1C; color: #FAFAF8; }
        .hp-acard:hover .hp-abadge { border-color: rgba(250,250,248,0.25); color: rgba(250,250,248,0.6); }
        .hp-acard:hover .hp-ahab { color: rgba(250,250,248,0.3); }
        .hp-aname { font-family: 'Archivo Black', sans-serif; font-size: 26px; letter-spacing: 1px; line-height: 1.1; }
        .hp-abadge { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; border: 1.5px solid rgba(28,28,28,0.25); padding: 3px 9px; align-self: flex-start; transition: all 0.12s; }
        .hp-ahab { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: rgba(28,28,28,0.5); margin-top: auto; transition: color 0.12s; }

        .hp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 10px; padding: 60px; }
        .hp-empty-i { font-family: 'Archivo Black', sans-serif; font-size: 48px; color: rgba(28,28,28,0.12); }
        .hp-empty-t { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: rgba(28,28,28,0.4); }

        @media (max-width: 900px) {
          .hp-drow { grid-template-columns: 40px 1fr 70px; }
          .hp-dfmt, .hp-ddate { display: none; }
          .hp-agrid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="hp-search-bar" style={{ animation: loaded ? "fadeIn 0.35s ease-out 0.04s both" : "none" }}>
        <div className="hp-search-icon">{"\u2315"}</div>
        <input ref={searchRef} className="hp-search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dans la documentation DSI..." />
        {search
          ? <div className="hp-search-meta" style={{ cursor: "pointer" }} onClick={() => { setSearch(""); searchRef.current?.focus(); }}>{"\u2715"}</div>
          : <div className="hp-search-meta">Raccourci <kbd>/</kbd></div>
        }
        <div className="hp-search-count">{filtered.length} resultat{filtered.length !== 1 ? "s" : ""}</div>
      </div>

      <div className="hp-tabs">
        {["docs", "apps", "carto"].map(v => (
          <div key={v} className={`hp-tab ${activeView === v ? "on" : ""}`} onClick={() => setActiveView(v)}>
            {v === "docs" ? "Documents" : v === "apps" ? "Applications" : "Cartographie"}
          </div>
        ))}
      </div>

      {activeView === "docs" && (
        <div className="hp-dlist">
          {filtered.length === 0 ? (
            <div className="hp-empty"><div className="hp-empty-i">{"\u2205"}</div><div className="hp-empty-t">Aucun document correspondant</div></div>
          ) : filtered.map((doc, idx) => {
            const svc = services.find(s => s.code === doc.domain_id);
            const fmt2 = TYPE_FORMAT[doc.type_slug] || "DOC";
            return (
              <div key={doc.id} className="hp-drow" onClick={() => navigate(`/documents/${doc.slug}`)}
                onMouseEnter={() => setHoveredDoc(doc.id)} onMouseLeave={() => setHoveredDoc(null)}
                style={{ animation: loaded ? `slideUp 0.22s ease-out ${0.025 * idx}s both` : "none" }}
              >
                <div className="hp-di" style={{ color: hoveredDoc === doc.id ? svc?.color : undefined }}>{TYPE_ICONS[fmt2] || "\u25CB"}</div>
                <div className="hp-dm">
                  <div className="hp-dt">
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
                      }}>A reviser</span>
                    )}
                  </div>
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="hp-dtags">{doc.tags.map(t => <span key={t} className="hp-dtag">{t}</span>)}</div>
                  )}
                </div>
                <div className="hp-dsvc"><div className="hp-dsvc-d" style={{ background: svc?.color }} /><span className="hp-dsvc-l">{svc?.label || doc.domain_name}</span></div>
                <div className="hp-dfmt">{fmt2}</div>
                <div className="hp-ddate">{doc.updated_at ? new Date(doc.updated_at).toLocaleDateString("fr-FR") : ""}</div>
              </div>
            );
          })}
        </div>
      )}

      {activeView === "apps" && (
        <div className="hp-agrid">
          {apps.map((app, idx) => (
            <div key={app.id} className="hp-acard" onClick={() => navigate(`/documents/${app.slug}`)} style={{ animation: loaded ? `fadeIn 0.25s ease-out ${0.05 * idx}s both` : "none" }}>
              <div className="hp-aname">{app.title}</div>
              <div className="hp-abadge">{app.freshness_badge === "green" ? "Production" : app.freshness_badge === "yellow" ? "En cours" : "A verifier"}</div>
              <div className="hp-ahab">{app.domain_name} · {app.view_count} vue{app.view_count !== 1 ? "s" : ""}</div>
            </div>
          ))}
          {apps.length === 0 && (
            <div className="hp-empty"><div className="hp-empty-i">{"\u2205"}</div><div className="hp-empty-t">Aucune fiche applicative</div></div>
          )}
        </div>
      )}

      {activeView === "carto" && (
        <div style={{ flex: 1, display: "flex", minHeight: 500 }}>
          <CartographyView
            onNodeClick={(id) => navigate(`/entities/${id}`)}
          />
        </div>
      )}

      {isAuthenticated && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderTop: '2px solid rgba(28,28,28,0.1)',
          background: '#FBFBF9',
        }}>
          <div style={{ borderRight: '1px solid rgba(28,28,28,0.07)', padding: '20px' }}>
            <FeedPanel />
          </div>
          <div style={{ padding: '20px' }}>
            <ReviewPanel />
          </div>
        </div>
      )}
    </div>
  );
}
