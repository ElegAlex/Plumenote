import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
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

interface Document {
  id: string
  slug: string
  title: string
  body: string
  domain_id: string
  type_id: string
  folder_id?: string
  tags: string[]
  visibility: 'public' | 'dsi'
}

export default function EditorPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEdit = !!slug

  const [searchParams] = useSearchParams()
  const initialFolderId = searchParams.get('folder_id') || ''
  const initialDomainId = searchParams.get('domain_id') || ''

  const [title, setTitle] = useState('')
  const [domainId, setDomainId] = useState(initialDomainId || user?.domain_id || '')
  const [typeId, setTypeId] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'dsi'>('dsi')
  const [tags, setTags] = useState<string[]>([])
  const [body, setBody] = useState('')
  const [loaded, setLoaded] = useState(!isEdit)
  const [domains, setDomains] = useState<Domain[]>([])
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(!isEdit)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [dirty, setDirty] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorInstanceRef = useRef<Editor | null>(null) as MutableRefObject<Editor | null>
  const [editorReady, setEditorReady] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [folderId, setFolderId] = useState('')
  const [folders, setFolders] = useState<{ id: string; name: string; path: string }[]>([])

  // Pre-select folder from query param
  useEffect(() => { if (initialFolderId) setFolderId(initialFolderId) }, [initialFolderId])

  // Load domains and document types
  useEffect(() => {
    api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
    api.get<DocType[]>('/document-types').then(setDocTypes).catch(() => {})
  }, [])

  // Fetch and flatten folder tree when domainId changes
  useEffect(() => {
    if (!domainId) { setFolders([]); return }
    api.get<any[]>(`/domains/${domainId}/folders`).then((tree) => {
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
    }).catch(() => {})
  }, [domainId])

  // Load existing document for edit mode
  useEffect(() => {
    if (!slug) return
    api.get<Document>(`/documents/${slug}`).then((doc) => {
      setTitle(doc.title)
      setDomainId(doc.domain_id)
      setTypeId(doc.type_id)
      setVisibility(doc.visibility)
      setTags(doc.tags || [])
      setBody(doc.body)
      setDocumentId(doc.id)
      setFolderId(doc.folder_id || '')
      setLoaded(true)
    }).catch(() => {
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
      const payload = {
        title,
        body,
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
      setToast(true)
      setTimeout(() => setToast(false), 2000)
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
    if (dirty && !window.confirm('Vous avez des modifications non sauvegardees. Quitter ?')) {
      return
    }
    if (slug) {
      navigate(`/documents/${slug}`)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-ink-70">
          {isEdit ? 'Modifier le document' : 'Nouveau document'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewing((p) => !p)}
            className={`px-4 py-2 border rounded-lg text-sm font-medium ${previewing ? 'bg-ink-10 text-ink' : 'hover:bg-ink-05 text-ink-70'}`}
          >
            {previewing ? 'Editer' : 'Previsualiser'}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-blue text-white rounded-lg hover:bg-blue/90 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? 'Sauvegarde...' : 'Publier'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border rounded-lg hover:bg-ink-05 text-sm text-ink-70"
          >
            Annuler
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-4 mb-6">
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
          placeholder="Titre du document"
          className="w-full text-2xl font-bold border-0 border-b-2 border-ink-10 focus:border-blue focus:ring-0 outline-none pb-2 bg-transparent"
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-45 mb-1">Domaine</label>
            <select
              value={domainId}
              onChange={(e) => { setDomainId(e.target.value); setDirty(true) }}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-bg"
            >
              <option value="">Choisir...</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-45 mb-1">Type</label>
            <select
              value={typeId}
              onChange={(e) => { setTypeId(e.target.value); setDirty(true) }}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-bg"
            >
              <option value="">Choisir...</option>
              {docTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-45 mb-1">Visibilite</label>
            <button
              type="button"
              onClick={() => { setVisibility((v) => v === 'public' ? 'dsi' : 'public'); setDirty(true) }}
              className={`w-full border rounded-lg px-3 py-2 text-sm text-left ${
                visibility === 'public' ? 'bg-[#2D8B4E]/10 border-[#2D8B4E]/30 text-[#2D8B4E]' : 'bg-orange-50 border-orange-300 text-orange-700'
              }`}
            >
              {visibility === 'public' ? 'Public' : 'DSI uniquement'}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-45 mb-1">Tags</label>
            <TagInput value={tags} onChange={(t) => { setTags(t); setDirty(true) }} />
          </div>
        </div>

        {/* Folder picker */}
        {domainId && (
          <div>
            <label className="block text-sm font-medium text-ink-70 mb-1">Dossier</label>
            <select
              value={folderId}
              onChange={(e) => { setFolderId(e.target.value); setDirty(true) }}
              className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm bg-bg"
            >
              <option value="">Aucun dossier (racine du domaine)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.path}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Template picker */}
      <TemplatePicker
        editor={editorInstanceRef.current}
        visible={showTemplates && editorReady}
        onUsed={(template) => {
          setShowTemplates(false)
          if (template.type_id) setTypeId(template.type_id)
        }}
      />

      {/* Editor / Preview toggle */}
      {previewing ? (
        <div className="border rounded-lg bg-bg p-6">
          <DocumentPreview content={body ? (() => { try { return JSON.parse(body) } catch { return {} } })() : {}} />
        </div>
      ) : loaded ? (
        <TipTapEditor
          content={body}
          documentId={documentId}
          onChange={handleEditorChange}
          onFirstInput={() => setShowTemplates(false)}
          onEditorReady={(e) => { editorInstanceRef.current = e; setEditorReady(true) }}
        />
      ) : null}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#2D8B4E] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50">
          Sauvegarde OK
        </div>
      )}
    </div>
  )
}
