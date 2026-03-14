import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Shell from '@/components/layout/Shell'
import RouteGuard from '@/features/auth/RouteGuard'
import { useAuth } from '@/lib/auth-context'

const AuthPage = lazy(() => import('@/features/auth'))
const HomePage = lazy(() => import('@/features/home'))
const PublicHomePage = lazy(() => import('@/features/home/PublicHomePage'))
const SearchPage = lazy(() => import('@/features/search'))
const ReaderPage = lazy(() => import('@/features/reader'))
const DiffPage = lazy(() => import('@/features/reader/DiffPage'))
const EditorPage = lazy(() => import('@/features/editor'))
const AdminPage = lazy(() => import('@/features/admin'))
const ProfilePage = lazy(() => import('@/features/profile'))
const DomainPage = lazy(() => import('@/features/home/DomainPage'))
const ImportPage = lazy(() => import('@/features/import'))
const BookmarkNewPage = lazy(() => import('@/features/bookmark'))
const EntityPage = lazy(() => import('@/features/entity/EntityPage'))
const EntityFormPage = lazy(() => import('@/features/entity/EntityFormPage'))
const CartographyPage = lazy(() => import('@/features/entity/CartographyPage'))
const MindMapPage = lazy(() => import('@/features/mindmap/MindMapPage'))
const NotFoundPage = lazy(() => import('@/features/home/NotFoundPage'))
const FolderPage = lazy(() => import('@/features/folder/FolderPage'))

function Loading() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-500">Chargement...</p>
    </div>
  )
}

function HomeRoute() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <HomePage /> : <PublicHomePage />
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<Shell />}>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/documents/:slug" element={<ReaderPage />} />
          <Route path="/documents/:slug/diff/:v1/:v2" element={<DiffPage />} />
          <Route path="/domains/:slug" element={<DomainPage />} />
          <Route path="/domains/:domainSlug/folders/:folderId" element={<FolderPage />} />
          <Route path="/entities/:id" element={<EntityPage />} />
          <Route element={<RouteGuard />}>
            <Route path="/cartography" element={<CartographyPage />} />
            <Route path="/documents/:slug/edit" element={<EditorPage />} />
            <Route path="/documents/new" element={<EditorPage />} />
            <Route path="/entities/new" element={<EntityFormPage />} />
            <Route path="/entities/:id/edit" element={<EntityFormPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/bookmarks/new" element={<BookmarkNewPage />} />
            <Route path="/mindmap" element={<MindMapPage />} />
            <Route path="/admin/*" element={<AdminPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
