import { useMemo, useState, type FormEvent } from 'react'
import {
  Activity,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  Info,
  Layers,
  Lock,
  Search,
  Settings,
  Shield,
  Upload,
  User,
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardFoot,
  CardHead,
  CardTitle,
  Field,
  FieldHint,
  FieldLabel,
  InlineMsg,
  Input,
  Kbd,
  Switch,
  Tab,
  TabPanel,
  Tabs,
  Textarea,
} from '@/components/ui'
import { useAuth, type User as AuthUser } from '@/lib/auth-context'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'

/**
 * ProfilePage — Mon compte (gabarit g10).
 *
 * Layout :
 *   - Identity hero (gradient navy → coral + avatar xl + eyebrow + meta-chips
 *     + stats rapides à droite).
 *   - Tabs Profil / Sécurité / Préférences / Activité.
 *   - Tab Profil (défaut) : grid 2 colonnes.
 *       · Gauche : Card "Informations personnelles" (avatar-edit + form) +
 *         Card "Notifications" (5 Switches controlled).
 *       · Droite (aside) : Card "Mon activité" (stats) + Card "Badges" +
 *         Card "Raccourcis clavier".
 *   - Tab Sécurité : formulaire PUT /auth/password (US-206) avec erreurs.
 *   - Tabs Préférences / Activité : placeholder Vague 3+.
 *
 * Données : `useAuth().user` pour display_name / username / role. Les
 * autres champs (email, fonction, biographie, stats, badges) ne sont pas
 * exposés par l'API actuelle ; ils sont initialisés en local et pilotés
 * côté UI. L'endpoint `PUT /api/users/me` n'existe pas côté backend :
 * le bouton "Enregistrer" du tab Profil est un stub (feedback visuel
 * local, pas de persistance). À câbler en Vague 3 quand l'endpoint sera
 * exposé.
 */

type TabKey = 'profile' | 'security' | 'preferences' | 'activity'

const roleLabel: Record<AuthUser['role'], string> = {
  admin: 'Administrateur DSI',
  dsi: 'Contributeur DSI',
  public: 'Public',
}

function computeInitials(displayName: string | undefined, username: string | undefined): string {
  const src = (displayName ?? username ?? '').trim()
  if (!src) return 'AB'
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('profile')

  const initials = useMemo(
    () => computeInitials(user?.display_name, user?.username),
    [user?.display_name, user?.username],
  )
  const displayName = user?.display_name ?? '—'
  const roleText = user ? roleLabel[user.role] : 'Compte'

  // Activity count (placeholder — pas de metric API en Vague 2)
  const activityCount = 47

  return (
    <main className="max-w-[1280px] w-full mx-auto px-8 py-7 pb-15 flex flex-col gap-5.5">
      {/* ============ IDENTITY HERO ============ */}
      <IdentityHero
        initials={initials}
        displayName={displayName}
        role={roleText}
      />

      {/* ============ TABS BAR ============ */}
      {/* Pattern WAI-ARIA complet : <Tabs activeKey onChange> + <Tab tabKey> +
          <TabPanel tabKey>. aria-controls / aria-labelledby / navigation
          clavier Arrow/Home/End générés automatiquement par la primitive. */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as TabKey)}
        aria-label="Sections du compte"
        className="flex"
      >
        <Tab tabKey="profile" icon={<User />}>
          Profil
        </Tab>
        <Tab tabKey="security" icon={<Shield />}>
          Sécurité
        </Tab>
        <Tab tabKey="preferences" icon={<Settings />}>
          Préférences
        </Tab>
        <Tab tabKey="activity" icon={<Activity />} badge={activityCount}>
          Activité
        </Tab>
      </Tabs>

      {/* ============ TAB PANELS ============ */}
      <TabPanel tabKey="profile" active={activeTab}>
        <ProfileTab initials={initials} />
      </TabPanel>
      <TabPanel tabKey="security" active={activeTab}>
        <SecurityTab />
      </TabPanel>
      <TabPanel tabKey="preferences" active={activeTab}>
        <PlaceholderTab label="Préférences" />
      </TabPanel>
      <TabPanel tabKey="activity" active={activeTab}>
        <PlaceholderTab label="Activité" />
      </TabPanel>
    </main>
  )
}

/* ====================================================================== */
/* IDENTITY HERO                                                          */
/* ====================================================================== */

