import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import SettingsPage from '@/pages/SettingsPage'
import ChatListPage from '@/pages/ChatListPage'
import NewAnalysisPage from '@/pages/NewAnalysisPage'
import SessionsPage from '@/pages/SessionsPage'
import SessionDetailPage from '@/pages/SessionDetailPage'

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
          <Route path="/sessions/:id" element={<SessionDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
