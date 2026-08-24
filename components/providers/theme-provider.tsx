'use client'

import * as React from 'react'

type Theme = 'dark' | 'light'

export type AccentColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'pink'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  accentColor: AccentColor
  setAccentColor: (color: AccentColor) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'datalook-theme'
const ACCENT_KEY = 'datalook-accent'

const ACCENT_PRESETS: Record<AccentColor, { light: string; dark: string; lightFg: string; darkFg: string }> = {
  blue: {
    light: 'oklch(0.6 0.13 220)',
    dark: 'oklch(0.74 0.13 210)',
    lightFg: 'oklch(0.99 0.005 220)',
    darkFg: 'oklch(0.16 0.02 255)',
  },
  green: {
    light: 'oklch(0.6 0.15 155)',
    dark: 'oklch(0.72 0.15 160)',
    lightFg: 'oklch(0.99 0.01 155)',
    darkFg: 'oklch(0.16 0.02 160)',
  },
  purple: {
    light: 'oklch(0.55 0.2 300)',
    dark: 'oklch(0.68 0.15 300)',
    lightFg: 'oklch(0.99 0.01 300)',
    darkFg: 'oklch(0.16 0.02 300)',
  },
  orange: {
    light: 'oklch(0.68 0.16 55)',
    dark: 'oklch(0.75 0.15 60)',
    lightFg: 'oklch(0.16 0.02 55)',
    darkFg: 'oklch(0.16 0.02 60)',
  },
  red: {
    light: 'oklch(0.58 0.22 25)',
    dark: 'oklch(0.68 0.19 22)',
    lightFg: 'oklch(0.99 0.01 25)',
    darkFg: 'oklch(0.16 0.02 25)',
  },
  pink: {
    light: 'oklch(0.65 0.18 350)',
    dark: 'oklch(0.72 0.16 350)',
    lightFg: 'oklch(0.99 0.01 350)',
    darkFg: 'oklch(0.16 0.02 350)',
  },
}

function applyAccent(color: AccentColor, theme: Theme) {
  const preset = ACCENT_PRESETS[color]
  const root = document.documentElement
  const primary = theme === 'dark' ? preset.dark : preset.light
  const primaryFg = theme === 'dark' ? preset.darkFg : preset.lightFg
  root.style.setProperty('--primary', primary)
  root.style.setProperty('--primary-foreground', primaryFg)
  root.style.setProperty('--ring', primary)
  root.style.setProperty('--sidebar-primary', primary)
  root.style.setProperty('--sidebar-primary-foreground', primaryFg)
  root.style.setProperty('--sidebar-ring', primary)
  root.style.setProperty('--chart-1', primary)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>('dark')
  const [accentColor, setAccentColorState] = React.useState<AccentColor>('blue')

  // Hydrate from storage / prior server default on mount.
  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'dark' || stored === 'light') {
      setThemeState(stored)
    }
    const storedAccent = window.localStorage.getItem(ACCENT_KEY) as AccentColor | null
    if (storedAccent && storedAccent in ACCENT_PRESETS) {
      setAccentColorState(storedAccent)
    }
  }, [])

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    window.localStorage.setItem(STORAGE_KEY, theme)
    applyAccent(accentColor, theme)
  }, [theme, accentColor])

  const setTheme = React.useCallback((t: Theme) => setThemeState(t), [])
  const toggleTheme = React.useCallback(
    () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  )
  const setAccentColor = React.useCallback((c: AccentColor) => {
    setAccentColorState(c)
    window.localStorage.setItem(ACCENT_KEY, c)
  }, [])

  const value = React.useMemo(
    () => ({ theme, toggleTheme, setTheme, accentColor, setAccentColor }),
    [theme, toggleTheme, setTheme, accentColor, setAccentColor],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export { ACCENT_PRESETS }
export type { AccentColor as AccentColorType }
