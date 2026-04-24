import { useState, useEffect, useCallback, useRef, useMemo, type MutableRefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Check,
  Clock,
  Pencil,
  Trash2,
  Eye,
  ArrowRight,
  Users,
  Globe2,
  Lock,
  Search,
  FileText,
} from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useSidebar } from '@/lib/sidebar-context'
import {
  Button,
  Card,
  CardBody,
  CardHead,
  CardTitle,
  DomainChip,
  Field,
  FieldLabel,
  Select,
  SidePanel,
} from '@/components/ui'
import {
  normalizeDomain,
  DOMAIN_ICON_BG,
  DOMAIN_LABEL,
  type DomainKey,
} from '@/features/search/shared'

import TipTapEditor from './TipTapEditor'
import TemplatePicker from './TemplatePicker'
import TagInput from './TagInput'
import DocumentPreview from '../reader/DocumentPreview'

interface Domain {
  id: string
  name: string
  slug: string
  color: string
}

interface DocType {
  id: string
  name: string
}

/** Visibilité étendue pour couvrir les 3 radio-cards du gabarit g6. */
type Visibility = 'public' | 'dsi' | 'private'

interface Document {
  id: string
  slug: string
  title: string
  body: string
  domain_id: string
  type_id: string
  folder_id?: string
  tags: string[]
  visibility: Visibility
  created_at?: string
  updated_at?: string
  author?: { display_name?: string }
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDateLong(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Stats d'écriture simples dérivées du JSON TipTap (sans parcourir ProseMirror).
 * Approximation : on compte les mots du texte visible, les liens internes (via
 * noeuds `text` avec marks.type === 'link' pointant vers /documents/), et les
 * blocs image / heading. Si le JSON est invalide, valeurs à 0.
 */
interface EditorStats {
  words: number
  readingMinutes: number
  internalLinks: number
  images: number
  blocks: number
}

function computeStats(bodyJsonString: string): EditorStats {
  if (!bodyJsonString) return { words: 0, readingMinutes: 0, internalLinks: 0, images: 0, blocks: 0 }
  let root: unknown
  try {
    root = JSON.parse(bodyJsonString)
  } catch {
    return { words: 0, readingMinutes: 0, internalLinks: 0, images: 0, blocks: 0 }
  }
  let words = 0
  let internalLinks = 0
  let images = 0
  let blocks = 0
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; text?: string; marks?: Array<{ type?: string; attrs?: { href?: string } }>; content?: unknown[] }
    if (n.type === 'image') images += 1
    if (n.type && ['paragraph', 'heading', 'codeBlock', 'blockquote', 'bulletList', 'orderedList', 'taskList', 'alertBlock', 'table', 'image', 'horizontalRule'].includes(n.type)) {
      blocks += 1
    }
    if (n.type === 'text' && typeof n.text === 'string') {
      const w = n.text.trim().split(/\s+/).filter(Boolean)
      words += w.length
      if (n.marks) {
        for (const m of n.marks) {
          if (m.type === 'link' && m.attrs?.href && m.attrs.href.startsWith('/documents/')) {
            internalLinks += 1
          }
        }
      }
    }
    if (n.content && Array.isArray(n.content)) {
      for (const c of n.content) walk(c)
    }
  }
  walk(root)
  return {
    words,
    readingMinutes: Math.max(1, Math.round(words / 220)),
    internalLinks,
    images,
    blocks,
  }
}

