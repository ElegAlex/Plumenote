import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

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

interface ImportProgressProps {
  jobId: string
  onDone: (result: ProgressEvent) => void
  onError?: (filename: string, error: string) => void
}

export default function ImportProgress({ jobId, onDone, onError }: ImportProgressProps) {
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const url = `/api/import/folder/progress/${jobId}?token=${token}`
    const source = new EventSource(url)

    source.addEventListener('progress', (e) => {
      const data: ProgressEvent = JSON.parse(e.data)
      setEvents(prev => [...prev, data])
      setCurrent(data.current || 0)
      setTotal(data.total)
      if (data.status === 'error' && data.filename && data.error && onError) {
        onError(data.filename, data.error)
      }
    })

    source.addEventListener('done', (e) => {
      const data: ProgressEvent = JSON.parse(e.data)
      source.close()
      onDone(data)
    })

    source.onerror = () => {
      source.close()
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [events])

  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Import en cours...</h3>
      <div className="h-2 rounded-full bg-muted mb-2 overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-muted-foreground mb-3">{current}/{total} fichiers</p>
      <div ref={scrollRef} className="border rounded-md p-2 max-h-64 overflow-y-auto space-y-1">
        {events.map((evt, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            {evt.status === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            ) : evt.status === 'error' ? (
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            )}
            <span className="truncate">{evt.filename}</span>
            {evt.error && <span className="text-red-500 text-xs">— {evt.error}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
