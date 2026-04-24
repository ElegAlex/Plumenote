// web/src/features/admin/RelationTypesAdmin.tsx
// Vue "Types de relations" — alignement tokens + logique CRUD préservée.
import { useState, useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { useRelationTypes, useCreateRelationType, useDeleteRelationType } from '@/lib/hooks'
import type { RelationType } from '@/lib/types'
import {
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogFoot,
  DialogHead,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  IconButton,
  Input,
  Table,
  TBody,
  THead,
  Td,
  Th,
  TitleEyebrow,
  Tr,
} from '@/components/ui'
import { cn } from '@/lib/cn'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

interface FormState {
  name: string
  inverse_name: string
}

const emptyForm: FormState = { name: '', inverse_name: '' }

export default function RelationTypesAdmin() {
  const { data: relationTypes, isLoading } = useRelationTypes()
  const createRelationType = useCreateRelationType()
  const deleteRelationType = useDeleteRelationType()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<RelationType | null>(null)
  const [deleteError, setDeleteError] = useState('')

  function openCreate() {
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }

  const save = useCallback(async () => {
    setError('')
    if (!form.name.trim() || !form.inverse_name.trim()) {
      setError('Les deux noms sont requis')
      return
    }
    try {
      await createRelationType.mutateAsync({
        name: form.name,
        slug: slugify(form.name),
        inverse_name: form.inverse_name,
        inverse_slug: slugify(form.inverse_name),
      })
      setShowForm(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }, [form, createRelationType])

  async function handleDelete(rt: RelationType) {
    setDeleteError('')
    try {
      await deleteRelationType.mutateAsync(rt.id)
      setDeleteConfirm(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setDeleteError('Ce type de relation est utilisé. Supprimez les relations avant.')
      } else {
        setDeleteError(e instanceof ApiError ? e.message : 'Erreur lors de la suppression')
      }
    }
  }

  if (isLoading) return <p className="text-ink-muted">Chargement...</p>

  return (
    <div className="flex flex-col gap-[18px]">
      <section className="flex items-center justify-between gap-5 flex-wrap">
        <div>
          <TitleEyebrow>Administration</TitleEyebrow>
          <h1 className="font-serif font-semibold text-[28px] leading-[1.15] tracking-[-0.02em] text-navy-900">
            Types de relations
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-soft leading-[1.55] max-w-[620px]">
            Chaque relation est bidirectionnelle : à un nom correspond un nom inverse (ex. « hébergé sur » / « héberge »).
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
              <Th>Nom</Th>
              <Th>Nom inverse</Th>
              <Th className="text-right !pr-4">
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {relationTypes?.map((rt) => (
              <Tr key={rt.id}>
                <Td>
                  <span className="font-semibold text-ink">{rt.name}</span>
                </Td>
                <Td>
                  <span className="text-ink-soft">{rt.inverse_name}</span>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <IconButton
                    aria-label="Supprimer le type de relation"
                    icon={<Trash2 size={13} />}
                    className={cn('!w-[30px] !h-[30px] !rounded-md', 'hover:!border-danger hover:!text-danger hover:!bg-danger-bg')}
                    onClick={() => {
                      setDeleteConfirm(rt)
                      setDeleteError('')
                    }}
                  />
                </Td>
              </Tr>
            ))}
            {(!relationTypes || relationTypes.length === 0) && (
              <Tr>
                <Td colSpan={3} className="py-8 text-center text-ink-muted">
                  Aucun type de relation défini.
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </Card>

      {/* Create modal */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} aria-label="Nouveau type de relation">
        <DialogHead>
          <h3 className="font-serif font-semibold text-[18px] text-navy-900">Nouveau type de relation</h3>
        </DialogHead>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel required>Nom (ex : « hébergé sur »)</FieldLabel>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <FieldHint>Slug : {slugify(form.name) || '—'}</FieldHint>
            </Field>
            <Field>
              <FieldLabel required>Nom inverse (ex : « héberge »)</FieldLabel>
              <Input value={form.inverse_name} onChange={(e) => setForm({ ...form, inverse_name: e.target.value })} />
              <FieldHint>Slug : {slugify(form.inverse_name) || '—'}</FieldHint>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </div>
        </DialogBody>
        <DialogFoot>
          <Button variant="secondary" onClick={() => setShowForm(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={save}>
            Créer
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
