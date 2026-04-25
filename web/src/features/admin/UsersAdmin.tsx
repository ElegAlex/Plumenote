// web/src/features/admin/UsersAdmin.tsx
// Vue "Comptes utilisateurs" — gabarit g9 (la vue la plus soignée).
// API calls /admin/users et /admin/domains préservés ; logique CRUD intacte.
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus,
  Users as UsersIcon,
  ShieldCheck,
  Pencil as PencilIcon,
  Clock,
  Search as SearchIcon,
  Filter,
  ListFilter,
  CircleDot,
  Download,
  Pencil,
  RotateCcw,
  Ban,
  Copy,
} from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import {
  Avatar,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogFoot,
  DialogHead,
  DomainChip,
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
  Tr,
  TitleEyebrow,
} from '@/components/ui'
import { cn } from '@/lib/cn'

interface UserRecord {
  id: string
  username: string
  display_name: string
  role: 'public' | 'dsi' | 'admin'
  domain_id: string | null
  domain_name?: string
  domain_slug?: string
  last_login: string | null
  contributions?: number
}

interface Domain {
  id: string
  name: string
  slug?: string
}

interface UserForm {
  username: string
  display_name: string
  password: string
  role: 'public' | 'dsi' | 'admin'
  domain_id: string
}

interface UsersAdminProps {
  onCountChange?: (count: number) => void
}

const emptyForm: UserForm = { username: '', display_name: '', password: '', role: 'dsi', domain_id: '' }

// Backend `public | dsi | admin` → pill g9 `reader | editor | admin`.
const ROLE_PILL: Record<UserRecord['role'], { label: string; classes: string }> = {
  admin: { label: 'Administrateur', classes: 'bg-danger-bg text-danger' },
  dsi: { label: 'Contributeur', classes: 'bg-coral-bg text-coral' },
  public: { label: 'Lecteur', classes: 'bg-cream text-navy-800' },
}

// Map slug backend → DomainChip variant. Valeurs non reconnues → neutral.
const DOMAIN_VARIANT: Record<string, 'infra' | 'support' | 'sci' | 'etudes' | 'data' | 'neutral'> = {
  infra: 'infra',
  infrastructure: 'infra',
  support: 'support',
  sci: 'sci',
  etudes: 'etudes',
  'etudes-developpement': 'etudes',
  'etudes-dev': 'etudes',
  data: 'data',
}

function relativeDate(dateStr: string | null): { relative: string; absolute: string } {
  if (!dateStr) return { relative: 'Jamais', absolute: '—' }
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const fmtHm = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const fmtD = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })

  if (diffMin < 60) return { relative: "aujourd'hui", absolute: `il y a ${Math.max(diffMin, 1)} min` }
  if (diffHours < 24) return { relative: "aujourd'hui", absolute: `il y a ${diffHours} h` }
  if (diffDays === 1) return { relative: 'hier', absolute: fmtHm }
  if (diffDays < 7) return { relative: `il y a ${diffDays} j`, absolute: fmtD }
  return { relative: fmtD, absolute: fmtHm }
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr).getTime()
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24))
}

