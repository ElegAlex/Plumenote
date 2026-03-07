import { useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  resultCount: number
}

export default function SearchBar({ value, onChange, resultCount }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== ref.current && !['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) {
        e.preventDefault()
        ref.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === ref.current) {
        onChange('')
        ref.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onChange])

  return (
    <div
      className="flex items-stretch border-b border-ink-10 bg-bg h-[50px]"
      style={{ animation: 'fadeIn 0.35s ease-out 0.04s both' }}
    >
      <div className="w-[50px] flex items-center justify-center border-r border-ink-05 text-ink-45 text-[15px]">
        &#x2315;
      </div>
      <input
        ref={ref}
        className="flex-1 border-none bg-transparent font-mono text-[13.5px] text-ink px-5 outline-none placeholder:text-ink-45"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher dans la documentation DSI..."
      />
      {value ? (
        <div
          className="flex items-center px-4 font-mono text-[10px] text-ink-45 border-l border-ink-05 cursor-pointer hover:text-ink transition-colors"
          onClick={() => { onChange(''); ref.current?.focus() }}
        >
          &#x2715;
        </div>
      ) : (
        <div className="flex items-center px-4 font-mono text-[10px] text-ink-45 border-l border-ink-05">
          Raccourci <kbd className="border border-ink-10 px-1.5 py-px text-[10px] ml-1 rounded-sm">/</kbd>
        </div>
      )}
      <div className="flex items-center justify-center px-5 min-w-[100px] font-mono text-[11px] text-ink-45 border-l border-ink-10">
        {resultCount} resultat{resultCount !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
