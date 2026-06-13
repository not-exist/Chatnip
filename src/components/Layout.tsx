import { Link, Outlet, useLocation } from 'react-router-dom'
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from '@heroui/navbar'
import { Link as HeroLink } from '@heroui/link'
import { Switch } from '@heroui/switch'
import { FiMessageCircle, FiSun, FiMoon } from 'react-icons/fi'
import { useTheme } from '@/hooks/useTheme'

const NAV_ITEMS = [
  { to: '/chats', label: '会话选择' },
  { to: '/sessions', label: '分析历史' },
  { to: '/settings', label: '设置' },
]

export default function Layout() {
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()

  return (
    <div className="min-h-screen app-bg">
      <Navbar maxWidth="xl" position="sticky" className="nav-glass">
        <NavbarBrand>
          <Link to="/chats" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-500 flex items-center justify-center shadow-sm">
              <FiMessageCircle className="text-white text-base" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary-500 to-primary-400 bg-clip-text text-transparent">
              QQ AI Chat
            </span>
          </Link>
        </NavbarBrand>
        <NavbarContent className="hidden sm:flex gap-1" justify="center">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname.startsWith(item.to)
            return (
              <NavbarItem key={item.to} isActive={active}>
                <HeroLink
                  as={Link}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'text-primary bg-primary/10'
                      : 'text-default-600 hover:text-default-900 hover:bg-default-100'
                  }`}
                >
                  {item.label}
                </HeroLink>
              </NavbarItem>
            )
          })}
        </NavbarContent>
        <NavbarContent justify="end">
          <Switch
            size="sm"
            color="primary"
            isSelected={isDark}
            onValueChange={toggleTheme}
            thumbIcon={isDark ? <FiMoon className="text-yellow-400" /> : <FiSun className="text-amber-500" />}
          />
        </NavbarContent>
      </Navbar>
      <main className="max-w-7xl mx-auto px-4 py-6 page-enter relative z-[1]">
        <Outlet />
      </main>
    </div>
  )
}
