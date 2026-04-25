import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  User,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import {
  Button,
  Field,
  FieldLabel,
  InlineMsg,
  Input,
  TitleEyebrow,
} from '@/components/ui'

/**
 * LoginPage — page de connexion PlumeNote (gabarit g1).
 *
 * Layout split plein écran :
 * - Panel gauche (1.1fr) : illustration navy/coral (brand mark plume,
 *   hero Fraunces, graphe de connaissances SVG, footer self-hosted animé).
 * - Panel droit (1fr) : formulaire Manrope/Fraunces (identifiant,
 *   mot de passe avec toggle, remember-me, bouton primaire, help-box GLPI).
 *
 * Logique d'authentification strictement préservée :
 *   useAuth().login(username, password) + navigate('/', { replace: true })
 *   + gestion erreur ApiError.
 */
export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [ticketUrl, setTicketUrl] = useState<string | null>(null)

  // Récupère l'URL du ticket GLPI exposée par l'API (même pattern que
  // PublicHomePage). Si absente, on retombe sur un lien aria-disabled.
  useEffect(() => {
    api
      .get<{ url: string }>('/config/ticket-url')
      .then((res) => {
        if (res.url) setTicketUrl(res.url)
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // TODO(V3) : brancher remember-me côté API quand useAuth().login
      // acceptera un 3e argument (actuellement signature (username, password)).
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Identifiant ou mot de passe incorrect')
      } else {
        setError('Une erreur est survenue. Veuillez reessayer.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 min-[960px]:grid-cols-[1.1fr_1fr]">
      {/* Style local : animation dot-pulse du footer illustration
          (rgba coral non exprimable en token). */}
      <style>{`
        @keyframes dot-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(232,132,92,.18); }
          50% { box-shadow: 0 0 0 6px rgba(232,132,92,.08); }
        }
      `}</style>

      {/* ============ GAUCHE : ILLUSTRATION ============ */}
      {/* Couleur texte #E9ECF6 : cream-blueish du gabarit g1 non exprimable via tokens
          (déjà utilisée telle quelle dans index.css .code-block-fallback). */}
      <section className="relative flex min-h-[360px] flex-col overflow-hidden bg-gradient-to-br from-navy-900 from-0% via-navy-700 via-60% to-navy-600 to-100% px-7 py-9 text-[#E9ECF6] min-[960px]:min-h-0 min-[960px]:px-14 min-[960px]:py-12">
        {/* Halo coral haut-droit */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[60px] -right-[80px] h-[360px] w-[360px] opacity-90"
          style={{
            background:
              'radial-gradient(circle, rgba(232,132,92,0.22), transparent 60%)',
          }}
        />
        {/* Halo cream bas-gauche */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-[120px] -left-[60px] h-[340px] w-[340px]"
          style={{
            background:
              'radial-gradient(circle, rgba(244,233,216,0.08), transparent 60%)',
          }}
        />

        {/* Brand */}
        <div className="relative z-[2] flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-[11px] bg-cream text-navy-900 shadow-[0_6px_18px_rgba(20,35,92,0.3)]">
            {/* Plume stylisée — SVG inline (illustration identitaire) */}
            <svg
              className="h-[22px] w-[22px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M4 20 L 13 11" />
              <path d="M18.5 2 C 12 2.5 6.5 8 6 14.5 L 6 18 L 9.5 18 C 16 17.5 21.5 12 22 5.5 Z" />
              <path d="M9 15 L 15 9" />
            </svg>
          </div>
          <div className="font-serif text-[19px] font-semibold leading-[1.1] tracking-[-0.01em] text-cream">
            PlumeNote
            <small className="mt-[3px] block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-coral-soft">
              Base de connaissances · DSI
            </small>
          </div>
        </div>

        {/* Corps */}
        <div className="relative z-[2] mt-14 flex flex-1 flex-col justify-center">
          {/* Eyebrow adapté panel sombre (trait + texte coral, sans losange). */}
          <div className="mb-4 flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">
            <span aria-hidden className="inline-block h-[1.5px] w-[22px] bg-coral" />
            Knowledge Management interne
          </div>

          <h2 className="max-w-[520px] font-serif text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-cream-light min-[960px]:text-[42px] [&_em]:font-medium [&_em]:italic [&_em]:text-coral">
            Un seul endroit pour <em>tout ce que sait la DSI</em>.
          </h2>

          {/* Texte grey-blue lisible sur fond navy : token --color-navy-fg-soft. */}
          <p className="mt-[22px] max-w-[460px] text-[15px] leading-[1.6] text-navy-fg-soft">
            Procédures, cartographies, modes opératoires, architecture.
            Recherche transversale, contenu versionné, graphe de liens entre
            documents. Hébergé sur notre infrastructure, accessible sans
            installation.
          </p>

          <KnowledgeGraphIllustration className="mt-12 w-full max-w-[520px]" />
        </div>

        {/* Footer illustration */}
        <div className="relative z-[2] mt-auto flex items-center gap-3.5 pt-9 text-[12px] font-semibold uppercase tracking-[0.08em] text-coral-soft">
          <span
            aria-hidden
            className="inline-block h-[6px] w-[6px] rounded-full bg-coral"
            style={{ animation: 'dot-pulse 2.4s infinite' }}
          />
          Self-hosted · CPAM 92
        </div>
      </section>

      {/* ============ DROITE : FORMULAIRE ============ */}
      <section className="relative flex flex-col justify-center bg-bg px-7 py-10 min-[960px]:px-14 min-[960px]:py-12">
        <div className="mx-auto w-full max-w-[420px]">
          <TitleEyebrow>Authentification</TitleEyebrow>

          <h1 className="font-serif text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] text-navy-900 min-[960px]:text-[44px] [&_em]:font-medium [&_em]:italic [&_em]:text-coral">
            Bon retour,
            <br />
            <em>connectez-vous</em>.
          </h1>

          <p className="mt-2.5 text-[14.5px] leading-[1.55] text-ink-soft">
            Utilisez votre identifiant PlumeNote. L'accès est restreint aux
            agents de la DSI et contributeurs autorisés.
          </p>

          <form onSubmit={handleSubmit} className="mt-9 flex flex-col gap-[18px]">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-[12.5px] font-medium text-danger"
              >
                {error}
              </div>
            )}

            <Field>
              <FieldLabel htmlFor="username" required>
                Identifiant
              </FieldLabel>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder="prenom.nom"
                leftIcon={<User />}
              />
            </Field>

            <Field>
              <FieldLabel
                htmlFor="password"
                required
                hintInline={
                  // TODO(V2+) : brancher la route interne `/password-reset`
                  // quand le flow de réinitialisation sera implémenté.
                  <a
                    href="#"
                    aria-disabled="true"
                    onClick={(e) => e.preventDefault()}
                    className="cursor-not-allowed text-[12px] font-semibold text-navy-700 transition-colors hover:text-coral"
                  >
                    Mot de passe oublié
                  </a>
                }
              >
                Mot de passe
              </FieldLabel>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••••"
                leftIcon={<Lock />}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                    className="grid h-7 w-7 place-items-center rounded-md text-ink-muted transition-colors hover:bg-cream-light hover:text-navy-800 [&_svg]:h-4 [&_svg]:w-4"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                }
              />
              <InlineMsg variant="info">
                Changez votre mot de passe depuis « Mon compte » après la
                première connexion.
              </InlineMsg>
            </Field>

            <div className="flex items-center justify-between text-[12.5px] text-ink-soft">
              <label className="inline-flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span
                  aria-hidden
                  className={cn(
                    'inline-grid h-4 w-4 place-items-center rounded-[4px] border-[1.5px] bg-white transition-colors',
                    'peer-focus-visible:ring-2 peer-focus-visible:ring-navy-700 peer-focus-visible:ring-offset-2',
                    rememberMe
                      ? 'border-navy-800 bg-navy-800'
                      : 'border-line',
                  )}
                >
                  {rememberMe && (
                    <svg
                      viewBox="0 0 10 8"
                      className="h-[8px] w-[10px] text-white"
                      aria-hidden
                    >
                      <path
                        d="M1 4 L4 7 L9 1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                Rester connecté sur ce poste
              </label>
              <span className="text-[11.5px] text-ink-muted">Session 8 h</span>
            </div>

            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={submitting}
              rightIcon={<ArrowRight />}
              className="mt-1.5 w-full py-[14px] text-[14px]"
            >
              {submitting ? 'Connexion…' : 'Se connecter'}
            </Button>

            <div className="my-7 mb-1.5 flex items-center gap-3.5 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted before:h-px before:flex-1 before:bg-line before:content-[''] after:h-px after:flex-1 after:bg-line after:content-['']">
              ou
            </div>

            <div className="mt-[18px] flex gap-3 rounded-xl border border-line bg-white p-4">
              <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-cream text-navy-800 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                <HelpCircle />
              </div>
              <div className="text-[12.5px] leading-[1.55] text-ink-soft">
                <strong className="mb-0.5 block text-[13px] font-semibold text-navy-900">
                  Pas de compte ?
                </strong>
                Les comptes PlumeNote sont créés par l'administrateur DSI.{' '}
                {/* TODO(V2+) : `/api/config/ticket-url` doit être exposée par
                    le backend pour rendre ce lien cliquable. À défaut, lien
                    passif (aria-disabled) pour éviter une navigation vers #. */}
                <a
                  href={ticketUrl || '#'}
                  target={ticketUrl ? '_blank' : undefined}
                  rel={ticketUrl ? 'noopener noreferrer' : undefined}
                  aria-disabled={ticketUrl ? undefined : 'true'}
                  onClick={ticketUrl ? undefined : (e) => e.preventDefault()}
                  className={cn(
                    'font-semibold text-navy-700 transition-colors hover:text-coral',
                    !ticketUrl && 'cursor-not-allowed',
                  )}
                >
                  Ouvrir un ticket GLPI
                </a>{' '}
                pour demander un accès.
              </div>
            </div>
          </form>

          <div className="mt-9 flex items-center justify-between text-[11px] tracking-[0.06em] text-ink-muted">
            <span>PlumeNote v0.1 (MVP) · 2026</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-success-bg px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-success before:inline-block before:h-[6px] before:w-[6px] before:rounded-full before:bg-success before:content-['']">
              Production
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* KnowledgeGraphIllustration — SVG décoratif reproduit verbatim du    */
/* gabarit g1-login.html (liens courbes, noeuds DSI, pulse central).   */
/* Les valeurs hexa sont conservées dans les attributs SVG natifs      */
/* (fill/stroke/stopColor), hors périmètre tokens Tailwind.            */
/* ------------------------------------------------------------------ */
function KnowledgeGraphIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 520 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="link" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E8845C" stopOpacity=".2" />
          <stop offset="1" stopColor="#E8845C" stopOpacity=".55" />
        </linearGradient>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" />
        </filter>
      </defs>

      {/* Liens */}
      <g stroke="url(#link)" strokeWidth="1.3" fill="none" opacity=".8">
        <path d="M 90 160 Q 180 100 260 140" />
        <path d="M 260 140 Q 340 70 430 110" />
        <path d="M 260 140 Q 350 210 440 200" />
        <path d="M 90 160 Q 160 220 250 230" />
        <path d="M 250 230 Q 330 200 440 200" />
        <path d="M 260 140 L 250 230" />
        <path d="M 430 110 Q 480 150 440 200" />
        <path d="M 90 160 L 260 140" />
      </g>

      {/* Noeuds secondaires */}
      <g>
        <circle cx="90" cy="160" r="22" fill="#FCEEE4" stroke="#E8845C" strokeWidth="1.5" />
        <text x="90" y="164" textAnchor="middle" fill="#14235C" fontFamily="Fraunces" fontWeight="600" fontSize="13">
          INF
        </text>
      </g>
      <g>
        <circle cx="430" cy="110" r="20" fill="#FAF3E6" stroke="#F4E9D8" strokeWidth="1.5" />
        <text x="430" y="114" textAnchor="middle" fill="#14235C" fontFamily="Fraunces" fontWeight="600" fontSize="11">
          SUP
        </text>
      </g>
      <g>
        <circle cx="440" cy="200" r="20" fill="#FAF3E6" stroke="#F4E9D8" strokeWidth="1.5" />
        <text x="440" y="204" textAnchor="middle" fill="#14235C" fontFamily="Fraunces" fontWeight="600" fontSize="11">
          SCI
        </text>
      </g>
      <g>
        <circle cx="250" cy="230" r="18" fill="#FAF3E6" stroke="#F4E9D8" strokeWidth="1.5" />
        <text x="250" y="234" textAnchor="middle" fill="#14235C" fontFamily="Fraunces" fontWeight="600" fontSize="10">
          E&amp;D
        </text>
      </g>

      {/* Noeud central avec pulse */}
      <circle cx="260" cy="140" r="40" fill="#E8845C" opacity=".18" filter="url(#soft)" />
      <circle cx="260" cy="140" r="30" fill="#E8845C" />
      <circle cx="260" cy="140" r="30" fill="none" stroke="#FCEEE4" strokeWidth="2" />
      <text x="260" y="145" textAnchor="middle" fill="#FFFFFF" fontFamily="Fraunces" fontWeight="600" fontSize="14">
        VPN
      </text>

      {/* Micro-noeuds */}
      <circle cx="155" cy="205" r="6" fill="#F3B69A" />
      <circle cx="355" cy="60" r="5" fill="#F3B69A" />
      <circle cx="490" cy="155" r="5" fill="#F3B69A" />
      <circle cx="185" cy="75" r="4" fill="#C9CFE4" opacity=".6" />
      <circle cx="380" cy="245" r="4" fill="#C9CFE4" opacity=".6" />
    </svg>
  )
}
