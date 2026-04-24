import { useEffect, useState, useMemo } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  ArrowRight,
  HelpCircle,
  Key,
  Upload,
  Info,
  Layers,
  Headphones,
  Users,
  Code2,
  Phone,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button, Kbd } from '@/components/ui'
import { cn } from '@/lib/cn'
import PublicHeader from './public/PublicHeader'
import DomainTile from './public/DomainTile'
import type { DomainTileAccent } from './public/DomainTile'
import PopularDocCard from './public/PopularDocCard'
import type { PopularDocDomainKey } from './public/PopularDocCard'

/**
 * PublicHomePage — accueil public non authentifié (profil "Sophie", agent CPAM hors DSI).
 *
 * Gabarit de référence : `gabarits-visuels/g3-accueil-public.html`.
 * Rendue HORS du Shell applicatif (voir App.tsx) : header standalone `<PublicHeader />`.
 *
 * Structure :
 * - Header public (sticky, brand + nav + badge + login)
 * - Hero (eyebrow + h1 Fraunces italique coral + search géante Ctrl+K + hint-chips)
 * - Section "Parcourir par domaine" (4 tuiles hardcodées, alignées sur g3)
 * - Section "Les plus consultés cette semaine" (6 cards, API `/documents?sort=views` avec fallback hardcode)
 * - CTA GLPI (card gradient navy/coral, bouton primaire coral + secondaire outline-on-dark)
 * - Footer sobre
 *
 * Logique API préservée :
 * - `/api/documents?visibility=public&sort=views&limit=6` → populaires
 * - `/api/config/ticket-url` → URL du ticket GLPI (fallback `#` si absent)
 */

// -------------------------- Données domaines (4 tuiles fixes g3) --------------------------

interface DomainTileData {
  slug: string
  name: string
  desc: string
  count: number
  accent: DomainTileAccent
  icon: React.ReactNode
}

const DOMAIN_TILES: DomainTileData[] = [
  {
    slug: 'infrastructure',
    name: 'Infrastructure',
    desc: 'Réseaux, VPN, serveurs, téléphonie, sauvegarde, PCA/PRA.',
    count: 18,
    accent: 'coral',
    icon: <Layers />,
  },
  {
    slug: 'support',
    name: 'Support',
    desc: 'FAQ utilisateurs, mots de passe, impression, postes de travail.',
    count: 14,
    accent: 'success',
    icon: <Headphones />,
  },
  {
    slug: 'sci',
    name: 'SCI',
    desc: 'Accueil, accès bâtiments, passeport, procédures métier transverses.',
    count: 11,
    accent: 'navy',
    icon: <Users />,
  },
  {
    slug: 'etudes',
    name: 'Études & Dev',
    desc: 'Applications locales, SUCRE, ProWeb, intégrations, flux techniques.',
    count: 5,
    accent: 'plum',
    icon: <Code2 />,
  },
]

// -------------------------- Données populaires (fallback si API vide) --------------------

interface PopularCardData {
  slug: string
  title: string
  desc: string
  domainKey: PopularDocDomainKey
  domainLabel: string
  typeLabel: string
  views: number
  dateLabel: string
}

