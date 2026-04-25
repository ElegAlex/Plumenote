// web/src/features/import/ImportProgress.tsx
// Phase Conversion — gabarit g8 (Card coral 2px + pulse + progress bar gradient
// + 4 compteurs + stream SSE live).
//
// Logique SSE (EventSource) strictement préservée : endpoint
// `/api/import/folder/progress/:jobId?token=...`, listeners `progress` / `done`.
// onError / onDone contractuels conservés pour compat FolderImportTab historique
// et ImportPage.
import { useEffect, useRef, useState } from 'react'
import { Check, X, Upload, Pause, Circle, XOctagon } from 'lucide-react'
import { Button } from '@/components/ui'

interface ProgressEvent {
  type: 'progress' | 'done'
  current?: number
  total: number
  filename?: string
  status?: string
  error?: string
  success?: number
  failed?: number
  domains_created?: string[]
  folders_created?: number
}

interface StreamRow {
  filename: string
  status: 'ok' | 'error' | 'current'
  time: string
  message?: string
}

interface ImportProgressProps {
  jobId: string
  onDone: (result: ProgressEvent) => void
  onError?: (filename: string, error: string) => void
}

const MAX_STREAM_ROWS = 50

export default function ImportProgress({ jobId, onDone, onError }: ImportProgressProps) {
  const [rows, setRows] = useState<StreamRow[]>([])
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(0)
  const [counters, setCounters] = useState({ ok: 0, warn: 0, err: 0 })
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const url = `/api/import/folder/progress/${jobId}?token=${token}`
    const source = new EventSource(url)

    source.addEventListener('progress', (e) => {
      const data: ProgressEvent = JSON.parse((e as MessageEvent).data)
      setCurrent(data.current || 0)
      setTotal(data.total)

      if (data.filename) {
        const now = new Date()
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
        const rowStatus: StreamRow['status'] = data.status === 'ok' ? 'ok' : data.status === 'error' ? 'error' : 'current'
        const newRow: StreamRow = {
          filename: data.filename,
          status: rowStatus,
          time,
          message: data.error,
        }
        setRows(prev => {
          const next = [newRow, ...prev]
          return next.length > MAX_STREAM_ROWS ? next.slice(0, MAX_STREAM_ROWS) : next
        })
      }

      if (data.status === 'ok') {
        setCounters(prev => ({ ...prev, ok: prev.ok + 1 }))
      } else if (data.status === 'error') {
        setCounters(prev => ({ ...prev, err: prev.err + 1 }))
        if (data.filename && data.error && onError) {
          onError(data.filename, data.error)
        }
      }
      // NOTE: le backend (internal/importer/folder_import.go) émet aujourd'hui
      // uniquement 'ok' et 'error'. Le compteur "Avertissements" restera à 0
      // tant qu'un status 'warn' ne sera pas introduit côté Go.
    })

    source.addEventListener('done', (e) => {
      const data: ProgressEvent = JSON.parse((e as MessageEvent).data)
      source.close()
      onDone(data)
    })

    source.onerror = () => {
      source.close()
      // Surface connection error as a synthetic done event so the parent can react
      onDone({ type: 'done', total: 0, success: 0, failed: 0 })
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      source.close()
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [jobId, onDone, onError])

  useEffect(() => {
    // Nouveau row en tête → scroll en haut (les plus récents sont en premier).
    scrollRef.current?.scrollTo({ top: 0 })
  }, [rows])

  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  const remaining = Math.max(0, total - (counters.ok + counters.err + counters.warn))

  return (
    <div className="bg-white border-2 border-coral rounded-[18px] overflow-hidden shadow-[0_14px_36px_rgba(232,132,92,0.15)]">
      <style>{`
        @keyframes import-pulse-ico { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes import-pulse-live { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
      `}</style>

      {/* ============ Head ============ */}
      <div className="flex items-center justify-between gap-5 flex-wrap px-7 pt-[22px] pb-[18px] bg-gradient-to-br from-coral-bg to-cream-light">
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 bg-coral text-white rounded-xl grid place-items-center shadow-[0_8px_22px_rgba(232,132,92,0.35)]"
            style={{ animation: 'import-pulse-ico 2s infinite' }}
          >
            <Upload size={22} strokeWidth={2.2} />
          </div>
          <div>
            <div className="font-serif font-semibold text-[21px] leading-tight text-navy-900">
              Conversion <em className="italic text-coral font-medium">en cours</em>
            </div>
            <div className="text-[13px] text-ink-soft mt-0.5">
              Pipeline Pandoc → HTML → TipTap JSON · indexation Meilisearch async
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-serif font-semibold text-[40px] text-coral tabular-nums leading-none tracking-[-0.02em]">
            {pct}%
          </div>
          <div className="text-[12.5px] text-ink-soft mt-1 tabular-nums">
            <strong className="text-navy-900 font-bold">{current}</strong> / {total} fichiers
          </div>
        </div>
      </div>

      {/* ============ Progress bar ============ */}
      <div className="h-1.5 bg-line-soft">
        <div
          className="h-full bg-gradient-to-r from-coral to-coral-soft transition-[width] duration-[400ms]"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* ============ Counters ============ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 px-7 py-[18px] border-b border-line-soft">
        <Counter label="Convertis" value={counters.ok} tone="success" />
        <Counter label="Avertissements" value={counters.warn} tone="warn" />
        <Counter label="Erreurs" value={counters.err} tone="danger" />
        <Counter label="Restant" value={remaining} tone="neutral" />
      </div>

      {/* ============ Stream SSE ============ */}
      <div className="px-7 pt-4 pb-5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-serif font-semibold text-sm text-navy-900">
            Flux SSE · fichiers traités
          </span>
          <span className="text-[11.5px] text-ink-muted inline-flex items-center gap-1.5">
            <span
              className="w-[7px] h-[7px] bg-success rounded-full shadow-[0_0_0_3px_rgba(47,125,91,0.18)]"
              style={{ animation: 'import-pulse-live 1.4s infinite' }}
            />
            Live · mise à jour en continu
          </span>
        </div>

        <div
          ref={scrollRef}
          className="bg-bg border border-line-soft rounded-xl max-h-[260px] overflow-y-auto"
        >
          {rows.length === 0 ? (
            <div className="p-4 text-[12.5px] text-ink-muted text-center">
              En attente du premier fichier…
            </div>
          ) : (
            rows.map((row, idx) => (
              <StreamRowItem key={`${row.time}-${idx}-${row.filename}`} row={row} highlight={idx === 0} />
            ))
          )}
        </div>
      </div>

      {/* ============ Actions ============ */}
      <div className="flex flex-wrap items-center gap-2.5 px-7 py-4 border-t border-line-soft bg-cream-light">
        <span className="text-[12.5px] text-ink-soft">
          Temps restant estimé <strong className="text-navy-900 font-bold tabular-nums">≈ {estimateEta(remaining, counters.ok + counters.err)}</strong>
        </span>
        <span className="flex-1" />
        <Button
          variant="secondary"
          leftIcon={<Pause />}
          disabled
          title="La mise en pause sera disponible dans une prochaine version"
        >
          Mettre en pause
        </Button>
        <Button
          variant="danger"
          leftIcon={<XOctagon />}
          disabled
          title="L'annulation sera disponible dans une prochaine version"
        >
          Annuler l'import
        </Button>
      </div>
    </div>
  )
}

