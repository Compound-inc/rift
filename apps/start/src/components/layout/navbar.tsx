'use client'

import { Link } from '@tanstack/react-router'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@rift/ui/button'
import { useTheme } from '@rift/ui/hooks/useTheme'
import { AppLogo } from './navbar-icons'
import { NavbarAuthButtons } from './navbar-auth-buttons'
import type { NavbarDict } from './navbar-auth-buttons'

type NavbarProps = {
  dict?: Partial<NavbarDict>
}

/**
 * Navbar component matching the next app's layout/navbar exactly.
 * Fixed header with logo, nav links (About, Pricing, Models), theme toggle, and auth buttons.
 */
export function Navbar({ dict }: NavbarProps) {
  const { resolvedTheme, setTheme, mounted } = useTheme()
  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full px-2 pt-2 sm:px-3 bg-surface-overlay">
      <div className="mx-auto max-w-7xl rounded-xl bg-surface-overlay backdrop-blur-md supports-[backdrop-filter]:bg-surface-overlay/80">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link
                to="/"
                className="flex items-center"
                aria-label={dict?.goHome ?? 'Go to home'}
              >
                <AppLogo className="h-8 w-auto text-foreground-strong" />
                <span className="sr-only">RIFT</span>
              </Link>
              <nav
                className="hidden md:flex items-center gap-12 text-md font-medium text-foreground-secondary"
                aria-label={dict?.mainNavLabel ?? 'Main navigation'}
              >
                <a
                  href="/#about"
                  className="hover:text-foreground-strong transition-colors"
                >
                  {dict?.about ?? 'About'}
                </a>
                <Link
                  to="/pricing"
                  className="hover:text-foreground-strong transition-colors"
                >
                  {dict?.pricing ?? 'Pricing'}
                </Link>
                <a
                  href="/#models"
                  className="hover:text-foreground-strong transition-colors"
                >
                  {dict?.models ?? 'Models'}
                </a>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <Sun className="transition-transform size-4" />
                ) : (
                  <Moon className="transition-transform size-4" />
                )}
              </Button>
              <NavbarAuthButtons dict={dict} />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
