import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import Breadcrumb from './Breadcrumb'
import MetadataHeader from './MetadataHeader'
import DocumentContent from './DocumentContent'
import TableOfContents from './TableOfContents'
import DeleteModal from './DeleteModal'
import MindMapView from '@/features/mindmap/MindMapView'
import VersionHistory from './VersionHistory'
import VersionPreview from './VersionPreview'

interface Tag {
  id: string
  name: string
}

interface Author {
  id: string
  display_name: string
}

interface Document {
  id: string
  title: string
  slug: string
  body: Record<string, unknown>
  domain_id: string
  type_id: string
  folder_id?: string
  author: Author
  visibility: string
  view_count: number
  tags: Tag[]
  freshness_badge: 'green' | 'yellow' | 'red'
  last_verified_at: string | null
  last_verified_by: string | null
  created_at: string
  updated_at: string
  domain_name?: string
  domain_slug?: string
  domain_color?: string
}

interface TocItem {
  id: string
  text: string
}

export default function ReaderPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()

  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tocItems, setTocItems] = useState<TocItem[]>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showMindMap, setShowMindMap] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [previewVersion, setPreviewVersion] = useState<number | null>(null)
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[] | undefined>(undefined)

  const viewStartRef = useRef<number>(Date.now())

  // Fetch document
  useEffect(() => {
    if (!slug) return

    setLoading(true)
    setError(null)

    api
      .get<Document>(`/documents/${slug}`)
      .then((data) => {
        setDoc(data)

        // Log view count + analytics
        api.post('/analytics/view-count', { document_id: data.id }).catch(() => {})
        api.post('/analytics/view-log', { document_id: data.id, duration_seconds: 0 }).catch(() => {})
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError('Document introuvable')
        } else {
          setError('Erreur lors du chargement du document')
        }
      })
      .finally(() => setLoading(false))

    viewStartRef.current = Date.now()
  }, [slug])

  // Send view duration on unmount
  useEffect(() => {
    if (!doc) return

    const docId = doc.id
    const sendDuration = () => {
      const duration = Math.floor((Date.now() - viewStartRef.current) / 1000)
      if (duration > 0) {
        navigator.sendBeacon?.(
          '/api/analytics/view-log',
          JSON.stringify({ document_id: docId, duration_seconds: duration })
        )
      }
    }

    window.addEventListener('beforeunload', sendDuration)
    return () => {
      sendDuration()
      window.removeEventListener('beforeunload', sendDuration)
    }
  }, [doc])

  // Fetch folder path for breadcrumb
  useEffect(() => {
    if (!doc?.folder_id) { setFolderPath(undefined); return }
    api.get<{ path: { id: string; name: string }[] }>(`/folders/${doc.folder_id}`)
      .then((f) => setFolderPath(f.path))
      .catch(() => setFolderPath(undefined))
  }, [doc?.folder_id])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  const handleVerify = useCallback(async () => {
    if (!doc) return
    try {
      await api.post(`/documents/${doc.id}/verify`, {})
      setDoc((prev) =>
        prev
          ? {
              ...prev,
              freshness_badge: 'green' as const,
              last_verified_at: new Date().toISOString(),
              last_verified_by: user?.display_name || null,
            }
          : null
      )
      showToast('Document verifie')
    } catch {
      showToast('Erreur lors de la verification')
    }
  }, [doc, user, showToast])

  const handleDelete = useCallback(async () => {
    if (!doc) return
    setDeleting(true)
    try {
      await api.delete(`/documents/${doc.id}`)
      showToast('Document supprime')
      navigate('/')
    } catch {
      showToast('Erreur lors de la suppression')
      setDeleting(false)
    }
  }, [doc, navigate, showToast])

  const handleTocExtracted = useCallback((items: TocItem[]) => {
    setTocItems(items)
  }, [])

  // Permission checks
  const canEdit = !!user && (isAdmin || user.id === doc?.author?.id || user.domain_id === doc?.domain_id)
  const canVerify = canEdit
  const canDelete = !!user && (isAdmin || user.id === doc?.author?.id)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-ink-45">Chargement...</p>
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red">{error || 'Document introuvable'}</p>
      </div>
    )
  }

  if (showMindMap) {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 58px)' }}>
        <div className="flex items-center gap-3 px-6 py-3 border-b border-ink-10 bg-bg flex-shrink-0">
          <button
            onClick={() => setShowMindMap(false)}
            className="text-sm text-ink-45 hover:text-ink"
          >
            &larr; Retour
          </button>
          <h1 className="text-lg font-semibold text-ink truncate">
            Mind Map — {doc.title}
          </h1>
        </div>
        <div className="flex-1 min-h-0">
          <MindMapView rootType="document" rootId={doc.id} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Breadcrumb
        domainName={doc.domain_name}
        domainSlug={doc.domain_slug}
        title={doc.title}
        folderPath={folderPath}
      />

      <div className="flex gap-8">
        {/* Main content — 75% */}
        <div className="flex-1 min-w-0">
          <MetadataHeader
            title={doc.title}
            author={doc.author}
            visibility={doc.visibility}
            viewCount={doc.view_count}
            tags={doc.tags}
            freshnessBadge={doc.freshness_badge}
            lastVerifiedAt={doc.last_verified_at}
            lastVerifiedBy={doc.last_verified_by}
            updatedAt={doc.updated_at}
            domainName={doc.domain_name}
            domainColor={doc.domain_color}
            onEdit={() => navigate(`/documents/${slug}/edit`)}
            onVerify={handleVerify}
            onDelete={() => setShowDeleteModal(true)}
            onMindMap={user ? () => setShowMindMap(true) : undefined}
            onHistory={() => setHistoryOpen(true)}
            canEdit={canEdit}
            canVerify={canVerify}
            canDelete={canDelete}
          />

          {previewVersion !== null ? (
            <VersionPreview
              documentId={doc.id}
              versionNumber={previewVersion}
              onClose={() => setPreviewVersion(null)}
              onRestore={() => { setPreviewVersion(null); window.location.reload() }}
            />
          ) : (
            <DocumentContent content={doc.body} onTocExtracted={handleTocExtracted} />
          )}
        </div>

        {/* Sidebar TOC — 25% */}
        {tocItems.length > 0 && (
          <aside className="hidden lg:block w-64 shrink-0">
            <TableOfContents items={tocItems} />
          </aside>
        )}
      </div>

      {/* Delete modal */}
      {showDeleteModal && (
        <DeleteModal
          title={doc.title}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}

      {/* Version history side panel */}
      <VersionHistory
        documentId={doc.id}
        documentSlug={slug!}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelectVersion={(vn) => { setPreviewVersion(vn); setHistoryOpen(false) }}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-[#1a1a2e] text-white rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}
    </div>
  )
}