// --- Sub-components ---------------------------------------------------------------------

interface CounterProps {
  label: string
  value: number
  tone: 'success' | 'warn' | 'danger' | 'neutral'
}

function Counter({ label, value, tone }: CounterProps) {
  const toneColor =
    tone === 'success' ? 'text-success'
    : tone === 'warn' ? 'text-warn'
    : tone === 'danger' ? 'text-danger'
    : 'text-ink-soft'
  return (
    <div className="p-3.5 bg-bg rounded-xl border border-line-soft">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-soft mb-1">
        {label}
      </div>
      <div className={`font-serif font-semibold text-[28px] leading-none tabular-nums ${toneColor}`}>
        {value}
      </div>
    </div>
  )
}

interface StreamRowItemProps {
  row: StreamRow
  highlight: boolean
}

function StreamRowItem({ row, highlight }: StreamRowItemProps) {
  const icoClass =
    row.status === 'ok' ? 'bg-success-bg text-success'
    : row.status === 'error' ? 'bg-danger-bg text-danger'
    : 'bg-coral-bg text-coral'

  const actionClass =
    row.status === 'ok' ? 'bg-success-bg text-success'
    : row.status === 'error' ? 'bg-danger-bg text-danger'
    : 'bg-warn-bg text-warn'

  const actionLabel =
    row.status === 'ok' ? 'Importé'
    : row.status === 'error' ? (row.message ? 'Erreur' : 'Erreur')
    : 'En cours…'

  // Split path: dernier segment en strong.
  const parts = row.filename.split('/')
  const leaf = parts.pop() || row.filename
  const prefix = parts.join(' / ')

  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-[9px] border-b border-line-soft last:border-b-0 text-[12.5px] ${highlight ? 'bg-cream-light' : ''}`}
    >
      <span className={`w-6 h-6 rounded-md grid place-items-center ${icoClass}`}>
        {row.status === 'ok' ? (
          <Check size={12} strokeWidth={3} />
        ) : row.status === 'error' ? (
          <X size={12} strokeWidth={3} />
        ) : (
          <Circle size={12} strokeWidth={2.5} style={{ animation: 'import-pulse-live 1s infinite' }} />
        )}
      </span>
      <span className="font-mono text-[11.5px] text-ink overflow-hidden text-ellipsis whitespace-nowrap">
        {prefix && <>{prefix} / </>}
        <strong className="text-navy-900 font-semibold">{leaf}</strong>
      </span>
      <span className="text-[11px] text-ink-muted tabular-nums">{row.time}</span>
      <span className={`text-[11px] font-semibold px-2 py-[2px] rounded ${actionClass}`}>
        {row.message && row.status === 'error' ? truncate(row.message, 28) : actionLabel}
        {row.message && row.status !== 'error' && row.status !== 'current' && (
          <></>
        )}
      </span>
    </div>
  )
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

function estimateEta(remaining: number, processed: number): string {
  if (remaining === 0) return '—'
  if (processed === 0) return 'calcul…'
  // ~1s/file par défaut (heuristique, remplacée par vraie mesure si dispo)
  const seconds = remaining
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m} min ${String(s).padStart(2, '0')}`
}

