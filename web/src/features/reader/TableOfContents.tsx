import { useState, useEffect, useRef, useCallback } from 'react'
import { Link2, Printer, Download } from 'lucide-react'
import { cn } from '@/lib/cn'
import { TitleEyebrow } from '@/components/ui'

export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

interface TableOfContentsProps {
  items: TocItem[]
  /** Callback "Copier le lien" — fallback : navigator.clipboard + current URL. */
  onCopyLink?: () => void
  /** Callback "Imprimer" — fallback : window.print(). */
  onPrint?: () => void
  /** Callback "Exporter PDF" — fallback : window.print() (même action côté navigateur). */
  onExportPdf?: () => void
}

/**
 * TableOfContents — sommaire sticky gauche (gabarit g5 .toc).
 *
 * - Eyebrow "◆ Sommaire" coral.
 * - Liste H2 + H3 (niveau 3 indenté).
 * - IntersectionObserver pour surligner l'item actif, border-left coral
 *   + gradient `coral-bg → transparent` sur l'actif.
 * - Actions pied : Copier le lien, Imprimer, Exporter PDF.
 */
export default function TableOfContents({
  items,
  onCopyLink,
  onPrint,
  onExportPdf,
}: TableOfContentsProps) {
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

  const handleCopyLink = useCallback(() => {
    if (onCopyLink) {
      onCopyLink()
      return
    }
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
    }
  }, [onCopyLink])

  const handlePrint = useCallback(() => {
    if (onPrint) {
      onPrint()
      return
    }
    if (typeof window !== 'undefined') window.print()
  }, [onPrint])

  const handleExportPdf = useCallback(() => {
    if (onExportPdf) {
      onExportPdf()
      return
    }
    // Dialogue d'impression navigateur = export PDF côté utilisateur.
    if (typeof window !== 'undefined') window.print()
  }, [onExportPdf])

  if (items.length === 0) return null

  return (
    <aside
      className={cn(
        'self-start sticky',
        'pl-2 pt-1',
        'overflow-y-auto',
      )}
      style={{
        top: 78,
        maxHeight: 'calc(100vh - 100px)',
      }}
      aria-label="Sommaire"
    >
      <TitleEyebrow>Sommaire</TitleEyebrow>

      <ul className="list-none m-0 p-0">
        {items.map(({ id, text, level }) => {
          const active = activeId === id
          return (
            <li key={id} className="relative">
              <button
                type="button"
                onClick={() => scrollTo(id)}
                className={cn(
                  'block w-full text-left transition-all',
                  'py-[7px] pr-[14px] border-l-2',
                  level === 3 ? 'pl-8 text-[12.5px]' : 'pl-[18px] text-[13px]',
                  'leading-[1.4] no-underline',
                  active
                    ? 'border-coral text-navy-900 font-semibold bg-gradient-to-r from-coral-bg to-transparent'
                    : 'border-line-soft text-ink-soft hover:border-navy-600 hover:text-navy-800',
                )}
              >
                {text}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-[22px] pt-[18px] border-t border-line-soft flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[12.5px] text-ink-soft text-left transition-colors hover:bg-cream-light hover:text-navy-800"
        >
          <Link2 className="w-[13px] h-[13px]" />
          Copier le lien
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[12.5px] text-ink-soft text-left transition-colors hover:bg-cream-light hover:text-navy-800"
        >
          <Printer className="w-[13px] h-[13px]" />
          Imprimer
        </button>
        <button
          type="button"
          onClick={handleExportPdf}
          className="flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[12.5px] text-ink-soft text-left transition-colors hover:bg-cream-light hover:text-navy-800"
        >
          <Download className="w-[13px] h-[13px]" />
          Exporter PDF
        </button>
      </div>
    </aside>
  )
}
