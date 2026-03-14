import { CheckCircle2, XCircle } from 'lucide-react'

interface ImportResultsProps {
  result: {
    total: number
    success?: number
    failed?: number
    domains_created?: string[]
    folders_created?: number
  }
  errors: { filename: string; error: string }[]
  onReset: () => void
}

export default function ImportResults({ result, errors, onReset }: ImportResultsProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        Import terminé
      </h3>
      <p className="text-sm mb-4">
        {result.success} succès · {result.failed} échec{(result.failed || 0) > 1 ? 's' : ''}
      </p>

      {result.domains_created && result.domains_created.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-1">Domaines créés :</p>
          <ul className="text-sm space-y-1">
            {result.domains_created.map(name => (
              <li key={name}>→ {name}</li>
            ))}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-1">Fichiers en erreur :</p>
          <ul className="text-sm space-y-1">
            {errors.map((e, i) => (
              <li key={i} className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <span>{e.filename}</span>
                <span className="text-muted-foreground">— {e.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onReset}
        className="px-4 py-2 border rounded-md text-sm hover:bg-accent"
      >
        Nouvel import
      </button>
    </div>
  )
}
