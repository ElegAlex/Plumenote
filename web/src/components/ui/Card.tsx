import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/**
 * Card — conteneur blanc avec border line et rounded-2xl.
 *
 * Composition :
 *   <Card>
 *     <CardHead>
 *       <CardTitle>Titre</CardTitle>
 *       <span className="text-xs text-ink-muted">meta</span>
 *     </CardHead>
 *     <CardBody>…</CardBody>
 *     <CardFoot>…</CardFoot>
 *   </Card>
 *
 * Gabarits : g2 panels "Récemment modifiés", g5 meta-card, g10 cards forms.
 */
export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white border border-line rounded-2xl overflow-hidden',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeadProps extends HTMLAttributes<HTMLDivElement> {
  /** Variante compacte (padding réduit). */
  compact?: boolean
  children: ReactNode
}

/**
 * CardHead — en-tête de Card (padding + border-bottom line-soft).
 * `compact` pour les métadonnées denses (padding 10 14).
 */
export function CardHead({ compact, className, children, ...props }: CardHeadProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        'border-b border-line-soft',
        compact ? 'px-[14px] py-[10px]' : 'px-[22px] pt-[16px] pb-[12px]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Slot icône à gauche (rendue à 15 px coral par défaut). */
  icon?: ReactNode
  children: ReactNode
}

/**
 * CardTitle — titre de Card, Fraunces 17 px navy-900 letter-spacing -0.01em.
 * Slot icône coral optionnel (gabarit g10 card-title svg).
 */
export function CardTitle({ icon, className, children, ...props }: CardTitleProps) {
  return (
    <h3
      className={cn(
        'flex items-center gap-2.5',
        'font-serif font-semibold text-[17px] tracking-[-0.01em] text-navy-900',
        '[&_svg]:w-[15px] [&_svg]:h-[15px] [&_svg]:text-coral',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </h3>
  )
}

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  /** Active le padding (par défaut `true`). Passer `false` pour mettre une Table ou Timeline pleine largeur. */
  padded?: boolean
  children: ReactNode
}

/**
 * CardBody — corps de Card. Par défaut padding 20 22.
 */
export function CardBody({ padded = true, className, children, ...props }: CardBodyProps) {
  return (
    <div
      className={cn(padded && 'px-[22px] py-[20px]', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardFootProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/**
 * CardFoot — pied de Card (border-top line-soft + fond cream-light).
 * Typiquement pour les barres d'action de formulaire.
 * Gabarit g10 card-foot.
 */
export function CardFoot({ className, children, ...props }: CardFootProps) {
  return (
    <div
      className={cn(
        'px-[22px] py-[14px]',
        'border-t border-line-soft bg-cream-light',
        'flex items-center justify-between gap-3 flex-wrap',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
