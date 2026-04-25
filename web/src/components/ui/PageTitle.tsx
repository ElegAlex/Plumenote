import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface PageTitleProps {
  eyebrow?: ReactNode
  children: ReactNode
  description?: ReactNode
  className?: string
}

/**
 * PageTitle — bloc de titre de page cohérent (eyebrow + H1 Fraunces + description).
 * L'italique dans le titre peut être mis en évidence coral en utilisant <em>.
 *
 * Usage :
 *   <PageTitle
 *     eyebrow="Formulaire · CDI externe"
 *     description="Texte descriptif court.">
 *     Créer une demande de <em>recrutement externe</em>
 *   </PageTitle>
 */
export function PageTitle({ eyebrow, children, description, className }: PageTitleProps) {
  return (
    <div className={cn('max-w-[720px]', className)}>
      {eyebrow && <TitleEyebrow>{eyebrow}</TitleEyebrow>}
      <h1 className="font-serif font-semibold text-[32px] leading-[1.1] tracking-[-0.02em] text-navy-900 [&_em]:italic [&_em]:text-coral [&_em]:font-medium">
        {children}
      </h1>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>
      )}
    </div>
  )
}

/**
 * TitleEyebrow — petit label coral en tête de section / page.
 * Affiche un losange ◆ en coral-soft + texte coral uppercase.
 */
export function TitleEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'flex items-center gap-2 mb-2.5',
        'font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-coral',
        'before:content-["◆"] before:text-coral-soft',
        className,
      )}
    >
      {children}
    </span>
  )
}
