import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import TemplatesAdmin from './TemplatesAdmin'
import DomainsAdmin from './DomainsAdmin'
import UsersAdmin from './UsersAdmin'
import ConfigAdmin from './ConfigAdmin'

const tabs = [
  { key: 'templates', label: 'Templates' },
  { key: 'domaines', label: 'Domaines' },
  { key: 'utilisateurs', label: 'Utilisateurs' },
  { key: 'configuration', label: 'Configuration' },
] as const

type TabKey = (typeof tabs)[number]['key']

export default function AdminPage() {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('templates')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Chargement...</p>
      </div>
    )
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Administration</h1>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'templates' && <TemplatesAdmin />}
      {activeTab === 'domaines' && <DomainsAdmin />}
      {activeTab === 'utilisateurs' && <UsersAdmin />}
      {activeTab === 'configuration' && <ConfigAdmin />}
    </div>
  )
}
