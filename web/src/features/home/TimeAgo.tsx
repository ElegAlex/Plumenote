interface Props {
  date: string
}

export default function TimeAgo({ date }: Props) {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)

  let text: string
  if (diffMin < 1) text = "a l'instant"
  else if (diffMin < 60) text = `il y a ${diffMin}min`
  else if (diffH < 24) text = `il y a ${diffH}h`
  else if (diffD < 30) text = `il y a ${diffD}j`
  else text = new Date(date).toLocaleDateString('fr-FR')

  return (
    <time dateTime={date} title={new Date(date).toLocaleString('fr-FR')} className="text-ink-45" style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10 }}>
      {text}
    </time>
  )
}
