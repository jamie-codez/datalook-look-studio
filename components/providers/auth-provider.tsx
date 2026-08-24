'use client'

import * as React from 'react'
import { MOCK_USERS, EXTRA_TEAM_USERS } from '@/lib/mock-data'
import { can, permissionsFor, type Permission } from '@/lib/rbac'
import type { Role, User } from '@/lib/types'
import { LoginScreen } from '@/components/auth/login-screen'

/** Shared demo password accepted for every seeded account. */
const DEMO_PASSWORD = 'datalook'

interface AuthContextValue {
  currentUser: User
  users: User[]
  /** switch the active identity (mock login) */
  switchUser: (userId: string) => void
  /** end the session and return to the login screen */
  logout: () => void
  addUser: (user: Omit<User, 'id' | 'initials'>) => void
  updateUserRole: (userId: string, role: Role) => void
  removeUser: (userId: string) => void
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
  const [users, setUsers] = React.useState<User[]>([
    ...MOCK_USERS,
    ...EXTRA_TEAM_USERS,
  ])
  // Logged out by default so the login screen greets the user first.
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)

  const currentUser = users.find((u) => u.id === currentUserId) ?? null

  const switchUser = React.useCallback((userId: string) => {
    setCurrentUserId(userId)
  }, [])

  const login = React.useCallback(
    (email: string, password: string) => {
      const match = users.find((u) => u.email.toLowerCase() === email)
      if (!match || password !== DEMO_PASSWORD) return false
      setCurrentUserId(match.id)
      return true
    },
    [users],
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

  const value = React.useMemo(
    () =>
      currentUser
        ? {
            currentUser,
            users,
            switchUser,
            logout,
            addUser,
            updateUserRole,
            removeUser,
          }
        : null,
    [currentUser, users, switchUser, logout, addUser, updateUserRole, removeUser],
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
