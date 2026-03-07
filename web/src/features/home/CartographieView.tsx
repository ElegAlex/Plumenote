import { Link } from 'react-router-dom'

interface Domain {
  id: string
  name: string
  slug: string
  color: string
  doc_count: number
}

interface Doc {
  id: string
  title: string
  slug: string
  domain_id: string
}

interface Props {
  domains: Domain[]
  docs: Doc[]
}

export default function CartographieView({ domains, docs }: Props) {
  const blocks = domains.slice(0, 4).map((d) => ({
    ...d,
    items: docs.filter((doc) => doc.domain_id === d.id).slice(0, 6),
  }))

  return (
    <div className="flex-1 grid grid-cols-2 grid-rows-2">
      {blocks.map((b, i) => (
        <div
          key={b.id}
          className="p-6 flex flex-col gap-3.5"
          style={{
            borderRight: i % 2 === 0 ? '1px solid rgba(28,28,28,0.07)' : 'none',
            borderBottom: i < 2 ? '1px solid rgba(28,28,28,0.07)' : 'none',
            animation: `fadeIn 0.3s ease-out ${0.07 * i}s both`,
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-[11px] h-[11px] rounded-sm"
              style={{ backgroundColor: b.color, border: '2px solid #1C1C1C' }}
            />
            <span className="font-display text-[17px] tracking-[2px]">
              {b.name.toUpperCase()}
            </span>
            <span className="font-mono text-[10px] opacity-45 ml-auto">{b.doc_count}</span>
          </div>
          <div className="flex flex-col gap-1">
            {b.items.length === 0 && (
              <div className="font-mono text-[11px] text-ink-45 py-2">Aucun document</div>
            )}
            {b.items.map((item) => (
              <Link
                key={item.id}
                to={`/documents/${item.slug}`}
                className="font-mono text-[11.5px] py-1.5 px-2.5 border border-ink-05 cursor-pointer transition-all duration-100 flex items-center gap-1.5 rounded-sm no-underline text-ink"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = b.color
                  e.currentTarget.style.color = b.color === '#D4952A' ? '#1C1C1C' : '#FAFAF8'
                  e.currentTarget.style.borderColor = b.color
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#1C1C1C'
                  e.currentTarget.style.borderColor = 'rgba(28,28,28,0.05)'
                }}
              >
                <span className="text-[4px] opacity-30">&#x25CF;</span> {item.title}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
