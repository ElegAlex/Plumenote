import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CornerDownLeft, Plus, Search as SearchIcon } from 'lucide-react'
import { Dialog, DialogBody, DialogFoot, DialogHead, FreshBadge, Kbd } from '@/components/ui'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { domainIcon } from './SearchPage'
import {
  DOMAIN_ICON_BG,
  DOMAIN_LABEL,
  TYPE_LABEL,
  freshLabel,
  freshStatus,
  normalizeDomain,
  normalizeType,
  sanitizeHighlight,
  type DocType,
  type Domain,
  type DomainKey,
  type DocTypeKey,
  type SearchResponse,
  type SearchResult,
} from './shared'

/* ==========================================================================
   Hook Ctrl+K — ouvre la palette globalement.
   ========================================================================== */

export function useSearchModal() {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return { isOpen, open, close }
}

/* ==========================================================================
   SearchModal — palette Ctrl+K (gabarit g4).
   Debounce 150 ms sur /api/search?q=..., navigation clavier ↑/↓/↵,
   affichage optionnel d'une bannière typo-tolérance (désactivée tant que
   l'API ne renvoie pas le champ `typo_corrected_from`).
   ========================================================================== */

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([])

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [processingTime, setProcessingTime] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [domains, setDomains] = useState<Domain[]>([])
  const [docTypes, setDocTypes] = useState<DocType[]>([])

  // Réservé : bannière typo-tolérance dès que l'API enverra le champ.
  const [typoFrom] = useState<string | null>(null)

  const queryRef = useRef(query)
  queryRef.current = query
  const totalRef = useRef(total)
  totalRef.current = total

  // Chargement des domaines / types à l'ouverture.
  useEffect(() => {
    if (!isOpen) return
    api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
    api.get<DocType[]>('/document-types').then(setDocTypes).catch(() => {})
  }, [isOpen])

  // Reset à la fermeture + focus input à l'ouverture.
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuery('')
      setResults([])
      setTotal(0)
      setProcessingTime(null)
      setSelectedIndex(0)
      setError(null)
    }
  }, [isOpen])

  // Debounce 150 ms.
  useEffect(() => {
    if (!isOpen) return
    if (query.length < 2) {
      setResults([])
      setTotal(0)
      setProcessingTime(null)
      setError(null)
      return
    }

    setIsLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, limit: '20', offset: '0' })
      api
        .get<SearchResponse>(`/search?${params}`, { signal: ctrl.signal })
        .then((data) => {
          setResults(data.results)
          setTotal(data.total)
          setProcessingTime(data.processing_time_ms)
          setSelectedIndex(0)
          setError(null)
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setResults([])
          setTotal(0)
          setError('Impossible de joindre le serveur de recherche.')
        })
        .finally(() => {
          if (ctrl.signal.aborted) return
          setIsLoading(false)
        })
    }, 150)

    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query, isOpen])

  // Analytics à la fermeture (requête ≥ 2 caractères sans click).
  const handleClose = useCallback(() => {
    if (queryRef.current.length >= 2) {
      api
        .post('/analytics/search-log', {
          query: queryRef.current,
          result_count: totalRef.current,
        })
        .catch(() => {})
    }
    onClose()
  }, [onClose])

  // Lookup id → clé normalisée.
  const domainIdToKey = useMemo(() => {
    const m = new Map<string, DomainKey>()
    for (const d of domains) m.set(d.id, normalizeDomain(d.name || d.slug))
    return m
  }, [domains])

  const typeIdToKey = useMemo(() => {
    const m = new Map<string, DocTypeKey>()
    for (const t of docTypes) m.set(t.id, normalizeType(t.name))
    return m
  }, [docTypes])

  // Navigation vers un résultat + analytics + close.
  const openResult = useCallback(
    (result: SearchResult) => {
      api
        .post('/analytics/search-log', {
          query: queryRef.current,
          result_count: totalRef.current,
          clicked_document_id: result.id,
        })
        .catch(() => {})

      if (result.object_type === 'bookmark' && result.url) {
        window.open(result.url, '_blank')
      } else if (result.object_type === 'entity') {
        navigate(`/entities/${result.id}`)
      } else {
        const target = result.slug ? `/documents/${result.slug}` : `/documents/${result.id}`
        navigate(target)
      }
      onClose()
    },
    [navigate, onClose],
  )

  // Action "Créer la page" : toujours présente si une requête est saisie.
  const canCreate = query.trim().length >= 2
  const createAction = useCallback(() => {
    navigate(`/documents/new?title=${encodeURIComponent(query.trim())}`)
    onClose()
  }, [navigate, onClose, query])

  // Total virtuel (résultats + action de création si disponible).
  const virtualCount = results.length + (canCreate ? 1 : 0)

  // Navigation clavier. On ne passe plus par Escape (géré par Dialog).
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev >= virtualCount - 1 ? 0 : prev + 1
          requestAnimationFrame(() => {
            itemRefs.current[next]?.scrollIntoView({ block: 'nearest' })
          })
          return next
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev <= 0 ? Math.max(0, virtualCount - 1) : prev - 1
          requestAnimationFrame(() => {
            itemRefs.current[next]?.scrollIntoView({ block: 'nearest' })
          })
          return next
        })
      } else if (e.key === 'Enter') {
        if (selectedIndex < results.length && results[selectedIndex]) {
          e.preventDefault()
          openResult(results[selectedIndex])
        } else if (canCreate && selectedIndex === results.length) {
          e.preventDefault()
          createAction()
        }
      }
    },
    [virtualCount, selectedIndex, results, canCreate, openResult, createAction],
  )

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      aria-label="Recherche globale"
      className="max-h-[calc(100vh-160px)]"
    >
      {/* onKeyDown au niveau du modal pour capter ↑/↓/Entrée */}
      <div onKeyDown={handleKeyDown} className="flex flex-col min-h-0">
        <DialogHead className="gap-3.5 px-[22px] py-[18px]">
          <SearchIcon className="w-[22px] h-[22px] text-navy-700 shrink-0" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans la base de connaissances…"
            className="flex-1 border-none outline-none bg-transparent text-[17px] text-ink placeholder:text-ink-muted"
            aria-label="Requête de recherche"
          />
          {isLoading && (
            <span
              aria-hidden
              className="w-4 h-4 border-2 border-navy-700 border-t-transparent rounded-full animate-spin shrink-0"
            />
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1.5',
              'border border-line bg-bg rounded-md',
              'text-[11px] font-bold text-ink-soft',
              'hover:border-navy-600 transition-colors',
            )}
          >
            esc
          </button>
        </DialogHead>

        {typoFrom && (
          <div className="flex items-center gap-2 bg-warn-bg px-[22px] py-2 border-b border-line-soft text-[12px] font-semibold text-warn">
            <AlertTriangle className="w-[13px] h-[13px] shrink-0" aria-hidden />
            <span>
              Faute de frappe corrigée : recherche étendue sur{' '}
              <strong className="text-warn">« {query} »</strong>
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 bg-danger-bg px-[22px] py-2 border-b border-line-soft text-[12px] font-semibold text-danger"
          >
            <AlertTriangle className="w-[13px] h-[13px] shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <DialogBody
          className="px-0 py-0 max-h-[60vh]"
          role="listbox"
          aria-label="Résultats de recherche"
        >
          {results.length > 0 && (
            <>
              <GroupLabel>
                Documents · {total} résultat{total !== 1 ? 's' : ''}
              </GroupLabel>
              {results.map((result, i) => (
                <PaletteItem
                  key={result.id}
                  ref={(el) => {
                    itemRefs.current[i] = el
                  }}
                  focused={i === selectedIndex}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={(e) => {
                    e.preventDefault()
                    openResult(result)
                  }}
                  domainKey={
                    domainIdToKey.get(result.domain_id) ??
                    normalizeDomain(result.domain_name || undefined)
                  }
                  title={result.title}
                  meta={
                    <>
                      {DOMAIN_LABEL[
                        domainIdToKey.get(result.domain_id) ??
                          normalizeDomain(result.domain_name || undefined)
                      ]}{' '}
                      · {TYPE_LABEL[typeIdToKey.get(result.type_id) ?? 'guide']}
                      {' · '}
                      <FreshBadge status={freshStatus(result.freshness_badge)} inline>
                        {freshLabel(result.freshness_badge).toLowerCase()}
                      </FreshBadge>
                      {result.view_count > 0 && <> · {result.view_count} vues</>}
                    </>
                  }
                />
              ))}
            </>
          )}

          {canCreate && (
            <>
              <GroupLabel>Actions · 1</GroupLabel>
              <PaletteActionCreate
                ref={(el) => {
                  itemRefs.current[results.length] = el
                }}
                focused={selectedIndex === results.length}
                onMouseEnter={() => setSelectedIndex(results.length)}
                onClick={(e) => {
                  e.preventDefault()
                  createAction()
                }}
                query={query.trim()}
              />
            </>
          )}

          {query.length >= 2 && results.length === 0 && !isLoading && (
            <div className="px-[22px] py-10 text-center text-[13px] text-ink-soft">
              Aucun résultat pour <strong className="text-navy-900">« {query} »</strong>.
              <br />
              Essayez d'autres mots-clés ou créez la page.
            </div>
          )}

          {query.length < 2 && (
            <div className="px-[22px] py-10 text-center text-[13px] text-ink-muted">
              Commencez à taper pour rechercher…
            </div>
          )}
        </DialogBody>

        <DialogFoot
          className={cn(
            'justify-between px-[22px] py-3',
            'bg-bg border-t border-line-soft',
            'text-[11.5px] text-ink-muted',
          )}
        >
          <div className="flex items-center gap-[18px]">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> Naviguer
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↵</Kbd> Ouvrir
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>esc</Kbd> Fermer
            </span>
          </div>
          <span>
            Meilisearch · typo-tolérant
            {processingTime !== null && <> · {processingTime} ms</>}
          </span>
        </DialogFoot>
      </div>
    </Dialog>
  )
}

