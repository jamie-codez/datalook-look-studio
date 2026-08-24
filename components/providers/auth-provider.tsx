'use client'

import * as React from 'react'
import { MOCK_USERS, EXTRA_TEAM_USERS } from '@/lib/mock-data'
import { can, permissionsFor, type Permission } from '@/lib/rbac'
import type { CustomRole, Role, User } from '@/lib/types'
import { LoginScreen } from '@/components/auth/login-screen'
import {
  isProduction,
  DEFAULT_ADMIN_NAME,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
} from '@/lib/env'

/** Shared demo password accepted for every seeded account. */
const DEMO_PASSWORD = isProduction ? DEFAULT_ADMIN_PASSWORD : 'datalook'

function initialUsers(): User[] {
  if (isProduction) {
    // Production starts from a clean slate with a single default admin;
    // more users are added from the Admin console.
    return [
      {
        id: 'u-admin',
        name: DEFAULT_ADMIN_NAME,
        email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
        role: 'Admin',
        initials: initialsFrom(DEFAULT_ADMIN_NAME),
      },
    ]
  }
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

function initialsFrom(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = React.useState<User[]>(initialUsers)
  const [customRoles, setCustomRoles] = React.useState<CustomRole[]>([])
  // Logged out by default so the login screen greets the user first.
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)

  const currentUser = users.find((u) => u.id === currentUserId) ?? null

  const [demoPassword, setDemoPassword] = React.useState(DEMO_PASSWORD)

  const switchUser = React.useCallback((userId: string) => {
    setCurrentUserId(userId)
  }, [])

  const login = React.useCallback(
    (email: string, password: string) => {
      const match = users.find((u) => u.email.toLowerCase() === email)
      if (!match || password !== demoPassword) return false
      setCurrentUserId(match.id)
      return true
    },
    [users, demoPassword],
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

  const updateCurrentUser = React.useCallback(
    (updates: { name?: string; email?: string; password?: string }) => {
      if (updates.password) setDemoPassword(updates.password)
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

  // Gate the entire workspace behind sign-in. While logged out, the login
  // screen is the only thing rendered, which also guarantees `currentUser`
  // is non-null for every consumer of this context.
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
