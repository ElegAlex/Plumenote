import { useState } from 'react'
import {
  Bell,
  Search,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  CheckSquare,
  Code as CodeIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Save,
  X,
  User,
  Shield,
  ChevronDown,
  MoreHorizontal,
  Edit3,
  Trash2,
} from 'lucide-react'
import {
  Avatar,
  AvatarStack,
  Breadcrumb,
  Button,
  Callout,
  Card,
  CardHead,
  CardTitle,
  CardBody,
  CardFoot,
  Dialog,
  DialogHead,
  DialogBody,
  DialogFoot,
  DomainChip,
  Field,
  FieldLabel,
  FieldHint,
  FieldError,
  FilterChip,
  FreshBadge,
  IconButton,
  IconButtonDot,
  InlineMsg,
  Input,
  Kbd,
  PageHeader,
  PageTitle,
  Select,
  SidePanel,
  Step,
  Stepper,
  Switch,
  Tab,
  Table,
  THead,
  TBody,
  Th,
  Tr,
  Td,
  Tabs,
  Textarea,
  Timeline,
  TimelineEvent,
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSelect,
  ToolbarSeparator,
  TypeChip,
} from '@/components/ui'

/**
 * DesignSystemPage — vitrine des primitives UI PlumeNote.
 * Route : /design-system (dev / QA visuelle). Regroupe palette, typo, composants.
 *
 * Ordre de lecture : couleurs → typo → micro-éléments → form controls → boutons →
 * layout blocks (Card, Tabs, Table) → overlays (Dialog, SidePanel) → éditeur (Toolbar)
 * → timeline / stepper.
 */
