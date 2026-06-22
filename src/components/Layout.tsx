import { Outlet } from 'react-router-dom'
import { Switch } from '@heroui/react'
import { FiSun, FiMoon } from 'react-icons/fi'
import { useTheme } from '@/hooks/useTheme'
import AppNavbar from '@/components/AppNavbar'

export default function Layout() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen app-bg">
      <AppNavbar
        themeToggle={
          <Switch
            size="sm"
            isSelected={isDark}
            onChange={() => toggleTheme()}
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb>
                  <Switch.Icon>
                    {isDark ? (
                      <FiMoon className="text-yellow-400 w-3 h-3" />
                    ) : (
                      <FiSun className="text-amber-500 w-3 h-3" />
                    )}
                  </Switch.Icon>
                </Switch.Thumb>
              </Switch.Control>
            </Switch.Content>
          </Switch>
        }
      />
      <main className="max-w-7xl mx-auto px-4 py-6 page-enter relative z-[1]">
        <Outlet />
      </main>
    </div>
  )
}
