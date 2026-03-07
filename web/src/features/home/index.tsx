import { useAuth } from '@/lib/auth-context'
import HomePage from './HomePage'
import PublicHomePage from './PublicHomePage'

export default function HomeRouter() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Chargement...</p>
      </div>
    )
  }

  return isAuthenticated ? <HomePage /> : <PublicHomePage />
}