export default function DesignSystemPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifPush, setNotifPush] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifs'>('profile')

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-10 flex flex-col gap-10">
      <header>
        <PageTitle
          eyebrow="Design system · PlumeNote"
          description="Référence vivante des primitives UI. Sert de smoke-test visuel après modifications de tokens ou de composants. Identité calquée sur RECRUT (palette navy / coral / cream, Fraunces + Manrope + JetBrains Mono).">
          Primitives <em>de référence</em>
        </PageTitle>
      </header>

      {/* ============ COULEURS ============ */}
      <Section title="Palette">
        <ColorRow
          label="Navy"
          swatches={[
            { name: '900', className: 'bg-navy-900' },
            { name: '800', className: 'bg-navy-800' },
            { name: '700', className: 'bg-navy-700' },
            { name: '600', className: 'bg-navy-600' },
            { name: '500', className: 'bg-navy-500' },
          ]}
        />
        <ColorRow
          label="Coral"
          swatches={[
            { name: 'coral', className: 'bg-coral' },
            { name: 'soft', className: 'bg-coral-soft' },
            { name: 'bg', className: 'bg-coral-bg' },
          ]}
        />
        <ColorRow
          label="Cream / surfaces"
          swatches={[
            { name: 'cream', className: 'bg-cream' },
            { name: 'cream-light', className: 'bg-cream-light' },
            { name: 'bg', className: 'bg-bg' },
            { name: 'white', className: 'bg-white border border-line' },
          ]}
        />
        <ColorRow
          label="Ink (texte)"
          swatches={[
            { name: 'ink', className: 'bg-ink' },
            { name: 'ink-soft', className: 'bg-ink-soft' },
            { name: 'ink-muted', className: 'bg-ink-muted' },
            { name: 'line', className: 'bg-line' },
            { name: 'line-soft', className: 'bg-line-soft' },
          ]}
        />
        <ColorRow
          label="Sémantiques"
          swatches={[
            { name: 'success', className: 'bg-success' },
            { name: 'success-bg', className: 'bg-success-bg' },
            { name: 'warn', className: 'bg-warn' },
            { name: 'warn-bg', className: 'bg-warn-bg' },
            { name: 'danger', className: 'bg-danger' },
            { name: 'danger-bg', className: 'bg-danger-bg' },
            { name: 'plum', className: 'bg-plum' },
            { name: 'plum-bg', className: 'bg-plum-bg' },
          ]}
        />
      </Section>

      {/* ============ TYPOGRAPHIE ============ */}
      <Section title="Typographie">
        <div className="bg-white border border-line rounded-2xl p-8 space-y-6">
          <div>
            <Label>font-serif · Fraunces (titres)</Label>
            <h1 className="font-serif font-semibold text-4xl leading-tight tracking-tight text-navy-900">
              Une seule source <em className="italic text-coral font-medium">pour la connaissance</em>.
            </h1>
            <h2 className="font-serif font-semibold text-2xl mt-4 text-navy-900 before:content-['§_'] before:text-coral before:font-medium">
              Titre de section H2
            </h2>
            <h3 className="font-serif font-semibold text-lg mt-3 text-navy-800">Titre H3</h3>
          </div>

          <div>
            <Label>font-sans · Manrope (UI, corps de texte)</Label>
            <p className="text-ink leading-relaxed">
              Manrope est la police par défaut du corps de texte et des composants d'interface.
              Lisibilité 14px, features stylistic alternates activées.
            </p>
            <p className="text-sm text-ink-soft mt-2">Texte secondaire 13 px · ink-soft.</p>
            <p className="text-[11px] text-ink-muted mt-1 uppercase tracking-[0.1em] font-bold">Eyebrow · uppercase · 11 px</p>
          </div>

          <div>
            <Label>font-mono · JetBrains Mono (code / références)</Label>
            <div className="font-mono text-xs bg-[#0F1838] text-[#E9ECF6] rounded-lg p-4 border border-navy-700">
              <span className="text-coral-soft">$</span> plumenote import --domain infra ./docs/SCI
            </div>
            <code className="inline-block mt-2 bg-cream-light px-1.5 py-0.5 rounded font-mono text-xs text-ink">
              INF-VPN-001
            </code>
          </div>
        </div>
      </Section>

      {/* ============ MICRO-ÉLÉMENTS ============ */}
      <Section title="Micro-éléments">
        <DemoCard>
          <Label>Kbd — touches clavier</Label>
          <p className="text-sm text-ink-soft mb-3">
            Ouvrir la recherche : <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> — Lien interne : <Kbd>[</Kbd> <Kbd>[</Kbd> — Slash menu : <Kbd>/</Kbd>
          </p>
        </DemoCard>

        <DemoCard>
          <Label>FreshBadge — indicateur de fraîcheur</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            <FreshBadge status="ok">À jour</FreshBadge>
            <FreshBadge status="ok">2 h</FreshBadge>
            <FreshBadge status="warn">6 mois</FreshBadge>
            <FreshBadge status="danger">14 mois</FreshBadge>
            <FreshBadge status="danger">Périmé</FreshBadge>
          </div>
        </DemoCard>

        <DemoCard>
          <Label>DomainChip — pastille par domaine</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            <DomainChip domain="infra">Infrastructure</DomainChip>
            <DomainChip domain="support">Support</DomainChip>
            <DomainChip domain="sci">SCI</DomainChip>
            <DomainChip domain="etudes">Études &amp; Dev</DomainChip>
            <DomainChip domain="data">Data</DomainChip>
            <DomainChip domain="neutral">Transverse</DomainChip>
          </div>
        </DemoCard>

        <DemoCard>
          <Label>TypeChip — pastille par type de document</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            <TypeChip type="proc">Procédure</TypeChip>
            <TypeChip type="mo">Mode opératoire</TypeChip>
            <TypeChip type="faq">FAQ</TypeChip>
            <TypeChip type="arch">Architecture</TypeChip>
            <TypeChip type="ref">Référence</TypeChip>
            <TypeChip type="guide">Guide</TypeChip>
          </div>
        </DemoCard>

        <DemoCard>
          <Label>FilterChip — filtre actif avec × de retrait</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            <FilterChip label="Domaine" value="Infrastructure" onRemove={() => {}} />
            <FilterChip label="Type" value="Procédure" onRemove={() => {}} />
            <FilterChip label="Fraîcheur" value="À jour" onRemove={() => {}} />
          </div>
        </DemoCard>

        <DemoCard>
          <Label>Avatar — tailles xs / sm / md / xl</Label>
          <div className="flex items-end gap-4 mt-3">
            <Avatar initials="AB" size="xs" variant="a" />
            <Avatar initials="MZ" size="sm" variant="b" />
            <Avatar initials="DB" size="md" variant="c" />
            <Avatar initials="LH" size="xl" variant="d" />
          </div>
        </DemoCard>

        <DemoCard>
          <Label>AvatarStack — groupe chevauché avec +N</Label>
          <div className="mt-3">
            <AvatarStack more={3}>
              <Avatar initials="AB" size="sm" variant="a" />
              <Avatar initials="MZ" size="sm" variant="b" />
              <Avatar initials="DB" size="sm" variant="c" />
              <Avatar initials="LH" size="sm" variant="d" />
            </AvatarStack>
          </div>
        </DemoCard>
      </Section>

      {/* ============ FORM CONTROLS ============ */}
      <Section title="Form controls">
        <DemoCard>
          <Label>Input — simple / avec icône / avec right-slot / invalide</Label>
          <div className="flex flex-col gap-3 mt-2 max-w-[420px]">
            <Input placeholder="Email professionnel" />
            <Input leftIcon={<Search />} placeholder="Rechercher…" />
            <Input
              leftIcon={<Search />}
              placeholder="Recherche globale"
              rightSlot={<><Kbd>Ctrl</Kbd> <Kbd>K</Kbd></>}
            />
            <Input invalid placeholder="Email invalide" defaultValue="pas-un-email" />
          </div>
        </DemoCard>

        <DemoCard>
          <Label>Textarea — multiligne (min-h 96px, resize vertical)</Label>
          <Textarea placeholder="Quelques lignes à propos de vous…" className="max-w-[520px]" />
        </DemoCard>

        <DemoCard>
          <Label>Select — choix court avec chevron SVG inline</Label>
          <div className="flex gap-3 flex-wrap mt-2">
            <Select defaultValue="updated" className="max-w-[220px]">
              <option value="updated">Trier : modifié récemment</option>
              <option value="created">Trier : créé récemment</option>
              <option value="title">Trier : titre A → Z</option>
            </Select>
            <Select invalid defaultValue="none" className="max-w-[220px]">
              <option value="none">— aucun choix —</option>
            </Select>
          </div>
        </DemoCard>

        <DemoCard>
          <Label>Field — label + control + hint / error / inline-msg</Label>
          <div className="grid gap-4 mt-2 max-w-[520px]">
            <Field>
              <FieldLabel required hintInline="25 / 280">Titre du document</FieldLabel>
              <Input placeholder="Configurer le VPN Always-On" />
              <FieldHint>Ce titre apparaît dans les résultats de recherche.</FieldHint>
            </Field>
            <Field>
              <FieldLabel required>Email professionnel</FieldLabel>
              <Input invalid defaultValue="pas-un-email" />
              <FieldError>Format email invalide.</FieldError>
            </Field>
            <Field>
              <FieldLabel>Statut enregistrement</FieldLabel>
              <Input defaultValue="Dernière sauvegarde il y a 2 min" readOnly />
              <InlineMsg variant="success">Enregistré automatiquement</InlineMsg>
            </Field>
          </div>
        </DemoCard>

        <DemoCard>
          <Label>Switch — toggle 38×22 (controlled)</Label>
          <div className="grid gap-3 mt-2 max-w-[380px]">
            <label className="flex items-center justify-between gap-3 py-2 border-b border-line-soft">
              <div>
                <span className="text-[13px] font-semibold text-ink">Notifications email</span>
                <p className="text-[11.5px] text-ink-soft">Résumé quotidien des documents modifiés.</p>
              </div>
              <Switch on={notifEmail} onChange={setNotifEmail} aria-label="Activer email" />
            </label>
            <label className="flex items-center justify-between gap-3 py-2">
              <div>
                <span className="text-[13px] font-semibold text-ink">Notifications push</span>
                <p className="text-[11.5px] text-ink-soft">Alertes en temps réel dans le navigateur.</p>
              </div>
              <Switch on={notifPush} onChange={setNotifPush} aria-label="Activer push" />
            </label>
          </div>
        </DemoCard>
      </Section>

      {/* ============ BOUTONS ============ */}
      <Section title="Boutons">
        <DemoCard>
          <Label>Button — 6 variantes, 2 tailles</Label>
          <div className="flex items-center gap-3 flex-wrap mt-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="cta" rightIcon={<ChevronDown />}>Call to action</Button>
            <Button variant="danger" leftIcon={<Trash2 />}>Supprimer</Button>
            <Button variant="thumb">👍 Utile</Button>
          </div>
          <div className="flex items-center gap-3 flex-wrap mt-4">
            <Button size="sm">Primary sm</Button>
            <Button size="sm" variant="secondary">Secondary sm</Button>
            <Button size="sm" variant="ghost">Ghost sm</Button>
          </div>
          <div className="flex items-center gap-3 flex-wrap mt-4">
            <Button disabled>Désactivé</Button>
            <Button leftIcon={<Save />}>Enregistrer</Button>
          </div>
        </DemoCard>

        <DemoCard>
          <Label>IconButton — carré 38×38, badge overlay optionnel</Label>
          <div className="flex items-center gap-3 mt-2">
            <IconButton icon={<Bell />} aria-label="Notifications" />
            <IconButton icon={<Bell />} aria-label="Notifications" badge={<IconButtonDot />} />
            <IconButton icon={<Search />} aria-label="Rechercher" />
            <IconButton icon={<MoreHorizontal />} aria-label="Plus d'actions" />
            <IconButton icon={<Edit3 />} aria-label="Éditer" disabled />
          </div>
        </DemoCard>
      </Section>

      {/* ============ CALLOUTS ============ */}
      <Section title="Callouts (5 variantes)">
        <Callout variant="tip" title="Astuce.">
          Ouvrez la recherche avec <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> depuis n'importe quelle page. Typo-tolérance activée par défaut.
        </Callout>
        <Callout variant="info" title="Information.">
          Les liens <code className="bg-cream-light px-1.5 py-0.5 rounded font-mono text-xs">[[Titre]]</code> génèrent des renvois internes avec auto-complétion.
        </Callout>
        <Callout variant="warn" title="Attention.">
          Ce profil VPN Always-On peut interdire l'accès à l'internet local en cas de déplacement à l'étranger.
        </Callout>
        <Callout variant="danger" title="Danger.">
          Ne supprimez pas ce document : 14 autres fiches y font référence via des liens internes.
        </Callout>
        <Callout variant="success" title="Validé.">
          Configuration effective. Les trois vérifications ont été passées avec succès.
        </Callout>
      </Section>

      {/* ============ CARDS ============ */}
      <Section title="Cards (head / body / foot)">
        <Card>
          <CardHead>
            <CardTitle icon={<User />}>Identité professionnelle</CardTitle>
            <span className="text-xs text-ink-muted">Données synchronisées depuis l'AD</span>
          </CardHead>
          <CardBody>
            <p className="text-sm text-ink-soft">
              Corps de Card, padding 20 × 22. Peut contenir un formulaire, un graphique, une liste.
            </p>
          </CardBody>
          <CardFoot>
            <span className="text-xs text-ink-soft">Dernière modification il y a 3 min</span>
            <div className="flex gap-2 ml-auto">
              <Button variant="secondary" size="sm">Annuler</Button>
              <Button variant="cta" size="sm">Enregistrer</Button>
            </div>
          </CardFoot>
        </Card>

        <Card>
          <CardHead compact>
            <CardTitle>Head compact</CardTitle>
            <span className="text-xs text-ink-muted">padding réduit</span>
          </CardHead>
          <CardBody padded={false}>
            <div className="px-[22px] py-[14px] text-sm text-ink-soft border-b border-line-soft">
              Ligne 1 pleine largeur (padded=false + padding interne géré)
            </div>
            <div className="px-[22px] py-[14px] text-sm text-ink-soft">
              Ligne 2 pleine largeur
            </div>
          </CardBody>
        </Card>
      </Section>

      {/* ============ TABS ============ */}
      <Section title="Tabs">
        <DemoCard>
          <Label>Tabs — 3 onglets avec icônes et badge numéroté</Label>
          <div className="mt-2">
            <Tabs aria-label="Sections du compte">
              <Tab active={activeTab === 'profile'} icon={<User />} onClick={() => setActiveTab('profile')}>
                Profil
              </Tab>
              <Tab active={activeTab === 'security'} icon={<Shield />} onClick={() => setActiveTab('security')}>
                Sécurité
              </Tab>
              <Tab active={activeTab === 'notifs'} icon={<Bell />} badge={3} onClick={() => setActiveTab('notifs')}>
                Notifications
              </Tab>
            </Tabs>
          </div>
        </DemoCard>
      </Section>

      {/* ============ TABLE ============ */}
      <Section title="Table (admin users)">
        <Card>
          <CardBody padded={false}>
            <Table>
              <THead>
                <tr>
                  <Th sortable sorted>Utilisateur</Th>
                  <Th>Rôle</Th>
                  <Th>Domaines</Th>
                  <Th sortable>Dernière connexion</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </THead>
              <TBody>
                <Tr>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar initials="AB" size="sm" variant="a" />
                      <div>
                        <div className="font-semibold text-ink text-[13.5px]">Alexandre Berge</div>
                        <div className="font-mono text-[11px] text-ink-muted">a.berge</div>
                      </div>
                    </div>
                  </Td>
                  <Td><span className="inline-flex px-[10px] py-[3px] rounded-full bg-danger-bg text-danger text-[10.5px] font-bold uppercase tracking-[0.06em]">Admin</span></Td>
                  <Td><DomainChip domain="infra">Infrastructure</DomainChip></Td>
                  <Td><span className="text-[11.5px] text-ink-muted tabular-nums"><strong className="text-ink font-semibold">à l'instant</strong></span></Td>
                  <Td className="text-right">
                    <IconButton icon={<Edit3 />} aria-label="Éditer" className="w-[30px] h-[30px]" />
                  </Td>
                </Tr>
                <Tr selected>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar initials="MZ" size="sm" variant="b" />
                      <div>
                        <div className="font-semibold text-ink text-[13.5px]">Mohamed Zemouche</div>
                        <div className="font-mono text-[11px] text-ink-muted">m.zemouche</div>
                      </div>
                    </div>
                  </Td>
                  <Td><span className="inline-flex px-[10px] py-[3px] rounded-full bg-coral-bg text-coral text-[10.5px] font-bold uppercase tracking-[0.06em]">Editor</span></Td>
                  <Td><DomainChip domain="infra">Infrastructure</DomainChip></Td>
                  <Td><span className="text-[11.5px] text-ink-muted tabular-nums">il y a 12 min</span></Td>
                  <Td className="text-right">
                    <IconButton icon={<Edit3 />} aria-label="Éditer" className="w-[30px] h-[30px]" />
                  </Td>
                </Tr>
                <Tr overdue>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar initials="DB" size="sm" variant="c" />
                      <div>
                        <div className="font-semibold text-ink text-[13.5px]">Didier Bottaz</div>
                        <div className="font-mono text-[11px] text-ink-muted">d.bottaz</div>
                      </div>
                    </div>
                  </Td>
                  <Td><span className="inline-flex px-[10px] py-[3px] rounded-full bg-cream text-navy-800 text-[10.5px] font-bold uppercase tracking-[0.06em]">Reader</span></Td>
                  <Td><DomainChip domain="sci">SCI</DomainChip></Td>
                  <Td><span className="text-[11.5px] text-ink-muted tabular-nums">il y a 3 mois</span></Td>
                  <Td className="text-right">
                    <IconButton icon={<Edit3 />} aria-label="Éditer" className="w-[30px] h-[30px]" />
                  </Td>
                </Tr>
              </TBody>
            </Table>
          </CardBody>
        </Card>
      </Section>

      {/* ============ BREADCRUMB + PAGEHEADER ============ */}
      <Section title="Breadcrumb + PageHeader">
        <DemoCard>
          <Label>Breadcrumb — fil d'ariane react-router</Label>
          <div className="mt-2">
            <Breadcrumb
              items={[
                { label: 'Accueil', href: '/' },
                { label: 'Infrastructure', href: '/domains/infrastructure' },
                { label: 'Configurer le VPN Always-On' },
              ]}
            />
          </div>
        </DemoCard>

        <div>
          <Label>PageHeader — bandeau sticky (simulation en place)</Label>
          <div className="border border-line rounded-2xl overflow-hidden bg-bg">
            <PageHeader
              breadcrumb={[
                { label: 'Admin', href: '/admin' },
                { label: 'Utilisateurs' },
              ]}
              actions={
                <>
                  <Button variant="secondary" size="sm" leftIcon={<Search />}>Filtrer</Button>
                  <Button variant="cta" size="sm">Nouvel utilisateur</Button>
                </>
              }
            />
            <div className="p-8 text-sm text-ink-soft">
              Contenu de la page. Le PageHeader reste collé en haut en situation réelle.
            </div>
          </div>
        </div>
      </Section>

      {/* ============ OVERLAYS ============ */}
      <Section title="Overlays">
        <DemoCard>
          <Label>Dialog — modale centrée en haut (gabarit Ctrl+K)</Label>
          <div className="mt-2">
            <Button onClick={() => setDialogOpen(true)}>Ouvrir la modale</Button>
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} aria-label="Recherche globale">
              <DialogHead>
                <CardTitle icon={<Search />}>Recherche globale</CardTitle>
                <IconButton icon={<X />} aria-label="Fermer" onClick={() => setDialogOpen(false)} className="w-[30px] h-[30px]" />
              </DialogHead>
              <DialogBody>
                <Input leftIcon={<Search />} placeholder="Chercher un document, une personne, un domaine…" autoFocus />
                <p className="mt-3 text-sm text-ink-soft">
                  Escape pour fermer, ↵ pour valider le premier résultat, Ctrl+K n'importe où pour ré-ouvrir.
                </p>
              </DialogBody>
              <DialogFoot>
                <Button variant="secondary" size="sm" onClick={() => setDialogOpen(false)}>Annuler</Button>
                <Button variant="cta" size="sm">Rechercher</Button>
              </DialogFoot>
            </Dialog>
          </div>
        </DemoCard>

        <div>
          <Label>SidePanel — colonne sticky droite (lecture / édition)</Label>
          <div className="grid gap-6 border border-line rounded-2xl overflow-hidden bg-bg p-6"
               style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}>
            <div className="bg-white border border-line rounded-2xl p-6">
              <h3 className="font-serif font-semibold text-lg text-navy-900">Contenu principal</h3>
              <p className="text-sm text-ink-soft mt-2">
                Colonne large (lecture de document, éditeur, liste de fiches). La SidePanel à
                droite reste sticky pendant le scroll de cette colonne.
              </p>
            </div>
            <SidePanel stickyTop={20}>
              <Card>
                <CardHead compact>
                  <CardTitle>Métadonnées</CardTitle>
                </CardHead>
                <CardBody>
                  <p className="text-sm text-ink-soft">
                    Infos latérales : auteurs, dates, liens entrants, versions.
                  </p>
                </CardBody>
              </Card>
              <Card>
                <CardHead compact>
                  <CardTitle>Activité récente</CardTitle>
                </CardHead>
                <CardBody>
                  <p className="text-sm text-ink-soft">
                    Timeline condensée des événements.
                  </p>
                </CardBody>
              </Card>
            </SidePanel>
          </div>
        </div>
      </Section>

      {/* ============ TOOLBAR ============ */}
      <Section title="Toolbar (éditeur)">
        <div className="border border-line rounded-2xl overflow-hidden bg-white">
          <Toolbar stickyTop={0}>
            <ToolbarGroup>
              <ToolbarSelect defaultValue="p">
                <option value="p">Paragraphe</option>
                <option value="h1">Titre 1</option>
                <option value="h2">Titre 2</option>
                <option value="h3">Titre 3</option>
              </ToolbarSelect>
            </ToolbarGroup>
            <ToolbarSeparator />
            <ToolbarGroup>
              <ToolbarButton title="Gras"><Bold /></ToolbarButton>
              <ToolbarButton active title="Italique"><Italic /></ToolbarButton>
              <ToolbarButton title="Souligné"><UnderlineIcon /></ToolbarButton>
              <ToolbarButton title="Code en ligne"><CodeIcon /></ToolbarButton>
            </ToolbarGroup>
            <ToolbarSeparator />
            <ToolbarGroup>
              <ToolbarButton title="Liste à puces"><List /></ToolbarButton>
              <ToolbarButton title="Liste numérotée"><ListOrdered /></ToolbarButton>
              <ToolbarButton title="Case à cocher"><CheckSquare /></ToolbarButton>
            </ToolbarGroup>
            <ToolbarSeparator />
            <ToolbarGroup>
              <ToolbarButton title="Lien"><LinkIcon /></ToolbarButton>
              <ToolbarButton title="Image"><ImageIcon /></ToolbarButton>
              <ToolbarButton title="Tableau"><TableIcon /></ToolbarButton>
            </ToolbarGroup>
            <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-line rounded-[7px] text-[11px] font-semibold text-ink-soft">
              Enregistré <Kbd>Ctrl</Kbd> <Kbd>S</Kbd>
            </span>
          </Toolbar>
          <div className="p-8 text-ink text-sm leading-relaxed">
            La zone d'édition vient en dessous. En situation réelle, la toolbar est sticky avec `top` calé sur la hauteur du header Shell (par défaut 68 px).
          </div>
        </div>
      </Section>

      {/* ============ STEPPER ============ */}
      <Section title="Stepper (workflow horizontal)">
        <Stepper columns={4}>
          <Step status="done" label="Étape 1 · terminé" title="Source" index={1} />
          <Step status="done" label="Étape 2 · terminé" title="Aperçu" index={2} />
          <Step status="current" label="Étape 3 · en cours" title="Conversion" index={3} />
          <Step status="todo" label="Étape 4 · à venir" title="Rapport" index={4} />
        </Stepper>
      </Section>

      {/* ============ TIMELINE ============ */}
      <Section title="Timeline (historique vertical)">
        <Card>
          <CardBody>
            <Timeline>
              <TimelineEvent
                status="done"
                label="Mohamed Zemouche a marqué comme vérifié « Configurer VPN Always-On »"
                meta="aujourd'hui à 14:32 · Infrastructure · badge repasse en 🟢"
              />
              <TimelineEvent
                status="done"
                label="Didier Bottaz a publié « Accueil passeport — mode opératoire 2026 »"
                meta="hier à 17:11 · SCI · 2 nouveaux liens entrants"
              />
              <TimelineEvent
                status="current"
                label="Import dossier « Procedures-SCI » en cours"
                meta="21/04 à 10:47 · 68 % traité (847 / 1 247)"
              />
              <TimelineEvent
                status="upcoming"
                label="Publication planifiée du rapport"
                meta="à la fin de l'import"
              />
              <TimelineEvent
                status="refused"
                label="Demande de suppression refusée"
                meta="4 liens entrants · conservation forcée"
              />
            </Timeline>
          </CardBody>
        </Card>
      </Section>

      {/* ============ PAGE TITLE ============ */}
      <Section title="PageTitle (composé)">
        <DemoCard>
          <PageTitle
            eyebrow="Domaine · Infrastructure"
            description="Documentation technique et opérationnelle du périmètre Infrastructure : réseaux, serveurs, téléphonie, VPN, sauvegarde, PCA/PRA.">
            Infrastructure
          </PageTitle>
        </DemoCard>
        <DemoCard>
          <PageTitle
            eyebrow="Recherche · 42 ms"
            description="12 documents correspondent à cette requête. Typo-tolérance activée, tri par pertinence.">
            Résultats pour <em>config vpn</em>
          </PageTitle>
        </DemoCard>
      </Section>

      <footer className="pt-6 border-t border-line flex justify-between text-xs text-ink-muted">
        <span>Vague 0 · socle de primitives</span>
        <span>Source : <code className="bg-cream-light px-1.5 py-0.5 rounded font-mono">web/src/components/ui/</code></span>
      </footer>
    </div>
  )
}

/* ============ HELPERS DE LA PAGE ============ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif font-semibold text-[22px] text-navy-900 tracking-tight flex items-center gap-3 border-b border-line-soft pb-2">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function DemoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-5">{children}</div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted mb-2">
      {children}
    </div>
  )
}

function ColorRow({
  label,
  swatches,
}: {
  label: string
  swatches: { name: string; className: string }[]
}) {
  return (
    <div className="bg-white border border-line rounded-2xl p-5">
      <Label>{label}</Label>
      <div className="flex gap-3 flex-wrap mt-2">
        {swatches.map((s) => (
          <div key={s.name} className="flex flex-col gap-1.5">
            <div className={`w-20 h-14 rounded-lg ${s.className}`} />
            <span className="text-[11px] font-mono text-ink-soft">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
