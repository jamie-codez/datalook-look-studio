'use client'

import * as React from 'react'
import {
  Database,
  Boxes,
  ShieldCheck,
  LoaderCircle,
  ArrowRight,
  Check,
  Lock,
  Eye,
  EyeOff,
  UserCircle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { DRIVER_LIST, driverMeta } from '@/lib/drivers'
import type { DriverId } from '@/lib/types'

type Family = 'sql' | 'nosql'

const SYSTEM_DRIVERS = DRIVER_LIST.filter((d) => d.systemCapable)
const SQL_DRIVERS = SYSTEM_DRIVERS.filter((d) => d.category === 'sql')
const NOSQL_DRIVERS = SYSTEM_DRIVERS.filter((d) => d.category !== 'sql')

const FAMILY_CARDS: {
  family: Family
  title: string
  blurb: string
  icon: typeof Database
  defaultDriver: DriverId
}[] = [
  {
    family: 'sql',
    title: 'SQL-like',
    blurb: 'Relational tables with a fixed schema. Best for structured app metadata.',
    icon: Database,
    defaultDriver: 'sqlite',
  },
  {
    family: 'nosql',
    title: 'NoSQL',
    blurb: 'Document, key-value, or wide-column. Flexible, schema-light storage.',
    icon: Boxes,
    defaultDriver: 'mongodb',
  },
]

interface OnboardingData {
  adminName: string
  adminEmail: string
  adminPassword: string
  systemDriver: DriverId
}

interface OnboardingScreenProps {
  onComplete: (data: OnboardingData) => Promise<void> | void
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = React.useState<1 | 2>(1)
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [family, setFamily] = React.useState<Family>('sql')
  const [driver, setDriver] = React.useState<DriverId>('sqlite')
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const familyDrivers = family === 'sql' ? SQL_DRIVERS : NOSQL_DRIVERS

  function selectFamily(next: Family) {
    setFamily(next)
    const card = FAMILY_CARDS.find((c) => c.family === next)!
    setDriver(card.defaultDriver)
  }

  function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setError(null)
    setStep(2)
  }

  async function handleFinish() {
    if (pending) return
    setPending(true)
    await onComplete({
      adminName: name.trim(),
      adminEmail: email.trim().toLowerCase(),
      adminPassword: password,
      systemDriver: driver,
    })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
              step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}>
              {step > 1 ? <Check className="size-3.5" /> : 1}
            </span>
            <span className={cn('text-sm', step >= 1 ? 'text-foreground' : 'text-muted-foreground')}>
              Admin account
            </span>
          </div>
          <div className={cn('h-px w-8', step > 1 ? 'bg-primary' : 'bg-border')} />
          <div className="flex items-center gap-2">
            <span className={cn(
              'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
              step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}>
              2
            </span>
            <span className={cn('text-sm', step >= 2 ? 'text-foreground' : 'text-muted-foreground')}>
              System store
            </span>
          </div>
        </div>

        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/favicon.svg" alt="Datalook Studio" className="mb-4 size-12 rounded-lg" />
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {step === 1 ? 'Set up your admin account' : 'Choose your system store'}
          </h1>
          <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            {step === 1
              ? 'Create the administrator account for your Datalook Studio workspace.'
              : 'Pick the database engine that will store workspace metadata — connections, audit logs, and query history.'}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleAdminSubmit}>
            <div className="rounded-lg border border-border bg-card p-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="ob-name">Admin name</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <UserCircle />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="ob-name"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel htmlFor="ob-email">Email</FieldLabel>
                  <Input
                    id="ob-email"
                    type="email"
                    placeholder="admin@yourcompany.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>

                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="ob-password">Password</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <Lock />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="ob-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
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
                  {error && (
                    <FieldDescription className="text-destructive">{error}</FieldDescription>
                  )}
                </Field>
              </FieldGroup>

              <Button type="submit" className="mt-5 w-full">
                Continue
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              {FAMILY_CARDS.map((card) => {
                const Icon = card.icon
                const active = family === card.family
                return (
                  <button
                    key={card.family}
                    type="button"
                    onClick={() => selectFamily(card.family)}
                    disabled={pending}
                    aria-pressed={active}
                    className={cn(
                      'group relative flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors',
                      active
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/40 hover:bg-accent/40',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        'flex size-9 items-center justify-center rounded-md',
                        active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                      )}>
                        <Icon className="size-5" />
                      </div>
                      {active && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>
                    <div className="font-medium">{card.title}</div>
                    <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
                      {card.blurb}
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 rounded-lg border border-border bg-card p-4">
              <label htmlFor="system-driver" className="mb-2 block text-sm font-medium">
                {family === 'sql' ? 'SQL engine' : 'NoSQL engine'}
              </label>
              <Select value={driver} onValueChange={(v) => v && setDriver(v as DriverId)}>
                <SelectTrigger id="system-driver" className="w-full">
                  <SelectValue placeholder="Select an engine">
                    {(value) => value ? driverMeta(value as DriverId).label : 'Select an engine'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {familyDrivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: d.accent }} aria-hidden />
                      {d.label}
                      <span className="text-xs text-muted-foreground">· {d.blurb}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-px size-4 shrink-0 text-chart-2" />
                <span>
                  The system store and every connection you create are encrypted at
                  rest with AES-GCM via the Web Crypto API.
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} disabled={pending}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleFinish} disabled={pending}>
                  {pending ? (
                    <>
                      <LoaderCircle className="animate-spin" data-icon="inline-start" />
                      Initializing…
                    </>
                  ) : (
                    <>
                      Initialize workspace
                      <ArrowRight data-icon="inline-end" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
