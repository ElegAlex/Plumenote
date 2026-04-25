// web/src/features/admin/AdminPage.tsx
// Console DSI — gabarit g9 (layout 2-col SubnavAdmin 224px + contenu).
// Le Shell primaire (sidebar 248px navy + topbar) est assuré par <Shell>.
//
// Architecture : state-based tabs (préservé de la V1), pas de URL routing.
// Les sub-entrées de la SubnavAdmin pilotent `activeTab`. Les entrées sans
// feature livrée restent inertes (href="#") et seront activées en V2/V3.
import { useCallback, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { useEntityLabel, useEntityTypes } from '@/lib/hooks'
import SubnavAdmin, { type AdminTabKey } from './SubnavAdmin'
import VersionBanner from './VersionBanner'
import TemplatesAdmin from './TemplatesAdmin'
import DomainsAdmin from './DomainsAdmin'
import UsersAdmin from './UsersAdmin'
import ConfigAdmin from './ConfigAdmin'
import AnalyticsTab from './AnalyticsTab'
import EntityTypesAdmin from './EntityTypesAdmin'
import RelationTypesAdmin from './RelationTypesAdmin'

export default function AdminPage() {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<AdminTabKey>('utilisateurs')
  const { data: entityLabelConfig } = useEntityLabel()
  const { data: entityTypes } = useEntityTypes()
  const entityLabel = entityLabelConfig?.label ?? 'Fiche'

  // Les counts users/domains/templates sont peuplés par les sous-vues lorsqu'elles
  // se chargent. On les remonte via un état partagé simple (pas de store global).
  const [counts, setCounts] = useState<{
    users?: number
    domains?: number
    templates?: number
  }>({})

  // useCallback stabilise les refs → évite les re-fetches en boucle dans les
  // sous-vues qui dépendent de `onCountChange` dans leur useCallback `load`.
  const setUsersCount = useCallback((n: number) => setCounts((c) => ({ ...c, users: n })), [])
  const setDomainsCount = useCallback((n: number) => setCounts((c) => ({ ...c, domains: n })), [])
  const setTemplatesCount = useCallback((n: number) => setCounts((c) => ({ ...c, templates: n })), [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-ink-muted">Chargement...</p>
      </div>
    )
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="grid grid-cols-[224px_1fr] min-h-[calc(100vh-68px)]">
      <SubnavAdmin
        activeTab={activeTab}
        onSelect={setActiveTab}
        entityLabel={entityLabel}
        counts={{
          users: counts.users,
          domains: counts.domains,
          entityTypes: entityTypes?.length,
          templates: counts.templates,
        }}
      />

      <main className="flex flex-col min-w-0 bg-bg">
        <div className="w-full max-w-[1300px] mx-auto px-8 pt-[22px] pb-12 flex flex-col gap-[18px]">
          <VersionBanner />

          {activeTab === 'utilisateurs' && <UsersAdmin onCountChange={setUsersCount} />}
          {activeTab === 'domaines' && <DomainsAdmin onCountChange={setDomainsCount} />}
          {activeTab === 'templates' && <TemplatesAdmin onCountChange={setTemplatesCount} />}
          {activeTab === 'entity-types' && <EntityTypesAdmin />}
          {activeTab === 'relation-types' && <RelationTypesAdmin />}
          {activeTab === 'configuration' && <ConfigAdmin />}
          {activeTab === 'analytique' && <AnalyticsTab />}
        </div>
      </main>
    </div>
  )
}