function avatarVariant(i: number): 'a' | 'b' | 'c' | 'd' | 'e' | 'f' {
  const order: Array<'a' | 'b' | 'c' | 'd' | 'e' | 'f'> = ['a', 'b', 'c', 'd', 'e', 'f']
  return order[i % order.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function UsersAdmin({ onCountChange }: UsersAdminProps) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [resetResult, setResetResult] = useState<{ password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get<UserRecord[]>('/admin/users'),
      api.get<Domain[]>('/admin/domains'),
    ])
      .then(([u, d]) => {
        setUsers(u)
        setDomains(d)
        onCountChange?.(u.length)
      })
      .catch(() => setError('Erreur lors du chargement'))
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

  function openEdit(u: UserRecord) {
    setEditing(u.id)
    setForm({
      username: u.username,
      display_name: u.display_name,
      password: '',
      role: u.role,
      domain_id: u.domain_id || '',
    })
    setShowForm(true)
    setError('')
  }

  async function save() {
    setError('')
    const payload: Record<string, unknown> = {
      username: form.username,
      display_name: form.display_name,
      role: form.role,
      domain_id: form.domain_id || null,
    }
    if (!editing) {
      payload.password = form.password
    }
    try {
      if (editing) {
        await api.put(`/admin/users/${editing}`, payload)
      } else {
        await api.post('/admin/users', payload)
      }
      setShowForm(false)
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde')
    }
  }

  async function resetPassword(userId: string) {
    setError('')
    setCopied(false)
    try {
      const result = await api.post<{ password: string }>(`/admin/users/${userId}/reset-password`, {})
      setResetResult(result)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la reinitialisation')
    }
  }

  function copyPassword() {
    if (resetResult) {
      navigator.clipboard.writeText(resetResult.password)
      setCopied(true)
    }
  }

  // KPI computés sur la base de users[] (ne pas hardcoder).
  const kpis = useMemo(() => {
    const active = users.length
    const admins = users.filter((u) => u.role === 'admin').length
    const contrib = users.filter((u) => u.role === 'dsi').length
    const inactive30 = users.filter((u) => {
      const d = daysSince(u.last_login)
      return d === null || d > 30
    }).length
    return { active, admins, contrib, inactive30 }
  }, [users])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.display_name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.domain_name ?? '').toLowerCase().includes(q),
    )
  }, [users, searchQuery])

  if (loading) {
    return <p className="text-ink-muted">Chargement...</p>
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Title block + CTA */}
      <section className="flex items-center justify-between gap-5 flex-wrap">
        <div>
          <TitleEyebrow>Administration</TitleEyebrow>
          <h1 className="font-serif font-semibold text-[28px] leading-[1.15] tracking-[-0.02em] text-navy-900 [&_em]:italic [&_em]:text-coral [&_em]:font-medium">
            Comptes utilisateurs <em>DSI</em>
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-soft leading-[1.55] max-w-[620px]">
            {users.length} compte{users.length > 1 ? 's' : ''} sur le périmètre DSI. Création manuelle par administrateur,
            assignation par domaine. Pas de SSO au MVP (LDAP prévu V2).
          </p>
        </div>
        <Button variant="cta" leftIcon={<Plus size={14} strokeWidth={2.5} />} onClick={openCreate}>
          Créer un compte
        </Button>
      </section>

      {error && <p className="text-danger text-sm">{error}</p>}

      {/* KPI row */}
      <section className="grid grid-cols-4 gap-3">
        <KpiTile label="Comptes actifs" value={kpis.active} sub={`${users.length} au total`} icon={<UsersIcon size={15} />} tone="success" />
        <KpiTile label="Administrateurs" value={kpis.admins} sub="Accès complet" icon={<ShieldCheck size={15} />} tone="coral" />
        <KpiTile label="Contributeurs" value={kpis.contrib} sub={`Répartis sur ${domains.length} domaine${domains.length > 1 ? 's' : ''}`} icon={<PencilIcon size={15} />} tone="neutral" />
        <KpiTile label="Inactifs 30 j" value={kpis.inactive30} sub="Relance manuelle" icon={<Clock size={15} />} tone="neutral" />
      </section>

      {/* Toolbar */}
      <Card className="flex items-center gap-3 flex-wrap px-4 py-3 rounded-2xl">
        <div className="flex-1 min-w-[240px] max-w-[320px]">
          <Input
            leftIcon={<SearchIcon size={14} />}
            placeholder="Nom, login, email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            inputClassName="!py-[9px] !text-[13px]"
            tone="muted"
          />
        </div>
        <Button variant="secondary" size="sm" leftIcon={<Filter size={12} />}>
          Rôle <span className="ml-1.5 px-1.5 py-[1px] bg-cream rounded font-bold text-[11px]">Tous</span>
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<ListFilter size={12} />}>
          Domaine <span className="ml-1.5 px-1.5 py-[1px] bg-cream rounded font-bold text-[11px]">Tous</span>
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<CircleDot size={12} />}>
          Statut <span className="ml-1.5 px-1.5 py-[1px] bg-cream rounded font-bold text-[11px]">Actifs</span>
        </Button>
        <div className="ml-auto">
          <Button variant="secondary" size="sm" leftIcon={<Download size={12} />}>
            Exporter CSV
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr className="!bg-cream-light hover:!bg-cream-light">
              <Th sortable sorted>Utilisateur</Th>
              <Th>Rôle</Th>
              <Th>Domaine</Th>
              <Th>Statut</Th>
              <Th sortable>Dernière connexion</Th>
              <Th>Contributions</Th>
              <Th className="text-right !pr-4"><span className="sr-only">Actions</span></Th>
            </Tr>
          </THead>
          <TBody>
            {filtered.map((u, i) => {
              const d = relativeDate(u.last_login)
              const days = daysSince(u.last_login)
              const status =
                days === null
                  ? { label: 'Jamais connecté', variant: 'inactive' as const }
                  : days > 30
                    ? { label: `Inactif ${days} j`, variant: 'inactive' as const }
                    : { label: 'Actif', variant: 'active' as const }
              const role = ROLE_PILL[u.role]
              const domainKey = u.domain_slug
                ? (DOMAIN_VARIANT[u.domain_slug] ?? 'neutral')
                : u.domain_name
                  ? 'neutral'
                  : 'neutral'
              return (
                <Tr key={u.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={initials(u.display_name || u.username)} size="md" variant={avatarVariant(i)} />
                      <div className="min-w-0">
                        <div className="font-semibold text-ink text-[13.5px] leading-[1.3] truncate">{u.display_name}</div>
                        <div className="font-mono text-[11px] text-ink-muted mt-[1px] truncate">
                          {u.username}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5',
                        'px-2.5 py-[3px] rounded-full',
                        'text-[10.5px] font-bold uppercase tracking-[0.06em]',
                        role.classes,
                      )}
                    >
                      {role.label}
                    </span>
                  </Td>
                  <Td>
                    {u.domain_name ? (
                      <DomainChip domain={domainKey}>{u.domain_name}</DomainChip>
                    ) : (
                      <span className="text-ink-muted text-[12px]">—</span>
                    )}
                  </Td>
                  <Td>
                    <StatusPill variant={status.variant}>{status.label}</StatusPill>
                  </Td>
                  <Td>
                    <div className="text-[11.5px] text-ink-muted tabular-nums leading-[1.3]">
                      {d.relative}
                      <br />
                      <strong className="text-ink font-semibold">{d.absolute}</strong>
                    </div>
                  </Td>
                  <Td>
                    <span className="tabular-nums font-semibold text-navy-900">{u.contributions ?? 0}</span>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <div className="inline-flex gap-1 justify-end">
                      <IconButton
                        aria-label="Modifier l'utilisateur"
                        icon={<Pencil size={13} />}
                        className="!w-[30px] !h-[30px] !rounded-md"
                        onClick={() => openEdit(u)}
                      />
                      <IconButton
                        aria-label="Réinitialiser le mot de passe"
                        icon={<RotateCcw size={13} />}
                        className="!w-[30px] !h-[30px] !rounded-md"
                        onClick={() => resetPassword(u.id)}
                      />
                      <IconButton
                        aria-label="Désactiver l'utilisateur"
                        icon={<Ban size={13} />}
                        className={cn(
                          '!w-[30px] !h-[30px] !rounded-md',
                          'hover:!border-danger hover:!text-danger hover:!bg-danger-bg',
                        )}
                      />
                    </div>
                  </Td>
                </Tr>
              )
            })}
            {filtered.length === 0 && (
              <Tr>
                <Td className="py-8 text-center text-ink-muted" colSpan={7}>
                  Aucun compte ne correspond à la recherche.
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>

        {/* Footer pagination */}
        <div
          className={cn(
            'flex items-center justify-between',
            'px-[18px] py-3',
            'border-t border-line-soft',
            'text-[12.5px] text-ink-soft',
          )}
        >
          <span>
            Affichage <strong className="text-navy-900 tabular-nums">1 – {filtered.length}</strong> sur{' '}
            <strong className="text-navy-900 tabular-nums">{users.length}</strong> compte{users.length > 1 ? 's' : ''}
          </span>
          <div className="flex gap-1">
            <PageBtn>‹</PageBtn>
            <PageBtn current>1</PageBtn>
            <PageBtn>›</PageBtn>
          </div>
        </div>
      </Card>

      {/* Diff card : historique template T-02 (visuel gabarit) */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-line-soft">
          <h3 className="font-serif font-semibold text-[15px] text-navy-900">
            Historique template T-02 · Procédure DSI
          </h3>
          <span className="text-[11.5px] text-ink-muted tabular-nums">
            v4 → v5 · modifié par Alexandre Berge · hier à 16:42
          </span>
        </div>
        <div className="font-mono text-[12.5px] leading-[1.7] bg-bg px-[18px] py-4">
          <DiffLine kind="ctx"># Titre de la procédure</DiffLine>
          <DiffLine kind="ctx">&nbsp;</DiffLine>
          <DiffLine kind="ctx">## Objet</DiffLine>
          <DiffLine kind="rm">Cette procédure décrit [objectif].</DiffLine>
          <DiffLine kind="add">Cette procédure décrit [objectif] pour les agents [périmètre].</DiffLine>
          <DiffLine kind="ctx">&nbsp;</DiffLine>
          <DiffLine kind="ctx">## Pré-requis</DiffLine>
          <DiffLine kind="ctx">- [Pré-requis 1]</DiffLine>
          <DiffLine kind="add">- [Pré-requis 2]</DiffLine>
          <DiffLine kind="ctx">&nbsp;</DiffLine>
          <DiffLine kind="ctx">## Procédure</DiffLine>
          <DiffLine kind="rm">[Étapes numérotées]</DiffLine>
          <DiffLine kind="add">1. [Première action]</DiffLine>
          <DiffLine kind="add">2. [Deuxième action]</DiffLine>
          <DiffLine kind="add">3. [Troisième action]</DiffLine>
        </div>
      </Card>

      {/* Create / edit modal */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} aria-label={editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}>
        <DialogHead>
          <h3 className="font-serif font-semibold text-[18px] text-navy-900">
            {editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
          </h3>
        </DialogHead>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel required>Login</FieldLabel>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                disabled={!!editing}
                placeholder="prenom.nom"
              />
            </Field>
            <Field>
              <FieldLabel required>Nom complet</FieldLabel>
              <Input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Prénom Nom"
              />
            </Field>
            {!editing && (
              <Field>
                <FieldLabel required>Mot de passe</FieldLabel>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
            )}
            <Field>
              <FieldLabel>Rôle</FieldLabel>
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserForm['role'] })}
              >
                <option value="public">Lecteur (public)</option>
                <option value="dsi">Contributeur (dsi)</option>
                <option value="admin">Administrateur</option>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Domaine</FieldLabel>
              <Select
                value={form.domain_id}
                onChange={(e) => setForm({ ...form, domain_id: e.target.value })}
              >
                <option value="">— Aucun —</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
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

      {/* Reset password result modal */}
      <Dialog open={!!resetResult} onClose={() => setResetResult(null)} aria-label="Mot de passe temporaire">
        <DialogHead>
          <h3 className="font-serif font-semibold text-[18px] text-navy-900">Mot de passe temporaire</h3>
        </DialogHead>
        <DialogBody>
          <p className="text-sm text-warn mb-3">Ce mot de passe ne sera plus affiché.</p>
          {resetResult && (
            <div className="flex items-center gap-2 bg-bg border border-line rounded-lg p-3">
              <code className="flex-1 font-mono text-[13px] text-ink select-all">{resetResult.password}</code>
              <Button variant="secondary" size="sm" onClick={copyPassword} leftIcon={<Copy size={12} />}>
                {copied ? 'Copié' : 'Copier'}
              </Button>
            </div>
          )}
        </DialogBody>
        <DialogFoot>
          <Button variant="secondary" onClick={() => setResetResult(null)}>
            Fermer
          </Button>
        </DialogFoot>
      </Dialog>
    </div>
  )
}

