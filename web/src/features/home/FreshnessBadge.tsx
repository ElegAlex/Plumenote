const badges = {
  green: { emoji: '\uD83D\uDFE2', label: 'A jour' },
  yellow: { emoji: '\uD83D\uDFE1', label: 'A verifier bientot' },
  red: { emoji: '\uD83D\uDD34', label: 'A mettre a jour' },
} as const

interface Props {
  badge: 'green' | 'yellow' | 'red'
  verifiedAt?: string
}

export default function FreshnessBadge({ badge, verifiedAt }: Props) {
  const { emoji, label } = badges[badge]
  const title = verifiedAt ? `${label} - Verifie le ${new Date(verifiedAt).toLocaleDateString('fr-FR')}` : label

  return (
    <span title={title} className="cursor-default">
      {emoji}
    </span>
  )
}
