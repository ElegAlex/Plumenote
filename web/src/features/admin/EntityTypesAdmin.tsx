// web/src/features/admin/EntityTypesAdmin.tsx
// Vue "Types de fiche" — version allégée alignée sur tokens (gabarit g9).
// Logique CRUD et schema editor préservés.
import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react'
import { ApiError } from '@/lib/api'
import {
  useEntityTypes,
  useCreateEntityType,
  useUpdateEntityType,
  useDeleteEntityType,
  useEntityLabel,
} from '@/lib/hooks'
import type { EntityTypeSchemaField, EntityType } from '@/lib/types'
import {
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogFoot,
  DialogHead,
  Field,
  FieldError,
  FieldLabel,
  IconButton,
  Input,
  Select,
  Table,
  TBody,
  THead,
  Td,
  Th,
  TitleEyebrow,
  Tr,
} from '@/components/ui'
import { cn } from '@/lib/cn'

const FIELD_TYPES = ['text', 'textarea', 'url', 'number', 'date', 'select'] as const

const emptyField: EntityTypeSchemaField = { name: '', label: '', type: 'text', required: false }

interface FormState {
  name: string
  icon: string
  schema: EntityTypeSchemaField[]
}

const emptyForm: FormState = { name: '', icon: '', schema: [] }

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export default function EntityTypesAdmin() {
  const { data: entityTypes, isLoading } = useEntityTypes()
  const createEntityType = useCreateEntityType()
  const updateEntityType = useUpdateEntityType()
  const deleteEntityType = useDeleteEntityType()
  const { data: entityLabelConfig } = useEntityLabel()
  const entityLabel = entityLabelConfig?.label ?? 'Fiche'

  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<EntityType | null>(null)
  const [deleteError, setDeleteError] = useState('')

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }

  function openEdit(et: EntityType) {
    setEditing(et.id)
    setForm({ name: et.name, icon: et.icon, schema: [...et.schema] })
    setShowForm(true)
    setError('')
  }

  const save = useCallback(async () => {
    setError('')
    if (!form.name.trim()) {
      setError('Le nom est requis')
      return
    }
    const schema = form.schema.map((f) => ({
      ...f,
      name: f.name || slugify(f.label),
    }))
    try {
      if (editing) {
        await updateEntityType.mutateAsync({ id: editing, name: form.name, icon: form.icon, schema })
      } else {
        await createEntityType.mutateAsync({ name: form.name, icon: form.icon, schema })
      }
      setShowForm(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }, [form, editing, createEntityType, updateEntityType])

  async function handleDelete(et: EntityType) {
    setDeleteError('')
    try {
      await deleteEntityType.mutateAsync(et.id)
      setDeleteConfirm(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setDeleteError(`Ce type contient ${et.entity_count} ${entityLabel.toLowerCase()}(s). Supprimez-les avant.`)
      } else {
        setDeleteError(e instanceof ApiError ? e.message : 'Erreur lors de la suppression')
      }
    }
  }

  function addField() {
    setForm({ ...form, schema: [...form.schema, { ...emptyField }] })
  }

  function removeField(index: number) {
    setForm({ ...form, schema: form.schema.filter((_, i) => i !== index) })
  }

  function updateField(index: number, patch: Partial<EntityTypeSchemaField>) {
    const schema = form.schema.map((f, i) => (i === index ? { ...f, ...patch } : f))
    setForm({ ...form, schema })
  }

  function moveField(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= form.schema.length) return
    const schema = [...form.schema]
    ;[schema[index], schema[target]] = [schema[target], schema[index]]
    setForm({ ...form, schema })
  }

  if (isLoading) return <p className="text-ink-muted">Chargement...</p>

  return (
    <div className="flex flex-col gap-[18px]">
      <section className="flex items-center justify-between gap-5 flex-wrap">
        <div>
          <TitleEyebrow>Administration</TitleEyebrow>
          <h1 className="font-serif font-semibold text-[28px] leading-[1.15] tracking-[-0.02em] text-navy-900">
            Types de {entityLabel.toLowerCase()}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-soft leading-[1.55] max-w-[620px]">
            Définissez les schémas de {entityLabel.toLowerCase()} utilisés pour la création d'entités typées.
          </p>
        </div>
        <Button variant="cta" leftIcon={<Plus size={14} strokeWidth={2.5} />} onClick={openCreate}>
          Nouveau type
        </Button>
      </section>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr className="!bg-cream-light hover:!bg-cream-light">
              <Th>Icône</Th>
              <Th>Nom</Th>
              <Th>Champs</Th>
              <Th>{entityLabel}s</Th>
              <Th className="text-right !pr-4">
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {entityTypes?.map((et) => (
              <Tr key={et.id}>
                <Td>
                  <span className="text-lg" aria-hidden>
                    {et.icon}
                  </span>
                </Td>
                <Td>
                  <span className="font-semibold text-ink">{et.name}</span>
                </Td>
                <Td>
                  <span className="tabular-nums text-ink-soft">{et.schema.length}</span>
                </Td>
                <Td>
                  <span className="tabular-nums font-semibold text-navy-900">{et.entity_count}</span>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <div className="inline-flex gap-1 justify-end">
                    <IconButton
                      aria-label="Modifier le type"
                      icon={<Pencil size={13} />}
                      className="!w-[30px] !h-[30px] !rounded-md"
                      onClick={() => openEdit(et)}
                    />
                    <IconButton
                      aria-label="Supprimer le type"
                      icon={<Trash2 size={13} />}
                      className={cn('!w-[30px] !h-[30px] !rounded-md', 'hover:!border-danger hover:!text-danger hover:!bg-danger-bg')}
                      onClick={() => {
                        setDeleteConfirm(et)
                        setDeleteError('')
                      }}
                    />
                  </div>
                </Td>
              </Tr>
            ))}
            {(!entityTypes || entityTypes.length === 0) && (
              <Tr>
                <Td colSpan={5} className="py-8 text-center text-ink-muted">
                  Aucun type défini.
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </Card>

      {/* Form modal */}
      <Dialog
        open={showForm}
        onClose={() => setShowForm(false)}
        aria-label={editing ? 'Modifier le type' : 'Nouveau type'}
        maxWidth={720}
      >
        <DialogHead>
          <h3 className="font-serif font-semibold text-[18px] text-navy-900">
            {editing ? 'Modifier le type' : 'Nouveau type'}
          </h3>
        </DialogHead>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel required>Nom</FieldLabel>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel>Icône (emoji)</FieldLabel>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="ex: 📦"
                />
              </Field>
            </div>

            {/* Schema editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12.5px] font-semibold text-ink">Champs du schéma</span>
                <Button variant="ghost" size="sm" onClick={addField} leftIcon={<Plus size={12} />}>
                  Ajouter un champ
                </Button>
              </div>

              {form.schema.length === 0 && (
                <p className="text-[13px] text-ink-muted py-4 text-center border border-dashed border-line rounded-lg">
                  Aucun champ. Cliquez sur « Ajouter un champ ».
                </p>
              )}

              <div className="flex flex-col gap-3">
                {form.schema.map((field, i) => (
                  <div key={i} className="border border-line rounded-lg p-3 bg-cream-light/60">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <Field>
                        <FieldLabel>Label</FieldLabel>
                        <Input
                          value={field.label}
                          onChange={(e) => updateField(i, { label: e.target.value, name: slugify(e.target.value) })}
                          placeholder="ex: Adresse IP"
                          inputClassName="!py-[7px] !text-[13px]"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Type</FieldLabel>
                        <Select
                          value={field.type}
                          onChange={(e) => updateField(i, { type: e.target.value as EntityTypeSchemaField['type'] })}
                          className="!py-[8px]"
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(i, { required: e.target.checked })}
                            className="accent-coral"
                          />
                          Requis
                        </label>
                        <div className="flex gap-1 ml-auto">
                          <button
                            type="button"
                            onClick={() => moveField(i, -1)}
                            disabled={i === 0}
                            aria-label="Déplacer vers le haut"
                            className="text-ink-muted hover:text-ink disabled:opacity-25 text-xs px-1"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveField(i, 1)}
                            disabled={i === form.schema.length - 1}
                            aria-label="Déplacer vers le bas"
                            className="text-ink-muted hover:text-ink disabled:opacity-25 text-xs px-1"
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeField(i)}
                            aria-label="Supprimer le champ"
                            className="text-danger hover:opacity-80 text-xs px-1"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {field.type === 'select' && (
                      <Field>
                        <FieldLabel>Options (séparées par des virgules)</FieldLabel>
                        <Input
                          value={field.options?.join(', ') ?? ''}
                          onChange={(e) =>
                            updateField(i, {
                              options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          placeholder="ex: Option A, Option B, Option C"
                          inputClassName="!py-[7px] !text-[13px]"
                        />
                      </Field>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {error && <FieldError>{error}</FieldError>}
          </div>
        </DialogBody>
        <DialogFoot>
          <Button variant="secondary" onClick={() => setShowForm(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={save}>
            {editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFoot>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        aria-label="Confirmer la suppression"
        maxWidth={420}
      >
        <DialogHead>
          <h3 className="font-serif font-semibold text-[18px] text-navy-900">Confirmer la suppression</h3>
        </DialogHead>
        <DialogBody>
          {deleteConfirm && (
            <p className="text-[13.5px] text-ink-soft">
              Supprimer le type <strong className="text-navy-900">« {deleteConfirm.name} »</strong> ?
            </p>
          )}
          {deleteError && <p className="mt-3 text-[12.5px] text-danger">{deleteError}</p>}
        </DialogBody>
        <DialogFoot>
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
            Annuler
          </Button>
          <Button variant="danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
            Supprimer
          </Button>
        </DialogFoot>
      </Dialog>
    </div>
  )
}
