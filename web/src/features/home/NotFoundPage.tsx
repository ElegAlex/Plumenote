import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui'

/**
 * NotFoundPage — page 404 sobre, cohérente avec l'identité RECRUT (Vague 2).
 *
 * Rendue à l'intérieur du Shell pour les routes inconnues authentifiées.
 * Le gros "404" utilise Fraunces en faible opacité (motif éditorial).
 */
export default function NotFoundPage() {
  return (
    <main className="flex flex-col items-center justify-center gap-4 px-8 py-20 min-h-[calc(100vh-58px)] text-ink">
      <div className="font-serif text-[96px] leading-none tracking-[-0.03em] text-ink-10">
        404
      </div>
      <h1 className="font-serif text-[22px] font-semibold tracking-[-0.01em] text-navy-900">
        Page non trouvée
      </h1>
      <p className="text-[13px] text-ink-soft max-w-[420px] text-center">
        Cette page n'existe pas ou a été déplacée. Utilisez la recherche (Ctrl+K) ou revenez à l'accueil.
      </p>
      <Link to="/" className="mt-2 no-underline">
        <Button variant="secondary" leftIcon={<ArrowLeft />}>
          Retour à l'accueil
        </Button>
      </Link>
    </main>
  )
}
