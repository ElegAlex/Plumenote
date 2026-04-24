import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Plus, Search, PanelLeftOpen, LogOut, User as UserIcon, FileText, Link2, Upload, Layers } from 'lucide-react'
import { Avatar, Breadcrumb, IconButton, IconButtonDot, Input, Kbd } from '@/components/ui'
import type { BreadcrumbItem } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth-context'
import { useEntityLabel } from '@/lib/hooks'
import { useSidebar } from '@/lib/sidebar-context'

interface TopbarProps {
  /** Ouvre la SearchModal (Ctrl+K). */
  onSearchOpen: () => void
  /** Liste des domaines côté Sidebar pour enrichir le breadcrumb /domains/:slug. */
  domainsBySlug?: Record<string, string>
}

/**
 * Topbar — bandeau supérieur du Shell (motif g2 / g5).
 *
 * - Breadcrumb dérivé du pathname (mapping statique pour la Vague 1).
 * - Search (Ctrl+K) qui ouvre la SearchModal.
 * - IconButtons : Créer (+) et Notifications (stub, point coral si actif).
 * - User-chip avec dropdown Profil / Déconnexion.
 * - Bouton PanelLeftOpen à gauche quand la sidebar est masquée.
 *
 * Owne ses propres dropdowns (moins de prop drilling depuis Shell).
 */
export default function Topbar({ onSearchOpen, domainsBySlug = {} }: TopbarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const { data: entityLabelConfig } = useEntityLabel()
  const entityLabel = entityLabelConfig?.label ?? 'Fiche'
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebar()

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const createMenuRef = useRef<HTMLDivElement>(null)

  // Fermeture des dropdowns au click extérieur (logique préservée de l'ex-Shell).
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) setCreateMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Note : le raccourci Ctrl+K global est déjà géré par `useSearchModal`
  // (features/search/SearchModal.tsx). Ne pas le dupliquer ici.

  const breadcrumb = useMemo<BreadcrumbItem[]>(
    () => deriveBreadcrumb(location.pathname, domainsBySlug),
    [location.pathname, domainsBySlug],
  )

  const initials = (user?.display_name || user?.username || '??').slice(0, 2)
  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''

  return (
    <header
      className={cn(
        'sticky top-0 z-10',
        'bg-white border-b border-line',
        'flex items-center gap-5 min-h-[68px] px-8 py-3.5',
      )}
    >
      {/* Toggle sidebar quand elle est masquée */}
      {!sidebarOpen && (
        <IconButton
          aria-label="Afficher la sidebar"
          icon={<PanelLeftOpen />}
          onClick={toggleSidebar}
        />
      )}

      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumb} />

      {/* Search center */}
      <div className="flex-1 max-w-[420px] mx-auto">
        <Input
          readOnly
          tone="muted"
          placeholder="Rechercher un document, un tag, une procédure…"
          leftIcon={<Search />}
          rightSlot={
            <>
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </>
          }
          onClick={onSearchOpen}
          onFocus={(e) => { e.currentTarget.blur(); onSearchOpen() }}
          className="cursor-pointer"
          inputClassName="cursor-pointer"
        />
      </div>

      {/* Actions droite */}
      <div className="ml-auto flex items-center gap-2">
        {isAuthenticated ? (
          <>
            {/* Créer */}
            <div ref={createMenuRef} className="relative">
              <IconButton
                aria-label="Créer"
                icon={<Plus />}
                onClick={() => { setCreateMenuOpen((v) => !v); setUserMenuOpen(false) }}
              />
              {createMenuOpen && (
                <DropdownMenu>
                  <DropdownItem
                    icon={<FileText size={14} />}
                    to="/documents/new"
                    onSelect={() => setCreateMenuOpen(false)}
                  >
                    Nouvelle page
                  </DropdownItem>
                  <DropdownItem
                    icon={<Layers size={14} />}
                    to="/entities/new"
                    onSelect={() => setCreateMenuOpen(false)}
                  >
                    {entityLabel}
                  </DropdownItem>
                  <DropdownDivider />
                  <DropdownItem
                    icon={<Upload size={14} />}
                    to="/import"
                    onSelect={() => setCreateMenuOpen(false)}
                  >
                    Importer
                  </DropdownItem>
                  <DropdownItem
                    icon={<Link2 size={14} />}
                    to="/bookmarks/new"
                    onSelect={() => setCreateMenuOpen(false)}
                  >
                    Nouveau lien
                  </DropdownItem>
                </DropdownMenu>
              )}
            </div>

            {/* Notifications (stub) */}
            <IconButton
              aria-label="Notifications"
              icon={<Bell />}
              badge={<IconButtonDot />}
            />

            {/* User chip + dropdown */}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => { setUserMenuOpen((v) => !v); setCreateMenuOpen(false) }}
                className={cn(
                  'flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full',
                  'bg-white border border-line cursor-pointer',
                  'transition-colors hover:border-navy-800',
                )}
                title={user?.display_name || user?.username}
              >
                <Avatar initials={initials} size="sm" variant="a" />
                <span className="hidden md:flex flex-col items-start leading-tight text-left">
                  <span className="font-semibold text-[12.5px] text-ink">
                    {user?.display_name || user?.username}
                  </span>
                  {roleLabel && (
                    <span className="text-[10.5px] text-ink-soft">
                      {roleLabel}
                    </span>
                  )}
                </span>
              </button>
              {userMenuOpen && (
                <DropdownMenu>
                  <div className="px-4 py-2.5 border-b border-line-soft">
                    <div className="font-semibold text-[13px] text-ink leading-tight">
                      {user?.display_name || user?.username}
                    </div>
                    <div className="font-mono text-[10px] text-ink-muted mt-0.5 capitalize">
                      {user?.role}
                    </div>
                  </div>
                  <DropdownItem
                    icon={<UserIcon size={14} />}
                    to="/profile"
                    onSelect={() => setUserMenuOpen(false)}
                  >
                    Mon profil
                  </DropdownItem>
                  <DropdownDivider />
                  <DropdownItem
                    icon={<LogOut size={14} />}
                    onSelect={() => { logout(); setUserMenuOpen(false) }}
                  >
                    Déconnexion
                  </DropdownItem>
                </DropdownMenu>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-navy-700 font-semibold text-[13px] hover:text-coral transition-colors"
          >
            Connexion
          </button>
        )}
      </div>
    </header>
  )
}