/* ==========================================================================
   Sub-components
   ========================================================================== */

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-[22px] pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
      {children}
    </div>
  )
}

interface PaletteItemProps {
  focused: boolean
  onMouseEnter?: () => void
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  domainKey: DomainKey
  title: string
  meta: React.ReactNode
}

const PaletteItem = forwardRef<HTMLAnchorElement, PaletteItemProps>(function PaletteItem(
  { focused, onMouseEnter, onClick, domainKey, title, meta },
  ref,
) {
  return (
    <a
      ref={ref}
      href="#"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-selected={focused}
      className={cn(
        'relative grid grid-cols-[auto_1fr_auto] gap-3 items-center',
        'px-[22px] py-2.5 no-underline text-inherit',
        'transition-colors duration-100',
        focused ? 'bg-cream-light' : 'hover:bg-cream-light',
      )}
    >
      {focused && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] bg-coral rounded-r-[3px]"
        />
      )}
      <span
        className={cn(
          'w-8 h-8 rounded-lg grid place-items-center [&_svg]:w-[15px] [&_svg]:h-[15px]',
          DOMAIN_ICON_BG[domainKey],
        )}
        aria-hidden
      >
        {domainIcon(domainKey)}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block text-[13.5px] font-semibold leading-[1.3] text-ink truncate',
            '[&_mark]:bg-warn-bg [&_mark]:text-warn [&_mark]:rounded-[3px] [&_mark]:px-0.5',
            '[&_mark]:font-bold',
          )}
          dangerouslySetInnerHTML={{ __html: sanitizeHighlight(title) }}
        />
        <span className="block mt-0.5 text-[11.5px] text-ink-soft">{meta}</span>
      </span>
      {focused && (
        <span
          className="inline-flex items-center gap-1 text-[11px] text-ink-muted"
          aria-hidden
        >
          <Kbd>
            <CornerDownLeft className="w-3 h-3" />
          </Kbd>
        </span>
      )}
    </a>
  )
})

