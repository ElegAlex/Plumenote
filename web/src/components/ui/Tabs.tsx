import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'

/* ------------------------------------------------------------------ */
/* Contexte — partage activeKey + onChange + enregistrement des tabs  */
/* ------------------------------------------------------------------ */

interface TabsContextValue {
  activeKey: string
  onChange: (key: string) => void
  /** Enregistre un tab pour la navigation clavier. */
  register: (key: string, el: HTMLButtonElement | null) => void
  /** Bouge le focus vers un tab relatif (Arrow / Home / End). */
  moveFocus: (from: string, delta: 'prev' | 'next' | 'first' | 'last') => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

export interface TabsProps {
  /**
   * Clé du tab actif (pattern contrôlé). Si fourni, active le mode
   * a11y complet : Tab reçoit ses id / aria-* automatiquement et
   * <TabPanel tabKey="…"> est lié par aria-controls/aria-labelledby.
   *
   * Optionnel : si absent, Tabs fonctionne en mode legacy (chaque
   * `<Tab active onClick />` gère son état — conservé pour compat).
   */
  activeKey?: string
  /** Callback de changement d'onglet (mode contrôlé). */
  onChange?: (key: string) => void
  children: ReactNode
  /** Label ARIA pour la navigation par onglets. */
  'aria-label'?: string
  className?: string
}

/**
 * Tabs — conteneur WAI-ARIA des onglets (`role="tablist"`).
 *
 * Deux modes d'utilisation :
 *
 *  1. **A11y complet (recommandé)** : fournir `activeKey` + `onChange`,
 *     chaque `<Tab tabKey="…">` reçoit ses attributs aria-* et id,
 *     `<TabPanel tabKey="…">` est lié à son tab. Navigation clavier
 *     Arrow/Home/End wrap-around.
 *
 *     ```tsx
 *     <Tabs activeKey={active} onChange={setActive}>
 *       <Tab tabKey="profile" icon={<User />}>Profil</Tab>
 *       <Tab tabKey="sec" icon={<Shield />}>Sécurité</Tab>
 *     </Tabs>
 *     <TabPanel tabKey="profile" active={active}>…</TabPanel>
 *     <TabPanel tabKey="sec" active={active}>…</TabPanel>
 *     ```
 *
 *  2. **Legacy** : `<Tab active={…} onClick={…}>` sans `activeKey` sur
 *     le parent. Conservé pour compat, sans aria-controls/labelledby.
 *
 * Style : `bg-white border border-line rounded-xl p-1 flex gap-0.5`.
 * Gabarit de référence : g10 tabs-bar (page Compte).
 */
export function Tabs({
  activeKey,
  onChange,
  children,
  className,
  ...props
}: TabsProps) {
  const tabsRef = useRef<Map<string, HTMLButtonElement>>(new Map())

  const register = useCallback((key: string, el: HTMLButtonElement | null) => {
    if (el) {
      tabsRef.current.set(key, el)
    } else {
      tabsRef.current.delete(key)
    }
  }, [])

  const moveFocus = useCallback(
    (from: string, delta: 'prev' | 'next' | 'first' | 'last') => {
      const keys = Array.from(tabsRef.current.keys())
      if (keys.length === 0) return
      const idx = keys.indexOf(from)
      let nextIdx = idx
      if (delta === 'first') nextIdx = 0
      else if (delta === 'last') nextIdx = keys.length - 1
      else if (delta === 'next') nextIdx = idx === keys.length - 1 ? 0 : idx + 1
      else if (delta === 'prev') nextIdx = idx <= 0 ? keys.length - 1 : idx - 1
      const nextKey = keys[nextIdx]
      const nextEl = tabsRef.current.get(nextKey)
      if (nextEl && onChange) {
        onChange(nextKey)
        nextEl.focus()
      }
    },
    [onChange],
  )

  const ctxValue = useMemo<TabsContextValue | null>(() => {
    if (activeKey == null || onChange == null) return null
    return { activeKey, onChange, register, moveFocus }
  }, [activeKey, onChange, register, moveFocus])

  return (
    <TabsContext.Provider value={ctxValue}>
      <div
        role="tablist"
        className={cn(
          'inline-flex items-center gap-0.5',
          'bg-white border border-line rounded-xl p-1',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

export interface TabProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /**
   * Identifiant logique du tab (mode a11y complet).
   * Lie visuellement `<Tab tabKey="x">` et `<TabPanel tabKey="x">`.
   */
  tabKey?: string
  /** État actif (mode legacy : passé par le parent). En mode contexte,
   *  calculé automatiquement via `activeKey === tabKey`. */
  active?: boolean
  /** Icône à gauche (14 px). */
  icon?: ReactNode
  /** Pastille numérotée à droite du label (ex. compteur). */
  badge?: ReactNode
  children: ReactNode
}

function tabId(key: string) {
  return `tab-${key}`
}
function panelId(key: string) {
  return `tabpanel-${key}`
}

/**
 * Tab — onglet individuel (role="tab").
 *
 * En mode contexte (`<Tabs activeKey onChange>`) : reçoit automatiquement
 * `aria-selected`, `aria-controls`, `id`, `tabIndex` et la navigation
 * clavier ArrowLeft/Right (wrap) + Home/End.
 *
 * En mode legacy (sans contexte) : l'appelant fournit `active` +
 * `onClick` comme avant. Les ids/aria-controls sont omis.
 */
export function Tab({
  tabKey,
  active: activeProp,
  icon,
  badge,
  className,
  children,
  onClick,
  onKeyDown,
  ...props
}: TabProps) {
  const ctx = useContext(TabsContext)
  const ref = useRef<HTMLButtonElement | null>(null)

  const isContextMode = ctx != null && tabKey != null
  const active = isContextMode ? ctx.activeKey === tabKey : !!activeProp

  const setRef = useCallback(
    (el: HTMLButtonElement | null) => {
      ref.current = el
      if (isContextMode && tabKey) ctx.register(tabKey, el)
    },
    [ctx, isContextMode, tabKey],
  )

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isContextMode && tabKey) ctx.onChange(tabKey)
    onClick?.(e)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (isContextMode && tabKey) {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          ctx.moveFocus(tabKey, 'next')
          break
        case 'ArrowLeft':
          e.preventDefault()
          ctx.moveFocus(tabKey, 'prev')
          break
        case 'Home':
          e.preventDefault()
          ctx.moveFocus(tabKey, 'first')
          break
        case 'End':
          e.preventDefault()
          ctx.moveFocus(tabKey, 'last')
          break
      }
    }
    onKeyDown?.(e)
  }

  return (
    <button
      ref={setRef}
      type="button"
      role="tab"
      aria-selected={active}
      {...(isContextMode && tabKey
        ? {
            id: tabId(tabKey),
            'aria-controls': panelId(tabKey),
            tabIndex: active ? 0 : -1,
          }
        : {})}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex items-center gap-2',
        'px-4 py-[10px] rounded-lg',
        'font-semibold text-[13px] font-sans cursor-pointer',
        'transition-[background-color,color]',
        '[&_svg]:w-[14px] [&_svg]:h-[14px]',
        active
          ? 'bg-navy-900 text-white'
          : 'bg-transparent text-ink-soft hover:bg-cream-light hover:text-navy-800',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {badge != null && (
        <span
          className={cn(
            'inline-flex items-center justify-center',
            'px-[7px] py-px rounded-[5px]',
            'text-[10.5px] font-bold tabular-nums',
            active
              ? 'bg-white/20 text-cream'
              : 'bg-cream text-navy-800',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* TabPanel                                                            */
/* ------------------------------------------------------------------ */

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Identifiant logique du panneau, liant avec `<Tab tabKey="…">`. */
  tabKey: string
  /**
   * Clé active (à passer depuis le parent si on n'utilise pas le
   * contexte — nécessaire en dehors de `<Tabs activeKey>`). Si Tabs
   * est en mode contexte, ce prop peut être omis.
   */
  active?: string
  children: ReactNode
}

/**
 * TabPanel — panneau associé à un onglet (role="tabpanel").
 *
 * Attributs ARIA : `aria-labelledby={tabId}`, `id={panelId}`, `tabIndex=0`
 * (focusable au Tab après activation — le contenu est accessible clavier).
 *
 * Le panneau n'est rendu QUE si actif (pattern unmount / mount), afin de
 * préserver la sémantique des formulaires intérieurs et les effets.
 *
 * Usage (mode contexte) :
 *   <Tabs activeKey={k} onChange={setK}>
 *     <Tab tabKey="a">A</Tab><Tab tabKey="b">B</Tab>
 *   </Tabs>
 *   <TabPanel tabKey="a">…</TabPanel>
 *   <TabPanel tabKey="b">…</TabPanel>
 */
export function TabPanel({
  tabKey,
  active,
  className,
  children,
  ...props
}: TabPanelProps) {
  const ctx = useContext(TabsContext)
  const currentKey = active ?? ctx?.activeKey
  const isActive = currentKey === tabKey

  if (!isActive) return null

  return (
    <div
      role="tabpanel"
      id={panelId(tabKey)}
      aria-labelledby={tabId(tabKey)}
      tabIndex={0}
      className={cn('outline-none', className)}
      {...props}
    >
      {children}
    </div>
  )
}
