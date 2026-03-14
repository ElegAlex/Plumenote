import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Folder, Plus, Trash2, Shield } from 'lucide-react'

interface PathItem { id: string; name: string; slug: string }
interface ChildFolder { id: string; name: string; slug: string }
interface DocItem { id: string; title: string; slug: string; updated_at: string }
interface DocsByType { type_name: string; type_slug: string; documents: DocItem[] }

interface FolderData {
  id: string
  name: string
  slug: string
  domain_id: string
  domain_name: string
  domain_slug: string
  parent_id: string | null
  path: PathItem[]
  children: ChildFolder[]
  documents_by_type: DocsByType[]
  user_role: string
}

export default function FolderPage() {
  const { domainSlug, folderId } = useParams<{ domainSlug: string; folderId: string }>()
  const navigate = useNavigate()
  const [folder, setFolder] = useState<FolderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [showPerms, setShowPerms] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (!folderId) return
    setLoading(true)
    api.get<FolderData>(`/folders/${folderId}`)
      .then(setFolder)
      .catch(() => navigate(`/domains/${domainSlug}`))
      .finally(() => setLoading(false))
  }, [folderId, domainSlug, navigate])

  if (loading || !folder) {
    return <div className="p-6 text-ink-45">Chargement...</div>
  }

  const isEditor = folder.user_role === 'editor' || folder.user_role === 'manager'
  const isManager = folder.user_role === 'manager'

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // Suppress unused state warnings — will be wired in Task 14
  void showDelete
  void showPerms
  void showCreate

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-ink-45 mb-4 flex-wrap">
        <Link to="/" className="hover:text-blue transition-colors">Accueil</Link>
        <span>&gt;</span>
        <Link to={`/domains/${folder.domain_slug}`} className="hover:text-blue transition-colors">
          {folder.domain_name}
        </Link>
        {folder.path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1">
            <span>&gt;</span>
            {i === folder.path.length - 1 ? (
              <span className="text-ink font-medium">{p.name}</span>
            ) : (
              <Link
                to={`/domains/${folder.domain_slug}/folders/${p.id}`}
                className="hover:text-blue transition-colors"
              >
                {p.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-ink">{folder.name}</h1>
        <div className="flex items-center gap-2">
          {isEditor && (
            <button
              onClick={() => navigate(`/documents/new?folder_id=${folder.id}&domain_id=${folder.domain_id}`)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue/10 text-blue rounded-md hover:bg-blue/20"
            >
              <Plus size={14} /> Document
            </button>
          )}
          {isManager && (
            <>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-ink-05 text-ink-70 rounded-md hover:bg-ink-10"
              >
                <Folder size={14} /> Sous-dossier
              </button>
              <button
                onClick={() => setShowPerms(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-ink-05 text-ink-70 rounded-md hover:bg-ink-10"
              >
                <Shield size={14} /> Permissions
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red/10 text-red rounded-md hover:bg-red/20"
              >
                <Trash2 size={14} /> Supprimer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-folders */}
      {folder.children.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-ink-45 uppercase tracking-wider mb-3">Sous-dossiers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {folder.children.map((child) => (
              <Link
                key={child.id}
                to={`/domains/${domainSlug}/folders/${child.id}`}
                className="flex items-center gap-2 p-3 border border-ink-10 rounded-lg hover:bg-ink-05 transition-colors"
              >
                <Folder size={16} className="text-ink-45 shrink-0" />
                <span className="text-sm font-medium text-ink truncate">{child.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Documents by type */}
      {folder.documents_by_type.length > 0 ? (
        folder.documents_by_type.map((group) => (
          <div key={group.type_slug} className="mb-6">
            <h2 className="text-xs font-semibold text-ink-45 uppercase tracking-wider mb-3">
              {group.type_name}
            </h2>
            <div className="space-y-1">
              {group.documents.map((doc) => (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.slug}`}
                  className="flex items-center justify-between p-3 border border-ink-05 rounded-lg hover:bg-ink-05 transition-colors"
                >
                  <span className="text-sm text-ink font-medium">{doc.title}</span>
                  <span className="text-xs text-ink-45">{formatDate(doc.updated_at)}</span>
                </Link>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-ink-45">Aucun document dans ce dossier.</p>
      )}

      {/* Modals placeholder — will be wired in Task 14 */}
    </div>
  )
}
