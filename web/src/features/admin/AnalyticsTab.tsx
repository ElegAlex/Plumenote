import { useSearchGaps } from '@/lib/hooks/useSearchGaps'
import { useStatsHealth } from '@/lib/hooks/useStatsHealth'

export default function AnalyticsTab() {
  const { data: health, isLoading: healthLoading } = useStatsHealth()
  const { data: gaps, isLoading: gapsLoading } = useSearchGaps()

  return (
    <div className="space-y-8">
      {/* Document Health */}
      <section>
        <h2 className="text-lg font-bold text-ink mb-4">Santé documentaire</h2>
        {healthLoading ? (
          <p className="text-sm text-ink-45">Chargement...</p>
        ) : health ? (
          <div className="border border-ink-10 rounded p-5 max-w-xl">
            <div className="flex h-4 rounded overflow-hidden mb-3" style={{ background: 'rgba(28,28,28,0.06)' }}>
              {health.total > 0 && (
                <>
                  <div style={{ width: `${(health.green / health.total) * 100}%`, background: '#22C55E' }} />
                  <div style={{ width: `${(health.yellow / health.total) * 100}%`, background: '#EAB308' }} />
                  <div style={{ width: `${(health.red / health.total) * 100}%`, background: '#C23B22' }} />
                </>
              )}
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#22C55E' }} />
                {health.green} vert{health.green !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#EAB308' }} />
                {health.yellow} jaune{health.yellow !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#C23B22' }} />
                {health.red} rouge{health.red !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-ink-45 mt-3">
              Total : {health.total} document{health.total !== 1 ? 's' : ''}
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-45">Aucune donnée disponible</p>
        )}
      </section>

      {/* Search Gaps */}
      <section>
        <h2 className="text-lg font-bold text-ink mb-4">Recherches sans résultat</h2>
        {gapsLoading ? (
          <p className="text-sm text-ink-45">Chargement...</p>
        ) : gaps && gaps.length > 0 ? (
          <div className="border border-ink-10 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-10 bg-ink-5/30">
                  <th className="text-left px-4 py-2 font-semibold text-ink-70">Requête</th>
                  <th className="text-right px-4 py-2 font-semibold text-ink-70">Occurrences</th>
                  <th className="text-right px-4 py-2 font-semibold text-ink-70">Dernière recherche</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((gap) => (
                  <tr key={gap.query} className="border-b border-ink-5 hover:bg-ink-5/20 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs">{gap.query}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-ink-45">{gap.count}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-ink-45">
                      {new Date(gap.last_searched).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-45">Aucune recherche sans résultat enregistrée</p>
        )}
      </section>
    </div>
  )
}
