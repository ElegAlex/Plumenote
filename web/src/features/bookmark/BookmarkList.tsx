import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useBookmarks, useDeleteBookmark } from '@/lib/hooks/useBookmarks'
import type { Bookmark } from '@/lib/types'
import BookmarkForm from './BookmarkForm'

interface BookmarkListProps {
  domainId: string
}

export default function BookmarkList({ domainId }: BookmarkListProps) {
  const { data: bookmarks, isLoading } = useBookmarks(domainId)
  const deleteMutation = useDeleteBookmark()
  const { user } = useAuth()
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)

  const canManage = (bookmark: Bookmark) => {
    if (!user) return false
    return user.id === bookmark.author_id || user.role === 'admin'
  }

  const handleDelete = (bookmark: Bookmark) => {
    if (!window.confirm(`Supprimer le lien "${bookmark.title}" ?`)) return
    deleteMutation.mutate(bookmark.id)
  }

  if (isLoading) {
    return <p className="text-sm text-ink-45">Chargement des liens...</p>
  }

  if (!bookmarks || bookmarks.length === 0) {
    return <p className="text-sm text-ink-45">Aucun lien externe pour ce domaine.</p>
  }

  return (
    <>
      <div className="space-y-2">
        {bookmarks.map((bm) => (
          <div
            key={bm.id}
            className="flex items-center justify-between bg-bg border border-ink-10 rounded-lg shadow-sm px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-ink-45 text-sm" aria-hidden="true">
                  <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                  </svg>
                </span>
                <a
                  href={bm.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue hover:text-blue/80 truncate"
                >
                  {bm.title}
                </a>
              </div>
              {bm.description && (
                <p className="text-xs text-ink-45 mt-0.5 line-clamp-1 pl-6">{bm.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1 pl-6">
                {bm.tags && bm.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    {bm.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block bg-blue/10 text-blue text-[10px] px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <span className="text-[11px] text-ink-45">par {bm.author_name}</span>
              </div>
            </div>

            {canManage(bm) && (
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => setEditingBookmark(bm)}
                  className="text-xs text-ink-45 hover:text-ink-70 transition-colors"
                  title="Modifier"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(bm)}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-ink-45 hover:text-red transition-colors disabled:opacity-50"
                  title="Supprimer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editingBookmark && (
        <BookmarkForm
          bookmark={editingBookmark}
          onClose={() => setEditingBookmark(null)}
        />
      )}
    </>
  )
}