export default function EditorPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isOpen: sidebarOpen } = useSidebar()
  const isEdit = !!slug

  const [searchParams] = useSearchParams()
  const initialFolderId = searchParams.get('folder_id') || ''
  const initialDomainId = searchParams.get('domain_id') || ''

  const [title, setTitle] = useState('')
  const [domainId, setDomainId] = useState(initialDomainId || user?.domain_id || '')
  const [typeId, setTypeId] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('dsi')
  const [tags, setTags] = useState<string[]>([])
  const [body, setBody] = useState('')
  const [loaded, setLoaded] = useState(!isEdit)
  const [domains, setDomains] = useState<Domain[]>([])
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(!isEdit)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [createdAt, setCreatedAt] = useState<string | undefined>()
  const [updatedAt, setUpdatedAt] = useState<string | undefined>()
  const [authorName, setAuthorName] = useState<string>('')
  const containerRef = useRef<HTMLDivElement>(null)
  const editorInstanceRef = useRef<Editor | null>(null) as MutableRefObject<Editor | null>
  const [editorReady, setEditorReady] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [folderId, setFolderId] = useState('')
  const [folders, setFolders] = useState<{ id: string; name: string; path: string }[]>([])

  // Pre-select folder from query param
  useEffect(() => {
    if (initialFolderId) setFolderId(initialFolderId)
  }, [initialFolderId])

  // Load domains and document types
  useEffect(() => {
    api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
    api.get<DocType[]>('/document-types').then(setDocTypes).catch(() => {})
  }, [])

  // Fetch and flatten folder tree when domainId changes
  useEffect(() => {
    if (!domainId) {
      setFolders([])
      return
    }
    api
      .get<any[]>(`/domains/${domainId}/folders`)
      .then((tree) => {
        const flat: { id: string; name: string; path: string }[] = []
        const flatten = (nodes: any[], prefix: string) => {
          for (const n of nodes) {
            const path = prefix ? `${prefix} / ${n.name}` : n.name
            flat.push({ id: n.id, name: n.name, path })
            if (n.children) flatten(n.children, path)
          }
        }
        flatten(tree, '')
        setFolders(flat)
      })
      .catch(() => {})
  }, [domainId])

  // Load existing document for edit mode
  useEffect(() => {
    if (!slug) return
    api
      .get<Document>(`/documents/${slug}`)
      .then((doc) => {
        setTitle(doc.title)
        setDomainId(doc.domain_id)
        setTypeId(doc.type_id)
        setVisibility((doc.visibility as Visibility) || 'dsi')
        setTags(doc.tags || [])
        setBody(doc.body)
        setDocumentId(doc.id)
        setFolderId(doc.folder_id || '')
        setCreatedAt(doc.created_at)
        setUpdatedAt(doc.updated_at)
        setAuthorName(doc.author?.display_name || '')
        setLoaded(true)
      })
      .catch(() => {
        navigate('/')
      })
  }, [slug, navigate])

  const handleEditorChange = useCallback((json: string) => {
    setBody(json)
    setDirty(true)
  }, [])

  const save = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      // body is a JSON string from TipTapEditor (JSON.stringify of getJSON()).
      // Parse it back to an object so api.post doesn't double-encode it.
      let parsedBody: unknown = {}
      if (body) {
        try {
          parsedBody = typeof body === 'string' ? JSON.parse(body) : body
        } catch {
          parsedBody = {}
        }
      }

      const payload = {
        title,
        body: parsedBody,
        domain_id: domainId,
        type_id: typeId,
        folder_id: folderId || null,
        tags,
        visibility,
      }

      if (documentId) {
        await api.put(`/documents/${documentId}`, payload)
      } else {
        const res = await api.post<{ id: string; slug: string }>('/documents', payload)
        setDocumentId(res.id)
        navigate(`/documents/${res.slug}/edit`, { replace: true })
      }

      setDirty(false)
      setLastSavedAt(new Date())
      setToast('Sauvegarde OK')
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      alert((err as Error).message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }, [saving, title, body, domainId, typeId, folderId, tags, visibility, documentId, navigate])

  // Ctrl+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [save])

  const handleCancel = () => {
    if (dirty && !window.confirm('Vous avez des modifications non sauvegardées. Quitter ?')) {
      return
    }
    if (slug) {
      navigate(`/documents/${slug}`)
    } else {
      navigate('/')
    }
  }

  // === Dérivés d'affichage =====================================================

  const activeDomain = useMemo(
    () => domains.find((d) => d.id === domainId) || null,
    [domains, domainId],
  )
  const domainKey: DomainKey = useMemo(
    () => normalizeDomain(activeDomain?.name ?? activeDomain?.slug),
    [activeDomain],
  )
  const activeType = useMemo(
    () => docTypes.find((t) => t.id === typeId) || null,
    [docTypes, typeId],
  )

  const stats = useMemo(() => computeStats(body), [body])

  // Ticker autosave (libellé "il y a Xs") — rafraîchi chaque 30 s pour que
  // l'indicateur reste vivant sans déclencher de re-render inutiles.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 1000), 30000)
    return () => clearInterval(id)
  }, [])
  const autosaveLabel = useMemo(() => {
    if (!lastSavedAt) return dirty ? 'Modifications non enregistrées' : 'Pas encore enregistré'
    const diffSec = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000)
    if (diffSec < 5) return 'Enregistré à l’instant'
    if (diffSec < 60) return `Enregistré il y a ${diffSec} s`
    const diffMin = Math.floor(diffSec / 60)
    return `Enregistré il y a ${diffMin} min`
    // tick force le recalcul périodique
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSavedAt, dirty, tick])

  // === Rendu ===================================================================

  return (
    <div ref={containerRef} className="flex flex-col">
      {/* ============ Sous-bandeau "Mode edition" + autosave ============ */}
      <div className="sticky top-0 z-[5] bg-white border-b border-line">
        <div className="max-w-[1440px] mx-auto px-8 py-3.5 flex items-center gap-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-coral-bg text-coral rounded-full text-[11px] font-bold uppercase tracking-[0.08em]">
            <span
              className="w-[7px] h-[7px] rounded-full bg-coral"
              style={{ animation: 'editor-edit-pulse 2s infinite' }}
              aria-hidden
            />
            Mode édition
          </span>
          <span
            className={
              dirty
                ? 'inline-flex items-center gap-1.5 px-3 py-1 bg-warn-bg text-warn rounded-lg text-[11.5px] font-semibold'
                : 'inline-flex items-center gap-1.5 px-3 py-1 bg-success-bg text-success rounded-lg text-[11.5px] font-semibold'
            }
          >
            {dirty ? <Clock className="w-[13px] h-[13px]" /> : <Check className="w-[13px] h-[13px]" />}
            {autosaveLabel}
          </span>
          {isEdit ? null : (
            <span className="text-[12px] text-ink-soft font-medium">
              Nouveau document
            </span>
          )}
        </div>
      </div>

      {/* Keyframe locale pour le pulse du badge (pas de token Tailwind équivalent). */}
      <style>{`@keyframes editor-edit-pulse { 0%,100% { opacity: 1 } 50% { opacity: .4 } }`}</style>

      {/* ============ Layout principal 2-colonnes ============ */}
      <div
        className={
          'grid mx-auto w-full max-w-[1440px] gap-7 px-8 pt-7 pb-28 ' +
          'grid-cols-[minmax(0,1fr)_340px] ' +
          'max-[1100px]:grid-cols-1 max-[1100px]:pb-36'
        }
      >
        {/* ============ Éditeur (colonne gauche) ============ */}
        <div className="min-w-0 flex flex-col gap-4">
          {/* Preview toggle switch : bascule entre l'éditeur TipTap et le rendu
              lecture (DocumentPreview). Logique conservée. */}
          {loaded && previewing ? (
            <section className="bg-white border border-line rounded-[18px] overflow-hidden min-h-[600px]">
              <div className="p-9 px-12">
                <h1 className="font-serif font-semibold text-[42px] leading-[1.1] tracking-[-0.02em] text-navy-900 mb-5">
                  {title || 'Sans titre'}
                </h1>
                <DocumentPreview
                  content={
                    body
                      ? (() => {
                          try {
                            return JSON.parse(body)
                          } catch {
                            return {}
                          }
                        })()
                      : {}
                  }
                />
              </div>
            </section>
          ) : loaded ? (
            <TipTapEditor
              content={body}
              documentId={documentId}
              onChange={handleEditorChange}
              onFirstInput={() => setShowTemplates(false)}
              onEditorReady={(e) => {
                editorInstanceRef.current = e
                setEditorReady(true)
              }}
              toolbarStickyTop={68}
              headerSlot={
                <div className="mb-6">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      setDirty(true)
                    }}
                    placeholder="Titre du document…"
                    aria-label="Titre du document"
                    className="w-full border-none outline-none bg-transparent font-serif font-semibold text-[42px] leading-[1.1] tracking-[-0.02em] text-navy-900 placeholder:text-ink-muted placeholder:font-medium"
                  />
                  <div className="mt-3 pt-3 pb-4 border-t border-b border-line-soft flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-ink-soft">
                    {activeDomain && (
                      <DomainChip domain={domainKey}>{activeDomain.name}</DomainChip>
                    )}
                    {activeType && (
                      <>
                        <span className="text-ink-muted">·</span>
                        <span>
                          Type : <strong className="text-ink font-semibold">{activeType.name}</strong>
                        </span>
                      </>
                    )}
                    {(authorName || user?.display_name) && (
                      <>
                        <span className="text-ink-muted">·</span>
                        <span>
                          {isEdit ? 'Créé par' : 'Auteur'}{' '}
                          <strong className="text-ink font-semibold">
                            {authorName || user?.display_name}
                          </strong>
                          {createdAt && (
                            <>
                              {' '}
                              · <span className="text-ink-soft">{formatDateLong(createdAt)}</span>
                            </>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              }
            />
          ) : (
            <section className="bg-white border border-line rounded-[18px] p-12 text-center text-[13px] text-ink-soft">
              Chargement du document…
            </section>
          )}
        </div>

        {/* ============ SidePanel meta (colonne droite) ============ */}
        <SidePanel stickyTop={112} className="gap-3.5">
          {/* Status box (gradient cream-light + icône coral) */}
          <div className="px-4 py-3 rounded-xl border border-line flex items-center gap-2.5 bg-gradient-to-br from-cream to-cream-light">
            <span className="w-8 h-8 bg-white text-coral rounded-lg grid place-items-center shrink-0 [&_svg]:w-4 [&_svg]:h-4">
              <Pencil />
            </span>
            <div className="text-[12px] leading-[1.4] text-ink-soft">
              <strong className="block text-navy-900 font-bold text-[13px]">
                {isEdit ? 'Modification en cours' : 'Nouveau document'}
              </strong>
              {isEdit && updatedAt
                ? `Dernière publication du ${formatDateLong(updatedAt)}`
                : 'La première sauvegarde créera le brouillon.'}
            </div>
          </div>

          {/* Card Classement */}
          <Card>
            <CardHead compact>
              <CardTitle>Classement</CardTitle>
            </CardHead>
            <CardBody padded={false} className="px-[18px] py-[14px] flex flex-col gap-3.5">
              <Field>
                <FieldLabel required>Domaine</FieldLabel>
                <Select
                  value={domainId}
                  onChange={(e) => {
                    setDomainId(e.target.value)
                    setDirty(true)
                  }}
                >
                  <option value="">Choisir un domaine…</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field>
                <FieldLabel required>Type de document</FieldLabel>
                <Select
                  value={typeId}
                  onChange={(e) => {
                    setTypeId(e.target.value)
                    setDirty(true)
                  }}
                >
                  <option value="">Choisir un type…</option>
                  {docTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {/* Folder picker (hors g6 mais fonctionnellement requis : pré-
                  sélection folder_id via query-param, pilotage arborescence). */}
              {domainId && (
                <Field>
                  <FieldLabel>Dossier</FieldLabel>
                  <Select
                    value={folderId}
                    onChange={(e) => {
                      setFolderId(e.target.value)
                      setDirty(true)
                    }}
                  >
                    <option value="">Racine du domaine</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.path}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              {/* Template picker (ex-grille, désormais Select inline). */}
              <TemplatePicker
                editor={editorInstanceRef.current}
                visible={showTemplates && editorReady}
                onUsed={(template) => {
                  setShowTemplates(false)
                  if (template.type_id) setTypeId(template.type_id)
                }}
              />

              <Field>
                <FieldLabel hintInline="séparés par entrée">Tags</FieldLabel>
                <TagInput
                  value={tags}
                  onChange={(t) => {
                    setTags(t)
                    setDirty(true)
                  }}
                />
              </Field>
            </CardBody>
          </Card>

          {/* Card Visibilité */}
          <Card>
            <CardHead compact>
              <CardTitle>Visibilité</CardTitle>
            </CardHead>
            <CardBody padded={false} className="px-[18px] py-[14px] flex flex-col gap-1.5">
              <VisibilityOption
                active={visibility === 'dsi'}
                icon={<Users />}
                title="DSI interne"
                desc="Lisible par les agents DSI connectés"
                onClick={() => {
                  setVisibility('dsi')
                  setDirty(true)
                }}
              />
              <VisibilityOption
                active={visibility === 'public'}
                icon={<Globe2 />}
                title="Public CPAM 92"
                desc="Consultable par tout agent CPAM 92"
                onClick={() => {
                  setVisibility('public')
                  setDirty(true)
                }}
              />
              <VisibilityOption
                active={visibility === 'private'}
                icon={<Lock />}
                title="Privé"
                desc="Vous uniquement + administrateurs"
                onClick={() => {
                  setVisibility('private')
                  setDirty(true)
                }}
              />
            </CardBody>
          </Card>

          {/* Card Aperçu recherche */}
          <Card>
            <CardHead compact>
              <CardTitle icon={<Search />}>Aperçu recherche</CardTitle>
            </CardHead>
            <CardBody padded={false} className="px-[18px] py-[14px] bg-cream-light">
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className={`w-7 h-7 rounded-lg grid place-items-center [&_svg]:w-3.5 [&_svg]:h-3.5 ${DOMAIN_ICON_BG[domainKey]}`}
                >
                  <FileText />
                </span>
                <div className="text-[13px] font-semibold text-ink leading-[1.3] truncate">
                  {title || 'Titre du document…'}
                </div>
              </div>
              <div className="text-[11.5px] text-ink-soft leading-[1.45]">
                {activeDomain?.name ?? DOMAIN_LABEL[domainKey]}
                {activeType ? ` · ${activeType.name}` : ''}
                {tags.length > 0 ? ` · ${tags.length} tag${tags.length > 1 ? 's' : ''}` : ''}
              </div>
            </CardBody>
          </Card>
        </SidePanel>
      </div>

      {/* ============ Action bar sticky bottom ============
          Responsive : left-0 par défaut (sidebar masquée ou viewport étroit),
          left-[248px] à partir de lg quand la sidebar est ouverte.
          Miroir de la logique Shell (sidebarOpen ? lg:grid-cols-[248px_1fr] :
          grid-cols-1) — si la sidebar est fermée, l'action bar reste collée
          au bord gauche quel que soit le viewport. */}
      <div
        className={
          'fixed bottom-0 right-0 z-10 bg-white border-t border-line shadow-[0_-4px_18px_rgba(20,35,92,0.06)] px-8 py-3.5 flex items-center gap-3.5 flex-wrap ' +
          (sidebarOpen ? 'left-0 lg:left-[248px]' : 'left-0')
        }
      >
        <div className="flex items-center gap-3 text-[12.5px] text-ink-soft">
          {lastSavedAt ? (
            <span>
              Dernière sauvegarde{' '}
              <strong className="text-navy-900 font-bold tabular-nums">
                {formatClock(lastSavedAt)}
              </strong>
            </span>
          ) : (
            <span className="italic">Pas encore sauvegardé</span>
          )}
          <span className="w-px h-[18px] bg-line" aria-hidden />
          <span>
            <strong className="text-navy-900 font-bold tabular-nums">
              {stats.words.toLocaleString('fr-FR')}
            </strong>{' '}
            mots ·{' '}
            <strong className="text-navy-900 font-bold tabular-nums">
              {stats.readingMinutes} min
            </strong>{' '}
            de lecture
          </span>
          <span className="w-px h-[18px] bg-line" aria-hidden />
          <span>
            {stats.internalLinks} lien{stats.internalLinks > 1 ? 's' : ''} interne ·{' '}
            {stats.images} image{stats.images > 1 ? 's' : ''} · {stats.blocks} bloc
            {stats.blocks > 1 ? 's' : ''}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" leftIcon={<Trash2 />} onClick={handleCancel}>
            Abandonner
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Eye />}
            onClick={() => setPreviewing((p) => !p)}
          >
            {previewing ? 'Éditer' : 'Aperçu'}
          </Button>
          <Button
            variant="cta"
            rightIcon={<ArrowRight />}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Publication…' : 'Publier la révision'}
          </Button>
        </div>
      </div>

      {/* Toast de confirmation (sauvegarde OK) */}
      {toast && (
        <div className="fixed bottom-24 right-6 z-50 px-4 py-2 bg-navy-900 text-white rounded-lg shadow-[0_10px_30px_rgba(20,35,92,0.35)] text-sm font-medium">
          {toast}
        </div>
      )}
    </div>
  )
}

/* ========================================================================
   Sous-composant VisibilityOption — radio-card g6.
   ======================================================================== */

interface VisibilityOptionProps {
  active: boolean
  icon: React.ReactNode
  title: string
  desc: string
  onClick: () => void
}

function VisibilityOption({ active, icon, title, desc, onClick }: VisibilityOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={
        'relative flex gap-2.5 px-3 py-2.5 border-[1.5px] rounded-[10px] text-left cursor-pointer transition-colors ' +
        (active
          ? 'border-navy-800 bg-cream-light'
          : 'border-line hover:border-navy-600 bg-white')
      }
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-2 right-2.5 w-[18px] h-[18px] rounded-full bg-navy-800 text-white text-[10px] font-bold grid place-items-center"
        >
          ✓
        </span>
      )}
      <span className="w-7 h-7 grid place-items-center rounded-[7px] bg-white text-navy-700 border border-line shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5">
        {icon}
      </span>
      <span className="flex-1 min-w-0 pr-6">
        <span className="block text-[12.5px] font-bold text-navy-900">{title}</span>
        <span className="block text-[11px] text-ink-soft mt-0.5 leading-[1.4]">{desc}</span>
      </span>
    </button>
  )
}
