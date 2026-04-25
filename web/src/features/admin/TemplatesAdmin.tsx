// web/src/features/admin/TemplatesAdmin.tsx
// Vue "Templates" — alignement tokens + logique CRUD préservée.
// L'éditeur TipTap est conservé dans la modale d'édition.
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import TipTapEditor from '@/features/editor/TipTapEditor'
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
  Table,
  TBody,
  THead,
  Td,
  Th,
  TitleEyebrow,
  Tr,
} from '@/components/ui'
import { cn } from '@/lib/cn'

interface Template {
  id: string
  name: string
  description: string
  type: string
  content: unknown
  usage_count: number
}

interface TemplateForm {
  name: string
  description: string
  type: string
  content: string
}

const emptyForm: TemplateForm = { name: '', description: '', type: '', content: '{}' }

interface TemplatesAdminProps {
  onCountChange?: (count: number) => void
}

export default function TemplatesAdmin({ onCountChange }: TemplatesAdminProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<TemplateForm>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api
      .get<Template[]>('/admin/templates')
      .then((t) => {
        setTemplates(t)
        onCountChange?.(t.length)
      })
      .catch(() => setError('Erreur lors du chargement des templates'))
      .finally(() => setLoading(false))
  }, [onCountChange])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }

  function openEdit(t: Template) {
    setEditing(t.id)
    setForm({
      name: t.name,
      description: t.description,
      type: t.type,
      content: JSON.stringify(t.content, null, 2),
    })
    setShowForm(true)
    setError('')
  }

  async function save() {
    setError('')
    let parsedContent: unknown
    try {
      parsedContent = JSON.parse(form.content)
    } catch {
      setError('Le contenu JSON est invalide')
      return
    }
    const payload = { name: form.name, description: form.description, type: form.type, content: parsedContent }
    try {
      if (editing) {
        await api.put(`/admin/templates/${editing}`, payload)
      } else {
        await api.post('/admin/templates', payload)
      }
      setShowForm(false)
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/admin/templates/${id}`)
      setDeleteConfirm(null)
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la suppression')
      setDeleteConfirm(null)
    }
  }

  if (loading) return <p className="text-ink-muted">Chargement...</p>

  return (
    <div className="flex flex-col gap-[18px]">
      <section className="flex items-center justify-between gap-5 flex-wrap">
        <div>
          <TitleEyebrow>Administration</TitleEyebrow>
          <h1 className="font-serif font-semibold text-[28px] leading-[1.15] tracking-[-0.02em] text-navy-900">
            Templates de documents
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-soft leading-[1.55] max-w-[620px]">
            Modèles réutilisables proposés à la création d'un document (procédures, modes opératoires, notes).
          </p>
        </div>
        <Button variant="cta" leftIcon={<Plus size={14} strokeWidth={2.5} />} onClick={openCreate}>
          Nouveau template
        </Button>
      </section>

      {error && <p className="text-danger text-sm">{error}</p>}

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr className="!bg-cream-light hover:!bg-cream-light">
              <Th>Nom</Th>
              <Th>Type</Th>
              <Th>Utilisations</Th>
              <Th className="text-right !pr-4">
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {templates.map((t) => (
              <Tr key={t.id}>
                <Td>
                  <div>
                    <div className="font-semibold text-ink">{t.name}</div>
                    {t.description && <div className="text-[11.5px] text-ink-muted mt-0.5">{t.description}</div>}
                  </div>
                </Td>
                <Td>
                  <span className="font-mono text-[11.5px] text-ink-soft">{t.type}</span>
                </Td>
                <Td>
                  <span className="tabular-nums font-semibold text-navy-900">{t.usage_count}</span>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <div className="inline-flex gap-1 justify-end">
                    <IconButton
                      aria-label="Modifier le template"
                      icon={<Pencil size={13} />}
                      className="!w-[30px] !h-[30px] !rounded-md"
                      onClick={() => openEdit(t)}
                    />
                    <IconButton
                      aria-label="Supprimer le template"
                      icon={<Trash2 size={13} />}
                      className={cn('!w-[30px] !h-[30px] !rounded-md', 'hover:!border-danger hover:!text-danger hover:!bg-danger-bg')}
                      onClick={() => setDeleteConfirm(t.id)}
                    />
                  </div>
                </Td>
              </Tr>
            ))}
            {templates.length === 0 && (
              <Tr>
                <Td colSpan={4} className="py-8 text-center text-ink-muted">
                  Aucun template défini.
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
        aria-label={editing ? 'Modifier le template' : 'Nouveau template'}
        maxWidth={960}
      >
        <DialogHead>
          <h3 className="font-serif font-semibold text-[18px] text-navy-900">
            {editing ? 'Modifier le template' : 'Nouveau template'}
          </h3>
        </DialogHead>
        <DialogBody className="max-h-[calc(90vh-120px)]">
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel required>Nom</FieldLabel>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel>Contenu du template</FieldLabel>
              <TipTapEditor
                content={form.content}
                documentId={null}
                onChange={(json) => setForm({ ...form, content: json })}
              />
            </Field>
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
          <p className="text-[13.5px] text-ink-soft">
            Le template ne sera plus proposé lors de la création de pages. Les documents existants ne seront pas impactés.
          </p>
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
