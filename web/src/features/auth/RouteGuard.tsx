import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

export default function RouteGuard() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Chargement...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
