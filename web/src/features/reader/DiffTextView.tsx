interface DiffLine {
  type: 'equal' | 'insert' | 'delete'
  text: string
}

interface Props {
  lines: DiffLine[]
}

export default function DiffTextView({ lines }: Props) {
  return (
    <div className="font-mono text-sm rounded-lg border border-ink-10 overflow-auto max-h-[70vh]">
      {lines.map((line, i) => (
        <div
          key={i}
          className={`px-4 py-0.5 whitespace-pre-wrap ${
            line.type === 'insert'
              ? 'bg-green-50 text-green-800'
              : line.type === 'delete'
                ? 'bg-red-50 text-red-800 line-through'
                : 'text-ink-70'
          }`}
        >
          <span className="inline-block w-6 text-ink-30 select-none">
            {line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' '}
          </span>
          {line.text || '\u00A0'}
        </div>
      ))}
    </div>
  )
}
