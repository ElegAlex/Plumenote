import { Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui'

/**
 * PublicHeader — header minimal standalone de la page d'accueil publique (gabarit g3).
 *
 * Présent uniquement sur `/` non authentifié. Ne fait PAS partie du Shell applicatif.
 * Brand plume inline SVG (identité PlumeNote), nav secondaire (masquée < 640 px),
 * badge "Accès public" success + bouton secondaire "Se connecter".
 */
export default function PublicHeader() {
  return (
    <header className="bg-white border-b border-line sticky top-0 z-10 px-9 py-3.5 flex items-center justify-between max-[640px]:px-5">
      <Link to="/" className="flex items-center gap-3 no-underline text-inherit">
        <div className="w-[38px] h-[38px] bg-navy-900 text-cream rounded-[10px] grid place-items-center">
          {/* Plume identité PlumeNote (SVG verbatim du gabarit g3) */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-[19px] h-[19px]"
            aria-hidden="true"
          >
            <path d="M4 20 L 13 11" />
            <path d="M18.5 2 C 12 2.5 6.5 8 6 14.5 L 6 18 L 9.5 18 C 16 17.5 21.5 12 22 5.5 Z" />
            <path d="M9 15 L 15 9" />
          </svg>
        </div>
        <div className="font-serif font-semibold text-base text-navy-900 leading-[1.15]">
          PlumeNote
          <small className="block font-sans text-[10.5px] font-medium text-ink-soft tracking-[0.1em] uppercase mt-0.5">
            Base de connaissances · DSI
          </small>
        </div>
      </Link>

      <nav className="flex items-center gap-5.5 max-[640px]:hidden">
        {/* TODO: câbler vers /domains (index), /recent, /help quand routes créées.
            Liens passifs pour le moment : ne pas rediriger vers /search (trompeur).
            aria-disabled + preventDefault pour signaler l'inactivité (AT + pointer). */}
        <a
          href="#"
          aria-disabled="true"
          onClick={(e) => e.preventDefault()}
          className="text-ink-soft no-underline text-[13px] font-semibold hover:text-navy-900 transition-colors cursor-not-allowed opacity-70"
        >
          Domaines
        </a>
        <a
          href="#"
          aria-disabled="true"
          onClick={(e) => e.preventDefault()}
          className="text-ink-soft no-underline text-[13px] font-semibold hover:text-navy-900 transition-colors cursor-not-allowed opacity-70"
        >
          Fiches récentes
        </a>
        <a
          href="#"
          aria-disabled="true"
          onClick={(e) => e.preventDefault()}
          className="text-ink-soft no-underline text-[13px] font-semibold hover:text-navy-900 transition-colors cursor-not-allowed opacity-70"
        >
          Aide
        </a>
      </nav>

      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center gap-[7px] px-3 py-1.5 bg-success-bg text-success rounded-full text-[11.5px] font-bold tracking-[0.06em] before:content-[''] before:w-[7px] before:h-[7px] before:bg-success before:rounded-full"
        >
          Accès public
        </span>
        {/* asChild : fusionne le style Button sur le <Link> (pattern Slot),
            évite le HTML invalide <a><button/></a>. */}
        <Button asChild variant="secondary" size="sm" leftIcon={<LogIn />}>
          <Link to="/login" className="no-underline">Se connecter</Link>
        </Button>
      </div>
    </header>
  )
}
