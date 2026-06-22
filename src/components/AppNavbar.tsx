import { Link, useLocation } from 'react-router-dom'
import { FiMessageCircle } from 'react-icons/fi'

const NAV_ITEMS = [
  { to: '/chats', label: '会话选择' },
  { to: '/sessions', label: '分析历史' },
  { to: '/settings', label: '设置' },
]

interface AppNavbarProps {
  themeToggle: React.ReactNode
}

export default function AppNavbar({ themeToggle }: AppNavbarProps) {
  const location = useLocation()

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/75 backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-[#110b14]/70">
      <div className="max-w-7xl mx-auto flex items-center h-14 px-4">
        {/* Brand */}
        <Link to="/chats" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-400 to-rose-500 flex items-center justify-center shadow-sm">
            <FiMessageCircle className="text-white text-base" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-rose-500 to-rose-400 bg-clip-text text-transparent">
            Chatnip
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1 ml-8">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Spacer + Theme toggle */}
        <div className="flex-1" />
        <div className="flex items-center">
          {themeToggle}
        </div>
      </div>
    </header>
  )
}
