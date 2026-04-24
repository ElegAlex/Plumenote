import { useState, useCallback } from 'react'
import DocumentContent from './DocumentContent'
import TableOfContents, { type TocItem } from './TableOfContents'

interface DocumentPreviewProps {
  content: Record<string, unknown>
}

/**
 * DocumentPreview — rendu readonly + TOC sommaire aligné sur le gabarit g5,
 * utilisé hors de la ReaderPage (notamment par l'éditeur pour prévisualiser).
 */
export default function DocumentPreview({ content }: DocumentPreviewProps) {
  const [tocItems, setTocItems] = useState<TocItem[]>([])

  const handleTocExtracted = useCallback((items: TocItem[]) => {
    setTocItems(items)
  }, [])

  return (
    <div className="flex gap-8">
      <div className="flex-1 min-w-0">
        <DocumentContent content={content} onTocExtracted={handleTocExtracted} />
      </div>
      {tocItems.length > 0 && (
        <div className="hidden lg:block w-64 shrink-0">
          <TableOfContents items={tocItems} />
        </div>
      )}
    </div>
  )
}
