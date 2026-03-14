import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

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
  const allFailed = (result.success || 0) === 0 && (result.failed || 0) > 0

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        {allFailed ? (
          <XCircle className="h-5 w-5 text-red-500" />
        ) : (result.failed || 0) > 0 ? (
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        )}
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

      {(result.folders_created || 0) > 0 && (
        <p className="text-sm mb-4">Dossiers créés : {result.folders_created}</p>
      )}

      {errors.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-1">Fichiers en erreur :</p>
          <ul className="text-sm space-y-1">
            {errors.map((e, i) => (
              <li key={i} className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <span>{e.filename}</span>
                <span className="text-ink-45">— {e.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onReset}
        className="px-4 py-2 text-sm font-medium text-ink-70 border border-ink-10 rounded hover:bg-ink-05 transition"
      >
        Nouvel import
      </button>
    </div>
  )
}
