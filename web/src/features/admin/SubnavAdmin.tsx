// web/src/features/admin/SubnavAdmin.tsx
// Subnav 224px de la Console DSI (gabarit g9). Rendue DANS le contenu
// de /admin/*, à la droite du Shell primaire (navy) et à la gauche du contenu.
// Les entrées pilotent l'état `activeTab` de AdminPage ; les entrées sans
// correspondance (Rôles, Imports, Logs) restent inertes (href="#") côté V1.
import type { ReactNode } from 'react'
import {
  FileText,
  Layers,
  Settings as SettingsIcon,
  ShieldCheck,
  AlertTriangle,
  Users,
  UploadCloud,
  ListOrdered,
  BarChart2,
  GitBranch,
} from 'lucide-react'
import { cn } from '@/lib/cn'

export type AdminTabKey =
  | 'templates'
  | 'domaines'
  | 'utilisateurs'
  | 'entity-types'
  | 'relation-types'
  | 'configuration'
  | 'analytique'

interface SubnavCounts {
  users?: number
  domains?: number
  entityTypes?: number
  templates?: number
}

interface SubnavAdminProps {
  activeTab: AdminTabKey
  onSelect: (tab: AdminTabKey) => void
  counts?: SubnavCounts
  entityLabel: string
}

interface SubnavItem {
  key: AdminTabKey | 'placeholder'
  label: string
  icon: ReactNode
  tab?: AdminTabKey
  badge?: { text: string; tone?: 'default' | 'pending' }
}

/**
 * SubnavAdmin — barre secondaire de la Console DSI.
 *
 * Groupes :
 *  - Contenus (Domaines, Types de fiche, Templates, Seuils fraîcheur)
 *  - Utilisateurs (Comptes, Rôles & permissions)
 *  - Système (Imports, Logs, Analytics, Configuration)
 *
 * Les items qui ne correspondent pas à un onglet existant sont laissés
 * inertes (dead link, `<a href="#">` sans onClick). Ils deviendront actifs
 * quand les features seront livrées (V2 / V3).
 */
export default function SubnavAdmin({ activeTab, onSelect, counts, entityLabel }: SubnavAdminProps) {
  const contenus: SubnavItem[] = [
    {
      key: 'domaines',
      tab: 'domaines',
      label: 'Domaines',
      icon: <Layers size={15} strokeWidth={2} />,
      badge: counts?.domains != null ? { text: String(counts.domains) } : undefined,
    },
    {
      key: 'entity-types',
      tab: 'entity-types',
      label: `Types de ${entityLabel.toLowerCase()}`,
      icon: <FileText size={15} strokeWidth={2} />,
      badge: counts?.entityTypes != null ? { text: String(counts.entityTypes) } : undefined,
    },
    {
      key: 'templates',
      tab: 'templates',
      label: 'Templates',
      icon: <SettingsIcon size={15} strokeWidth={2} />,
      badge: counts?.templates != null ? { text: String(counts.templates), tone: 'pending' } : undefined,
    },
    {
      key: 'relation-types',
      tab: 'relation-types',
      label: 'Types de relations',
      icon: <GitBranch size={15} strokeWidth={2} />,
    },
    {
      key: 'placeholder',
      label: 'Seuils fraîcheur',
      icon: <AlertTriangle size={15} strokeWidth={2} />,
    },
  ]

  const utilisateurs: SubnavItem[] = [
    {
      key: 'utilisateurs',
      tab: 'utilisateurs',
      label: 'Comptes',
      icon: <Users size={15} strokeWidth={2} />,
      badge: counts?.users != null ? { text: String(counts.users) } : undefined,
    },
    {
      key: 'placeholder',
      label: 'Rôles & permissions',
      icon: <ShieldCheck size={15} strokeWidth={2} />,
    },
  ]

  const systeme: SubnavItem[] = [
    {
      key: 'placeholder',
      label: 'Imports',
      icon: <UploadCloud size={15} strokeWidth={2} />,
    },
    {
      key: 'placeholder',
      label: "Logs d'audit",
      icon: <ListOrdered size={15} strokeWidth={2} />,
    },
    {
      key: 'analytique',
      tab: 'analytique',
      label: 'Analytics',
      icon: <BarChart2 size={15} strokeWidth={2} />,
    },
    {
      key: 'configuration',
      tab: 'configuration',
      label: 'Configuration',
      icon: <SettingsIcon size={15} strokeWidth={2} />,
    },
  ]

  return (
    <aside
      className={cn(
        'bg-white border-r border-line',
        'px-3.5 py-[22px]',
        // Topbar du Shell = min-h 68 px, sticky top-0 z-10. On s'ancre juste en
        // dessous pour que la subnav reste visible quand le contenu défile.
        'sticky top-[68px] h-[calc(100vh-68px)] overflow-y-auto',
        'flex flex-col gap-[22px]',
        'shrink-0',
      )}
    >
      {/* subnav-brand */}
      <div className="px-2.5 pb-3.5 border-b border-line">
        <div
          className={cn(
            'mb-1.5 flex items-center gap-1.5',
            'font-sans text-[10.5px] font-bold uppercase tracking-[0.12em] text-coral',
            'before:content-["◆"] before:text-coral-soft',
          )}
        >
          Administration
        </div>
        <h2 className="font-serif font-semibold text-[19px] text-navy-900 tracking-[-0.01em] leading-tight">
          Console DSI
        </h2>
      </div>

      <SubnavGroup label="Contenus" items={contenus} activeTab={activeTab} onSelect={onSelect} />
      <SubnavGroup label="Utilisateurs" items={utilisateurs} activeTab={activeTab} onSelect={onSelect} />
      <SubnavGroup label="Système" items={systeme} activeTab={activeTab} onSelect={onSelect} />
    </aside>
  )
}

