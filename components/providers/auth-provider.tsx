'use client'

import * as React from 'react'
import { MOCK_USERS, EXTRA_TEAM_USERS } from '@/lib/mock-data'
import { can, permissionsFor, type Permission } from '@/lib/rbac'
import type { CustomRole, Role, User, DriverId } from '@/lib/types'
import { LoginScreen } from '@/components/auth/login-screen'
import { OnboardingScreen } from '@/components/auth/onboarding-screen'
import {
  isProduction,
  SKIP_ONBOARDING,
  DEFAULT_ADMIN_NAME,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
} from '@/lib/env'
import {
  loadPersistedUsers,
  savePersistedUsers,
  loadPersistedCustomRoles,
  savePersistedCustomRoles,
  loadAdminPassword,
  saveAdminPassword,
} from '@/lib/persistence'

function initialsFrom(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function envAdminUser(): User {
  return {
    id: 'u-admin',
    name: DEFAULT_ADMIN_NAME,
    email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
    role: 'Admin',
    initials: initialsFrom(DEFAULT_ADMIN_NAME),
  }
}

function devUsers(): User[] {
  return [...MOCK_USERS, ...EXTRA_TEAM_USERS]
}

interface AuthContextValue {
  currentUser: User
  users: User[]
  customRoles: CustomRole[]
  /** switch the active identity (mock login) */
  switchUser: (userId: string) => void
  /** end the session and return to the login screen */
  logout: () => void
  addUser: (user: Omit<User, 'id' | 'initials'>) => void
  updateUserRole: (userId: string, role: Role) => void
  removeUser: (userId: string) => void
  /** update the current user's profile (name, email) and optionally password */
  updateCurrentUser: (updates: { name?: string; email?: string; password?: string }) => void
  addCustomRole: (role: Omit<CustomRole, 'id'>) => void
  updateCustomRole: (id: string, updates: Partial<Omit<CustomRole, 'id'>>) => void
  removeCustomRole: (id: string) => void
  assignCustomRole: (userId: string, customRoleId: string | undefined) => void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = React.useState<User[]>(() =>
    isProduction ? (SKIP_ONBOARDING ? [envAdminUser()] : []) : devUsers(),
  )
  const [customRoles, setCustomRoles] = React.useState<CustomRole[]>([])
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)
  const [adminPassword, setAdminPassword] = React.useState(
    isProduction ? DEFAULT_ADMIN_PASSWORD : 'datalook',
  )
  const [hydrated, setHydrated] = React.useState(false)
  const [onboarding, setOnboarding] = React.useState(false)

  // In production, hydrate users/customRoles/password from IndexedDB.
  React.useEffect(() => {
    if (!isProduction) {
      setHydrated(true)
      return
    }
    let cancelled = false
    ;(async () => {
      const [persistedUsers, persistedRoles, persistedPassword] = await Promise.all([
        loadPersistedUsers(),
        loadPersistedCustomRoles(),
        loadAdminPassword(),
      ])
      if (cancelled) return

      if (persistedUsers.length > 0) {
        setUsers(persistedUsers)
        if (persistedPassword) setAdminPassword(persistedPassword)
      } else if (!SKIP_ONBOARDING) {
        setOnboarding(true)
      }
      if (persistedRoles.length > 0) setCustomRoles(persistedRoles)
      setHydrated(true)
    })()
    return () => { cancelled = true }
  }, [])

  // Persist to IndexedDB in production.
  React.useEffect(() => {
    if (!isProduction || !hydrated) return
    savePersistedUsers(users)
  }, [users, isProduction, hydrated])

  React.useEffect(() => {
    if (!isProduction || !hydrated) return
    savePersistedCustomRoles(customRoles)
  }, [customRoles, isProduction, hydrated])

  React.useEffect(() => {
    if (!isProduction || !hydrated) return
    saveAdminPassword(adminPassword)
  }, [adminPassword, isProduction, hydrated])

  const currentUser = users.find((u) => u.id === currentUserId) ?? null

  const switchUser = React.useCallback((userId: string) => {
    setCurrentUserId(userId)
  }, [])

  const login = React.useCallback(
    (email: string, password: string) => {
      const match = users.find((u) => u.email.toLowerCase() === email)
      if (!match || password !== adminPassword) return false
      setCurrentUserId(match.id)
      return true
    },
    [users, adminPassword],
  )

  const logout = React.useCallback(() => {
    setCurrentUserId(null)
  }, [])

  const addUser = React.useCallback(
    (user: Omit<User, 'id' | 'initials'>) => {
      setUsers((prev) => [
        ...prev,
        {
          ...user,
          id: `u-${Date.now()}`,
          initials: initialsFrom(user.name),
        },
      ])
    },
    [],
  )

  const updateUserRole = React.useCallback((userId: string, role: Role) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u)),
    )
  }, [])

  const removeUser = React.useCallback((userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId))
  }, [])

  const handleOnboarding = React.useCallback(
    async (data: {
      adminName: string
      adminEmail: string
      adminPassword: string
      systemDriver: DriverId
    }) => {
      const admin: User = {
        id: 'u-admin',
        name: data.adminName,
        email: data.adminEmail,
        role: 'Admin',
        initials: initialsFrom(data.adminName),
      }
      setUsers([admin])
      setAdminPassword(data.adminPassword)
      setOnboarding(false)
      setCurrentUserId(admin.id)
    },
    [],
  )

  const updateCurrentUser = React.useCallback(
    (updates: { name?: string; email?: string; password?: string }) => {
      if (updates.password) setAdminPassword(updates.password)
      setUsers((prev) =>
        prev.map((u) =>
          u.id === currentUserId
            ? {
                ...u,
                name: updates.name ?? u.name,
                email: updates.email ?? u.email,
                initials: updates.name ? initialsFrom(updates.name) : u.initials,
              }
            : u,
        ),
      )
    },
    [currentUserId],
  )

  const addCustomRole = React.useCallback((role: Omit<CustomRole, 'id'>) => {
    setCustomRoles((prev) => [
      ...prev,
      { ...role, id: `cr-${Date.now()}` },
    ])
  }, [])

  const updateCustomRole = React.useCallback(
    (id: string, updates: Partial<Omit<CustomRole, 'id'>>) => {
      setCustomRoles((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      )
    },
    [],
  )

  const removeCustomRole = React.useCallback((id: string) => {
    setCustomRoles((prev) => prev.filter((r) => r.id !== id))
    setUsers((prev) =>
      prev.map((u) =>
        u.customRoleId === id ? { ...u, customRoleId: undefined } : u,
      ),
    )
  }, [])

  const assignCustomRole = React.useCallback(
    (userId: string, customRoleId: string | undefined) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, customRoleId } : u,
        ),
      )
    },
    [],
  )

  const value = React.useMemo(
    () =>
      currentUser
        ? {
            currentUser,
            users,
            customRoles,
            switchUser,
            logout,
            addUser,
            updateUserRole,
            removeUser,
            updateCurrentUser,
            addCustomRole,
            updateCustomRole,
            removeCustomRole,
            assignCustomRole,
          }
        : null,
    [
      currentUser,
      users,
      customRoles,
      switchUser,
      logout,
      addUser,
      updateUserRole,
      removeUser,
      updateCurrentUser,
      addCustomRole,
      updateCustomRole,
      removeCustomRole,
      assignCustomRole,
    ],
  )

  // Loading state while IndexedDB hydrates in production.
  if (!hydrated) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          Loading…
        </div>
      </div>
    )
  }

  // Production onboarding: no users set up and no env-configured admin.
  if (onboarding) {
    return <OnboardingScreen onComplete={handleOnboarding} />
  }

  // Gate the entire workspace behind sign-in.
  if (!value) {
    return <LoginScreen users={users} onLogin={login} />
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Convenience hook for permission checks against the current user's role. */
export function useRBAC() {
  const { currentUser } = useAuth()
  const role = currentUser.role
  return React.useMemo(
    () => ({
      role,
      can: (permission: Permission) => can(role, permission),
      permissions: permissionsFor(role),
    }),
    [role],
  )
}
