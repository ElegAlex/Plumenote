// web/src/features/admin/DomainsAdmin.tsx
// Vue "Domaines" — gabarit g9 (version allégée, focus sur la table + logique CRUD).
// API calls /admin/domains préservés.
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
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

interface Domain {
  id: string
  name: string
  slug: string
  color: string
  icon: string
  doc_count: number
  features_enabled: string[]
}

interface DomainForm {
  name: string
  color: string
  icon: string
  features_enabled: string[]
}

const emptyForm: DomainForm = { name: '', color: '#E8845C', icon: '', features_enabled: ['documents'] }

interface DomainsAdminProps {
  onCountChange?: (count: number) => void
}

export default function DomainsAdmin({ onCountChange }: DomainsAdminProps) {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<DomainForm>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<Domain | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api
      .get<Domain[]>('/admin/domains')
      .then((d) => {
        setDomains(d)
        onCountChange?.(d.length)
      })
      .catch(() => setError('Erreur lors du chargement des domaines'))
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

  function openEdit(d: Domain) {
    setEditing(d.id)
    setForm({ name: d.name, color: d.color, icon: d.icon, features_enabled: d.features_enabled || ['documents'] })
    setShowForm(true)
    setError('')
  }

  async function save() {
    setError('')
    try {
      if (editing) {
        await api.put(`/admin/domains/${editing}`, form)
      } else {
        await api.post('/admin/domains', form)
      }
      setShowForm(false)
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }

  async function handleDelete(d: Domain) {
    setDeleteError('')
    try {
      await api.delete(`/admin/domains/${d.id}`)
      setDeleteConfirm(null)
      load()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setDeleteError(
          `Ce domaine contient ${d.doc_count} documents. Déplacez-les ou supprimez-les avant de supprimer le domaine.`,
        )
      } else {
        setDeleteError(e instanceof ApiError ? e.message : 'Erreur lors de la suppression')
      }
    }
  }

  if (loading) return <p className="text-ink-muted">Chargement...</p>

  return (
    <div className="flex flex-col gap-[18px]">
      <section className="flex items-center justify-between gap-5 flex-wrap">
        <div>
          <TitleEyebrow>Administration</TitleEyebrow>
          <h1 className="font-serif font-semibold text-[28px] leading-[1.15] tracking-[-0.02em] text-navy-900">
            Domaines documentaires
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-soft leading-[1.55] max-w-[620px]">
            {domains.length} domaine{domains.length > 1 ? 's' : ''} défini{domains.length > 1 ? 's' : ''}. Chaque domaine
            regroupe ses documents, ses types et ses droits d'accès.
          </p>
        </div>
        <Button variant="cta" leftIcon={<Plus size={14} strokeWidth={2.5} />} onClick={openCreate}>
          Nouveau domaine
        </Button>
      </section>

      {error && <p className="text-danger text-sm">{error}</p>}

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr className="!bg-cream-light hover:!bg-cream-light">
              <Th>Nom</Th>
              <Th>Slug</Th>
              <Th>Couleur</Th>
              <Th>Documents</Th>
              <Th className="text-right !pr-4">
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {domains.map((d) => (
              <Tr key={d.id}>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-[10px] h-[10px] rounded-full shrink-0"
                      // Data-driven : couleur stockée en base, pas littéral source.
                      style={{ backgroundColor: d.color }}
                      aria-hidden
                    />
                    <span className="font-semibold text-ink">{d.name}</span>
                  </div>
                </Td>
                <Td>
                  <span className="font-mono text-[11.5px] text-ink-muted">{d.slug}</span>
                </Td>
                <Td>
                  <span className="font-mono text-[11.5px] text-ink-soft">{d.color}</span>
                </Td>
                <Td>
                  <span className="tabular-nums font-semibold text-navy-900">{d.doc_count}</span>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <div className="inline-flex gap-1 justify-end">
                    <IconButton
                      aria-label="Modifier le domaine"
                      icon={<Pencil size={13} />}
                      className="!w-[30px] !h-[30px] !rounded-md"
                      onClick={() => openEdit(d)}
                    />
                    <IconButton
                      aria-label="Supprimer le domaine"
                      icon={<Trash2 size={13} />}
                      className={cn('!w-[30px] !h-[30px] !rounded-md', 'hover:!border-danger hover:!text-danger hover:!bg-danger-bg')}
                      onClick={() => {
                        setDeleteConfirm(d)
                        setDeleteError('')
                      }}
                    />
                  </div>
                </Td>
              </Tr>
            ))}
            {domains.length === 0 && (
              <Tr>
                <Td colSpan={5} className="py-8 text-center text-ink-muted">
                  Aucun domaine défini.
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </Card>

      {/* Form modal */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} aria-label={editing ? 'Modifier le domaine' : 'Nouveau domaine'}>
        <DialogHead>
          <h3 className="font-serif font-semibold text-[18px] text-navy-900">
            {editing ? 'Modifier le domaine' : 'Nouveau domaine'}
          </h3>
        </DialogHead>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel required>Nom</FieldLabel>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel>Couleur</FieldLabel>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-10 rounded border border-line cursor-pointer"
                  aria-label="Sélecteur de couleur"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="#E8845C"
                  inputClassName="font-mono"
                />
              </div>
            </Field>
            <Field>
              <FieldLabel>Icône</FieldLabel>
              <Input
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="ex: server, shield, code"
              />
            </Field>
            <Field>
              <FieldLabel>Features activées</FieldLabel>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[13px] text-ink-muted">
                  <input type="checkbox" checked disabled className="accent-coral" />
                  Documents
                </label>
                <label className="flex items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={form.features_enabled.includes('cartography')}
                    onChange={(e) => {
                      const features = e.target.checked
                        ? [...form.features_enabled, 'cartography']
                        : form.features_enabled.filter((f) => f !== 'cartography')
                      setForm({ ...form, features_enabled: features })
                    }}
                    className="accent-coral"
                  />
                  Cartographie
                </label>
              </div>
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
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} aria-label="Confirmer la suppression" maxWidth={420}>
        <DialogHead>
          <h3 className="font-serif font-semibold text-[18px] text-navy-900">Confirmer la suppression</h3>
        </DialogHead>
        <DialogBody>
          {deleteConfirm && (
            <p className="text-[13.5px] text-ink-soft">
              Supprimer le domaine <strong className="text-navy-900">« {deleteConfirm.name} »</strong> ?
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
