import { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

interface Tag {
  id?: string
  name: string
  slug?: string
}

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
}

export default function TagInput({ value, onChange }: TagInputProps) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 1) {
      setSuggestions([])
      return
    }
    try {
      const results = await api.get<Tag[]>(`/tags?q=${encodeURIComponent(q)}`)
      setSuggestions(results.filter((t) => !value.includes(t.name)))
    } catch {
      setSuggestions([])
    }
  }, [value])

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(input.trim())
      setShowSuggestions(true)
    }, 200)
    return () => clearTimeout(debounceRef.current)
  }, [input, fetchSuggestions])

  const addTag = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || value.includes(trimmed)) return
    onChange([...value, trimmed])
    setInput('')
    setSuggestions([])
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const removeTag = (name: string) => {
    onChange(value.filter((t) => t !== name))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showSuggestions && suggestions.length > 0) {
        addTag(suggestions[selected].name)
      } else if (input.trim()) {
        addTag(input)
      }
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className="relative">
      <div className="min-h-[38px] px-2.5 py-1.5 bg-white border border-line rounded-[9px] flex flex-wrap gap-1.5 items-center transition-colors focus-within:border-navy-600 focus-within:shadow-[0_0_0_3px_rgba(46,66,160,0.12)]">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-cream text-navy-900 text-[12px] font-semibold border border-line-soft before:content-['#'] before:text-coral before:font-bold before:mr-0.5"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Retirer ${tag}`}
              className="w-4 h-4 rounded-full grid place-items-center text-ink-muted hover:text-coral transition-colors text-[12px]"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={value.length === 0 ? 'Ajouter des tags…' : 'ajouter…'}
          className="flex-1 min-w-[80px] outline-none border-none bg-transparent text-[12.5px] text-ink placeholder:text-ink-muted py-0.5"
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-xl shadow-[0_18px_40px_rgba(20,35,92,0.15)] border border-line overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s.name}
              type="button"
              className={`block w-full text-left px-3.5 py-2 text-[13px] font-medium transition-colors ${
                i === selected ? 'bg-cream-light text-navy-800' : 'text-ink hover:bg-cream-light hover:text-navy-800'
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(s.name)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
