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
const EditorPage = lazy(() => import('@/features/editor'))
const AdminPage = lazy(() => import('@/features/admin'))
const ProfilePage = lazy(() => import('@/features/profile'))
const DomainPage = lazy(() => import('@/features/home/DomainPage'))
const ImportPage = lazy(() => import('@/features/import'))
const BookmarkNewPage = lazy(() => import('@/features/bookmark'))

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
          <Route path="/domains/:slug" element={<DomainPage />} />
          <Route element={<RouteGuard />}>
            <Route path="/documents/:slug/edit" element={<EditorPage />} />
            <Route path="/documents/new" element={<EditorPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/bookmarks/new" element={<BookmarkNewPage />} />
            <Route path="/admin/*" element={<AdminPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
