import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { SearchModal, useSearchModal } from '@/features/search'
import { cn } from '@/lib/cn'
import { useSidebar } from '@/lib/sidebar-context'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

/**
 * Shell — coquille applicative authentifiée (motif g2).
 *
 * Layout grid 248px | 1fr (responsive → colonne unique <= 820 px).
 * Toute la logique d'auth / search / dropdowns est désormais isolée dans
 * Topbar (menus Créer + User) et Sidebar (navigation).
 *
 * Ce composant ne conserve que :
 *   - Le montage de la SearchModal (Ctrl+K, palette globale).
 *   - Le cache des domaines chargés par la Sidebar pour enrichir le
 *     breadcrumb du Topbar (routes /domains/:slug).
 *   - Le `<Outlet />` des routes enfants.
 *
 * Note Vague 1 : le hideSidebar regex de la version précédente est supprimé.
 * La navigation est accessible sur toutes les routes authentifiées ; l'admin
 * posera sa subnav interne (Vague 4) en complément de la Sidebar.
 */
export default function Shell() {
  const search = useSearchModal()
  const { isOpen: sidebarOpen } = useSidebar()
  const [domainsBySlug, setDomainsBySlug] = useState<Record<string, string>>({})

  const handleDomainsLoaded = useCallback(
    (domains: Array<{ slug: string; name: string }>) => {
      const map: Record<string, string> = {}
      for (const d of domains) map[d.slug] = d.name
      setDomainsBySlug(map)
    },
    [],
  )

  // Le grid doit se réduire à une seule colonne quand la sidebar est masquée
  // (sinon la colonne fantôme de 248 px pousse tout le contenu en strip).
  // Breakpoint lg (1024 px) aligné sur Tailwind ; g2 collapse à 820 px, on
  // accepte ce décalage pour garder l'échelle de tokens par défaut.
  return (
    <div
      className={cn(
        'min-h-screen bg-bg text-ink font-sans grid',
        sidebarOpen ? 'grid-cols-1 lg:grid-cols-[248px_1fr]' : 'grid-cols-1',
      )}
    >
      <Sidebar
        onSearchOpen={search.open}
        onDomainsLoaded={handleDomainsLoaded}
      />

      <div className="flex flex-col min-w-0">
        <Topbar onSearchOpen={search.open} domainsBySlug={domainsBySlug} />
        <Outlet context={{ onSearchOpen: search.open } satisfies ShellOutletContext} />
      </div>

      <SearchModal isOpen={search.isOpen} onClose={search.close} />
    </div>
  )
}

/**
 * Contexte exposé aux routes enfants du Shell via `useOutletContext`.
 * Permet aux pages rendues dans l'Outlet d'ouvrir la palette de recherche
 * sans recourir à un KeyboardEvent synthétique ou à un store global.
 */
export interface ShellOutletContext {
  onSearchOpen: () => void
}
