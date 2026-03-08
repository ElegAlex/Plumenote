import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import FeedPanel from "./FeedPanel";
import ReviewPanel from "./ReviewPanel";
import FreshnessBadge from "./FreshnessBadge";
import TimeAgo from "./TimeAgo";

interface Doc {
  id: string; title: string; slug: string;
  domain_id: string; domain_name: string; domain_color: string;
  freshness_badge: 'green' | 'yellow' | 'red';
  updated_at: string;
}

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [recentDocs, setRecentDocs] = useState<Doc[]>([]);

  useEffect(() => { setLoaded(true); }, []);

  useEffect(() => {
    api.get<Doc[]>("/documents?limit=20&sort=recent").then(setRecentDocs).catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 58px)", fontFamily: "'IBM Plex Sans', sans-serif", color: "#1C1C1C" }}>
      <style>{`
        @keyframes slideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .hp-section-title {
          font-family: 'IBM Plex Sans', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 2px; text-transform: uppercase; color: rgba(28,28,28,0.6);
          margin-bottom: 12px;
        }

        .hp-doc-row {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(28,28,28,0.04);
          cursor: pointer; transition: background 0.08s;
        }
        .hp-doc-row:hover { background: rgba(28,28,28,0.02); }
        .hp-doc-row:hover .hp-doc-title { text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1.5px; }

        .hp-doc-domain-dot {
          width: 8px; height: 8px; border-radius: 2px;
          border: 1.5px solid #1C1C1C; flex-shrink: 0;
        }
        .hp-doc-title {
          font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; font-weight: 600;
          color: #1C1C1C; flex: 1; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .hp-doc-domain-label {
          font-family: 'IBM Plex Mono', monospace; font-size: 10px;
          color: rgba(28,28,28,0.5); flex-shrink: 0;
        }
        @media (max-width: 900px) {
          .hp-panels-grid { grid-template-columns: 1fr !important; }
          .hp-doc-domain-label { display: none; }
        }
      `}</style>

      {/* Feed + Review panels */}
      {isAuthenticated && (
        <div className="hp-panels-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: '2px solid rgba(28,28,28,0.1)',
          background: '#FBFBF9',
          animation: loaded ? "fadeIn 0.35s ease-out 0.1s both" : "none",
        }}>
          <div style={{ borderRight: '1px solid rgba(28,28,28,0.07)', padding: '20px' }}>
            <FeedPanel />
          </div>
          <div style={{ padding: '20px' }}>
            <ReviewPanel />
          </div>
        </div>
      )}

      {/* Documents récents */}
      <div style={{
        padding: '24px 24px 40px',
        background: '#FBFBF9',
        flex: 1,
        animation: loaded ? "fadeIn 0.35s ease-out 0.15s both" : "none",
      }}>
        <div className="hp-section-title">Documents recents</div>

        {recentDocs.length === 0 ? (
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
            color: 'rgba(28,28,28,0.4)', padding: '30px 0', textAlign: 'center',
          }}>
            Aucun document
          </div>
        ) : (
          recentDocs.map((doc, idx) => (
            <div
              key={doc.id}
              className="hp-doc-row"
              onClick={() => navigate(`/documents/${doc.slug}`)}
              style={{ animation: loaded ? `slideUp 0.22s ease-out ${0.025 * idx}s both` : "none" }}
            >
              <div className="hp-doc-domain-dot" style={{ background: doc.domain_color }} />
              <span className="hp-doc-title">{doc.title}</span>
              <span className="hp-doc-domain-label">{doc.domain_name}</span>
              <FreshnessBadge badge={doc.freshness_badge} />
              <TimeAgo date={doc.updated_at} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
