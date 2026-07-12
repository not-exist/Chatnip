import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import Layout from '@/components/Layout'
import SettingsPage from '@/pages/SettingsPage'
import ChatListPage from '@/pages/ChatListPage'
import NewAnalysisPage from '@/pages/NewAnalysisPage'
import SessionsPage from '@/pages/SessionsPage'
import SessionDetailPage from '@/pages/SessionDetailPage'

// Key by :id so switching between two sessions remounts the page instead of
// reusing the mounted instance. Without this, per-session refs/state (e.g. the
// interaction guard) survive navigation and can block the next session's load.
function KeyedSessionDetail() {
  const { id } = useParams<{ id: string }>()
  return <SessionDetailPage key={id} />
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/chats" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/chats" element={<ChatListPage />} />
          <Route path="/analyze/:type/:id" element={<NewAnalysisPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/sessions/:id" element={<KeyedSessionDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