function IdentityHero({
  initials,
  displayName,
  role,
}: {
  initials: string
  displayName: string
  role: string
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[22px] px-9 py-8',
        'bg-[linear-gradient(130deg,var(--color-navy-900)_0%,var(--color-navy-700)_55%,var(--color-coral)_120%)]',
        'text-cream',
        'grid gap-7 items-center',
        'grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto]',
      )}
    >
      {/* Halo décoratif cream (gabarit g10 .identity-hero::before). */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-20 -right-20',
          'w-[340px] h-[340px]',
          'bg-[radial-gradient(circle,rgba(244,233,216,0.15),transparent_60%)]',
        )}
      />

      {/* Avatar hero 88 px — ouvert en markup direct car la primitive
          Avatar `xl` est fixée à 72 px (gabarit g10 demande 88). Conserve
          la recette visuelle : gradient coral → coral-soft, bordure
          blanche translucide, shadow navy. */}
      <span
        aria-hidden
        className={cn(
          'relative z-[1] inline-grid place-items-center shrink-0',
          'w-[88px] h-[88px] rounded-full',
          'bg-gradient-to-br from-coral to-coral-soft',
          'text-white font-serif font-semibold text-[30px]',
          'border-[3px] border-white/25',
          'shadow-[0_8px_20px_rgba(20,35,92,0.3)]',
        )}
      >
        {initials}
      </span>

      {/* Texte identité */}
      <div className="relative z-[1] min-w-0">
        {/* Eyebrow adapté panel sombre (coral-soft, trait, pas de losange). */}
        <div className="mb-2 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-coral-soft">
          <span aria-hidden className="inline-block h-[1.5px] w-[22px] bg-coral-soft" />
          Compte · {role}
        </div>
        <h1 className="font-serif font-semibold text-[34px] leading-[1.1] tracking-[-0.02em] text-white mb-1.5">
          {displayName}
        </h1>
        <div className="flex flex-wrap items-center gap-2.5 mt-3">
          <IdChip coral icon={<Shield />}>
            Rôle : <strong className="font-bold text-white">{role}</strong>
          </IdChip>
          <IdChip icon={<Layers />}>
            Domaines : <strong className="font-bold text-white">Tous (4)</strong>
          </IdChip>
          <IdChip icon={<Clock />}>
            Compte créé : <strong className="font-bold text-white">15 mars 2026</strong>
          </IdChip>
        </div>
      </div>

      {/* Colonne stats — desktop : colonne verticale text-right ; mobile :
          passe sous le bloc identité (col-span-full) en ligne horizontale
          qui wrappe. Cf. gabarit g10 @media (max-width: 1000px) :
          .identity-right { grid-column: 1 / -1; flex-direction: row; }. */}
      <div
        className={cn(
          'relative z-[1] min-w-0',
          'col-span-full lg:col-auto',
          'flex flex-wrap gap-x-5 gap-y-1',
          'lg:flex-col lg:flex-nowrap lg:gap-y-1.5 lg:text-right lg:justify-start',
        )}
      >
        <span className="text-[11.5px] text-navy-fg-soft">Dernière connexion</span>
        <span className="text-[11.5px] text-navy-fg-soft">
          <strong className="font-serif font-semibold text-[13px] text-white tabular-nums">
            aujourd'hui · 08:14
          </strong>
        </span>
        <span className="hidden lg:block h-1" aria-hidden />
        <span className="text-[11.5px] text-navy-fg-soft">
          Contributions · <strong className="font-serif font-semibold text-[13px] text-white tabular-nums">47</strong>
        </span>
        <span className="text-[11.5px] text-navy-fg-soft">
          Documents consultés · <strong className="font-serif font-semibold text-[13px] text-white tabular-nums">312</strong>
        </span>
      </div>
    </section>
  )
}

