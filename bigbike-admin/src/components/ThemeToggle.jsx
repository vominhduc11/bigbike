import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/theme'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Button variant="secondary" className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Chuyển sang light mode' : 'Chuyển sang dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
    </Button>
  )
}