const POPULAR_FALLBACK: PopularCardData[] = [
  {
    slug: 'vpn-always-on-windows-11',
    title: 'Configurer le VPN Always-On sur poste Windows 11',
    desc: 'Guide pas-à-pas pour activer et vérifier la connexion VPN CPAM sur un poste fraîchement migré.',
    domainKey: 'coral',
    domainLabel: 'Infrastructure',
    typeLabel: 'Procédure',
    views: 312,
    dateLabel: 'mis à jour il y a 2 h',
  },
  {
    slug: 'reinitialiser-mot-de-passe-annuaire',
    title: 'Réinitialiser son mot de passe annuaire national',
    desc: "Procédure détaillée pour l'autogestion du mot de passe (portail libre-service) et le contact support en cas d'échec.",
    domainKey: 'success',
    domainLabel: 'Support',
    typeLabel: 'FAQ',
    views: 248,
    dateLabel: '21 avril 2026',
  },
  {
    slug: 'accueil-passeport-mode-operatoire-2026',
    title: 'Accueil passeport — mode opératoire 2026',
    desc: "Checklist complète pour l'accueil d'un agent nouvellement arrivé (badge, compte AD, accès annuaires).",
    domainKey: 'navy',
    domainLabel: 'SCI',
    typeLabel: 'Mode opératoire',
    views: 203,
    dateLabel: 'hier à 17:11',
  },
  {
    slug: 'installation-office-2024',
    title: "Installation d'Office 2024 sur poste utilisateur",
    desc: 'Déploiement massif MUDT, prérequis et étapes manuelles pour les postes restants.',
    domainKey: 'coral',
    domainLabel: 'Infrastructure',
    typeLabel: 'Procédure',
    views: 174,
    dateLabel: 'il y a 3 j',
  },
  {
    slug: 'impression-impossible-diagnostic',
    title: 'Impression impossible — diagnostic en 6 étapes',
    desc: "Checklist exhaustive : driver, file d'attente, connexion, compte utilisateur, imprimante partagée.",
    domainKey: 'success',
    domainLabel: 'Support',
    typeLabel: 'FAQ',
    views: 156,
    dateLabel: '18 avril 2026',
  },
  {
    slug: 'sucre-acces-profils-applicatifs',
    title: 'SUCRE — accès et profils applicatifs',
    desc: 'Référence des profils utilisateurs SUCRE, circuit de demande d\'habilitation et points de contact DFC.',
    domainKey: 'plum',
    domainLabel: 'Études',
    typeLabel: 'Référence',
    views: 134,
    dateLabel: '15 avril 2026',
  },
]

/**
 * Mapping slug domaine → domainKey visuel pour le type-chip des cards populaires.
 * Sert quand on câble l'API : les slugs "infrastructure" → coral, "support" → success, etc.
 */
function slugToDomainKey(slug: string | undefined): PopularDocDomainKey {
  if (!slug) return 'neutral'
  const s = slug.toLowerCase()
  if (s.includes('infra')) return 'coral'
  if (s.includes('support')) return 'success'
  if (s.includes('sci')) return 'navy'
  if (s.includes('etude') || s.includes('dev')) return 'plum'
  return 'neutral'
}

/**
 * Format simple d'une date ISO → "JJ mois AAAA" français. Ne fait pas de relatif ("il y a X")
 * : pour un rendu riche on resterait sur le fallback. Vague 2 : humaniser avec TimeAgo.
 */
function formatDate(iso: string | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}

// -------------------------- Shape minimale de l'API /documents ---------------------------

interface ApiDoc {
  id: string
  title: string
  slug: string
  view_count: number
  updated_at: string
  type_name?: string | null
  type_slug?: string | null
  domain_name?: string | null
}

// -------------------------- Page ---------------------------------------------------------

