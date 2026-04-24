// web/src/features/import/ImportResults.tsx
// Phase Rapport — gabarit g8 (3 sections Succès / Avertissements / Erreurs + actions
// Terminer → /search et Nouvel import).
//
// Contrat inchangé : reçoit `result` (DoneEvent) + `errors` + `onReset`.
import { useNavigate } from 'react-router-dom'
import { Check, AlertTriangle, X, Folder } from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHead,
  CardTitle,
} from '@/components/ui'

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
  const navigate = useNavigate()
  const success = result.success ?? 0
  const failed = result.failed ?? 0
  const allFailed = success === 0 && failed > 0
  const globalTone: 'success' | 'warn' | 'danger' =
    allFailed ? 'danger' : failed > 0 ? 'warn' : 'success'

  return (
    <Card>
      <CardHead>
        <CardTitle
          icon={
            globalTone === 'success' ? <Check /> :
            globalTone === 'warn' ? <AlertTriangle /> :
            <X />
          }
        >
          Rapport d'import
        </CardTitle>
        <span className="text-[12.5px] text-ink-soft tabular-nums">
          <strong className="text-navy-900 font-bold">{success}</strong> succès
          {' · '}
          <strong className="text-navy-900 font-bold">{failed}</strong> échec{failed > 1 ? 's' : ''}
          {' · '}
          <strong className="text-navy-900 font-bold">{result.total}</strong> total
        </span>
      </CardHead>
      <CardBody>
        <div className="flex flex-col gap-5">

          {/* ---- Section Succès ---- */}
          {success > 0 && (
            <ReportSection
              tone="success"
              title="Documents importés"
              count={success}
            >
              <p className="text-[13px] text-ink-soft">
                {success} document{success > 1 ? 's' : ''} créé{success > 1 ? 's' : ''} avec succès.
              </p>
              {result.domains_created && result.domains_created.length > 0 && (
                <div className="mt-2.5 text-[13px] text-ink">
                  <span className="font-semibold text-navy-900">Domaines créés :</span>{' '}
                  {result.domains_created.map(d => (
                    <span
                      key={d}
                      className="inline-block mr-1.5 mb-1 px-2 py-[2px] bg-navy-50 text-navy-700 rounded-full text-[11.5px] font-semibold uppercase tracking-[0.06em]"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              )}
              {(result.folders_created || 0) > 0 && (
                <p className="mt-2 text-[13px] text-ink-soft inline-flex items-center gap-1.5">
                  <Folder size={13} className="text-ink-muted" />
                  {result.folders_created} dossier{(result.folders_created || 0) > 1 ? 's' : ''} créé{(result.folders_created || 0) > 1 ? 's' : ''}
                </p>
              )}
            </ReportSection>
          )}

          {/* ---- Section Avertissements ----
              Le backend n'émet pas encore de status 'warn' (voir ImportProgress).
              Section réservée visuellement mais masquée tant qu'il n'y a pas
              de signal explicite. */}

          {/* ---- Section Erreurs ---- */}
          {errors.length > 0 && (
            <ReportSection
              tone="danger"
              title="Fichiers en erreur"
              count={errors.length}
            >
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {errors.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 font-mono text-[12px] text-ink"
                  >
                    <X size={13} className="text-danger shrink-0 mt-0.5" />
                    <span className="flex-1 min-w-0">
                      <strong className="text-navy-900 font-semibold break-all">{e.filename}</strong>
                      <span className="text-ink-soft"> — {e.error}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </ReportSection>
          )}

          {/* ---- Actions ---- */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-line-soft mt-1">
            <Button
              variant="primary"
              onClick={() => navigate('/search')}
              disabled={allFailed}
            >
              Terminer · voir les documents
            </Button>
            <Button
              variant="secondary"
              onClick={onReset}
            >
              Nouvel import
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

interface ReportSectionProps {
  tone: 'success' | 'warn' | 'danger'
  title: string
  count: number
  children: React.ReactNode
}

function ReportSection({ tone, title, count, children }: ReportSectionProps) {
  const toneBg =
    tone === 'success' ? 'bg-success-bg border-success'
    : tone === 'warn' ? 'bg-warn-bg border-warn'
    : 'bg-danger-bg border-danger'
  const toneText =
    tone === 'success' ? 'text-success'
    : tone === 'warn' ? 'text-warn'
    : 'text-danger'

  return (
    <section className={`rounded-xl border-l-4 ${toneBg} p-4 pl-5`}>
      <div className="flex items-center justify-between mb-2.5">
        <h4 className={`font-serif font-semibold text-[15px] ${toneText}`}>
          {title}
        </h4>
        <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${toneText} tabular-nums`}>
          {count}
        </span>
      </div>
      {children}
    </section>
  )
}
