import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle,
  Clock,
  Share2,
  Trash2,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  Network,
} from 'lucide-react'

import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import {
  Avatar,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHead,
  CardTitle,
  DomainChip,
  FreshBadge,
  SidePanel,
  TypeChip,
} from '@/components/ui'
import {
  normalizeDomain,
  normalizeType,
  freshStatus,
  DOMAIN_LABEL,
  TYPE_LABEL,
  type DomainKey,
  type DocTypeKey,
} from '@/features/search/shared'

import DocumentContent from './DocumentContent'
import TableOfContents, { type TocItem } from './TableOfContents'
import DeleteModal from './DeleteModal'
import MindMapView from '@/features/mindmap/MindMapView'
import VersionHistory from './VersionHistory'
import VersionPreview from './VersionPreview'
import TagPill from '@/features/home/domain/TagPill'

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
  type_name?: string
  type_slug?: string
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffH < 1) return "à l'instant"
  if (diffH < 24) return `il y a ${diffH} h`
  const diffDays = Math.floor(diffH / 24)
  if (diffDays === 1) return 'hier'
  if (diffDays < 30) return `il y a ${diffDays} jours`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `il y a ${diffMonths} mois`
  const diffYears = Math.floor(diffDays / 365)
  return `il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`
}

function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function freshBadgeLabel(badge: 'green' | 'yellow' | 'red', lastVerifiedAt: string | null): string {
  if (badge === 'green') {
    return lastVerifiedAt ? `À jour · vérifié ${relativeDate(lastVerifiedAt)}` : 'À jour'
  }
  if (badge === 'yellow') {
    return lastVerifiedAt ? `À vérifier · révisé ${relativeDate(lastVerifiedAt)}` : 'À vérifier'
  }
  return 'Périmé'
}

function visibilityLabel(v: string): { main: string; hint: string } {
  switch (v) {
    case 'public':
      return { main: 'Public', hint: 'tous les utilisateurs' }
    case 'dsi':
      return { main: 'DSI', hint: 'interne uniquement' }
    case 'private':
      return { main: 'Privé', hint: 'auteur uniquement' }
    default:
      return { main: v || '—', hint: '' }
  }
}