function IdChip({
  icon,
  coral,
  children,
}: {
  icon: React.ReactNode
  coral?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        'px-3 py-1.5 rounded-full',
        'text-[11.5px] font-semibold text-cream',
        'border',
        '[&_svg]:w-3 [&_svg]:h-3',
        coral
          ? 'bg-[rgba(232,132,92,0.24)] border-[rgba(232,132,92,0.35)]'
          : 'bg-white/10 border-white/15',
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/* ====================================================================== */
/* TAB PROFIL                                                             */
/* ====================================================================== */

function ProfileTab({ initials }: { initials: string }) {
  return (
    <section className="grid gap-5.5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      {/* Colonne gauche : Informations + Notifications */}
      <div className="flex flex-col gap-5.5 min-w-0">
        <PersonalInfoCard initials={initials} />
        <NotificationsCard />
      </div>

      {/* Colonne droite (aside) : Stats + Badges + Raccourcis */}
      <aside className="flex flex-col gap-4 min-w-0">
        <ActivityStatsCard />
        <BadgesCard />
        <ShortcutsCard />
      </aside>
    </section>
  )
}

/* ---- Card : Informations personnelles ---------------------------------- */

function PersonalInfoCard({ initials }: { initials: string }) {
  const { user } = useAuth()
  const [firstName, setFirstName] = useState(() => {
    const parts = (user?.display_name ?? '').split(/\s+/)
    return parts[0] ?? ''
  })
  const [lastName, setLastName] = useState(() => {
    const parts = (user?.display_name ?? '').split(/\s+/)
    return parts.slice(1).join(' ')
  })
  const [position, setPosition] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')
  const [dirty, setDirty] = useState(false)

  const markDirty = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setDirty(true)
  }

  function handleCancel() {
    // Reset : en Vague 2 on se contente de vider le flag dirty.
    setDirty(false)
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    // Endpoint PUT /api/users/me non exposé en Vague 2 ; stub visuel.
    setDirty(false)
  }

  return (
    <Card>
      <CardHead>
        <CardTitle icon={<Edit3 />}>Informations personnelles</CardTitle>
        <span className="text-xs text-ink-muted">
          Visible par les autres contributeurs DSI
        </span>
      </CardHead>
      <CardBody>
        {/* Avatar editor block */}
        <div
          className={cn(
            'flex items-center gap-4.5 mb-4.5',
            'p-4 rounded-xl',
            'bg-cream-light border border-line-soft',
          )}
        >
          {/* Avatar 64×64 (entre md=44 et xl=72) : markup direct, pas de
              taille intermédiaire dans la primitive Avatar. Factoriser si
              besoin se répète. */}
          <span
            className={cn(
              'inline-grid place-items-center shrink-0',
              'w-16 h-16 rounded-full',
              'bg-gradient-to-br from-navy-700 to-coral',
              'text-white font-serif font-semibold text-[22px]',
            )}
            aria-hidden
          >
            {initials}
          </span>
          <div className="flex-1 min-w-0">
            <strong className="block text-[13px] font-bold text-navy-900 mb-0.5">
              Avatar
            </strong>
            <p className="text-[11.5px] leading-[1.5] text-ink-soft">
              Les initiales sont dérivées de votre nom. Vous pouvez téléverser
              une image (carré, PNG/JPG, max 1 Mo).
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="secondary" leftIcon={<Upload />}>
              Téléverser
            </Button>
            <Button size="sm" variant="ghost">
              Retirer
            </Button>
          </div>
        </div>

        {/* Form grid */}
        <form onSubmit={handleSave} className="grid gap-3.5" id="profile-form">
          <div className="grid gap-3.5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="pf-firstname" required>
                Prénom
              </FieldLabel>
              <Input
                id="pf-firstname"
                type="text"
                value={firstName}
                onChange={(e) => markDirty<string>(setFirstName)(e.target.value)}
                required
                autoComplete="given-name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pf-lastname" required>
                Nom
              </FieldLabel>
              <Input
                id="pf-lastname"
                type="text"
                value={lastName}
                onChange={(e) => markDirty<string>(setLastName)(e.target.value)}
                required
                autoComplete="family-name"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel
              htmlFor="pf-position"
              hintInline="affichée dans les métadonnées des documents"
            >
              Fonction
            </FieldLabel>
            <Input
              id="pf-position"
              type="text"
              value={position}
              onChange={(e) => markDirty<string>(setPosition)(e.target.value)}
              placeholder="Ex. Responsable du Système d'Information — CPAM 92"
            />
          </Field>

          <div className="grid gap-3.5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="pf-email" required>
                Adresse e-mail
              </FieldLabel>
              <Input
                id="pf-email"
                type="email"
                value={email}
                onChange={(e) => markDirty<string>(setEmail)(e.target.value)}
                required
                autoComplete="email"
                placeholder="prenom.nom@cpam92.fr"
              />
              <InlineMsg variant="info">
                Utilisée pour les notifications et la récupération de compte.
              </InlineMsg>
            </Field>
            <Field>
              <FieldLabel htmlFor="pf-username">
                Identifiant de connexion
              </FieldLabel>
              <Input
                id="pf-username"
                type="text"
                value={user?.username ?? ''}
                readOnly
                inputClassName="bg-cream-light text-ink-soft cursor-not-allowed"
              />
              <FieldHint icon={<Lock size={12} />}>
                Modification réservée à l'administrateur
              </FieldHint>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="pf-bio" hintInline="220 caractères max">
              Biographie courte
            </FieldLabel>
            <Textarea
              id="pf-bio"
              rows={3}
              value={bio}
              maxLength={220}
              onChange={(e) => markDirty<string>(setBio)(e.target.value)}
              className="min-h-[80px] leading-[1.55]"
              placeholder="Ex. DSI CPAM 92. Responsable de la plateforme PlumeNote."
            />
          </Field>
        </form>
      </CardBody>
      <CardFoot>
        {dirty ? (
          <InlineMsg variant="info">Modifications non publiées</InlineMsg>
        ) : (
          <span className="text-[12px] text-ink-soft">Aucune modification en attente</span>
        )}
        <div className="flex gap-2 ml-auto">
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={handleCancel}
            disabled={!dirty}
          >
            Annuler
          </Button>
          <Button
            variant="cta"
            size="md"
            type="submit"
            form="profile-form"
            rightIcon={<CheckCircle2 />}
            disabled={!dirty}
          >
            Enregistrer
          </Button>
        </div>
      </CardFoot>
    </Card>
  )
}

/* ---- Card : Notifications --------------------------------------------- */

interface PrefRow {
  id: string
  label: string
  hint: string
  defaultOn: boolean
}

const PREF_ROWS: PrefRow[] = [
  {
    id: 'pref-popular',
    label: "Un document que j'ai rédigé a été consulté 10+ fois",
    hint: 'Récap hebdomadaire, par e-mail uniquement.',
    defaultOn: true,
  },
  {
    id: 'pref-stale',
    label: 'Un de mes documents est devenu périmé',
    hint: 'Alerte immédiate in-app + rappel hebdomadaire par e-mail.',
    defaultOn: true,
  },
  {
    id: 'pref-mention',
    label: 'Quelqu\'un mentionne un de mes documents via lien interne',
    hint: 'In-app uniquement.',
    defaultOn: true,
  },
  {
    id: 'pref-digest',
    label: 'Digest hebdomadaire de l\'activité DSI',
    hint: 'Chaque lundi matin : nouveaux documents, top recherches, contributions.',
    defaultOn: false,
  },
  {
    id: 'pref-tips',
    label: 'Astuces d\'utilisation (ex. raccourcis Ctrl+K)',
    hint: 'Une fois par mois, in-app uniquement.',
    defaultOn: true,
  },
]

function NotificationsCard() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PREF_ROWS.map((r) => [r.id, r.defaultOn])),
  )

  return (
    <Card>
      <CardHead>
        <CardTitle>Notifications</CardTitle>
        <span className="text-xs text-ink-muted">Matrice e-mail & in-app</span>
      </CardHead>
      <CardBody className="px-[22px] py-1.5">
        {PREF_ROWS.map((row, idx) => (
          <div
            key={row.id}
            className={cn(
              'grid grid-cols-[1fr_auto] gap-3.5 items-center py-3',
              idx < PREF_ROWS.length - 1 && 'border-b border-line-soft',
            )}
          >
            <div>
              <label
                htmlFor={row.id}
                className="block text-[13px] font-semibold text-ink cursor-pointer"
              >
                {row.label}
              </label>
              <p className="mt-0.5 text-[11.5px] leading-[1.4] text-ink-soft">
                {row.hint}
              </p>
            </div>
            <Switch
              id={row.id}
              on={prefs[row.id]}
              onChange={(next) => setPrefs((p) => ({ ...p, [row.id]: next }))}
              aria-label={row.label}
            />
          </div>
        ))}
      </CardBody>
    </Card>
  )
}