interface SubnavGroupProps {
  label: string
  items: SubnavItem[]
  activeTab: AdminTabKey
  onSelect: (tab: AdminTabKey) => void
}

function SubnavGroup({ label, items, activeTab, onSelect }: SubnavGroupProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          'px-3 pb-1.5',
          'font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted',
        )}
      >
        {label}
      </div>
      {items.map((item, i) => {
        const active = item.tab === activeTab
        const base = cn(
          'relative flex items-center gap-2.5',
          'px-3 py-[9px] rounded-lg',
          'font-sans text-[13px] font-medium',
          'transition-colors',
          active
            ? 'bg-gradient-to-r from-coral-bg to-cream-light text-navy-900 font-bold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-[18px] before:bg-coral before:rounded-r-[3px]'
            : 'text-ink hover:bg-cream-light hover:text-navy-900',
          '[&>svg]:shrink-0',
          active ? '[&>svg]:text-coral' : '[&>svg]:text-ink-soft',
        )

        if (item.tab) {
          return (
            <button
              key={`${item.key}-${i}`}
              type="button"
              onClick={() => onSelect(item.tab!)}
              className={cn(base, 'text-left cursor-pointer bg-transparent border-0 w-full')}
              aria-current={active ? 'page' : undefined}
            >
              {item.icon}
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && <SubnavBadge tone={item.badge.tone}>{item.badge.text}</SubnavBadge>}
            </button>
          )
        }
        // Dead link (feature V2/V3)
        return (
          <a
            key={`${item.key}-${i}`}
            href="#"
            onClick={(e) => e.preventDefault()}
            className={cn(base, 'no-underline opacity-60 cursor-not-allowed')}
            aria-disabled="true"
            title="Bientôt disponible"
          >
            {item.icon}
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && <SubnavBadge tone={item.badge.tone}>{item.badge.text}</SubnavBadge>}
          </a>
        )
      })}
    </div>
  )
}

function SubnavBadge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'pending' }) {
  return (
    <span
      className={cn(
        'ml-auto px-2 py-[1px] rounded-md',
        'font-sans text-[10.5px] font-bold tabular-nums',
        tone === 'pending'
          ? 'bg-warn-bg text-warn relative after:content-[""] after:absolute after:-top-[2px] after:-right-[2px] after:w-[6px] after:h-[6px] after:bg-warn after:rounded-full after:shadow-[0_0_0_2px_var(--color-white)]'
          : 'bg-cream text-navy-800',
      )}
    >
      {children}
    </span>
  )
}
