import {
  Avatar,
  AvatarStack,
  Callout,
  DomainChip,
  FilterChip,
  FreshBadge,
  Kbd,
  PageTitle,
  Step,
  Stepper,
  Timeline,
  TimelineEvent,
  TypeChip,
} from '@/components/ui'

/**
 * DesignSystemPage — vitrine des primitives UI PlumeNote.
 * Route : /design-system (dev / QA visuelle). Regroupe palette, typo, composants.
 */
export default function DesignSystemPage() {
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

      {/* ============ KBD + FRESHBADGE ============ */}
      <Section title="Micro-éléments">
        <Card>
          <Label>Kbd — touches clavier</Label>
          <p className="text-sm text-ink-soft mb-3">
            Ouvrir la recherche : <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> — Lien interne : <Kbd>[</Kbd> <Kbd>[</Kbd> — Slash menu : <Kbd>/</Kbd>
          </p>
        </Card>

        <Card>
          <Label>FreshBadge — indicateur de fraîcheur</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            <FreshBadge status="ok">À jour</FreshBadge>
            <FreshBadge status="ok">2 h</FreshBadge>
            <FreshBadge status="warn">6 mois</FreshBadge>
            <FreshBadge status="danger">14 mois</FreshBadge>
            <FreshBadge status="danger">Périmé</FreshBadge>
          </div>
        </Card>

        <Card>
          <Label>DomainChip — pastille par domaine</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            <DomainChip domain="infra">Infrastructure</DomainChip>
            <DomainChip domain="support">Support</DomainChip>
            <DomainChip domain="sci">SCI</DomainChip>
            <DomainChip domain="etudes">Études &amp; Dev</DomainChip>
            <DomainChip domain="data">Data</DomainChip>
            <DomainChip domain="neutral">Transverse</DomainChip>
          </div>
        </Card>

        <Card>
          <Label>TypeChip — pastille par type de document</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            <TypeChip type="proc">Procédure</TypeChip>
            <TypeChip type="mo">Mode opératoire</TypeChip>
            <TypeChip type="faq">FAQ</TypeChip>
            <TypeChip type="arch">Architecture</TypeChip>
            <TypeChip type="ref">Référence</TypeChip>
            <TypeChip type="guide">Guide</TypeChip>
          </div>
        </Card>

        <Card>
          <Label>FilterChip — filtre actif avec × de retrait</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            <FilterChip label="Domaine" value="Infrastructure" onRemove={() => {}} />
            <FilterChip label="Type" value="Procédure" onRemove={() => {}} />
            <FilterChip label="Fraîcheur" value="À jour" onRemove={() => {}} />
          </div>
        </Card>
      </Section>

      {/* ============ AVATARS ============ */}
      <Section title="Avatars">
        <Card>
          <Label>Avatar — tailles xs / sm / md / xl</Label>
          <div className="flex items-end gap-4 mt-3">
            <Avatar initials="AB" size="xs" variant="a" />
            <Avatar initials="MZ" size="sm" variant="b" />
            <Avatar initials="DB" size="md" variant="c" />
            <Avatar initials="LH" size="xl" variant="d" />
          </div>
        </Card>

        <Card>
          <Label>Avatar — 6 variantes de gradient</Label>
          <div className="flex gap-3 mt-3">
            {(['a', 'b', 'c', 'd', 'e', 'f'] as const).map((v) => (
              <Avatar key={v} initials={v.toUpperCase()} variant={v} />
            ))}
          </div>
        </Card>

        <Card>
          <Label>AvatarStack — groupe chevauché avec +N</Label>
          <div className="mt-3">
            <AvatarStack more={3}>
              <Avatar initials="AB" size="sm" variant="a" />
              <Avatar initials="MZ" size="sm" variant="b" />
              <Avatar initials="DB" size="sm" variant="c" />
              <Avatar initials="LH" size="sm" variant="d" />
            </AvatarStack>
          </div>
        </Card>
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
        </Card>
      </Section>

      {/* ============ PAGE TITLE ============ */}
      <Section title="PageTitle (composé)">
        <Card>
          <PageTitle
            eyebrow="Domaine · Infrastructure"
            description="Documentation technique et opérationnelle du périmètre Infrastructure : réseaux, serveurs, téléphonie, VPN, sauvegarde, PCA/PRA.">
            Infrastructure
          </PageTitle>
        </Card>
        <Card>
          <PageTitle
            eyebrow="Recherche · 42 ms"
            description="12 documents correspondent à cette requête. Typo-tolérance activée, tri par pertinence.">
            Résultats pour <em>config vpn</em>
          </PageTitle>
        </Card>
      </Section>

      <footer className="pt-6 border-t border-line flex justify-between text-xs text-ink-muted">
        <span>Version PR 2 · primitives</span>
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

function Card({ children }: { children: React.ReactNode }) {
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