/* ---- Card : Mon activité (stats) -------------------------------------- */

type StatIcoVariant = 'coral' | 'success' | 'navy' | 'plum'

const statIcoStyles: Record<StatIcoVariant, string> = {
  coral: 'bg-coral-bg text-coral',
  success: 'bg-success-bg text-success',
  navy: 'bg-navy-50 text-navy-700',
  plum: 'bg-plum-bg text-plum',
}

interface StatRow {
  icon: React.ReactNode
  variant: StatIcoVariant
  label: string
  sub: string
  value: string
}

const STAT_ROWS: StatRow[] = [
  {
    icon: <Edit3 />,
    variant: 'coral',
    label: 'Contributions',
    sub: 'Publications + révisions',
    value: '47',
  },
  {
    icon: <Eye />,
    variant: 'navy',
    label: 'Vues générées',
    sub: 'Sur vos 47 documents',
    value: '1 284',
  },
  {
    icon: <CheckCircle2 />,
    variant: 'success',
    label: 'Documents vérifiés',
    sub: 'Cette année',
    value: '38',
  },
  {
    icon: <Search />,
    variant: 'plum',
    label: 'Recherches',
    sub: '30 derniers jours',
    value: '94',
  },
]

function ActivityStatsCard() {
  return (
    <Card>
      <CardHead>
        <CardTitle className="!text-[15px]">Mon activité</CardTitle>
        {/* TODO(V3) : route détail activité non implémentée, lien rendu passif */}
        <a
          href="#"
          aria-disabled="true"
          onClick={(e) => e.preventDefault()}
          className="text-[12px] font-semibold text-navy-700 hover:text-coral transition-colors cursor-not-allowed opacity-70"
        >
          Voir le détail →
        </a>
      </CardHead>
      <CardBody padded={false} className="py-1">
        {STAT_ROWS.map((row, idx) => (
          <div
            key={row.label}
            className={cn(
              'grid grid-cols-[auto_1fr_auto] gap-3 items-center',
              'px-[22px] py-3.5',
              idx < STAT_ROWS.length - 1 && 'border-b border-line-soft',
            )}
          >
            <span
              className={cn(
                'grid place-items-center w-9 h-9 rounded-[9px]',
                '[&_svg]:w-4 [&_svg]:h-4',
                statIcoStyles[row.variant],
              )}
              aria-hidden
            >
              {row.icon}
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-ink-soft">{row.label}</div>
              <div className="text-[11px] text-ink-muted mt-px">{row.sub}</div>
            </div>
            <div className="font-serif font-semibold text-[26px] leading-none tracking-[-0.01em] text-navy-900 tabular-nums">
              {row.value}
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  )
}

/* ---- Card : Badges ---------------------------------------------------- */

interface BadgeItem {
  emoji: string
  name: string
  descr: string
  earned: boolean
}

// TODO(V3) : brancher GET /api/users/me/badges ; aujourd'hui tous en false (pas de source de vérité).
const BADGES: BadgeItem[] = [
  { emoji: '🌱', name: 'Premier pas', descr: 'Première contribution publiée', earned: false },
  { emoji: '🔍', name: 'Veilleur', descr: '10+ documents marqués vérifiés', earned: false },
  { emoji: '✍️', name: 'Rédacteur', descr: '25+ documents publiés', earned: false },
  { emoji: '📚', name: 'Bibliothécaire', descr: '50+ documents publiés', earned: false },
  { emoji: '🔗', name: 'Tisseur', descr: '100+ liens internes créés', earned: false },
  { emoji: '🏆', name: 'Référent', descr: 'Document cité 20+ fois', earned: false },
]

function BadgesCard() {
  const earnedCount = BADGES.filter((b) => b.earned).length
  return (
    <Card>
      <CardHead>
        <CardTitle className="!text-[15px]">Badges</CardTitle>
        <span className="text-xs text-ink-muted">{earnedCount} / {BADGES.length}</span>
      </CardHead>
      <CardBody padded={false} className="px-[22px] pt-4 pb-[18px] grid grid-cols-2 gap-2.5">
        {BADGES.map((b) => (
          <div
            key={b.name}
            className={cn(
              'flex items-center gap-2.5 p-3 rounded-xl border',
              b.earned
                ? 'bg-coral-bg border-coral'
                : 'bg-bg border-line-soft opacity-55',
            )}
          >
            <span
              className={cn(
                'grid place-items-center shrink-0 w-9 h-9 rounded-lg',
                'bg-white text-[18px] border',
                b.earned
                  ? 'border-coral-soft text-coral'
                  : 'border-line-soft text-ink-muted',
              )}
              aria-hidden
            >
              {b.emoji}
            </span>
            <div className="text-[12px] leading-[1.35] min-w-0">
              <strong className="block font-serif font-bold text-[13px] text-navy-900 mb-0.5">
                {b.name}
              </strong>
              <span className="text-ink-soft">{b.descr}</span>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  )
}

/* ---- Card : Raccourcis clavier ---------------------------------------- */

interface ShortcutRow {
  label: string
  keys: string[]
}

const SHORTCUTS: ShortcutRow[] = [
  { label: 'Ouvrir la recherche', keys: ['Ctrl', 'K'] },
  { label: 'Nouveau document', keys: ['Ctrl', 'N'] },
  { label: 'Sauvegarder (éditeur)', keys: ['Ctrl', 'S'] },
  { label: "Lien interne dans l'éditeur", keys: ['[', '['] },
  { label: 'Menu slash commands', keys: ['/'] },
]

function ShortcutsCard() {
  return (
    <Card>
      <CardHead>
        <CardTitle className="!text-[15px]">Raccourcis clavier</CardTitle>
      </CardHead>
      <CardBody padded={false} className="px-[22px] pt-2.5 pb-4">
        {SHORTCUTS.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between py-1.5 text-[12.5px]"
          >
            <span className="text-ink-soft">{s.label}</span>
            <span className="inline-flex gap-1">
              {s.keys.map((k, i) => (
                <Kbd key={i}>{k}</Kbd>
              ))}
            </span>
          </div>
        ))}
      </CardBody>
    </Card>
  )
}

/* ====================================================================== */
/* TAB SÉCURITÉ — Changement de mot de passe (US-206)                     */
/* ====================================================================== */

function SecurityTab() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)
    try {
      await api.put('/auth/password', {
        old_password: oldPassword,
        new_password: newPassword,
      })
      setSuccess('Mot de passe modifié avec succès.')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError('Mot de passe actuel incorrect.')
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="grid gap-5.5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <Card>
          <CardHead>
            <CardTitle icon={<Lock />}>Changer mon mot de passe</CardTitle>
            <span className="text-xs text-ink-muted">Minimum 8 caractères</span>
          </CardHead>
          <CardBody>
            <form onSubmit={handleSubmit} id="security-form" className="grid gap-3.5">
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-[12.5px] font-medium text-danger"
                >
                  {error}
                </div>
              )}
              {success && (
                <div
                  role="status"
                  className="rounded-xl border border-success/30 bg-success-bg px-4 py-3 text-[12.5px] font-medium text-success"
                >
                  {success}
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="old-password" required>
                  Mot de passe actuel
                </FieldLabel>
                <Input
                  id="old-password"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  leftIcon={<Lock />}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-password" required>
                  Nouveau mot de passe
                </FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  leftIcon={<Lock />}
                />
                <FieldHint>Minimum 8 caractères.</FieldHint>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password" required>
                  Confirmer le nouveau mot de passe
                </FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  leftIcon={<Lock />}
                />
              </Field>
            </form>
          </CardBody>
          <CardFoot>
            <InlineMsg variant="info">
              La modification déconnecte les autres sessions actives.
            </InlineMsg>
            <Button
              variant="cta"
              size="md"
              type="submit"
              form="security-form"
              disabled={submitting}
              className="ml-auto"
              rightIcon={<CheckCircle2 />}
            >
              {submitting ? 'Modification…' : 'Changer le mot de passe'}
            </Button>
          </CardFoot>
        </Card>
      </div>

      <aside className="min-w-0">
        <Card>
          <CardHead>
            <CardTitle icon={<Info />} className="!text-[15px]">
              Conseils
            </CardTitle>
          </CardHead>
          <CardBody>
            <ul className="flex flex-col gap-2 text-[12.5px] leading-[1.5] text-ink-soft">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-success shrink-0" />
                <span>Au moins 8 caractères, idéalement 12 ou plus.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-success shrink-0" />
                <span>Mélangez majuscules, minuscules, chiffres et symboles.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-success shrink-0" />
                <span>Évitez les mots de passe déjà utilisés ailleurs.</span>
              </li>
            </ul>
          </CardBody>
        </Card>
      </aside>
    </section>
  )
}

/* ====================================================================== */
/* TABS PLACEHOLDER (Vague 3+)                                            */
/* ====================================================================== */

function PlaceholderTab({ label }: { label: string }) {
  return (
    <Card>
      <CardBody className="py-12">
        <div className="flex flex-col items-center justify-center text-center gap-3">
          <span className="inline-grid place-items-center w-11 h-11 rounded-xl bg-cream-light text-coral [&_svg]:w-5 [&_svg]:h-5">
            <Settings />
          </span>
          <div>
            <strong className="block font-serif font-semibold text-[17px] text-navy-900">
              {label} · bientôt
            </strong>
            <p className="mt-1 text-[12.5px] text-ink-soft max-w-[380px]">
              Cette section sera disponible dans une prochaine version de
              PlumeNote.
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
