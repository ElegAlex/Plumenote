import { Link } from 'react-router-dom'

const TYPE_ICONS: Record<string, string> = {
  'procedure-technique': '\u25FC',
  'guide-utilisateur': '\u25E7',
  'architecture-systeme': '\u25E7',
  'faq': '\u25A4',
  'troubleshooting': '\u25A4',
  'fiche-applicative': '\u25E8',
  'procedure-dinstallation': '\u25FC',
  'note-de-version': '\u25CB',
  'guide-reseau': '\u25E7',
  'documentation-api': '\u25CE',
  'autre': '\u25CB',
}

interface Doc {
  id: string
  title: string
  slug: string
  tags?: string[]
  domain_id: string
  domain_name: string
  domain_color: string
  type_name?: string
  type_slug?: string
  updated_at: string
}

interface Props {
  docs: Doc[]
}

export default function DocumentsView({ docs }: Props) {
  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2.5 py-16">
        <div className="font-display text-5xl text-ink-10">&empty;</div>
        <div className="font-mono text-xs text-ink-45">Aucun document correspondant</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {docs.map((doc, idx) => {
        const icon = TYPE_ICONS[doc.type_slug || ''] || '\u25CB'
        const shortType = doc.type_name?.split(' ')[0]?.toUpperCase().slice(0, 5) || ''
        return (
          <Link
            key={doc.id}
            to={`/documents/${doc.slug}`}
            className="grid grid-cols-[46px_1fr_95px_65px_88px] max-md:grid-cols-[40px_1fr_70px] items-center border-b border-ink-05 cursor-pointer transition-[background] duration-75 hover:bg-[rgba(28,28,28,0.02)] group no-underline text-inherit"
            style={{ animation: `slideUp 0.22s ease-out ${0.025 * idx}s both` }}
          >
            <div className="flex items-center justify-center text-sm py-3 text-ink-45 transition-colors duration-100 group-hover:text-ink-70">
              {icon}
            </div>
            <div className="py-3 px-4">
              <div className="font-sans text-[13px] font-semibold text-ink group-hover:underline group-hover:underline-offset-3 group-hover:decoration-[1.5px]">
                {doc.title}
              </div>
              {doc.tags && doc.tags.length > 0 && (
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  {doc.tags.map((t) => (
                    <span key={t} className="font-mono text-[8.5px] tracking-wider text-ink-45 bg-ink-05 px-1.5 py-px uppercase">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 py-3 px-2">
              <div
                className="w-[7px] h-[7px] rounded-sm shrink-0"
                style={{ backgroundColor: doc.domain_color, border: '1.5px solid #1C1C1C' }}
              />
              <span className="font-mono text-[10px] text-ink-45">{doc.domain_name}</span>
            </div>
            <div className="font-mono text-[10px] tracking-[1.5px] text-ink-45 text-center max-md:hidden">
              {shortType}
            </div>
            <div className="font-mono text-[10px] text-ink-45 text-right pr-5 max-md:hidden">
              {doc.updated_at ? new Date(doc.updated_at).toLocaleDateString('fr-FR') : ''}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