export default function PublicHomePage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [apiDocs, setApiDocs] = useState<ApiDoc[] | null>(null)
  const [ticketUrl, setTicketUrl] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<ApiDoc[]>('/documents?visibility=public&sort=views&limit=6')
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) setApiDocs(res)
      })
      .catch(() => {
        // silencieux : fallback hardcode
      })
    api
      .get<{ url: string }>('/config/ticket-url')
      .then((res) => {
        if (res.url) setTicketUrl(res.url)
      })
      .catch(() => {})
  }, [])

  /**
   * Données populaires effectives : API si dispo + non vide, sinon fallback hardcode g3.
   * On ne mixe jamais les deux pour éviter les doublons visuels.
   */
  const popularCards = useMemo<PopularCardData[]>(() => {
    if (!apiDocs || apiDocs.length === 0) return POPULAR_FALLBACK
    return apiDocs.map<PopularCardData>((d) => ({
      slug: d.slug,
      title: d.title,
      desc: '', // API ne renvoie pas de description courte : Vague 2 à enrichir côté backend
      domainKey: slugToDomainKey(d.domain_name ?? undefined),
      domainLabel: d.domain_name ?? '—',
      typeLabel: d.type_name ?? 'Document',
      views: d.view_count,
      dateLabel: formatDate(d.updated_at),
    }))
  }, [apiDocs])

  /** Total fiches publiques affiché en sous-titre (somme des 4 tuiles). */
  const totalDocs = useMemo(
    () => DOMAIN_TILES.reduce((acc, tile) => acc + tile.count, 0),
    [],
  )

  function onSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = query.trim()
    if (!q) {
      navigate('/search')
      return
    }
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <PublicHeader />

      {/* ============ HERO ============ */}
      <section className="relative max-w-[1200px] mx-auto px-9 pt-20 pb-15 text-center overflow-hidden max-[640px]:px-5 max-[640px]:pt-14 max-[640px]:pb-10">
        {/* Halo radial coral décoratif derrière le hero (rgba non tokenisable) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[30px] -translate-x-1/2 w-[520px] h-[520px] z-0"
          style={{
            background: 'radial-gradient(circle, rgba(232,132,92,0.08), transparent 65%)',
          }}
        />

        <span
          className={cn(
            'relative z-1 inline-flex items-center gap-2 mb-5.5',
            'px-3.5 py-1.5 bg-coral-bg rounded-full',
            'font-sans text-[12px] font-bold uppercase tracking-[0.14em] text-coral',
            'before:content-["◆"] before:text-coral-soft',
          )}
        >
          Connaissances DSI · Consultation libre
        </span>

        <h1
          className={cn(
            'relative z-1',
            'font-serif font-medium text-[56px] leading-[1.05] tracking-[-0.03em] text-navy-900',
            'max-w-[820px] mx-auto',
            '[&_em]:italic [&_em]:text-coral [&_em]:font-medium',
            'max-[1024px]:text-[42px] max-[640px]:text-[34px]',
          )}
        >
          La base qui répond <em>avant</em>
          <br />
          que vous n'ouvriez un ticket.
        </h1>

        <p className="relative z-1 mt-5 text-[17px] leading-[1.55] text-ink-soft max-w-[620px] mx-auto">
          Cherchez une procédure, une FAQ, un mode opératoire. PlumeNote regroupe la documentation
          officielle des équipes DSI de la CPAM des Hauts-de-Seine.
        </p>

        {/* Search géante */}
        <form onSubmit={onSearchSubmit} className="relative z-1 max-w-[640px] mx-auto mt-10">
          <div className="relative">
            <Search
              className="absolute left-5.5 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-700 pointer-events-none"
              aria-hidden="true"
              strokeWidth={2.2}
            />
            <input
              type="search"
              // autofocus en arrivant sur la page publique : l'utilisateur tape directement
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ex. configurer VPN, mot de passe annuaire, installation Office 2024…"
              aria-label="Rechercher dans la base de connaissances"
              className={cn(
                'w-full py-5 pl-14 pr-14',
                'font-sans text-base text-ink bg-white',
                'border border-line rounded-2xl outline-none',
                // shadow custom avec alpha navy : non exprimable en token
                'shadow-[0_14px_34px_rgba(20,35,92,0.08),0_2px_4px_rgba(20,35,92,0.04)]',
                'placeholder:text-ink-muted',
                'transition-[border-color,box-shadow] duration-150',
                'focus:border-navy-600 focus:shadow-[0_14px_34px_rgba(20,35,92,0.12),0_0_0_4px_rgba(46,66,160,0.1)]',
              )}
            />
            <span className="absolute right-[18px] top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[11px] font-bold text-ink-muted">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          </div>
        </form>

        {/* Hint chips */}
        <div className="relative z-1 mt-3.5 flex flex-wrap justify-center gap-2">
          <HintChip icon={<HelpCircle />} query="mot de passe oublié">
            Mot de passe oublié
          </HintChip>
          <HintChip icon={<Key />} query="accès VPN">
            Accès VPN
          </HintChip>
          <HintChip icon={<Upload />} query="Office 2024">
            Migration Office 2024
          </HintChip>
          <HintChip icon={<Info />} query="demander un accès">
            Demander un accès
          </HintChip>
        </div>
      </section>

      {/* ============ DOMAINES ============ */}
      <section className="max-w-[1200px] mx-auto mt-5 px-9 py-10 max-[640px]:px-5">
        <div className="flex justify-between items-baseline mb-6 gap-5 flex-wrap">
          <div>
            <h2 className="font-serif font-semibold text-[26px] text-navy-900 tracking-[-0.02em] leading-[1.15]">
              Parcourir par domaine
            </h2>
            <div className="mt-1 text-ink-soft text-[13.5px]">
              {totalDocs} fiches publiques à votre disposition · mise à jour continue
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4.5 max-[1024px]:grid-cols-2 max-[640px]:grid-cols-1">
          {DOMAIN_TILES.map((tile) => (
            <DomainTile
              key={tile.slug}
              href={`/domains/${tile.slug}`}
              icon={tile.icon}
              accent={tile.accent}
              name={tile.name}
              desc={tile.desc}
              count={tile.count}
            />
          ))}
        </div>
      </section>

      {/* ============ POPULAIRES ============ */}
      <section className="max-w-[1200px] mx-auto mt-5 px-9 py-10 pb-15 max-[640px]:px-5">
        <div className="flex justify-between items-baseline mb-6 gap-5 flex-wrap">
          <div>
            <h2 className="font-serif font-semibold text-[26px] text-navy-900 tracking-[-0.02em] leading-[1.15]">
              Les plus consultés cette semaine
            </h2>
            <div className="mt-1 text-ink-soft text-[13.5px]">
              Ce que les agents ont trouvé utile récemment
            </div>
          </div>
          <Link
            to="/search"
            className={cn(
              'inline-flex items-center gap-1.5',
              'px-3.5 py-2 bg-white border border-line rounded-full',
              'text-[12.5px] font-semibold text-navy-700 no-underline',
              'transition-colors',
              'hover:border-coral hover:text-coral hover:bg-coral-bg',
            )}
          >
            Toutes les fiches
            <ArrowRight className="w-3 h-3" aria-hidden="true" strokeWidth={2.5} />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 max-[1024px]:grid-cols-1">
          {popularCards.map((card) => (
            <PopularDocCard
              key={card.slug}
              href={`/documents/${card.slug}`}
              domainKey={card.domainKey}
              domainLabel={card.domainLabel}
              title={card.title}
              desc={card.desc}
              typeLabel={card.typeLabel}
              views={card.views}
              dateLabel={card.dateLabel}
            />
          ))}
        </div>
      </section>

      {/* ============ CTA GLPI ============ */}
      <section className="max-w-[1200px] mx-auto px-9 mb-15 max-[640px]:px-5">
        <div
          className={cn(
            'relative overflow-hidden',
            'rounded-[22px] p-10 px-10',
            'bg-gradient-to-br from-navy-900 via-navy-700 to-navy-600',
            'text-cream',
            'flex items-center justify-between gap-7 flex-wrap',
          )}
        >
          {/* Halo radial coral haut-droite */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-[60px] -top-[60px] w-[280px] h-[280px]"
            style={{
              background: 'radial-gradient(circle, rgba(232,132,92,0.22), transparent 65%)',
            }}
          />

          <div className="relative z-1 max-w-[560px]">
            <div
              className={cn(
                'flex items-center gap-2 mb-2.5',
                'font-sans text-[12px] font-bold uppercase tracking-[0.14em] text-coral',
                'before:content-["◆"] before:text-coral-soft',
              )}
            >
              Vous ne trouvez pas ?
            </div>
            <h3
              className={cn(
                'font-serif font-medium text-[28px] leading-[1.2] tracking-[-0.01em] text-white mb-2.5',
                '[&_em]:italic [&_em]:text-coral-soft [&_em]:font-medium',
              )}
            >
              Aucune fiche ne couvre votre besoin ?
              <br />
              <em>Ouvrez un ticket support.</em>
            </h3>
            {/* #C9CFE4 = bleu clair lisible sur fond navy, non tokenisé (one-off sur dark) */}
            <p className="text-[14px] leading-[1.55] text-[#C9CFE4]">
              Les équipes Support, Infrastructure et SCI instruisent vos demandes sur GLPI.
              Décrivez votre problème, joignez une capture si possible, un technicien revient vers
              vous dans la journée.
            </p>
          </div>

          <div className="relative z-1 flex gap-2.5 flex-wrap">
            {/* Bouton primaire CTA coral : on utilise la variante cta existante mais rendue comme <a> via Link */}
            <a
              href={ticketUrl || '#'}
              target={ticketUrl ? '_blank' : undefined}
              rel={ticketUrl ? 'noopener noreferrer' : undefined}
              className="no-underline"
            >
              <Button variant="cta" size="md" rightIcon={<ArrowRight />} tabIndex={-1}>
                Ouvrir un ticket GLPI
              </Button>
            </a>

            {/* Secondaire outline-on-dark : one-off, pas de variante Button pour ce contexte dark */}
            <a
              href="#"
              className={cn(
                'inline-flex items-center gap-2',
                // rgba(255,255,255,0.08) bg + rgba(255,255,255,0.2) border : contexte dark, non tokenisable
                'bg-white/[0.08] border border-white/20 text-cream',
                'py-3.5 px-5.5 rounded-xl',
                'font-semibold text-[13px] no-underline',
                'transition-colors hover:bg-white/[0.16]',
                '[&_svg]:w-[15px] [&_svg]:h-[15px]',
              )}
            >
              <Phone aria-hidden="true" />
              Astreinte DSI
            </a>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-line px-9 py-7.5 max-w-[1200px] mx-auto flex justify-between items-center text-xs text-ink-muted flex-wrap gap-3.5 max-[640px]:px-5">
        <div>PlumeNote · Base de connaissances DSI · CPAM des Hauts-de-Seine</div>
        <div className="flex items-center gap-5">
          <a href="#" className="text-ink-soft no-underline hover:text-navy-800 transition-colors">
            Mentions légales
          </a>
          <a href="#" className="text-ink-soft no-underline hover:text-navy-800 transition-colors">
            Accessibilité
          </a>
          <a href="#" className="text-ink-soft no-underline hover:text-navy-800 transition-colors">
            Contact DSI
          </a>
          <span className="text-ink-muted">v0.1 · 2026</span>
        </div>
      </footer>
    </div>
  )
}

// -------------------------- HintChip sous-composant local --------------------------------

/**
 * HintChip — suggestion pré-remplie de recherche. Navigue vers `/search?q=<query>`.
 * Style : white bg, border-line, text-navy-700 ; hover coral border + text + coral-bg.
 */
function HintChip({
  icon,
  query,
  children,
}: {
  icon: React.ReactNode
  query: string
  children: React.ReactNode
}) {
  return (
    <Link
      to={`/search?q=${encodeURIComponent(query)}`}
      className={cn(
        'inline-flex items-center gap-1.5',
        'px-3 py-1.5 bg-white border border-line rounded-full',
        'text-[12.5px] font-semibold text-navy-700 no-underline',
        'transition-[border-color,color,background-color] duration-150',
        'hover:border-coral hover:text-coral hover:bg-coral-bg',
        '[&_svg]:w-3 [&_svg]:h-3',
      )}
    >
      {icon}
      {children}
    </Link>
  )
}