/* ============ sous-composants locaux ============ */

function KpiTile({
  label,
  value,
  sub,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: number
  sub?: string
  icon?: React.ReactNode
  tone?: 'coral' | 'success' | 'neutral'
}) {
  const icoClass =
    tone === 'coral'
      ? 'bg-coral-bg text-coral'
      : tone === 'success'
        ? 'bg-success-bg text-success'
        : 'bg-cream-light text-navy-800'
  return (
    <Card className="flex items-center justify-between gap-3 px-[18px] py-[14px] rounded-2xl">
      <div className="min-w-0">
        <div className="font-sans text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-soft">{label}</div>
        <div className="font-serif font-semibold text-[26px] text-navy-900 tabular-nums leading-[1.1] tracking-[-0.01em]">
          {value}
        </div>
        {sub && <div className="text-[11px] text-ink-muted mt-[2px]">{sub}</div>}
      </div>
      {icon && (
        <div className={cn('w-[34px] h-[34px] rounded-lg grid place-items-center shrink-0', icoClass)}>
          {icon}
        </div>
      )}
    </Card>
  )
}

function StatusPill({ variant, children }: { variant: 'active' | 'inactive' | 'blocked'; children: React.ReactNode }) {
  const classes =
    variant === 'active'
      ? 'bg-success-bg text-success'
      : variant === 'blocked'
        ? 'bg-danger-bg text-danger'
        : 'bg-bg text-ink-muted'
  const dotBg =
    variant === 'active'
      ? 'bg-success shadow-[0_0_0_3px_rgba(47,125,91,0.15)]'
      : variant === 'blocked'
        ? 'bg-danger'
        : 'bg-ink-muted'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        'px-2.5 py-1 rounded-full',
        'font-sans text-[11px] font-bold',
        classes,
      )}
    >
      <span className={cn('w-[7px] h-[7px] rounded-full', dotBg)} />
      {children}
    </span>
  )
}

function PageBtn({ current, children }: { current?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'min-w-[30px] h-[30px] px-2.5 rounded-md',
        'font-sans text-[12px] font-semibold',
        'cursor-pointer transition-colors',
        current
          ? 'bg-navy-900 text-white border border-navy-900'
          : 'bg-white text-ink-soft border border-line hover:border-navy-800 hover:text-navy-800',
      )}
    >
      {children}
    </button>
  )
}

function DiffLine({ kind, children }: { kind: 'add' | 'rm' | 'ctx'; children: React.ReactNode }) {
  const cls =
    kind === 'add'
      ? 'bg-success-bg text-success'
      : kind === 'rm'
        ? 'bg-danger-bg text-danger'
        : 'text-ink-soft'
  const prefix = kind === 'add' ? '+ ' : kind === 'rm' ? '- ' : '  '
  return (
    <div className={cn('px-2.5 py-[2px] rounded', cls)}>
      <span className={cn(kind !== 'ctx' && 'font-bold')}>{prefix}</span>
      {children}
    </div>
  )
}
