import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import TagInput from '@/features/editor/TagInput'
import { useCreateBookmark, useUpdateBookmark } from '@/lib/hooks/useBookmarks'
import type { Bookmark } from '@/lib/types'

interface Domain {
  id: string
  name: string
  slug: string
  color: string
}

interface BookmarkFormProps {
  bookmark?: Bookmark
  onClose: () => void
  onSaved?: () => void
}

function validateUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

function BookmarkFormFields({
  bookmark,
  onClose,
  onSaved,
}: BookmarkFormProps) {
  const [title, setTitle] = useState(bookmark?.title ?? '')
  const [url, setUrl] = useState(bookmark?.url ?? '')
  const [description, setDescription] = useState(bookmark?.description ?? '')
  const [domainId, setDomainId] = useState(bookmark?.domain_id ?? '')
  const [tags, setTags] = useState<string[]>(bookmark?.tags ?? [])
  const [domains, setDomains] = useState<Domain[]>([])
  const [urlError, setUrlError] = useState('')
  const [error, setError] = useState('')

  const createMutation = useCreateBookmark()
  const updateMutation = useUpdateBookmark()
  const isEditing = !!bookmark

  useEffect(() => {
    api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateUrl(url)) {
      setUrlError("L'URL doit commencer par http:// ou https://")
      return
    }
    setUrlError('')

    const payload = { title, url, description, domain_id: domainId, tags }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: bookmark.id, ...payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onSaved?.()
      onClose()
    } catch {
      setError('Une erreur est survenue. Veuillez reessayer.')
    }
  }

  const isBusy = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Titre <span className="text-red">*</span>
        </label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre du lien"
          className="w-full border border-ink-10 rounded-lg px-3 py-2 text-sm bg-bg focus:ring-2 focus:ring-blue focus:border-blue outline-none"
        />
      </div>

      {/* URL */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          URL <span className="text-red">*</span>
        </label>
        <input
          type="url"
          required
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            if (urlError) setUrlError('')
          }}
          placeholder="https://exemple.com"
          className={`w-full border rounded-lg px-3 py-2 text-sm bg-bg focus:ring-2 focus:ring-blue focus:border-blue outline-none ${
            urlError ? 'border-red' : 'border-ink-10'
          }`}
        />
        {urlError && <p className="text-red text-xs mt-1">{urlError}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description optionnelle..."
          rows={3}
          className="w-full border border-ink-10 rounded-lg px-3 py-2 text-sm bg-bg focus:ring-2 focus:ring-blue focus:border-blue outline-none resize-none"
        />
      </div>

      {/* Domain */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Domaine <span className="text-red">*</span>
        </label>
        <select
          required
          value={domainId}
          onChange={(e) => setDomainId(e.target.value)}
          className="w-full border border-ink-10 rounded-lg px-3 py-2 text-sm bg-bg focus:ring-2 focus:ring-blue focus:border-blue outline-none"
        >
          <option value="">Choisir un domaine...</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Tags</label>
        <TagInput value={tags} onChange={setTags} />
      </div>

      {/* Error */}
      {error && <p className="text-red text-sm">{error}</p>}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-ink-70 hover:text-ink transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isBusy || !title || !url || !domainId}
          className="px-5 py-2 bg-blue text-white text-sm font-medium rounded-md hover:bg-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBusy ? 'Enregistrement...' : isEditing ? 'Mettre a jour' : 'Ajouter le lien'}
        </button>
      </div>
    </form>
  )
}

/** Modal wrapper — renders BookmarkFormFields inside a backdrop overlay */
export default function BookmarkForm(props: BookmarkFormProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-ink/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose() }}
    >
      <div className="w-full max-w-lg bg-bg rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "'Archivo Black', sans-serif" }}
          >
            {props.bookmark ? 'Modifier le lien' : 'Ajouter un lien externe'}
          </h2>
          <button
            onClick={props.onClose}
            className="text-ink-45 hover:text-ink-70 p-1"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <BookmarkFormFields {...props} />
      </div>
    </div>
  )
}

/** Inline variant — no modal overlay, for use in standalone pages */
export function BookmarkFormInline({
  bookmark,
  onSaved,
}: {
  bookmark?: Bookmark
  onSaved?: () => void
}) {
  return (
    <BookmarkFormFields
      bookmark={bookmark}
      onClose={() => onSaved?.()}
      onSaved={onSaved}
    />
  )
}
