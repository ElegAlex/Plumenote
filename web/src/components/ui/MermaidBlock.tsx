import { useEffect, useRef, useState, useId } from 'react'

interface MermaidBlockProps {
  code: string
  showToggle?: boolean
}

export default function MermaidBlock({ code, showToggle = true }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgHtml, setSvgHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSource, setShowSource] = useState(false)
  const instanceId = useId().replace(/:/g, '_')

  useEffect(() => {
    if (!code.trim()) {
      setSvgHtml(null)
      setError(null)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const { default: mermaid } = await import('mermaid')
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'IBM Plex Sans, sans-serif',
        })

        const id = `mermaid_${instanceId}_${Date.now()}`
        const { svg } = await mermaid.render(id, code.trim())
        if (!cancelled) {
          setSvgHtml(svg)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setSvgHtml(null)
          setError(err instanceof Error ? err.message : 'Erreur de rendu Mermaid')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [code, instanceId])

  if (showSource || error) {
    return (
      <div className="my-4 rounded-lg border border-ink-10 overflow-hidden">
        {error && (
          <div className="px-3 py-2 bg-red-50 text-red-700 text-xs border-b border-red-200">
            Erreur Mermaid : {error}
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-1.5 bg-ink-05 border-b border-ink-10">
          <span className="text-xs text-ink-45 font-medium">mermaid</span>
          {showToggle && (
            <button
              onClick={() => {
                if (error) return
                setShowSource(false)
              }}
              className={`text-xs px-2 py-0.5 rounded ${error ? 'text-ink-30 cursor-not-allowed' : 'text-blue hover:bg-blue/10'}`}
            >
              Voir le diagramme
            </button>
          )}
        </div>
        <pre className="bg-[#1a1a2e] text-ink rounded-b-lg p-4 overflow-x-auto text-sm font-mono">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className="my-4 rounded-lg border border-ink-10 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-ink-05 border-b border-ink-10">
        <span className="text-xs text-ink-45 font-medium">mermaid</span>
        {showToggle && (
          <button
            onClick={() => setShowSource(true)}
            className="text-xs text-blue px-2 py-0.5 rounded hover:bg-blue/10"
          >
            Voir le code source
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className="flex justify-center p-4 bg-white overflow-x-auto"
        dangerouslySetInnerHTML={svgHtml ? { __html: svgHtml } : undefined}
      />
    </div>
  )
}
