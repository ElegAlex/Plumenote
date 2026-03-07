import { Link } from 'react-router-dom'

interface BreadcrumbProps {
  domainName?: string
  domainSlug?: string
  title: string
}

export default function Breadcrumb({ domainName, domainSlug, title }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-ink-45 mb-4">
      <Link to="/" className="hover:text-blue transition-colors">
        Accueil
      </Link>
      {domainName && domainSlug && (
        <>
          <span>&gt;</span>
          <Link to={`/domains/${domainSlug}`} className="hover:text-blue transition-colors">
            {domainName}
          </Link>
        </>
      )}
      <span>&gt;</span>
      <span className="text-ink font-medium truncate max-w-xs">{title}</span>
    </nav>
  )
}
