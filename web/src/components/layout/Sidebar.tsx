import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  Code2,
  FileText,
  Headphones,
  Home,
  Layers,
  Map,
  Network,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth-context'
import { useStatsHealth } from '@/lib/hooks/useStatsHealth'
import { useSidebar } from '@/lib/sidebar-context'
import FolderTree from './FolderTree'

interface Domain {
  id: string
  name: string
  slug: string
  color: string
  doc_count: number
  entity_count: number
  features_enabled: string[]
}

interface SidebarProps {
  /** Optionnel : ouvre la palette de recherche (depuis le Shell). */
  onSearchOpen?: () => void
  /** Transmis depuis Shell pour que Topbar puisse enrichir le breadcrumb. */
  onDomainsLoaded?: (domains: Domain[]) => void
}

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  infra: Zap,
  infrastructure: Zap,
  support: Headphones,
  sci: Users,
  etudes: Code2,
  'etudes-dev': Code2,
  'études-dev': Code2,
  data: BarChart3,
}

function iconForDomain(slug: string): LucideIcon {
  return DOMAIN_ICONS[slug.toLowerCase()] ?? Layers
}

/**
 * Sidebar — volet de navigation navy (g2).
 *
 * Logique préservée :
 * - Fetch `/domains` + `/stats/health`.
 * - Expansion dynamique des sous-dossiers via FolderTree (state localStorage).
 * - Routage dynamique vers `/domains/:slug`.
 *
 * Nouveautés Vague 1 :
 * - Structure en 3 sections : Navigation / Domaines / Gestion.
 * - Plume mark SVG inline, "PlumeNote" Fraunces.
 * - Badge coral soft sur compteurs, variante danger pour "À vérifier".
 * - Suppression de la grille 2×2 /stats (consommée par la home page).
 */
export default function Sidebar({ onSearchOpen, onDomainsLoaded }: SidebarProps) {
  const { isOpen, toggle } = useSidebar()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useAuth()
  const { data: health } = useStatsHealth()

  const [domains, setDomains] = useState<Domain[]>([])
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({})

  const toggleDomainExpand = useCallback((domainId: string) => {
    setExpandedDomains((prev) => ({ ...prev, [domainId]: !prev[domainId] }))
  }, [])

  useEffect(() => {
    api.get<Domain[]>('/domains').then((data) => {
      setDomains(data)
      onDomainsLoaded?.(data)
    }).catch(() => {})
  }, [onDomainsLoaded])

  const isAdmin = user?.role === 'admin'
  const isDsiOrAdmin = isAuthenticated && (user?.role === 'admin' || user?.role === 'dsi')

  const activeDomainSlug = useMemo(() => {
    const m = location.pathname.match(/^\/domains\/([^/]+)/)
    return m ? m[1] : null
  }, [location.pathname])

  const redCount = health?.red ?? 0

  if (!isOpen) return null

  return (
    <aside
      className={cn(
        'sticky top-0 h-screen overflow-y-auto',
        'w-[248px] shrink-0',
        'bg-navy-900 text-[#C9CFE4]',
        'flex flex-col gap-6',
        'py-6 px-4',
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 pb-5 border-b border-white/10">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-3 cursor-pointer text-left"
          title="Accueil"
        >
          <BrandMark />
          <span className="flex flex-col leading-tight">
            <span className="font-serif font-semibold text-[15px] text-white">PlumeNote</span>
            <span className="font-sans text-[10px] font-medium tracking-[0.1em] uppercase text-[#8A93B8] mt-0.5">
              Base de connaissances
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={toggle}
          title="Masquer la sidebar"
          aria-label="Masquer la sidebar"
          className={cn(
            'ml-auto p-1 rounded-md text-[#8A93B8]',
            'hover:text-white hover:bg-white/5 transition-colors',
          )}
        >
          <ChevronsLeft size={16} />
        </button>
      </div>

      <nav className="flex flex-col gap-[18px] flex-1">
        {/* Navigation */}
        <NavSection label="Navigation">
          <NavItem
            icon={Home}
            label="Accueil"
            active={location.pathname === '/'}
            onClick={() => navigate('/')}
          />
          <NavItem
            icon={Search}
            label="Recherche"
            onClick={onSearchOpen}
            rightSlot={<SidebarKbd>⌘ K</SidebarKbd>}
          />
          <NavItem
            icon={FileText}
            label="Mes documents"
            onClick={() => navigate('/search?filter=mine')}
          />
          <NavItem
            icon={RefreshCw}
            label="Récemment modifiés"
            onClick={() => navigate('/search?sort=recent')}
          />
          <NavItem
            icon={AlertTriangle}
            label="À vérifier"
            count={redCount > 0 ? redCount : undefined}
            countVariant="urgent"
            onClick={() => navigate('/search?status=stale')}
          />
        </NavSection>

        {/* Domaines (dynamique) */}
        {domains.length > 0 && (
          <NavSection label="Domaines">
            {domains.map((d) => {
              const Icon = iconForDomain(d.slug)
              const isActive = activeDomainSlug === d.slug
              const isExpanded = expandedDomains[d.id] ?? false
              return (
                <div key={d.id}>
                  <NavItem
                    icon={Icon}
                    label={d.name}
                    active={isActive}
                    count={d.doc_count || undefined}
                    onClick={() => navigate(`/domains/${d.slug}`)}
                    rightSlot={
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleDomainExpand(d.id)
                        }}
                        aria-label={isExpanded ? 'Replier' : 'Déplier'}
                        className={cn(
                          'ml-1 p-0.5 rounded transition-opacity opacity-60 hover:opacity-100',
                          'text-current',
                        )}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    }
                  />
                  {isExpanded && <FolderTree domainId={d.id} domainSlug={d.slug} />}
                </div>
              )
            })}
          </NavSection>
        )}

        {/* Gestion (dsi / admin) */}
        {isDsiOrAdmin && (
          <NavSection label="Gestion">
            <NavItem
              icon={Map}
              label="Cartographie"
              active={location.pathname === '/cartography'}
              onClick={() => navigate('/cartography')}
            />
            <NavItem
              icon={Network}
              label="Mind Map"
              active={location.pathname === '/mindmap'}
              onClick={() => navigate('/mindmap')}
            />
            {isAdmin && (
              <>
                <NavItem
                  icon={Sparkles}
                  label="Templates"
                  active={location.pathname.startsWith('/admin/templates')}
                  onClick={() => navigate('/admin/templates')}
                />
                <NavItem
                  icon={Settings}
                  label="Administration"
                  active={
                    location.pathname === '/admin' ||
                    (location.pathname.startsWith('/admin') && !location.pathname.startsWith('/admin/templates'))
                  }
                  onClick={() => navigate('/admin')}
                />
              </>
            )}
          </NavSection>
        )}
      </nav>

      {/* Footer santé documentaire */}
      {health && health.total > 0 && (
        <SidebarFooter
          green={health.green}
          yellow={health.yellow}
          red={health.red}
          total={health.total}
        />
      )}
    </aside>
  )
}