/* ---------------- Breadcrumb derivation ---------------- */

const STATIC_LABELS: Record<string, string> = {
  '': 'Accueil',
  'search': 'Recherche',
  'admin': 'Administration',
  'import': 'Importer',
  'profile': 'Mon profil',
  'bookmarks': 'Liens',
  'new': 'Nouveau',
  'documents': 'Documents',
  'entities': 'Fiches',
  'domains': 'Domaines',
  'cartography': 'Cartographie',
  'mindmap': 'Mind map',
  'design-system': 'Design system',
  'folders': 'Dossier',
  'edit': 'Édition',
  'diff': 'Comparaison',
}

function deriveBreadcrumb(pathname: string, domainsBySlug: Record<string, string>): BreadcrumbItem[] {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) {
    return [{ label: 'Accueil' }]
  }

  const items: BreadcrumbItem[] = [{ label: 'Accueil', href: '/' }]

  // Cas spécifiques traitables proprement.
  if (parts[0] === 'domains' && parts[1]) {
    const slug = parts[1]
    const domainName = domainsBySlug[slug] ?? humanize(slug)
    if (parts.length === 2) {
      items.push({ label: domainName })
    } else {
      items.push({ label: domainName, href: `/domains/${slug}` })
      if (parts[2] === 'folders') {
        items.push({ label: 'Dossier' })
      }
    }
    return items
  }

  if (parts[0] === 'documents') {
    if (parts[1] === 'new') {
      items.push({ label: 'Nouveau document' })
    } else if (parts[2] === 'edit') {
      items.push({ label: 'Document', href: `/documents/${parts[1]}` })
      items.push({ label: 'Édition' })
    } else {
      items.push({ label: 'Document' })
    }
    return items
  }

  if (parts[0] === 'entities') {
    if (parts[1] === 'new') {
      items.push({ label: 'Nouvelle fiche' })
    } else if (parts[2] === 'edit') {
      items.push({ label: 'Fiche', href: `/entities/${parts[1]}` })
      items.push({ label: 'Édition' })
    } else {
      items.push({ label: 'Fiche' })
    }
    return items
  }

  if (parts[0] === 'admin') {
    items.push({ label: 'Administration', href: parts.length > 1 ? '/admin' : undefined })
    if (parts[1]) {
      items.push({ label: STATIC_LABELS[parts[1]] ?? humanize(parts[1]) })
    }
    return items
  }

  // Par défaut : mapping statique segment par segment.
  parts.forEach((segment, idx) => {
    const label = STATIC_LABELS[segment] ?? humanize(segment)
    const isLast = idx === parts.length - 1
    items.push({
      label,
      href: isLast ? undefined : '/' + parts.slice(0, idx + 1).join('/'),
    })
  })

  return items
}

function humanize(seg: string): string {
  return seg
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ---------------- Dropdown primitives (locales au Topbar) ---------------- */

function DropdownMenu({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'absolute top-full right-0 mt-1 z-[100]',
        'min-w-[220px] py-1.5 overflow-hidden',
        'bg-white border border-line rounded-xl',
        // Ombre volontairement rgba alpha (non exprimable en token).
        'shadow-[0_10px_30px_rgba(20,35,92,0.08)]',
      )}
    >
      {children}
    </div>
  )
}

function DropdownItem({
  children,
  icon,
  to,
  onSelect,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
  to?: string
  onSelect?: () => void
}) {
  const baseClasses = cn(
    'flex items-center gap-2.5 px-4 py-2.5',
    'text-[13px] font-medium text-ink',
    'hover:bg-cream-light transition-colors',
    'no-underline text-left w-full',
  )

  if (to) {
    return (
      <Link to={to} className={baseClasses} onClick={onSelect}>
        {icon && <span className="text-ink-soft">{icon}</span>}
        <span>{children}</span>
      </Link>
    )
  }

  return (
    <button type="button" className={baseClasses} onClick={onSelect}>
      {icon && <span className="text-ink-soft">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}

function DropdownDivider() {
  return <div className="h-px bg-line-soft my-1" />
}
