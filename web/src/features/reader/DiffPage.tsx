import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import DiffTextView from './DiffTextView'
import DiffVisualView from './DiffVisualView'

interface DiffData {
  v1: number
  v2: number
  v1_created_at: string
  v2_created_at: string
  v1_author: string
  v2_author: string
  v1_body: Record<string, unknown>
  v2_body: Record<string, unknown>
  lines: Array<{ type: 'equal' | 'insert' | 'delete'; text: string }>
}

export default function DiffPage() {
  const { slug, v1, v2 } = useParams<{ slug: string; v1: string; v2: string }>()
  const navigate = useNavigate()

  const [diff, setDiff] = useState<DiffData | null>(null)
  const [mode, setMode] = useState<'text' | 'visual'>('text')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug || !v1 || !v2) return
    // Resolve slug to document ID, then fetch diff
    api.get<{ id: string }>(`/documents/${slug}`)
      .then((doc) => api.get<DiffData>(`/documents/${doc.id}/versions/${v1}/diff/${v2}`))
      .then(setDiff)
      .catch(() => setError('Impossible de charger le diff'))
  }, [slug, v1, v2])

  if (error) {
    return <div className="max-w-4xl mx-auto py-12 text-center text-red-600">{error}</div>
  }
  if (!diff) {
    return <div className="max-w-6xl mx-auto py-12 text-center text-ink-45">Chargement...</div>
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-ink-70">
            Version {diff.v1} &rarr; Version {diff.v2}
          </h1>
          <p className="text-xs text-ink-45 mt-1">
            {formatDate(diff.v1_created_at)} ({diff.v1_author}) &rarr; {formatDate(diff.v2_created_at)} ({diff.v2_author})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden text-sm">
            <button
              onClick={() => setMode('text')}
              className={`px-3 py-1.5 ${mode === 'text' ? 'bg-ink-10 text-ink font-medium' : 'text-ink-45 hover:bg-ink-05'}`}
            >
              Textuel
            </button>
            <button
              onClick={() => setMode('visual')}
              className={`px-3 py-1.5 ${mode === 'visual' ? 'bg-ink-10 text-ink font-medium' : 'text-ink-45 hover:bg-ink-05'}`}
            >
              Visuel
            </button>
          </div>
          <button
            onClick={() => navigate(`/documents/${slug}`)}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-ink-05 text-ink-70"
          >
            Retour
          </button>
        </div>
      </div>

      {mode === 'text' ? (
        <DiffTextView lines={diff.lines} />
      ) : (
        <DiffVisualView oldBody={diff.v1_body} newBody={diff.v2_body} />
      )}
    </div>
  )
}
