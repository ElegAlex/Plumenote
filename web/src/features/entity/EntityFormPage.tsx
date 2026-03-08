import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import {
  useEntity,
  useEntityTypes,
  useCreateEntity,
  useUpdateEntity,
  useEntityLabel,
} from '@/lib/hooks'
import TipTapEditor from '../editor/TipTapEditor'
import type { EntityTypeSchemaField } from '@/lib/types'

interface Domain {
  id: string
  name: string
  slug: string
  color: string
}

export default function EntityFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const { data: existingEntity, isLoading: loadingEntity } = useEntity(id || '')
  const { data: entityTypes } = useEntityTypes()
  const createEntity = useCreateEntity()
  const updateEntity = useUpdateEntity()
  const { data: entityLabelConfig } = useEntityLabel()
  const entityLabel = entityLabelConfig?.label ?? 'Fiche'

  const [name, setName] = useState('')
  const [entityTypeId, setEntityTypeId] = useState('')
  const [domainId, setDomainId] = useState('')
  const [properties, setProperties] = useState<Record<string, string | number>>({})
  const [notes, setNotes] = useState('')
  const [domains, setDomains] = useState<Domain[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  // Load domains
  useEffect(() => {
    api.get<Domain[]>('/domains').then(setDomains).catch(() => {})
  }, [])

  // Populate form in edit mode
  useEffect(() => {
    if (!existingEntity) return
    setName(existingEntity.name)
    setEntityTypeId(existingEntity.entity_type.id)
    setDomainId(existingEntity.domain.id)
    setProperties(existingEntity.properties)
    if (existingEntity.notes) {
      setNotes(JSON.stringify(existingEntity.notes))
    }
  }, [existingEntity])

  const selectedType = entityTypes?.find((t) => t.id === entityTypeId)
  const schema: EntityTypeSchemaField[] = selectedType?.schema || []

  function setProperty(fieldName: string, value: string | number) {
    setProperties((prev) => ({ ...prev, [fieldName]: value }))
  }

  function validate(): boolean {
    const errs: string[] = []
    if (!name.trim()) errs.push('Le nom est requis')
    if (!entityTypeId) errs.push('Le type est requis')
    if (!domainId) errs.push('Le domaine est requis')
    for (const field of schema) {
      if (field.required) {
        const val = properties[field.name]
        if (val === undefined || val === '') {
          errs.push(`${field.label} est requis`)
        }
      }
    }
    setErrors(errs)
    return errs.length === 0
  }

  const save = useCallback(async () => {
    if (saving || !validate()) return
    setSaving(true)
    try {
      const payload = {
        entity_type_id: entityTypeId,
        domain_id: domainId,
        name: name.trim(),
        properties,
        notes: notes ? JSON.parse(notes) : undefined,
      }

      let result
      if (isEdit && id) {
        result = await updateEntity.mutateAsync({ id, ...payload })
      } else {
        result = await createEntity.mutateAsync(payload)
      }

      setToast(true)
      setTimeout(() => setToast(false), 2000)
      navigate(`/entities/${result.id}`)
    } catch {
      setErrors(['Erreur lors de la sauvegarde'])
    } finally {
      setSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, name, entityTypeId, domainId, properties, notes, isEdit, id, navigate])

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

  if (isEdit && loadingEntity) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-ink-45">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-ink-70">
          {isEdit ? `Modifier ${entityLabel.toLowerCase()}` : `Nouveau ${entityLabel.toLowerCase()}`}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-blue text-white rounded-lg hover:bg-blue/90 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={() => isEdit ? navigate(`/entities/${id}`) : navigate('/')}
            className="px-4 py-2 border rounded-lg hover:bg-ink-05 text-sm text-ink-70"
          >
            Annuler
          </button>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-red/10 border border-red/20 rounded-lg">
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-red">{err}</p>
          ))}
        </div>
      )}

      {/* Form */}
      <div className="space-y-4 mb-6">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Nom de ${entityLabel.toLowerCase()}`}
          className="w-full text-2xl font-bold border-0 border-b-2 border-ink-10 focus:border-blue focus:ring-0 outline-none pb-2 bg-transparent"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-45 mb-1">Type *</label>
            <select
              value={entityTypeId}
              onChange={(e) => {
                setEntityTypeId(e.target.value)
                setProperties({})
              }}
              disabled={isEdit}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-bg disabled:opacity-50"
            >
              <option value="">Choisir...</option>
              {entityTypes?.map((t) => (
                <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-45 mb-1">Domaine *</label>
            <select
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-bg"
            >
              <option value="">Choisir...</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic properties */}
      {schema.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-ink-70 mb-3">Proprietes</h2>
          <div className="bg-bg border border-ink-10 rounded-lg p-4 space-y-4">
            {schema.map((field) => (
              <div key={field.name}>
                <label className="block text-xs font-medium text-ink-45 mb-1">
                  {field.label}{field.required ? ' *' : ''}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={String(properties[field.name] ?? '')}
                    onChange={(e) => setProperty(field.name, e.target.value)}
                    rows={3}
                    className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={String(properties[field.name] ?? '')}
                    onChange={(e) => setProperty(field.name, e.target.value)}
                    className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm bg-bg focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                  >
                    <option value="">Choisir...</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
                    value={String(properties[field.name] ?? '')}
                    onChange={(e) => setProperty(field.name, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                    className="w-full border border-ink-10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notes (TipTap editor) */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-ink-70 mb-3">Notes (optionnel)</h2>
        <TipTapEditor
          content={notes}
          documentId={null}
          onChange={(json) => setNotes(json)}
        />
      </section>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#2D8B4E] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50">
          Sauvegarde OK
        </div>
      )}
    </div>
  )
}