/* ---------------- Internals ---------------- */

function BrandMark() {
  return (
    <span
      className={cn(
        'grid place-items-center shrink-0',
        'w-10 h-10 rounded-lg',
        'bg-cream text-navy-900',
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <path d="M4 20 L 13 11" />
        <path d="M18.5 2 C 12 2.5 6.5 8 6 14.5 L 6 18 L 9.5 18 C 16 17.5 21.5 12 22 5.5 Z" />
        <path d="M9 15 L 15 9" />
      </svg>
    </span>
  )
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className={cn(
          'px-3 pb-2',
          'text-[10px] font-bold uppercase tracking-[0.14em]',
          'text-[#7A83A8]',
        )}
      >
        {label}
      </div>
      <div className="flex flex-col gap-[2px]">{children}</div>
    </div>
  )
}

interface NavItemProps {
  icon: LucideIcon
  label: string
  active?: boolean
  count?: number
  countVariant?: 'default' | 'urgent'
  onClick?: () => void
  rightSlot?: React.ReactNode
}

function NavItem({
  icon: Icon,
  label,
  active,
  count,
  countVariant = 'default',
  onClick,
  rightSlot,
}: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full text-left',
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg',
        'text-[13.5px] font-medium',
        'transition-colors',
        active
          ? cn(
              'text-white',
              'bg-gradient-to-b from-coral/20 to-coral/10',
            )
          : 'text-[#C9CFE4] hover:bg-white/5 hover:text-white',
      )}
    >
      {active && (
        <span
          className={cn(
            'absolute -left-4 top-1/2 -translate-y-1/2',
            'w-[3px] h-[22px] bg-coral',
            'rounded-r',
          )}
          aria-hidden
        />
      )}
      <Icon size={17} strokeWidth={1.8} className="shrink-0" />
      <span className="truncate flex-1">{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={cn(
            'ml-auto px-1.5 py-0.5 rounded-md',
            'text-[11px] font-bold tabular-nums',
            countVariant === 'urgent'
              ? 'bg-danger/30 text-[#F3B6BE]'
              : 'bg-coral/20 text-coral-soft',
          )}
        >
          {count}
        </span>
      )}
      {rightSlot}
    </button>
  )
}

function SidebarKbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'ml-auto px-1.5 py-0.5 rounded',
        'bg-white/10 text-[#9299BD]',
        'text-[10px] font-semibold',
      )}
    >
      {children}
    </span>
  )
}

function SidebarFooter({
  green,
  yellow,
  red,
  total,
}: {
  green: number
  yellow: number
  red: number
  total: number
}) {
  const pctGreen = (green / total) * 100
  const pctYellow = (yellow / total) * 100
  const pctRed = (red / total) * 100

  return (
    <div
      className={cn(
        'mt-auto p-3 rounded-lg',
        'bg-white/5 text-[11.5px] text-[#8A93B8] leading-snug',
      )}
    >
      <div className="font-semibold text-cream mb-2">Santé documentaire</div>
      <div className="flex h-1.5 rounded overflow-hidden bg-white/10">
        <span className="bg-success block" style={{ width: `${pctGreen}%` }} />
        <span className="bg-warn block" style={{ width: `${pctYellow}%` }} />
        <span className="bg-danger block" style={{ width: `${pctRed}%` }} />
      </div>
      <div className="flex justify-between mt-1.5 font-mono text-[10px]">
        <span>{green} à jour</span>
        <span>{yellow} tièdes</span>
        <span>{red} périmés</span>
      </div>
    </div>
  )
}
