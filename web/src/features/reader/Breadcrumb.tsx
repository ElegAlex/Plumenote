import { Link } from 'react-router-dom'

interface FolderSegment {
  id: string
  name: string
}

interface BreadcrumbProps {
  domainName?: string
  domainSlug?: string
  title: string
  folderPath?: FolderSegment[]
}

export default function Breadcrumb({ domainName, domainSlug, title, folderPath }: BreadcrumbProps) {
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
      {folderPath?.map((f) => (
        <span key={f.id} className="flex items-center gap-1">
          <span>&gt;</span>
          <Link to={`/domains/${domainSlug}/folders/${f.id}`} className="hover:text-blue transition-colors">
            {f.name}
          </Link>
        </span>
      ))}
      <span>&gt;</span>
      <span className="text-ink font-medium truncate max-w-xs">{title}</span>
    </nav>
  )
}
