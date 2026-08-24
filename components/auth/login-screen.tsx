'use client'

import * as React from 'react'
import {
  Database,
  Eye,
  EyeOff,
  LogIn,
  LoaderCircle,
  ShieldCheck,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from '@/components/ui/field'
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { isProduction, DEFAULT_ADMIN_PASSWORD } from '@/lib/env'
import type { Role, User } from '@/lib/types'

const DEMO_PASSWORD = isProduction ? DEFAULT_ADMIN_PASSWORD : 'datalook'

/** Roles surfaced as one-tap demo identities on the sign-in screen. */
const QUICK_ROLES: { role: Role; blurb: string }[] = [
  { role: 'Admin', blurb: 'Full access — run, edit, manage users' },
  { role: 'Editor', blurb: 'Read + write data, no admin' },
  { role: 'Viewer', blurb: 'Read-only exploration' },
]

interface LoginScreenProps {
  users: User[]
  onLogin: (email: string, password: string) => boolean
}

export function LoginScreen({ users, onLogin }: LoginScreenProps) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setError(null)
    setPending(true)
    // Simulate a network round-trip so the pending state is perceptible.
    window.setTimeout(() => {
      const ok = onLogin(email.trim().toLowerCase(), password)
      if (!ok) {
        setError('Invalid email or password. Try a demo account below.')
        setPending(false)
      }
      // On success the auth provider swaps this screen for the workspace,
      // so there's no need to reset pending.
    }, 550)
  }

  function quickFill(role: Role) {
    const user = users.find((u) => u.role === role)
    if (!user) return
    setEmail(user.email)
    setPassword(DEMO_PASSWORD)
    setError(null)
  }

  return (
    <div className="flex min-h-svh w-full bg-background text-foreground">
      {/* Brand panel */}
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden border-r border-border bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="Datalook Studio" className="size-9 rounded-md" />
          <span className="text-lg font-semibold tracking-tight">
            Datalook Studio
          </span>
        </div>

        <div className="flex flex-col gap-6">
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight">
            One workspace for every database your team touches.
          </h1>
          <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
            Browse schemas, run SQL, inspect tables, and manage access — all
            behind role-based permissions with a full audit trail.
          </p>
          <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
            {[
              'Visual navigator across connections, schemas & tables',
              'SQL editor with typed result grids and CSV export',
              'Admin, Editor & Viewer roles enforced end to end',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {!isProduction && (
          <p className="text-xs text-muted-foreground">
            Demo environment — no real databases are contacted.
          </p>
        )}

        {/* Decorative grid wash, kept subtle and non-distracting */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl"
        />
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-2 lg:hidden">
            <img src="/favicon.svg" alt="Datalook Studio" className="size-9 rounded-md" />
            <span className="text-lg font-semibold tracking-tight">
              Datalook Studio
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to open the workspace.
            </p>
          </div>

          <form onSubmit={submit} noValidate>
            <FieldGroup>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@datalook.dev"
                  value={email}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                />
              </Field>

              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    aria-invalid={error ? true : undefined}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={pending}
                  />
                  <InputGroupAddon align="inline-start">
                    <Lock />
                  </InputGroupAddon>
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="icon-xs"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {error ? (
                  <FieldDescription className="text-destructive">
                    {error}
                  </FieldDescription>
                ) : (
                  !isProduction && (
                    <FieldDescription>
                      Demo password for every account:{' '}
                      <span className="font-mono text-foreground">datalook</span>
                    </FieldDescription>
                  )
                )}
              </Field>

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <LogIn data-icon="inline-start" />
                )}
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
            </FieldGroup>
          </form>

          {!isProduction && (
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Quick demo access
            </span>
            <Separator className="flex-1" />
          </div>
          )}

          {!isProduction && (
          <div className="flex flex-col gap-2">
            {QUICK_ROLES.map(({ role, blurb }) => {
              const user = users.find((u) => u.role === role)
              if (!user) return null
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => quickFill(role)}
                  disabled={pending}
                  className={cn(
                    'flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left outline-none transition-colors',
                    'hover:border-primary/50 hover:bg-accent focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {user.initials}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {user.name}
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                        {role}
                      </span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {blurb}
                    </span>
                  </span>
                </button>
              )
            })}
            <p className="px-1 pt-1 text-xs text-muted-foreground">
              Tap an account to prefill, then press Sign in.
            </p>
          </div>
          )}
        </div>
      </main>
    </div>
  )
}
