import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { useEffect } from 'react'
import { TournamentProvider } from './context/TournamentContext'
import { AuthProvider } from './context/AuthContext'
import { PublicLayout } from './components/PublicLayout'
import Home from './pages/Home'
import StandingsPage from './pages/StandingsPage'
import FixturesPage from './pages/FixturesPage'
import BracketPage from './pages/BracketPage'
import PlayersPage from './pages/PlayersPage'
import NotFound from './pages/NotFound'
import SetupRequired from './pages/SetupRequired'
import { needsSetup } from './lib/api'

// The admin panel is a separate bundle: public visitors never download it.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'))
const AdminPlayers = lazy(() => import('./pages/admin/AdminPlayers'))
const AdminFixtures = lazy(() => import('./pages/admin/AdminFixtures'))
const AdminResults = lazy(() => import('./pages/admin/AdminResults'))
const AdminBracket = lazy(() => import('./pages/admin/AdminBracket'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

const AdminFallback = (
  <div className="grid min-h-screen place-items-center bg-ink-950" aria-busy="true">
    <div className="skeleton h-10 w-48" />
  </div>
)

export default function App() {
  if (needsSetup) return <SetupRequired />

  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ScrollToTop />
        <TournamentProvider>
          <AuthProvider>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="standings" element={<StandingsPage />} />
                <Route path="fixtures" element={<FixturesPage />} />
                <Route path="bracket" element={<BracketPage />} />
                <Route path="players" element={<PlayersPage />} />
              </Route>

              <Route
                path="admin/login"
                element={
                  <Suspense fallback={AdminFallback}>
                    <AdminLogin />
                  </Suspense>
                }
              />
              <Route
                path="admin"
                element={
                  <Suspense fallback={AdminFallback}>
                    <AdminLayout />
                  </Suspense>
                }
              >
                <Route index element={<Suspense fallback={null}><AdminOverview /></Suspense>} />
                <Route path="players" element={<Suspense fallback={null}><AdminPlayers /></Suspense>} />
                <Route path="fixtures" element={<Suspense fallback={null}><AdminFixtures /></Suspense>} />
                <Route path="results" element={<Suspense fallback={null}><AdminResults /></Suspense>} />
                <Route path="bracket" element={<Suspense fallback={null}><AdminBracket /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={null}><AdminSettings /></Suspense>} />
              </Route>

              <Route element={<PublicLayout />}>
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </AuthProvider>
        </TournamentProvider>
      </BrowserRouter>
    </MotionConfig>
  )
}
