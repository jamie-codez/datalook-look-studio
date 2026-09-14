'use client'

import * as React from 'react'
import { toast } from 'sonner'
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
  SYSTEM_BACKEND_IS_POSTGRES,
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
  // Which provider backs auth is a deployment-time constant (set via
  // NEXT_PUBLIC_SYSTEM_BACKEND), not per-render state, so picking between
  // two separate implementations here doesn't violate the rules of hooks.
  if (SYSTEM_BACKEND_IS_POSTGRES) {
    return <RealAuthProvider>{children}</RealAuthProvider>
  }
  return <DemoAuthProvider>{children}</DemoAuthProvider>
}

// ---------------------------------------------------------------------------
// Real backend: server-verified auth against the Postgres system store
// (app/api/auth/*, app/api/system/*). Session lives in an httpOnly cookie,
// never in the browser's own storage.
// ---------------------------------------------------------------------------

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`)
  return data as T
}

function RealAuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = React.useState<User | null>(null)
  const [users, setUsers] = React.useState<User[]>([])
  const [customRoles, setCustomRoles] = React.useState<CustomRole[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  const refreshUsers = React.useCallback(async () => {
    try {
      const { users } = await apiFetch<{ users: User[] }>('/api/system/users')
      setUsers(users)
    } catch {
      // Non-managers can't list every user — that's fine, they just won't
      // see the team roster.
    }
  }, [])

  const refreshRoles = React.useCallback(async () => {
    try {
      const { roles } = await apiFetch<{ roles: CustomRole[] }>('/api/system/roles')
      setCustomRoles(roles)
    } catch {
      // ignore — same as above
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { user } = await apiFetch<{ user: User }>('/api/auth/session')
        if (cancelled) return
        setCurrentUser(user)
        setUsers([user])
        await Promise.all([refreshUsers(), refreshRoles()])
      } catch {
        // No valid session — LoginScreen will be shown.
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshUsers, refreshRoles])

  const login = React.useCallback(
    async (email: string, password: string) => {
      try {
        const { user } = await apiFetch<{ user: User }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        setCurrentUser(user)
        setUsers([user])
        await Promise.all([refreshUsers(), refreshRoles()])
        return true
      } catch {
        return false
      }
    },
    [refreshUsers, refreshRoles],
  )

  const logout = React.useCallback(() => {
    apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setCurrentUser(null)
    setUsers([])
    setCustomRoles([])
  }, [])

  const switchUser = React.useCallback(() => {
    // Not applicable with real auth — the "switch identity" demo menu is
    // hidden outside dev/demo mode, so this is never actually invoked.
  }, [])

  const addUser = React.useCallback((user: Omit<User, 'id' | 'initials'>) => {
    apiFetch<{ user: User }>('/api/system/users', {
      method: 'POST',
      body: JSON.stringify(user),
    })
      .then(({ user: created }) => setUsers((prev) => [...prev, created]))
      .catch((err) => toast.error('Could not add user', { description: err.message }))
  }, [])

  const updateUserRole = React.useCallback((userId: string, role: Role) => {
    apiFetch<{ user: User }>(`/api/system/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
      .then(({ user: updated }) => {
        setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
        setCurrentUser((prev) => (prev && prev.id === userId ? updated : prev))
      })
      .catch((err) => toast.error('Could not update role', { description: err.message }))
  }, [])

  const removeUser = React.useCallback((userId: string) => {
    apiFetch(`/api/system/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
      .then(() => setUsers((prev) => prev.filter((u) => u.id !== userId)))
      .catch((err) => toast.error('Could not remove user', { description: err.message }))
  }, [])

  const updateCurrentUser = React.useCallback(
    (updates: { name?: string; email?: string; password?: string }) => {
      if (!currentUser) return
      apiFetch<{ user: User }>(`/api/system/users/${encodeURIComponent(currentUser.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
        .then(({ user: updated }) => {
          setCurrentUser(updated)
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
        })
        .catch((err) => toast.error('Could not update profile', { description: err.message }))
    },
    [currentUser],
  )

  const addCustomRole = React.useCallback((role: Omit<CustomRole, 'id'>) => {
    apiFetch<{ role: CustomRole }>('/api/system/roles', {
      method: 'POST',
      body: JSON.stringify(role),
    })
      .then(({ role: created }) => setCustomRoles((prev) => [...prev, created]))
      .catch((err) => toast.error('Could not add role', { description: err.message }))
  }, [])

  const updateCustomRole = React.useCallback(
    (id: string, updates: Partial<Omit<CustomRole, 'id'>>) => {
      apiFetch<{ role: CustomRole }>(`/api/system/roles/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
        .then(({ role: updated }) =>
          setCustomRoles((prev) => prev.map((r) => (r.id === id ? updated : r))),
        )
        .catch((err) => toast.error('Could not update role', { description: err.message }))
    },
    [],
  )

  const removeCustomRole = React.useCallback((id: string) => {
    apiFetch(`/api/system/roles/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then(() => {
        setCustomRoles((prev) => prev.filter((r) => r.id !== id))
        setUsers((prev) => prev.map((u) => (u.customRoleId === id ? { ...u, customRoleId: undefined } : u)))
      })
      .catch((err) => toast.error('Could not remove role', { description: err.message }))
  }, [])

  const assignCustomRole = React.useCallback((userId: string, customRoleId: string | undefined) => {
    apiFetch<{ user: User }>(`/api/system/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ customRoleId: customRoleId ?? null }),
    })
      .then(({ user: updated }) => setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u))))
      .catch((err) => toast.error('Could not assign role', { description: err.message }))
  }, [])

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

  if (!value) {
    return <LoginScreen users={users} onLogin={login} />
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------
// Demo / browser-only backend: unchanged from the original implementation.
// Users, roles, and the admin password live in the browser (IndexedDB in
// production mode, in-memory mock data in dev) — there is no server-side
// identity behind this path.
// ---------------------------------------------------------------------------

function DemoAuthProvider({ children }: { children: React.ReactNode }) {
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
  // If SKIP_ONBOARDING is true and no users exist, seed admin from env vars.
  // If SKIP_ONBOARDING is false and no users exist, show onboarding screen.
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

      if (persistedRoles.length > 0) setCustomRoles(persistedRoles)

      if (persistedUsers.length > 0) {
        setUsers(persistedUsers)
        if (persistedPassword) setAdminPassword(persistedPassword)
      } else if (SKIP_ONBOARDING) {
        const admin = envAdminUser()
        setUsers([admin])
        await savePersistedUsers([admin])
        await saveAdminPassword(DEFAULT_ADMIN_PASSWORD)
      } else {
        setOnboarding(true)
      }

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
