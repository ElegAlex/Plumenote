import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

// --- Types ---

interface SearchResult {
  id: string
  title: string
  body_text_highlight: string
  domain_id: string
  type_id: string
  visibility: string
  tags: string[]
  author_name: string
  view_count: number
  freshness_badge: 'green' | 'yellow' | 'red'
  created_at: string
  slug?: string
  attachment_count?: number
}

interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
  processing_time_ms: number
}

interface Domain {
  id: string
  name: string
  slug: string
  color: string
}

// --- Hook ---

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

// --- HTML sanitizer for Meilisearch highlights (only allow <mark> tags) ---

function sanitizeHighlight(html: string): string {
  // Replace all tags except <mark> and </mark> with escaped versions
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi, (match, tag) => {
    if (tag.toLowerCase() === 'mark') return match
    return match.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  })
}

// --- Freshness badge ---

const FRESHNESS: Record<string, { icon: string; label: string; className: string }> = {
  green: { icon: '\u{1F7E2}', label: 'A jour', className: 'text-green-600' },
  yellow: { icon: '\u{1F7E1}', label: 'A verifier', className: 'text-orange-500' },
  red: { icon: '\u{1F534}', label: 'Obsolete', className: 'text-red-600' },
}

// --- Component ---

export default function SearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [processingTime, setProcessingTime] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const [domainFilter, setDomainFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [domains, setDomains] = useState<Domain[]>([])
  const resultRefs = useRef<(HTMLDivElement | null)[]>([])
  const queryRef = useRef(query)
  queryRef.current = query
  const totalRef = useRef(total)
  totalRef.current = total

  // Load domains on mount
  useEffect(() => {
    if (isOpen) {
      api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
    }
  }, [isOpen])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      // Reset state on close
      setQuery('')
      setResults([])
      setTotal(0)
      setProcessingTime(null)
      setSelectedIndex(-1)
      setDomainFilter('')
      setTypeFilter('')
    }
  }, [isOpen])

  // Search with debounce
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setTotal(0)
      setProcessingTime(null)
      return
    }

    setIsLoading(true)
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, limit: '20', offset: '0' })
      if (domainFilter) params.set('domain', domainFilter)
      if (typeFilter) params.set('type', typeFilter)

      api
        .get<SearchResponse>(`/search?${params}`)
        .then((data) => {
          setResults(data.results)
          setTotal(data.total)
          setProcessingTime(data.processing_time_ms)
          setSelectedIndex(-1)
        })
        .catch(() => {
          setResults([])
          setTotal(0)
        })
        .finally(() => setIsLoading(false))
    }, 200)

    return () => clearTimeout(timer)
  }, [query, domainFilter, typeFilter])

  // Log analytics on close (without click)
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

  // Navigate to result
  const openResult = useCallback(
    (result: SearchResult) => {
      api
        .post('/analytics/search-log', {
          query: queryRef.current,
          result_count: totalRef.current,
          clicked_document_id: result.id,
        })
        .catch(() => {})
      const target = result.slug ? `/documents/${result.slug}` : `/documents/${result.id}`
      navigate(target)
      onClose()
    },
    [navigate, onClose],
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev >= results.length - 1 ? 0 : prev + 1
          resultRefs.current[next]?.scrollIntoView({ block: 'nearest' })
          return next
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => {
          if (prev <= 0) {
            inputRef.current?.focus()
            return -1
          }
          const next = prev - 1
          resultRefs.current[next]?.scrollIntoView({ block: 'nearest' })
          return next
        })
      } else if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
        e.preventDefault()
        openResult(results[selectedIndex])
      }
    },
    [results, selectedIndex, handleClose, openResult],
  )

  // Backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) handleClose()
    },
    [handleClose],
  )

  const hasActiveFilter = domainFilter || typeFilter
  const hasResults = query.length >= 2

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-[600px] bg-white rounded-xl shadow-2xl flex flex-col max-h-[70vh]">
        {/* Search input */}
        <div className="flex items-center border-b px-4">
          <svg
            className="w-5 h-5 text-gray-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans la base de connaissances..."
            className="flex-1 text-lg py-3 px-3 outline-none bg-transparent"
          />
          {isLoading && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0 mr-2" />
          )}
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 shrink-0 p-1"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-4 py-2 border-b text-sm">
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm bg-white"
          >
            <option value="">Tous les domaines</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm bg-white"
          >
            <option value="">Tous les types</option>
            <option value="procedure">Procedure</option>
            <option value="guide">Guide</option>
            <option value="faq">FAQ</option>
            <option value="architecture">Architecture</option>
            <option value="runbook">Runbook</option>
          </select>
          {hasActiveFilter && (
            <button
              onClick={() => {
                setDomainFilter('')
                setTypeFilter('')
              }}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Reinitialiser
            </button>
          )}
        </div>

        {/* Results info */}
        {hasResults && processingTime !== null && (
          <div className="px-4 py-1.5 text-xs text-gray-500">
            {total} resultat{total !== 1 ? 's' : ''} en {(processingTime / 1000).toFixed(1)}s
          </div>
        )}

        {/* Results list */}
        <div className="overflow-y-auto flex-1">
          {hasResults && results.length === 0 && !isLoading && (
            <div className="px-4 py-8 text-center text-gray-500">
              <p>
                Aucun resultat pour &laquo;&nbsp;{query}&nbsp;&raquo;. Essayez avec d&apos;autres
                mots-cles ou creez une page.
              </p>
              <button
                onClick={() => {
                  navigate(`/documents/new?title=${encodeURIComponent(query)}`)
                  onClose()
                }}
                className="mt-3 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
              >
                + Creer cette page
              </button>
            </div>
          )}

          {results.map((result, i) => {
            const fresh = FRESHNESS[result.freshness_badge] || FRESHNESS.green
            const domain = domains.find((d) => d.id === result.domain_id)
            const isSelected = i === selectedIndex

            return (
              <div
                key={result.id}
                ref={(el) => {
                  resultRefs.current[i] = el
                }}
                onClick={() => openResult(result)}
                className={`py-3 px-4 cursor-pointer transition ${
                  isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                {/* Title + freshness */}
                <div className="flex items-center gap-2">
                  <span
                    className="font-semibold text-gray-900"
                    dangerouslySetInnerHTML={{ __html: sanitizeHighlight(result.title) }}
                  />
                  <span className={`text-xs ${fresh.className}`}>{fresh.icon}</span>
                </div>

                {/* Meta line */}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {domain && (
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: domain.color }}
                      />
                      {domain.name}
                    </span>
                  )}
                  {result.author_name && <span>par {result.author_name}</span>}
                  {result.view_count > 0 && <span>* {result.view_count} vues</span>}
                  {result.attachment_count && result.attachment_count > 0 && (
                    <span>
                      {'\u{1F4CE}'} {result.attachment_count} fichier
                      {result.attachment_count > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Highlight excerpt */}
                {result.body_text_highlight && (
                  <p
                    className="mt-1 text-sm text-gray-600 line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeHighlight(result.body_text_highlight) }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t text-xs text-gray-400 flex items-center gap-4">
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">{'\u2191\u2193'}</kbd>{' '}
            naviguer
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">{'\u23CE'}</kbd> ouvrir
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">esc</kbd> fermer
          </span>
        </div>
      </div>
    </div>
  )
}
