import { useState, useEffect, useRef, useCallback } from 'react'

interface TocItem {
  id: string
  text: string
}

interface TableOfContentsProps {
  items: TocItem[]
}

export default function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('')
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (items.length === 0) return

    observerRef.current?.disconnect()

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    )

    observerRef.current = observer

    items.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [items])

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  if (items.length === 0) return null

  return (
    <nav className="sticky top-20 text-sm border-l-2 border-gray-200 pl-4">
      <h3 className="font-semibold text-gray-900 mb-3">Sommaire</h3>
      <ul className="space-y-2">
        {items.map(({ id, text }) => (
          <li key={id}>
            <button
              onClick={() => scrollTo(id)}
              className={`text-left w-full transition-colors ${
                activeId === id
                  ? 'text-blue-600 font-medium border-l-2 border-blue-600 -ml-[calc(1rem+2px)] pl-[calc(1rem)]'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
