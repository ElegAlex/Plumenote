# Design System & Homepage Refonte

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the entire PlumeNote UI with the maquette in `preparation/homepage1_code.md` — Swiss/brutaliste design system, 3-view homepage (Documents/Applications/Cartographie), sidebar with service filters + stats, inline search bar, proper header.

**Architecture:** Replace the current generic Tailwind layout (Shell/Topbar/Sidebar/HomePage) with components matching the maquette. Keep all existing functional pages (editor, reader, admin, search modal, auth) but restyle them to use the new design tokens. Backend needs 2 new endpoints: stats aggregation and public document_types listing.

**Tech Stack:** React 19, Tailwind CSS 4 (CSS-first config via `@theme`), IBM Plex Mono + IBM Plex Sans + Archivo Black (Google Fonts), existing TipTap/Meilisearch stack unchanged.

---

## Task 1: Design System Tokens (CSS + Fonts)

**Files:**
- Modify: `web/index.html`
- Modify: `web/src/index.css`

**Step 1: Add Google Fonts to index.html**

In `web/index.html`, add inside `<head>` before `<title>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

Also change `<title>` from "PlumeNote" to "PlumeNote - DSI Hub".

**Step 2: Add design tokens and base styles to index.css**

Replace `web/src/index.css` with:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --font-mono: 'IBM Plex Mono', monospace;
  --font-sans: 'IBM Plex Sans', sans-serif;
  --font-display: 'Archivo Black', sans-serif;

  --color-bg: #F7F6F3;
  --color-bg-content: #FBFBF9;
  --color-ink: #1C1C1C;
  --color-ink-70: rgba(28, 28, 28, 0.7);
  --color-ink-45: rgba(28, 28, 28, 0.45);
  --color-ink-10: rgba(28, 28, 28, 0.1);
  --color-ink-05: rgba(28, 28, 28, 0.05);
  --color-ink-hover: #FAFAF8;

  --color-blue: #2B5797;
  --color-red: #C23B22;
  --color-amber: #D4952A;
  --color-gray-dark: #404040;
  --color-gray-mid: #8B8B8B;
}

::selection {
  background: var(--color-blue);
  color: #fff;
}

body {
  font-family: var(--font-mono);
  color: var(--color-ink);
  background: var(--color-bg);
  margin: 0;
}

@keyframes slideUp {
  from { transform: translateY(14px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

**Step 3: Commit**

```bash
git add web/index.html web/src/index.css
git commit -m "feat: design system tokens — IBM Plex fonts, maquette color palette, animations"
```

---

## Task 2: Header Component

**Files:**
- Create: `web/src/components/layout/Header.tsx`
- Modify: `web/src/components/layout/Shell.tsx`

**Step 1: Create Header component matching maquette**

Create `web/src/components/layout/Header.tsx`:

```tsx
import { useState, useEffect } from 'react'

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
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  return (
    <header
      className="flex items-stretch bg-bg border-b-3 border-blue h-[58px] relative z-10"
      style={{ animation: 'fadeIn 0.35s ease-out' }}
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
            className={`px-5 flex items-center font-sans text-[12.5px] font-semibold tracking-[1.5px] uppercase cursor-pointer border-r border-ink-05 transition-all select-none relative ${
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
      <div className="ml-auto flex items-center px-6 gap-4 border-l border-ink-05 font-mono text-[11px] text-ink-70">
        <span className="font-semibold text-ink">CPAM 92</span>
        <span className="opacity-40">·</span>
        <span>{fmt(time)}</span>
      </div>
    </header>
  )
}
```

**Step 2: Commit**

```bash
git add web/src/components/layout/Header.tsx
git commit -m "feat: Header component — logo, nav tabs, clock (maquette)"
```

---

## Task 3: Inline Search Bar Component

**Files:**
- Create: `web/src/components/layout/SearchBar.tsx`

**Step 1: Create SearchBar matching maquette**

```tsx
import { useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  resultCount: number
}

export default function SearchBar({ value, onChange, resultCount }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== ref.current) {
        e.preventDefault()
        ref.current?.focus()
      }
      if (e.key === 'Escape') {
        onChange('')
        ref.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onChange])

  return (
    <div
      className="flex items-stretch border-b border-ink-10 bg-bg h-[50px]"
      style={{ animation: 'fadeIn 0.35s ease-out 0.04s both' }}
    >
      <div className="w-[50px] flex items-center justify-center border-r border-ink-05 text-ink-45 text-[15px]">
        &#x2315;
      </div>
      <input
        ref={ref}
        className="flex-1 border-none bg-transparent font-mono text-[13.5px] text-ink px-5 outline-none placeholder:text-ink-45"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher dans la documentation DSI..."
      />
      {value ? (
        <div
          className="flex items-center px-4 font-mono text-[10px] text-ink-45 border-l border-ink-05 cursor-pointer hover:text-ink"
          onClick={() => { onChange(''); ref.current?.focus() }}
        >
          &#x2715;
        </div>
      ) : (
        <div className="flex items-center px-4 font-mono text-[10px] text-ink-45 border-l border-ink-05">
          Raccourci <kbd className="border border-ink-10 px-1.5 py-px text-[10px] ml-1 rounded-sm">/</kbd>
        </div>
      )}
      <div className="flex items-center justify-center px-5 min-w-[100px] font-mono text-[11px] text-ink-45 border-l border-ink-10">
        {resultCount} resultat{resultCount !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add web/src/components/layout/SearchBar.tsx
git commit -m "feat: SearchBar component — inline search with / shortcut (maquette)"
```

---

## Task 4: Sidebar Component (Service Filters + Stats)

**Files:**
- Create: `web/src/components/layout/SidebarNew.tsx`

**Step 1: Create new Sidebar with service filters and stats grid**

```tsx
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface Domain {
  id: string
  name: string
  slug: string
  color: string
  doc_count: number
}

interface Stats {
  documents: number
  searches_month: number
  contributors: number
  updates_month: number
}

interface Props {
  activeService: string | null
  onServiceChange: (service: string | null) => void
}

export default function SidebarNew({ activeService, onServiceChange }: Props) {
  const [domains, setDomains] = useState<Domain[]>([])
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
    api.get<Stats>('/stats').then(setStats).catch(() => {})
  }, [])

  return (
    <aside className="border-r border-ink-10 flex flex-col bg-bg max-md:hidden">
      <div className="font-sans text-[9px] font-bold tracking-[3px] uppercase text-ink-45 px-5 pt-5 pb-2.5">
        Services
      </div>

      {domains.map((d) => {
        const isOn = activeService === d.id
        return (
          <div
            key={d.id}
            onClick={() => onServiceChange(isOn ? null : d.id)}
            className={`flex items-center gap-2.5 px-5 py-2.5 cursor-pointer border-b border-ink-05 transition-all select-none ${
              isOn ? 'bg-ink text-ink-hover' : 'hover:bg-ink-05'
            }`}
          >
            <div
              className="w-3 h-3 rounded-sm border-2 shrink-0"
              style={{
                backgroundColor: d.color,
                borderColor: isOn ? 'rgba(250,250,248,0.35)' : '#1C1C1C',
              }}
            />
            <span className="font-sans text-[13px] font-semibold flex-1">{d.name}</span>
            <span className="font-mono text-[10px] opacity-50">{d.doc_count}</span>
          </div>
        )
      })}

      {/* Stats grid */}
      <div className="mt-auto border-t-2 border-ink-10 grid grid-cols-2">
        {[
          { label: 'Documents', value: stats?.documents ?? 0 },
          { label: 'Recherches / mois', value: stats?.searches_month ?? 0 },
          { label: 'Contributeurs', value: stats?.contributors ?? 0 },
          { label: 'Mises a jour', value: stats?.updates_month ?? 0 },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`px-4 py-3.5 flex flex-col gap-px ${
              i % 2 === 0 ? 'border-r border-ink-05' : ''
            } border-b border-ink-05`}
          >
            <div className="font-display text-2xl leading-none">{s.value}</div>
            <div className="font-mono text-[8px] uppercase tracking-[1.5px] text-ink-45">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
```

**Step 2: Commit**

```bash
git add web/src/components/layout/SidebarNew.tsx
git commit -m "feat: SidebarNew — service filters with dots + stats grid (maquette)"
```

---

## Task 5: Backend — Stats API Endpoint

**Files:**
- Modify: `internal/server/server.go`

**Step 1: Add /api/stats endpoint**

In `internal/server/server.go`, add a new handler after the `/api/domains` handler:

```go
r.Get("/api/stats", func(w http.ResponseWriter, r *http.Request) {
    type statsResp struct {
        Documents     int `json:"documents"`
        SearchesMonth int `json:"searches_month"`
        Contributors  int `json:"contributors"`
        UpdatesMonth  int `json:"updates_month"`
    }
    var s statsResp

    // Total documents
    _ = deps.DB.QueryRow(r.Context(),
        "SELECT COUNT(*) FROM documents").Scan(&s.Documents)

    // Searches this month
    _ = deps.DB.QueryRow(r.Context(),
        "SELECT COUNT(*) FROM search_log WHERE created_at >= date_trunc('month', CURRENT_DATE)").Scan(&s.SearchesMonth)

    // Contributors (users who authored at least 1 doc)
    _ = deps.DB.QueryRow(r.Context(),
        "SELECT COUNT(DISTINCT author_id) FROM documents").Scan(&s.Contributors)

    // Updates this month
    _ = deps.DB.QueryRow(r.Context(),
        "SELECT COUNT(*) FROM documents WHERE updated_at >= date_trunc('month', CURRENT_DATE)").Scan(&s.UpdatesMonth)

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(s)
})
```

**Step 2: Add /api/document-types endpoint (public listing)**

```go
r.Get("/api/document-types", func(w http.ResponseWriter, r *http.Request) {
    rows, err := deps.DB.Query(r.Context(),
        "SELECT id, name, slug, icon, sort_order FROM document_types ORDER BY sort_order, name")
    if err != nil {
        http.Error(w, "internal error", 500)
        return
    }
    defer rows.Close()

    type dt struct {
        ID        string `json:"id"`
        Name      string `json:"name"`
        Slug      string `json:"slug"`
        Icon      string `json:"icon"`
        SortOrder int    `json:"sort_order"`
    }
    var list []dt
    for rows.Next() {
        var d dt
        if err := rows.Scan(&d.ID, &d.Name, &d.Slug, &d.Icon, &d.SortOrder); err != nil {
            continue
        }
        list = append(list, d)
    }
    if list == nil {
        list = []dt{}
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(list)
})
```

**Step 3: Commit**

```bash
git add internal/server/server.go
git commit -m "feat: /api/stats + /api/document-types public endpoints"
```

---

## Task 6: Shell Layout Refonte

**Files:**
- Modify: `web/src/components/layout/Shell.tsx`

**Step 1: Replace Shell with maquette CSS Grid layout**

The new Shell should use the Header + SearchBar + Grid(Sidebar + Content) layout for the homepage, but keep the existing layout for other pages (reader, editor, admin).

Replace `web/src/components/layout/Shell.tsx`:

```tsx
import { Outlet, useLocation } from 'react-router-dom'
import { SearchModal, useSearchModal } from '../../features/search'

export default function Shell() {
  const search = useSearchModal()
  const location = useLocation()
  const isHomepage = location.pathname === '/'

  if (isHomepage) {
    // Homepage renders its own layout (Header + SearchBar + Grid)
    return (
      <>
        <Outlet />
        <SearchModal isOpen={search.isOpen} onClose={search.close} />
      </>
    )
  }

  // Other pages: import old layout components lazily
  return <InnerShell searchModal={search} />
}

// For non-homepage routes, keep sidebar + topbar layout but restyled
function InnerShell({ searchModal }: { searchModal: { isOpen: boolean; close: () => void } }) {
  // Lazy import to avoid circular — these are the existing components, restyled
  const Sidebar = require('./Sidebar').default
  const Topbar = require('./Topbar').default

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <SearchModal isOpen={searchModal.isOpen} onClose={searchModal.close} />
    </div>
  )
}
```

Wait — `require()` won't work in ESM/Vite. Better approach: always render the full layout but let the homepage override its own content area. Let me revise.

Actually, the simplest approach: the Shell always renders, but on homepage it uses the maquette layout, on other pages it uses the sidebar+topbar layout. The homepage component (`/`) handles Header+SearchBar+Sidebar+Content internally. Non-homepage routes use the existing Sidebar+Topbar.

Revised Shell:

```tsx
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { SearchModal, useSearchModal } from '../../features/search'

export default function Shell() {
  const search = useSearchModal()
  const location = useLocation()
  const isHomepage = location.pathname === '/'

  // Homepage manages its own full layout
  if (isHomepage) {
    return (
      <>
        <Outlet />
        <SearchModal isOpen={search.isOpen} onClose={search.close} />
      </>
    )
  }

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <SearchModal isOpen={search.isOpen} onClose={search.close} />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add web/src/components/layout/Shell.tsx
git commit -m "feat: Shell layout — homepage uses full maquette layout, other pages keep sidebar+topbar"
```

---

## Task 7: Homepage — Documents View

**Files:**
- Modify: `web/src/features/home/HomePage.tsx`
- Create: `web/src/features/home/DocumentsView.tsx`

**Step 1: Create DocumentsView component**

```tsx
import { Link } from 'react-router-dom'

const TYPE_ICONS: Record<string, string> = {
  'Procedure technique': '\u25FC',
  'Guide utilisateur': '\u25E7',
  'Architecture systeme': '\u25E7',
  'FAQ': '\u25A4',
  'Troubleshooting': '\u25A4',
  'Fiche applicative': '\u25E8',
  'Documentation API': '\u25CE',
  'Autre': '\u25CB',
}

interface Domain {
  id: string
  name: string
  color: string
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
  updated_at: string
  freshness_badge: string
}

interface Props {
  docs: Doc[]
  domains: Domain[]
}

export default function DocumentsView({ docs, domains }: Props) {
  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2.5 p-15">
        <div className="font-display text-5xl text-ink-10">&empty;</div>
        <div className="font-mono text-xs text-ink-45">Aucun document correspondant</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {docs.map((doc, idx) => {
        const icon = TYPE_ICONS[doc.type_name] || '\u25CB'
        return (
          <Link
            key={doc.id}
            to={`/documents/${doc.slug}`}
            className="grid grid-cols-[46px_1fr_95px_65px_88px] items-center border-b border-ink-05 cursor-pointer transition-[background] duration-75 hover:bg-ink-05 group no-underline text-inherit max-md:grid-cols-[40px_1fr_70px]"
            style={{ animation: `slideUp 0.22s ease-out ${0.025 * idx}s both` }}
          >
            <div className="flex items-center justify-center text-sm py-3 text-ink-45 transition-colors group-hover:text-ink-70">
              {icon}
            </div>
            <div className="py-3 px-4">
              <div className="font-sans text-[13px] font-semibold text-ink group-hover:underline group-hover:underline-offset-3">
                {doc.title}
              </div>
              {doc.tags && doc.tags.length > 0 && (
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  {doc.tags.map((t) => (
                    <span key={t} className="font-mono text-[8.5px] tracking-wider text-ink-45 bg-ink-05 px-1.5 py-px uppercase">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 py-3 px-2">
              <div
                className="w-[7px] h-[7px] rounded-sm border-[1.5px] border-ink shrink-0"
                style={{ backgroundColor: doc.domain_color }}
              />
              <span className="font-mono text-[10px] text-ink-45">{doc.domain_name}</span>
            </div>
            <div className="font-mono text-[10px] tracking-[1.5px] text-ink-45 text-center max-md:hidden">
              {doc.type_name?.split(' ')[0]?.toUpperCase().slice(0, 4) || ''}
            </div>
            <div className="font-mono text-[10px] text-ink-45 text-right pr-5 max-md:hidden">
              {doc.updated_at ? new Date(doc.updated_at).toLocaleDateString('fr-FR') : ''}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add web/src/features/home/DocumentsView.tsx
git commit -m "feat: DocumentsView — document list rows matching maquette grid"
```

---

## Task 8: Homepage — Applications View

**Files:**
- Create: `web/src/features/home/ApplicationsView.tsx`

**Step 1: Create ApplicationsView**

This view shows documents of type "Fiche applicative" as app cards, matching the maquette's grid layout.

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'

interface AppDoc {
  id: string
  title: string
  slug: string
  domain_name: string
  freshness_badge: string
  view_count: number
}

interface Props {
  apps: AppDoc[]
}

const BADGE_LABELS: Record<string, string> = {
  green: 'Production',
  yellow: 'En cours',
  red: 'A verifier',
}

export default function ApplicationsView({ apps }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2.5 p-15">
        <div className="font-display text-5xl text-ink-10">&empty;</div>
        <div className="font-mono text-xs text-ink-45">Aucune fiche applicative</div>
      </div>
    )
  }

  return (
    <div className="flex-1 grid grid-cols-3 max-md:grid-cols-2">
      {apps.map((app, idx) => {
        const isHovered = hovered === app.id
        return (
          <Link
            key={app.id}
            to={`/documents/${app.slug}`}
            className="border-r border-b border-ink-05 p-6 flex flex-col gap-2.5 cursor-pointer transition-all no-underline"
            style={{
              animation: `fadeIn 0.25s ease-out ${0.05 * idx}s both`,
              background: isHovered ? '#1C1C1C' : 'transparent',
              color: isHovered ? '#FAFAF8' : '#1C1C1C',
            }}
            onMouseEnter={() => setHovered(app.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="font-display text-[26px] tracking-wider leading-tight">
              {app.title}
            </div>
            <div
              className="font-mono text-[9px] tracking-[1.5px] uppercase border-[1.5px] px-2 py-0.5 self-start transition-all"
              style={{
                borderColor: isHovered ? 'rgba(250,250,248,0.25)' : 'rgba(28,28,28,0.25)',
                color: isHovered ? 'rgba(250,250,248,0.6)' : undefined,
              }}
            >
              {BADGE_LABELS[app.freshness_badge] || 'Production'}
            </div>
            <div
              className="font-mono text-[10px] mt-auto transition-colors"
              style={{ color: isHovered ? 'rgba(250,250,248,0.3)' : 'rgba(28,28,28,0.5)' }}
            >
              {app.domain_name} &middot; {app.view_count} vue{app.view_count !== 1 ? 's' : ''}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add web/src/features/home/ApplicationsView.tsx
git commit -m "feat: ApplicationsView — app cards with hover inversion (maquette)"
```

---

## Task 9: Homepage — Cartographie View

**Files:**
- Create: `web/src/features/home/CartographieView.tsx`

**Step 1: Create CartographieView**

This view shows a 2x2 grid. For now, it groups documents by domain into 4 quadrants. Each block shows domain-colored items from documents.

```tsx
import { Link } from 'react-router-dom'

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
  domain_id: string
}

interface Props {
  domains: Domain[]
  docs: Doc[]
}

export default function CartographieView({ domains, docs }: Props) {
  // Take up to 4 domains for the 2x2 grid
  const blocks = domains.slice(0, 4).map((d) => ({
    ...d,
    items: docs.filter((doc) => doc.domain_id === d.id).slice(0, 6),
  }))

  return (
    <div className="flex-1 grid grid-cols-2 grid-rows-2">
      {blocks.map((b, i) => (
        <div
          key={b.id}
          className="p-6 flex flex-col gap-3.5"
          style={{
            borderRight: i % 2 === 0 ? '1px solid rgba(28,28,28,0.07)' : 'none',
            borderBottom: i < 2 ? '1px solid rgba(28,28,28,0.07)' : 'none',
            animation: `fadeIn 0.3s ease-out ${0.07 * i}s both`,
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-[11px] h-[11px] rounded-sm border-2 border-ink"
              style={{ backgroundColor: b.color }}
            />
            <span className="font-display text-[17px] tracking-[2px]">
              {b.name.toUpperCase()}
            </span>
            <span className="font-mono text-[10px] opacity-45 ml-auto">{b.doc_count}</span>
          </div>
          <div className="flex flex-col gap-1">
            {b.items.map((item) => (
              <Link
                key={item.id}
                to={`/documents/${item.slug}`}
                className="font-mono text-[11.5px] py-1.5 px-2.5 border border-ink-05 cursor-pointer transition-all flex items-center gap-1.5 rounded-sm no-underline text-ink hover:text-ink-hover"
                style={{ ['--hover-bg' as string]: b.color }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = b.color
                  e.currentTarget.style.color = b.color === '#D4952A' ? '#1C1C1C' : '#FAFAF8'
                  e.currentTarget.style.borderColor = b.color
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#1C1C1C'
                  e.currentTarget.style.borderColor = 'rgba(28,28,28,0.05)'
                }}
              >
                <span className="text-[4px] opacity-30">&#x25CF;</span> {item.title}
              </Link>
            ))}
            {b.items.length === 0 && (
              <div className="font-mono text-[11px] text-ink-45 py-2">Aucun document</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add web/src/features/home/CartographieView.tsx
git commit -m "feat: CartographieView — 2x2 domain grid with colored items (maquette)"
```

---

## Task 10: Homepage — Full Assembly

**Files:**
- Modify: `web/src/features/home/HomePage.tsx`

**Step 1: Rewrite HomePage to assemble all maquette components**

Replace the entire `HomePage.tsx` with the full maquette layout:

```tsx
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
    api.get<Doc[]>('/documents?limit=100&sort=recent').then(setDocs).catch(() => {})
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
        className="grid grid-cols-[240px_1fr] min-h-[calc(100vh-110px)] max-md:grid-cols-1"
        style={{ animation: 'fadeIn 0.4s ease-out 0.08s both' }}
      >
        <SidebarNew activeService={activeService} onServiceChange={setActiveService} />

        <main className="flex flex-col bg-bg-content">
          {/* Tabs */}
          <div className="flex items-center border-b border-ink-05 bg-bg">
            {['docs', 'apps', 'carto'].map((v) => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                className={`font-sans text-[11.5px] font-semibold tracking-wider uppercase px-5 py-3 cursor-pointer border-r border-ink-05 transition-all select-none relative ${
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
                className="ml-auto px-5 font-mono text-[10px] text-ink-45 cursor-pointer flex items-center gap-1.5 hover:text-red"
                onClick={() => setActiveService(null)}
              >
                {activeDomain.name} &#x2715;
              </div>
            )}
          </div>

          {/* View content */}
          {activeView === 'docs' && (
            <DocumentsView docs={filtered} domains={domains} />
          )}
          {activeView === 'apps' && <ApplicationsView apps={apps} />}
          {activeView === 'carto' && (
            <CartographieView domains={domains} docs={filtered} />
          )}
        </main>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add web/src/features/home/HomePage.tsx
git commit -m "feat: HomePage full assembly — Header + SearchBar + Sidebar + 3 views (maquette)"
```

---

## Task 11: Restyle Existing Sidebar + Topbar for Non-Homepage Pages

**Files:**
- Modify: `web/src/components/layout/Sidebar.tsx`
- Modify: `web/src/components/layout/Topbar.tsx`

**Step 1: Restyle Sidebar to use new design tokens**

Update colors/fonts in Sidebar.tsx to match the maquette palette:
- Replace `bg-white` with `bg-bg`
- Replace `border-gray-200` with `border-ink-10`
- Replace `text-gray-*` with `text-ink` / `text-ink-70` / `text-ink-45`
- Replace `bg-gray-100` with `bg-ink-05`
- Use `font-sans` for labels, `font-mono` for counts
- Keep existing functionality (domain links, admin link, mobile toggle)

**Step 2: Restyle Topbar similarly**

- Replace `bg-white` with `bg-bg`
- Replace `border-gray-200` with `border-ink-10`
- Replace `bg-blue-600` with `bg-blue`
- Replace `text-gray-*` colors with design tokens
- Add SearchModal trigger via Ctrl+K (keep existing behavior)

**Step 3: Commit**

```bash
git add web/src/components/layout/Sidebar.tsx web/src/components/layout/Topbar.tsx
git commit -m "style: restyle Sidebar + Topbar with maquette design tokens"
```

---

## Task 12: Restyle Reader, Editor, Admin Pages

**Files:**
- Various files in `web/src/features/reader/`, `web/src/features/editor/`, `web/src/features/admin/`

**Step 1: Global search-replace of Tailwind colors**

Across all feature files, replace:
- `bg-white` -> `bg-bg` or `bg-bg-content`
- `bg-gray-50` -> `bg-bg`
- `border-gray-200` / `border-gray-300` -> `border-ink-10`
- `text-gray-900` -> `text-ink`
- `text-gray-700` / `text-gray-600` -> `text-ink-70`
- `text-gray-500` / `text-gray-400` -> `text-ink-45`
- `bg-blue-600` -> `bg-blue`
- `hover:bg-blue-700` -> `hover:bg-blue/90`
- `bg-gray-100` -> `bg-ink-05`
- `hover:bg-gray-50` -> `hover:bg-ink-05`
- `focus:ring-blue-500` -> `focus:ring-blue`
- `text-red-600` -> `text-red`
- `bg-red-600` -> `bg-red`

Keep all existing functionality intact — this is purely a color/font token swap.

**Step 2: Commit**

```bash
git add web/src/features/
git commit -m "style: restyle all feature pages with maquette design tokens"
```

---

## Task 13: PublicHomePage Restyle

**Files:**
- Modify: `web/src/features/home/PublicHomePage.tsx`

**Step 1: Restyle PublicHomePage with maquette tokens**

Replace generic Tailwind colors with design tokens. The public page keeps its current structure (guides populaires grid + ticket CTA) but uses the correct fonts and colors.

**Step 2: Commit**

```bash
git add web/src/features/home/PublicHomePage.tsx
git commit -m "style: PublicHomePage with maquette design tokens"
```

---

## Task 14: Backend — Expose type_name and type_slug in Document List API

**Files:**
- Modify: `internal/document/handlers.go`

**Step 1: Add type_name and type_slug to document list response**

In the `ListDocuments` handler, JOIN document_types to include type name/slug in the response. The current query likely only returns `type_id`. Add:

```sql
LEFT JOIN document_types dt ON d.type_id = dt.id
```

And include `dt.name AS type_name, dt.slug AS type_slug` in the SELECT.

Also add `domain_name` and `domain_color` from the domains JOIN if not already present.

**Step 2: Commit**

```bash
git add internal/document/handlers.go
git commit -m "feat: document list API returns type_name, type_slug, domain_name, domain_color"
```

---

## Task 15: Final Integration Test

**Step 1: Build frontend**

```bash
cd web && npm run build
```

Verify no TypeScript/build errors.

**Step 2: Rebuild Go binary with new SPA**

```bash
cd /home/alex/Documents/REPO/PLUMENOTE_REFONTE
rm -rf cmd/plumenote/static && cp -r web/dist cmd/plumenote/static
go build ./cmd/plumenote
```

**Step 3: Visual verification**

Start the app and verify:
- [ ] Homepage shows Header with logo, nav tabs, clock
- [ ] SearchBar is inline below header with `/` shortcut
- [ ] Sidebar shows domains with colored dots and stats grid
- [ ] Documents tab shows grid rows with type icons, tags, service badge
- [ ] Applications tab shows card grid with hover inversion
- [ ] Cartographie tab shows 2x2 domain grid
- [ ] Fonts are IBM Plex Mono / Sans / Archivo Black
- [ ] Colors match palette (#F7F6F3, #2B5797, #C23B22, #D4952A)
- [ ] Grid background pattern visible at low opacity
- [ ] Reader page uses correct design tokens
- [ ] Editor page uses correct design tokens
- [ ] Admin pages use correct design tokens
- [ ] SearchModal (Ctrl+K) still works
- [ ] Login/logout still works

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: design system refonte complete — maquette conforme"
```

---

## Execution Notes

- Tasks 1-4 are frontend-only, can be done in parallel
- Task 5 (backend stats) is independent, can parallel with frontend
- Tasks 6-10 depend on Tasks 1-5
- Tasks 11-13 (restyle existing pages) are independent of each other
- Task 14 (backend type_name) should be done before Task 10 (homepage assembly)
- Task 15 is the final verification

**Estimated task count:** 15 tasks, ~60 steps total.
