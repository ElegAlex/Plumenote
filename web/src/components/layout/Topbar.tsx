import { useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

export default function Topbar() {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleCtrlK = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      navigate('/search')
    }
  }, [navigate])

  useEffect(() => {
    document.addEventListener('keydown', handleCtrlK)
    return () => document.removeEventListener('keydown', handleCtrlK)
  }, [handleCtrlK])

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <button
        onClick={() => navigate('/search')}
        className="flex items-center px-4 py-1.5 bg-gray-100 rounded-md text-sm text-gray-500 hover:bg-gray-200 transition-colors"
      >
        <kbd className="text-xs bg-gray-200 rounded px-1.5 py-0.5 mr-2 font-mono">Ctrl+K</kbd>
        Rechercher...
      </button>

      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <Link to="/documents/new" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
              + Nouvelle page
            </Link>
            <div className="relative group">
              <button className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                {user?.display_name?.[0] || user?.username?.[0] || '?'}
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 hidden group-hover:block z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.display_name}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                </div>
                <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Mon profil
                </Link>
                <button
                  onClick={logout}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Deconnexion
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </header>
  )
}
