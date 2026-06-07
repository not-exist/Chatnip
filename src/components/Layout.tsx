import { Link, Outlet, useLocation } from 'react-router-dom'
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from '@heroui/navbar'
import { Button } from '@heroui/button'
import { Link as HeroLink } from '@heroui/link'
import { Switch } from '@heroui/switch'
import { FiSun, FiMoon } from 'react-icons/fi'
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
          <Link to="/chats" className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">QQ AI Chat</span>
          </Link>
        </NavbarBrand>
        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          {NAV_ITEMS.map((item) => (
            <NavbarItem key={item.to} isActive={location.pathname === item.to}>
              <HeroLink
                as={Link}
                to={item.to}
                color={location.pathname === item.to ? 'primary' : 'foreground'}
              >
                {item.label}
              </HeroLink>
            </NavbarItem>
          ))}
        </NavbarContent>
        <NavbarContent justify="end">
          <Switch
            size="sm"
            color="primary"
            isSelected={isDark}
            onValueChange={toggleTheme}
            thumbIcon={isDark ? <FiMoon /> : <FiSun />}
          />
        </NavbarContent>
      </Navbar>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