export default function ReaderPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
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
  const [versionCount, setVersionCount] = useState<number | null>(null)
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
          JSON.stringify({ document_id: docId, duration_seconds: duration }),
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
    if (!doc?.folder_id) {
      setFolderPath(undefined)
      return
    }
    api
      .get<{ path: { id: string; name: string }[] }>(`/folders/${doc.folder_id}`)
      .then((f) => setFolderPath(f.path))
      .catch(() => setFolderPath(undefined))
  }, [doc?.folder_id])

  // Fetch versions count (pour l'action "Historique" du side-panel)
  useEffect(() => {
    if (!doc?.id) return
    api
      .get<{ id: string }[]>(`/documents/${doc.id}/versions`)
      .then((versions) => setVersionCount(versions.length))
      .catch(() => setVersionCount(null))
  }, [doc?.id])

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
          : null,
      )
      showToast('Document vérifié')
    } catch {
      showToast('Erreur lors de la vérification')
    }
  }, [doc, user, showToast])

  const handleDelete = useCallback(async () => {
    if (!doc) return
    setDeleting(true)
    try {
      await api.delete(`/documents/${doc.id}`)
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      showToast('Document supprimé')
      navigate('/')
    } catch {
      showToast('Erreur lors de la suppression')
      setDeleting(false)
    }
  }, [doc, navigate, queryClient, showToast])

  const handleCopyLink = useCallback(() => {
    if (typeof window === 'undefined') return
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => showToast('Lien copié'))
      .catch(() => showToast('Impossible de copier le lien'))
  }, [showToast])

  const handleTocExtracted = useCallback((items: TocItem[]) => {
    setTocItems(items)
  }, [])

  // Permission checks
  const canEdit = !!user && (isAdmin || user.id === doc?.author?.id || user.domain_id === doc?.domain_id)
  const canVerify = canEdit
  const canDelete = !!user && (isAdmin || user.id === doc?.author?.id)

  // Mapping domaine / type / freshness pour les primitives typées
  const domainKey: DomainKey = useMemo(
    () => normalizeDomain(doc?.domain_name ?? doc?.domain_slug),
    [doc?.domain_name, doc?.domain_slug],
  )
  const typeKey: DocTypeKey = useMemo(
    () => normalizeType(doc?.type_name ?? doc?.type_slug),
    [doc?.type_name, doc?.type_slug],
  )
  const fresh = doc ? freshStatus(doc.freshness_badge) : 'ok'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-ink-soft">Chargement…</p>
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-danger">{error || 'Document introuvable'}</p>
      </div>
    )
  }

  if (showMindMap) {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 58px)' }}>
        <div className="flex items-center gap-3 px-6 py-3 border-b border-line bg-white flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowMindMap(false)}
            className="text-sm text-ink-soft hover:text-navy-800 transition-colors"
          >
            ← Retour
          </button>
          <h1 className="font-serif text-lg font-semibold text-navy-900 truncate">
            Mind Map — {doc.title}
          </h1>
        </div>
        <div className="flex-1 min-h-0">
          <MindMapView rootType="document" rootId={doc.id} />
        </div>
      </div>
    )
  }

  const visibility = visibilityLabel(doc.visibility)
  const authorInitials = getInitials(doc.author.display_name)

  const breadcrumbItems = [
    { label: 'Accueil', href: '/' },
    ...(doc.domain_name && doc.domain_slug
      ? [{ label: doc.domain_name, href: `/domains/${doc.domain_slug}` }]
      : []),
    ...(folderPath?.map((f) => ({
      label: f.name,
      href: `/domains/${doc.domain_slug}/folders/${f.id}`,
    })) ?? []),
    { label: doc.title },
  ]

  return (
    <div
      className={
        'grid mx-auto w-full max-w-[1440px] gap-10 px-8 pt-9 pb-[60px] ' +
        'grid-cols-[240px_minmax(0,1fr)_320px] ' +
        'max-[1280px]:grid-cols-[minmax(0,1fr)_300px] max-[1280px]:gap-7 ' +
        'max-[1000px]:grid-cols-1'
      }
    >
      {/* ============ TOC gauche (masquée < 1280 px) ============ */}
      <div className="max-[1280px]:hidden">
        <TableOfContents items={tocItems} onCopyLink={handleCopyLink} />
      </div>

      {/* ============ Article centre ============ */}
      <article className="min-w-0">
        <Breadcrumb items={breadcrumbItems} className="mb-3.5 text-[12px] text-ink-muted" />

        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3.5">
            {doc.domain_name && <DomainChip domain={domainKey}>{doc.domain_name}</DomainChip>}
            {doc.type_name && <TypeChip type={typeKey}>{doc.type_name}</TypeChip>}
          </div>

          <h1 className="font-serif font-semibold text-[42px] leading-[1.1] tracking-[-0.02em] text-navy-900 [&_em]:italic [&_em]:text-coral [&_em]:font-medium">
            {doc.title}
          </h1>

          <div className="mt-5 py-3.5 border-t border-b border-line-soft flex items-center flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-ink-soft">
            <span className="flex items-center gap-2">
              <Avatar initials={authorInitials} size="xs" variant="a" />
              <span>
                Rédigé par{' '}
                <strong className="text-ink font-semibold">{doc.author.display_name}</strong>
              </span>
            </span>
            <span className="w-[3px] h-[3px] bg-ink-muted rounded-full" aria-hidden />
            <span>
              mis à jour{' '}
              <strong className="text-ink font-semibold">{relativeDate(doc.updated_at)}</strong>
            </span>
            <span className="w-[3px] h-[3px] bg-ink-muted rounded-full" aria-hidden />
            <span>
              <strong className="text-ink font-semibold tabular-nums">{doc.view_count}</strong>{' '}
              consultations
            </span>
            <FreshBadge status={fresh} className="ml-auto">
              {freshBadgeLabel(doc.freshness_badge, doc.last_verified_at)}
            </FreshBadge>
          </div>
        </header>

        {previewVersion !== null ? (
          <VersionPreview
            documentId={doc.id}
            versionNumber={previewVersion}
            onClose={() => setPreviewVersion(null)}
            onRestore={() => {
              setPreviewVersion(null)
              window.location.reload()
            }}
          />
        ) : (
          <DocumentContent content={doc.body} onTocExtracted={handleTocExtracted} />
        )}

        {/* Tags bar */}
        {doc.tags.length > 0 && (
          <div className="mt-12 pt-[22px] border-t border-line-soft flex flex-wrap items-center gap-2">
            <span className="mr-1.5 text-[11px] font-bold tracking-[0.12em] uppercase text-ink-soft">
              Tags
            </span>
            {doc.tags.map((tag) => (
              <TagPill key={tag.id}>{tag.name}</TagPill>
            ))}
          </div>
        )}

        {/* Article footer — feedback utilité */}
        <Card className="mt-9 flex items-center justify-between gap-5 flex-wrap px-[22px] py-5">
          <div className="flex items-center gap-3 text-[13px] text-ink-soft">
            <span className="w-[34px] h-[34px] grid place-items-center rounded-lg bg-cream text-navy-800">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
                aria-hidden
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <div>
              <strong className="block text-navy-900 font-bold text-[13px]">
                Cette fiche a été utile ?
              </strong>
              <span>Votre retour aide à maintenir la qualité du contenu.</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="thumb"
              leftIcon={<ThumbsUp />}
              onClick={() => showToast('Merci pour votre retour')}
            >
              Oui, utile
            </Button>
            <Button
              variant="thumb"
              leftIcon={<ThumbsDown />}
              onClick={() => showToast('Retour enregistré')}
            >
              À améliorer
            </Button>
          </div>
        </Card>
      </article>

      {/* ============ Side-panel droite ============ */}
      <SidePanel className="gap-3.5">
        {/* Card Informations */}
        <Card>
          <CardHead compact>
            <CardTitle>Informations</CardTitle>
          </CardHead>
          <CardBody padded={false} className="px-[18px] py-[14px]">
            <dl
              className="grid gap-x-3 gap-y-2 text-[12.5px]"
              style={{ gridTemplateColumns: 'auto 1fr' }}
            >
              {doc.domain_name && (
                <>
                  <dt className="text-ink-soft font-semibold">Domaine</dt>
                  <dd className="m-0">
                    <DomainChip domain={domainKey}>{DOMAIN_LABEL[domainKey]}</DomainChip>
                  </dd>
                </>
              )}

              {doc.type_name && (
                <>
                  <dt className="text-ink-soft font-semibold">Type</dt>
                  <dd className="m-0 font-serif font-semibold text-[13px] text-ink">
                    {doc.type_name || TYPE_LABEL[typeKey]}
                  </dd>
                </>
              )}

              <dt className="text-ink-soft font-semibold">Auteur</dt>
              <dd className="m-0 font-serif font-semibold text-[13px] text-ink">
                {doc.author.display_name}
              </dd>

              <dt className="text-ink-soft font-semibold">Créé le</dt>
              <dd className="m-0 font-serif font-semibold text-[13px] text-ink">
                {formatDateLong(doc.created_at)}
              </dd>

              <dt className="text-ink-soft font-semibold">Mis à jour</dt>
              <dd className="m-0 font-serif font-semibold text-[13px] text-ink">
                {relativeDate(doc.updated_at)}
                <small className="block font-sans font-medium text-ink-muted text-[11.5px] mt-0.5">
                  {formatDateLong(doc.updated_at)}
                </small>
              </dd>

              <dt className="text-ink-soft font-semibold">Vérifié le</dt>
              <dd className="m-0 font-serif font-semibold text-[13px] text-ink">
                {doc.last_verified_at ? (
                  <>
                    {relativeDate(doc.last_verified_at)}
                    {doc.last_verified_by && (
                      <small className="block font-sans font-medium text-ink-muted text-[11.5px] mt-0.5">
                        par {doc.last_verified_by}
                      </small>
                    )}
                  </>
                ) : (
                  <span className="text-ink-muted font-normal">Jamais</span>
                )}
              </dd>

              <dt className="text-ink-soft font-semibold">Visibilité</dt>
              <dd className="m-0 font-serif font-semibold text-[13px] text-ink">
                {visibility.main}
                {visibility.hint && (
                  <small className="block font-sans font-medium text-ink-muted text-[11.5px] mt-0.5">
                    {visibility.hint}
                  </small>
                )}
              </dd>

              <dt className="text-ink-soft font-semibold">Consultations</dt>
              <dd className="m-0 font-serif font-semibold text-[13px] text-ink tabular-nums">
                {doc.view_count}
              </dd>
            </dl>
          </CardBody>
        </Card>

        {/* Card Liens entrants — empty-state en attendant l'endpoint dédié
            (le schéma document_links existe mais aucune API ne l'expose à ce jour). */}
        <Card>
          <CardHead compact>
            <CardTitle>Liens entrants</CardTitle>
          </CardHead>
          <CardBody padded={false} className="px-[18px] py-3 text-[12.5px] text-ink-muted">
            Aucun lien entrant recensé pour ce document.
          </CardBody>
        </Card>

        {/* Card Actions */}
        <Card>
          <CardHead compact>
            <CardTitle>Actions</CardTitle>
          </CardHead>
          <CardBody padded={false} className="px-[18px] py-[14px] flex flex-col gap-1.5">
            {canEdit && (
              <Button
                variant="cta"
                leftIcon={<Pencil />}
                onClick={() => navigate(`/documents/${slug}/edit`)}
                className="w-full justify-start"
              >
                Modifier
              </Button>
            )}
            {canVerify && (
              <Button
                variant="secondary"
                leftIcon={<CheckCircle />}
                onClick={handleVerify}
                className="w-full justify-start"
              >
                Marquer vérifié
              </Button>
            )}
            <Button
              variant="secondary"
              leftIcon={<Clock />}
              onClick={() => setHistoryOpen(true)}
              className="w-full justify-start"
            >
              Historique{versionCount !== null ? ` (${versionCount} version${versionCount > 1 ? 's' : ''})` : ''}
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Share2 />}
              onClick={handleCopyLink}
              className="w-full justify-start"
            >
              Partager / copier lien
            </Button>
            {user && (
              <Button
                variant="secondary"
                leftIcon={<Network />}
                onClick={() => setShowMindMap(true)}
                className="w-full justify-start"
              >
                Voir la carte mentale
              </Button>
            )}
            {canDelete && (
              <Button
                variant="danger"
                leftIcon={<Trash2 />}
                onClick={() => setShowDeleteModal(true)}
                className="w-full justify-start"
              >
                Supprimer
              </Button>
            )}
          </CardBody>
        </Card>
      </SidePanel>

      {/* Modals / panels superposés */}
      {showDeleteModal && (
        <DeleteModal
          title={doc.title}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}

      <VersionHistory
        documentId={doc.id}
        documentSlug={slug!}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelectVersion={(vn) => {
          setPreviewVersion(vn)
          setHistoryOpen(false)
        }}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-navy-900 text-white rounded-lg shadow-[0_10px_30px_rgba(20,35,92,.35)] text-sm">
          {toast}
        </div>
      )}
    </div>
  )
}
