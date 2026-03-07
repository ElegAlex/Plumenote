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
      <div className="flex flex-wrap items-center gap-1.5 border rounded-lg px-2 py-1.5 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-sm px-2 py-0.5 rounded"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-blue-500 hover:text-blue-700"
            >
              x
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
          placeholder={value.length === 0 ? 'Ajouter des tags...' : ''}
          className="flex-1 min-w-[100px] outline-none text-sm py-0.5"
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s.name}
              type="button"
              className={`block w-full text-left px-3 py-2 text-sm ${i === selected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
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
