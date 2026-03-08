import { useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { useEntity, useDeleteEntity, useEntityLabel } from '@/lib/hooks'
import DocumentContent from '../reader/DocumentContent'
import MindMapView from '@/features/mindmap/MindMapView'

export default function EntityPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: entity, isLoading, error } = useEntity(id || '')
  const deleteEntity = useDeleteEntity()
  const { data: entityLabelConfig } = useEntityLabel()
  const entityLabel = entityLabelConfig?.label ?? 'Fiche'

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMindMap, setShowMindMap] = useState(false)

  const handleDelete = useCallback(async () => {
    if (!id) return
    try {
      await deleteEntity.mutateAsync(id)
      navigate('/')
    } catch {
      // error handled by mutation
    }
  }, [id, deleteEntity, navigate])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-ink-45">Chargement...</p>
      </div>
    )
  }

  if (error || !entity) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red">{entityLabel} introuvable</p>
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
          <h1 className="text-lg font-semibold text-ink">
            Mind Map — {entity.entity_type.icon} {entity.name}
          </h1>
        </div>
        <div className="flex-1 min-h-0">
          <MindMapView rootType="entity" rootId={id!} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm text-ink-45 mb-6 gap-1">
        <Link to="/" className="hover:text-ink">Accueil</Link>
        <span>/</span>
        <span className="text-ink">{entityLabel}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{entity.entity_type.icon}</span>
            <h1 className="text-2xl font-bold text-ink">{entity.name}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-ink-05 rounded text-ink-70">
              {entity.entity_type.icon} {entity.entity_type.name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entity.domain.color }} />
              <span className="text-ink-70">{entity.domain.name}</span>
            </span>
            <span className="text-ink-45">par {entity.author_name}</span>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMindMap(true)}
              className="px-4 py-2 text-sm font-medium text-ink-70 border border-ink-10 rounded-md hover:bg-ink-05"
            >
              Mind Map
            </button>
            <button
              onClick={() => navigate(`/entities/${id}/edit`)}
              className="px-4 py-2 text-sm font-medium text-blue border border-blue rounded-md hover:bg-blue/5"
            >
              Modifier
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 text-sm font-medium text-red border border-red rounded-md hover:bg-red/5"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>

      {/* Properties */}
      {entity.entity_type.schema.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">Proprietes</h2>
          <div className="bg-bg border border-ink-10 rounded-lg p-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {entity.entity_type.schema.map((field) => {
                const value = entity.properties[field.name]
                return (
                  <div key={field.name}>
                    <dt className="text-xs font-medium text-ink-45 uppercase tracking-wide">{field.label}</dt>
                    <dd className={`text-sm mt-0.5 ${value ? 'text-ink' : 'text-ink-25'}`}>
                      {field.type === 'url' && value ? (
                        <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline break-all">
                          {String(value)}
                        </a>
                      ) : (
                        String(value ?? '—')
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        </section>
      )}

      {/* Notes */}
      {entity.notes && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">Notes</h2>
          <div className="bg-bg border border-ink-10 rounded-lg p-6">
            <DocumentContent content={entity.notes} />
          </div>
        </section>
      )}

      {/* Relations */}
      {(entity.relations_outgoing.length > 0 || entity.relations_incoming.length > 0) && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">Relations</h2>
          <div className="space-y-4">
            {entity.relations_outgoing.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-ink-45 mb-2">Relations sortantes</h3>
                <div className="space-y-1">
                  {entity.relations_outgoing.map((rel) => (
                    <Link
                      key={rel.id}
                      to={`/entities/${rel.target?.id}`}
                      className="flex items-center gap-2 p-2 rounded hover:bg-ink-05 text-sm"
                    >
                      <span className="text-ink-45">{rel.relation_type.name}</span>
                      <span className="text-ink-25">&rarr;</span>
                      <span>{rel.target?.type_icon}</span>
                      <span className="text-ink font-medium">{rel.target?.name}</span>
                      <span className="text-ink-45 text-xs">({rel.target?.type_name})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {entity.relations_incoming.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-ink-45 mb-2">Relations entrantes</h3>
                <div className="space-y-1">
                  {entity.relations_incoming.map((rel) => (
                    <Link
                      key={rel.id}
                      to={`/entities/${rel.source?.id}`}
                      className="flex items-center gap-2 p-2 rounded hover:bg-ink-05 text-sm"
                    >
                      <span>{rel.source?.type_icon}</span>
                      <span className="text-ink font-medium">{rel.source?.name}</span>
                      <span className="text-ink-45 text-xs">({rel.source?.type_name})</span>
                      <span className="text-ink-25">&rarr;</span>
                      <span className="text-ink-45">{rel.relation_type.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Linked Documents */}
      {entity.linked_documents.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">Documents lies</h2>
          <div className="space-y-1">
            {entity.linked_documents.map((doc) => {
              const badgeColor = doc.freshness_badge === 'green' ? '#2D8B4E' : doc.freshness_badge === 'yellow' ? '#F59E0B' : '#EF4444'
              return (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.slug}`}
                  className="flex items-center gap-2 p-2 rounded hover:bg-ink-05 text-sm"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: badgeColor }} />
                  <span className="text-ink font-medium">{doc.title}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Linked Bookmarks */}
      {entity.linked_bookmarks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">Liens externes</h2>
          <div className="space-y-1">
            {entity.linked_bookmarks.map((bm) => (
              <a
                key={bm.id}
                href={bm.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded hover:bg-ink-05 text-sm"
              >
                <svg className="w-4 h-4 text-ink-45 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="text-blue font-medium">{bm.title}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-bg rounded-lg shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-ink-70 mb-4">
              Supprimer {entityLabel.toLowerCase()} &laquo;&nbsp;{entity.name}&nbsp;&raquo; ?
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-ink-70 border border-ink-10 rounded-md hover:bg-ink-05">
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteEntity.isPending}
                className="px-4 py-2 text-sm text-white bg-red rounded-md hover:bg-red/90 disabled:opacity-50"
              >
                {deleteEntity.isPending ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
