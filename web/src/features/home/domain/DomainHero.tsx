import { cn } from '@/lib/cn'

/**
 * DomainHero — bandeau gradient navy → coral, eyebrow + titre Fraunces
 * + 4 StatBox (total / à jour / vieillissantes / périmées).
 * Gabarit de référence : `gabarits-visuels/g7-domaine.html` (.domain-hero).
 */
export interface DomainHeroProps {
  name: string
  description?: string
  total: number
  okCount: number
  warnCount: number
  dangerCount: number
}

export default function DomainHero({
  name,
  description,
  total,
  okCount,
  warnCount,
  dangerCount,
}: DomainHeroProps) {
  const okPct = total > 0 ? Math.round((okCount / total) * 100) : 0
  const warnPct = total > 0 ? Math.round((warnCount / total) * 100) : 0

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[22px] p-8 px-9',
        // Gradient g7: navy-900 0% → navy-700 55% → coral 100% (direction 120deg → bg-gradient-to-br acceptable).
        'bg-gradient-to-br from-navy-900 from-0% via-navy-700 via-55% to-coral to-100%',
        'text-cream',
        'grid gap-7 items-center',
        'grid-cols-1 min-[1200px]:grid-cols-[1fr_auto]',
      )}
    >
      {/* Halo radial cream décoratif (top-right). rgba(244,233,216,0.15) non tokenisable. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 w-[360px] h-[360px]"
        style={{
          background: 'radial-gradient(circle, rgba(244,233,216,0.15), transparent 60%)',
        }}
      />

      <div className="relative z-1">
        <div
          className={cn(
            'inline-flex items-center gap-2.5 mb-3',
            'text-[12px] font-bold uppercase tracking-[0.14em] text-coral-soft',
            'before:content-[""] before:w-[26px] before:h-[1.5px] before:bg-coral-soft',
          )}
        >
          Domaine
        </div>
        <h1 className="font-serif font-medium text-[44px] leading-[1.05] tracking-[-0.02em] text-white mb-3">
          {name}
        </h1>
        {description ? (
          // #C9CFE4 = bleu clair lisible sur fond navy, non tokenisé (one-off dark)
          <p className="text-[14.5px] leading-[1.6] max-w-[580px] text-[#C9CFE4]">
            {description}
          </p>
        ) : null}
      </div>

      <div className="relative z-1 grid grid-cols-2 gap-y-3.5 gap-x-5.5">
        <StatBox label="Total" value={total} sub="fiches" />
        <StatBox
          label="À jour"
          value={okCount}
          // Teintes pastel sur fond navy/coral : non tokenisables (one-off hero g7)
          valueColor="#B2E5C9"
          sub={`🟢 ${okPct} %`}
        />
        <StatBox
          label="Vieillissantes"
          value={warnCount}
          valueColor="#F3D99A"
          sub={`🟡 ${warnPct} %`}
        />
        <StatBox
          label="Périmées"
          value={dangerCount}
          valueColor="#F3B6BE"
          sub="🔴 à vérifier"
        />
      </div>
    </section>
  )
}

function StatBox({
  label,
  value,
  valueColor,
  sub,
}: {
  label: string
  value: number
  valueColor?: string
  sub: string
}) {
  return (
    <div className="text-left">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-coral-soft mb-[3px]">
        {label}
      </div>
      <div
        className="font-serif font-semibold text-[34px] leading-none tracking-[-0.02em] text-white tabular-nums"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {/* #C9CFE4 pour la même raison que plus haut */}
      <div className="text-[11.5px] text-[#C9CFE4] mt-0.5">{sub}</div>
    </div>
  )
}
