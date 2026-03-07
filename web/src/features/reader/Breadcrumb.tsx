import { Link } from 'react-router-dom'

interface BreadcrumbProps {
  domainName?: string
  domainSlug?: string
  title: string
}

export default function Breadcrumb({ domainName, domainSlug, title }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
      <Link to="/" className="hover:text-blue-600 transition-colors">
        Accueil
      </Link>
      {domainName && domainSlug && (
        <>
          <span>&gt;</span>
          <Link to={`/domains/${domainSlug}`} className="hover:text-blue-600 transition-colors">
            {domainName}
          </Link>
        </>
      )}
      <span>&gt;</span>
      <span className="text-gray-900 font-medium truncate max-w-xs">{title}</span>
    </nav>
  )
}
