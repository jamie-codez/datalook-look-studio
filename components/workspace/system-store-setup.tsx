'use client'

import * as React from 'react'
import {
  Database,
  Boxes,
  ShieldCheck,
  LoaderCircle,
  ArrowRight,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface SystemStoreSetupProps {
  onComplete: (driver: DriverId) => Promise<void> | void
}

export function SystemStoreSetup({ onComplete }: SystemStoreSetupProps) {
  const [family, setFamily] = React.useState<Family>('sql')
  const [driver, setDriver] = React.useState<DriverId>('sqlite')
  const [pending, setPending] = React.useState(false)

  const familyDrivers = family === 'sql' ? SQL_DRIVERS : NOSQL_DRIVERS

  function selectFamily(next: Family) {
    setFamily(next)
    const card = FAMILY_CARDS.find((c) => c.family === next)!
    setDriver(card.defaultDriver)
  }

  async function initialize() {
    if (pending) return
    setPending(true)
    await onComplete(driver)
    // On success the provider swaps this screen for the workspace.
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Database className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            Choose your system store
          </h1>
          <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            DataLook keeps its own metadata — connections, audit log, and query
            history — in a store you choose. Pick the engine family to finish
            setup.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {FAMILY_CARDS.map((card) => {
            const Icon = card.icon
            const active = family === card.family
            return (
              <button
                key={card.family}
                type="button"
                onClick={() => selectFamily(card.family)}
                aria-pressed={active}
                className={cn(
                  'group relative flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40 hover:bg-accent/40',
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      'flex size-9 items-center justify-center rounded-md',
                      active
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
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
          <label
            htmlFor="system-driver"
            className="mb-2 block text-sm font-medium"
          >
            {family === 'sql' ? 'SQL engine' : 'NoSQL engine'}
          </label>
          <Select value={driver} onValueChange={(v) => v && setDriver(v as DriverId)}>
            <SelectTrigger id="system-driver" className="w-full">
              <SelectValue placeholder="Select an engine">
                {(value) =>
                  value
                    ? driverMeta(value as DriverId).label
                    : 'Select an engine'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {familyDrivers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: d.accent }}
                    aria-hidden
                  />
                  {d.label}
                  <span className="text-xs text-muted-foreground">
                    · {d.blurb}
                  </span>
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

          <Button
            className="mt-4 w-full"
            onClick={initialize}
            disabled={pending}
          >
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
  )
}
