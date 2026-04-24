/**
 * Concatène des classes CSS en ignorant les valeurs falsy.
 * Version minimaliste, sans dépendance (pas de clsx/classnames).
 */
export function cn(...classes: (string | undefined | null | false | 0)[]): string {
  return classes.filter(Boolean).join(' ')
}