interface PaletteActionCreateProps {
  focused: boolean
  onMouseEnter?: () => void
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  query: string
}

const PaletteActionCreate = forwardRef<HTMLAnchorElement, PaletteActionCreateProps>(
  function PaletteActionCreate({ focused, onMouseEnter, onClick, query }, ref) {
    return (
      <a
        ref={ref}
        href="#"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        role="option"
        aria-selected={focused}
        className={cn(
          'relative grid grid-cols-[auto_1fr_auto] gap-3 items-center',
          'px-[22px] py-2.5 no-underline text-inherit',
          'transition-colors duration-100',
          focused ? 'bg-cream-light' : 'hover:bg-cream-light',
        )}
      >
        {focused && (
          <span
            aria-hidden
            className="absolute left-0 top-2 bottom-2 w-[3px] bg-coral rounded-r-[3px]"
          />
        )}
        <span className="w-8 h-8 rounded-lg grid place-items-center bg-coral-bg text-coral [&_svg]:w-[15px] [&_svg]:h-[15px]">
          <Plus />
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold leading-[1.3] text-ink truncate">
            Créer la page « {query} »
          </span>
          <span className="block mt-0.5 text-[11.5px] text-ink-soft">
            Démarrer un nouveau document vierge
          </span>
        </span>
        {focused && (
          <span
            className="inline-flex items-center gap-1 text-[11px] text-ink-muted"
            aria-hidden
          >
            <Kbd>
              <CornerDownLeft className="w-3 h-3" />
            </Kbd>
          </span>
        )}
      </a>
    )
  },
)

