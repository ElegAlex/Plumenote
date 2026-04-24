// web/src/features/admin/AnalyticsTab.tsx
// Vue "Analytics" — placeholder "Bientôt V3".
// La version V1 (santé, gaps, orphelins) est mise en pause le temps de
// consolider les metrics côté backend. Les hooks de données restent dans
// /lib/hooks mais ne sont plus consommés ici.
import { BarChart2 } from 'lucide-react'
import { Card, TitleEyebrow } from '@/components/ui'

export default function AnalyticsTab() {
  return (
    <div className="flex flex-col gap-[18px]">
      <section>
        <TitleEyebrow>Administration</TitleEyebrow>
        <h1 className="font-serif font-semibold text-[28px] leading-[1.15] tracking-[-0.02em] text-navy-900">
          Analytics documentaires
        </h1>
        <p className="mt-1.5 text-[13.5px] text-ink-soft leading-[1.55] max-w-[620px]">
          Santé du corpus, recherches sans résultat, documents orphelins.
        </p>
      </section>

      <Card className="px-[22px] py-12 flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-coral-bg text-coral grid place-items-center">
          <BarChart2 size={24} strokeWidth={1.8} />
        </div>
        <h2 className="font-serif font-semibold text-[20px] text-navy-900">Bientôt V3</h2>
        <p className="text-[13.5px] text-ink-soft max-w-[420px]">
          Les indicateurs de santé documentaire, les requêtes sans résultat et l'analyse d'orphelinage seront
          exposés dans cette vue après consolidation des metrics côté backend.
        </p>
      </Card>
    </div>
  )
}
