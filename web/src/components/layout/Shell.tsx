import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { SearchModal, useSearchModal } from '../../features/search'

export default function Shell() {
  const search = useSearchModal()

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <SearchModal isOpen={search.isOpen} onClose={search.close} />
    </div>
  )
}
