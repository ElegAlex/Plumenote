import { useState, useCallback } from 'react'
import DocumentContent from './DocumentContent'
import TableOfContents from './TableOfContents'

interface TocItem {
  id: string
  text: string
}

interface DocumentPreviewProps {
  content: Record<string, unknown>
}

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
        <aside className="hidden lg:block w-64 shrink-0">
          <TableOfContents items={tocItems} />
        </aside>
      )}
    </div>
  )
}
