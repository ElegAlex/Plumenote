import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 58px)',
      fontFamily: "'IBM Plex Mono', monospace",
      color: '#1C1C1C',
      gap: 16,
      padding: 40,
    }}>
      <div style={{
        fontFamily: "'Archivo Black', sans-serif",
        fontSize: 72,
        lineHeight: 1,
        color: 'rgba(28,28,28,0.1)',
      }}>
        404
      </div>
      <div style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 16,
        fontWeight: 600,
        color: 'rgba(28,28,28,0.6)',
      }}>
        Page non trouvee
      </div>
      <Link
        to="/"
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          color: '#2B5797',
          textDecoration: 'none',
          marginTop: 8,
        }}
      >
        &larr; Retour a l'accueil
      </Link>
    </div>
  )
}
