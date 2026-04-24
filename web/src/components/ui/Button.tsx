import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'cta' | 'danger' | 'thumb'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Slot icône à gauche du label (rendu à 14 px). */
  leftIcon?: ReactNode
  /** Slot icône à droite (animation hover sur primary / cta). */
  rightIcon?: ReactNode
  /** Type HTML (par défaut `button`, pour éviter les submit involontaires). */
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type']
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-[7px] text-[12px]',
  md: 'px-4 py-[10px] text-[13px]',
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-navy-900 text-white border-transparent',
    'shadow-[0_6px_18px_rgba(20,35,92,0.22)]',
    'hover:-translate-y-px hover:shadow-[0_10px_28px_rgba(20,35,92,0.28)] active:translate-y-0',
  ].join(' '),
  secondary: [
    'bg-white text-navy-800 border-line',
    'hover:border-navy-800 hover:bg-cream-light',
  ].join(' '),
  ghost: [
    'bg-transparent text-ink-soft border-transparent',
    'hover:bg-cream-light hover:text-navy-800',
  ].join(' '),
  cta: [
    'bg-coral text-white border-transparent',
    'shadow-[0_6px_18px_rgba(232,132,92,0.35)]',
    'hover:bg-[#E0734A] hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(232,132,92,0.45)] active:translate-y-0',
  ].join(' '),
  danger: [
    'bg-danger-bg text-danger border-[rgba(177,48,74,0.3)]',
    'hover:border-danger',
  ].join(' '),
  thumb: [
    'bg-white text-navy-800 border-line',
    'hover:bg-cream-light hover:border-navy-800',
  ].join(' '),
}

/**
 * Button — bouton polymorphe avec 6 variantes.
 *
 * - `primary` : action principale (navy-900, shadow navy, translate hover). Gabarit g1.
 * - `secondary` : action secondaire (white, border line). Gabarit g8.
 * - `ghost` : action tertiaire discrète (transparent, hover cream-light).
 * - `cta` : call-to-action coral (gabarit g2 btn-cta, g10 btn-primary coral).
 * - `danger` : action destructive (fond danger-bg, texte danger). Gabarit g8.
 * - `thumb` : feedback utilisateur (👍 / 👎). Gabarit g5 btn-thumb.
 *
 * L'icône droite sur primary / cta se décale de 3 px au hover (guidance visuelle).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', leftIcon, rightIcon, type = 'button', className, children, ...props },
  ref,
) {
  const animatedRightIcon = variant === 'primary' || variant === 'cta'
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2',
        'rounded-lg border-[1.5px] font-semibold font-sans cursor-pointer',
        'transition-[transform,box-shadow,background-color,border-color,color]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
        '[&_svg]:w-[14px] [&_svg]:h-[14px] [&_svg]:shrink-0',
        sizeStyles[size],
        variantStyles[variant],
        animatedRightIcon && '[&>[data-right-icon]]:transition-transform hover:[&>[data-right-icon]]:translate-x-[3px]',
        className,
      )}
      {...props}
    >
      {leftIcon && <span data-left-icon className="inline-flex">{leftIcon}</span>}
      {children}
      {rightIcon && <span data-right-icon className="inline-flex">{rightIcon}</span>}
    </button>
  )
})
