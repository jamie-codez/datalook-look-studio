'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Plus, Users, Lock, Trash2, Server } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { ConnectionAccessEditor } from './connection-access-editor'
import {
  CATEGORY_LABEL,
  driverMeta,
  driversByCategory,
} from '@/lib/drivers'
import type { ConnectionGrant, DriverId, ReplicaHost } from '@/lib/types'
import { ShieldCheck } from 'lucide-react'

export function NewConnectionDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { addConnection, logAudit } = useWorkspace()
  const { currentUser, users } = useAuth()

  // Only platform Admins may create shared (team) connections; everyone else
  // creates personal, owner-only connections.
  const canCreateShared = currentUser.role === 'Admin'

  const [name, setName] = React.useState('')
  const [driver, setDriver] = React.useState<DriverId>('postgres')
  const [host, setHost] = React.useState('')
  const [port, setPort] = React.useState('5432')
  const [database, setDatabase] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [readOnly, setReadOnly] = React.useState<'rw' | 'ro'>('rw')
  const [scope, setScope] = React.useState<'shared' | 'personal'>(
    canCreateShared ? 'shared' : 'personal',
  )
  const [grants, setGrants] = React.useState<ConnectionGrant[]>([])
  const [topology, setTopology] = React.useState<'standalone' | 'replicaSet' | 'masterSlave'>('standalone')
  const [replicaHosts, setReplicaHosts] = React.useState<ReplicaHost[]>([])

  function reset() {
    setName('')
    setDriver('postgres')
    setHost('')
    setPort('5432')
    setDatabase('')
    setUsername('')
    setReadOnly('rw')
    setScope(canCreateShared ? 'shared' : 'personal')
    setGrants([])
    setTopology('standalone')
    setReplicaHosts([])
  }

  function addReplicaHost() {
    setReplicaHosts((prev) => [
      ...prev,
      { host: '', port: driverMeta(driver).defaultPort, role: 'secondary', priority: 1 },
    ])
  }

  function updateReplicaHost(index: number, updates: Partial<ReplicaHost>) {
    setReplicaHosts((prev) =>
      prev.map((h, i) => (i === index ? { ...h, ...updates } : h)),
    )
  }

  function removeReplicaHost(index: number) {
    setReplicaHosts((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDriverChange(value: DriverId | null) {
    if (!value) return
    setDriver(value)
    setPort(String(driverMeta(value).defaultPort))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !host.trim() || !database.trim()) {
      toast.error('Please fill in connection name, host, and database.')
      return
    }
    const effectiveScope = canCreateShared ? scope : 'personal'
    const validReplicas = replicaHosts.filter((r) => r.host.trim())
    addConnection({
      name: name.trim(),
      driver,
      host: host.trim(),
      port: Number.parseInt(port, 10) || 0,
      database: database.trim(),
      username: username.trim() || 'app',
      readOnly: readOnly === 'ro',
      scope: effectiveScope,
      grants: effectiveScope === 'shared' ? grants : [],
      topology,
      replicaHosts: topology !== 'standalone' && validReplicas.length > 0 ? validReplicas : undefined,
    })
    logAudit(
      `Create ${effectiveScope} connection`,
      name.trim(),
      'allowed',
    )
    toast.success(`Connection "${name.trim()}" created`, {
      description:
        effectiveScope === 'shared'
          ? `Shared · ${grants.length} ${grants.length === 1 ? 'member' : 'members'} assigned`
          : 'Personal · visible only to you',
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New connection</DialogTitle>
          <DialogDescription>
            {canCreateShared
              ? 'Configure a data source, then choose whether to share it with the team or keep it private to you.'
              : 'Configure a personal data source. It will be visible only to you.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} id="new-connection-form">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="conn-name">Connection name</FieldLabel>
              <Input
                id="conn-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Analytics Replica"
                autoFocus
              />
            </Field>

            <Field orientation="responsive">
              <Field>
                <FieldLabel htmlFor="conn-driver">Driver</FieldLabel>
                <Select value={driver} onValueChange={handleDriverChange}>
                  <SelectTrigger id="conn-driver" className="w-full">
                    <SelectValue placeholder="Select a driver">
                      {(value) =>
                        value
                          ? driverMeta(value as DriverId).label
                          : 'Select a driver'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {driversByCategory().map(({ category, drivers }) => (
                      <SelectGroup key={category}>
                        <SelectLabel>{CATEGORY_LABEL[category]}</SelectLabel>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: d.accent }}
                              aria-hidden
                            />
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="conn-port">Port</FieldLabel>
                <Input
                  id="conn-port"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  inputMode="numeric"
                />
              </Field>
            </Field>

            <Field>
              <FieldLabel htmlFor="conn-host">Host</FieldLabel>
              <Input
                id="conn-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="db.example.internal"
              />
            </Field>

            <Field>
              <FieldLabel>Topology</FieldLabel>
              <ToggleGroup
                value={[topology]}
                onValueChange={(v) => v[0] && setTopology(v[0] as 'standalone' | 'replicaSet' | 'masterSlave')}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="standalone" className="flex-1">
                  Standalone
                </ToggleGroupItem>
                <ToggleGroupItem value="replicaSet" className="flex-1">
                  Replica set
                </ToggleGroupItem>
                <ToggleGroupItem value="masterSlave" className="flex-1">
                  Master / Slave
                </ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                {topology === 'standalone'
                  ? 'Single server instance.'
                  : topology === 'replicaSet'
                    ? 'Multiple nodes with automatic failover. The primary host above is the seed.'
                    : 'Primary (master) with one or more read replicas. The host above is the master.'}
              </FieldDescription>
            </Field>

            {topology !== 'standalone' && (
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel>Replica hosts</FieldLabel>
                  <Button type="button" variant="outline" size="sm" onClick={addReplicaHost}>
                    <Plus data-icon="inline-start" className="size-3.5" />
                    Add host
                  </Button>
                </div>
                {replicaHosts.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    No replica hosts added. The primary host above will be used as{' '}
                    {topology === 'replicaSet' ? 'the primary node' : 'the master'}.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {replicaHosts.map((replica, index) => (
                      <div key={index} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                        <Server className="size-4 shrink-0 text-muted-foreground" />
                        <Input
                          value={replica.host}
                          onChange={(e) => updateReplicaHost(index, { host: e.target.value })}
                          placeholder="replica-1.example.internal"
                          className="flex-1"
                        />
                        <Input
                          value={String(replica.port)}
                          onChange={(e) => updateReplicaHost(index, { port: Number.parseInt(e.target.value, 10) || 0 })}
                          inputMode="numeric"
                          className="w-20"
                        />
                        <Select
                          value={replica.role}
                          onValueChange={(v) => v && updateReplicaHost(index, { role: v as ReplicaHost['role'] })}
                        >
                          <SelectTrigger size="sm" className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="primary">Primary</SelectItem>
                            <SelectItem value="secondary">Secondary</SelectItem>
                            <SelectItem value="arbiter">Arbiter</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeReplicaHost(index)}
                          aria-label="Remove replica host"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Field>
            )}

            <Field orientation="responsive">
              <Field>
                <FieldLabel htmlFor="conn-db">Database</FieldLabel>
                <Input
                  id="conn-db"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="appdb"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="conn-user">Username</FieldLabel>
                <Input
                  id="conn-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="app"
                />
              </Field>
            </Field>

            <Field>
              <FieldLabel>Access mode</FieldLabel>
              <ToggleGroup
                value={[readOnly]}
                onValueChange={(v) => v[0] && setReadOnly(v[0] as 'rw' | 'ro')}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="rw" className="flex-1">
                  Read / Write
                </ToggleGroupItem>
                <ToggleGroupItem value="ro" className="flex-1">
                  Read only
                </ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                Read-only connections reject write and DDL statements for every
                role.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Visibility</FieldLabel>
              {canCreateShared ? (
                <ToggleGroup
                  value={[scope]}
                  onValueChange={(v) =>
                    v[0] && setScope(v[0] as 'shared' | 'personal')
                  }
                  variant="outline"
                  className="w-full"
                >
                  <ToggleGroupItem value="shared" className="flex-1 gap-1.5">
                    <Users data-icon="inline-start" />
                    Shared
                  </ToggleGroupItem>
                  <ToggleGroupItem value="personal" className="flex-1 gap-1.5">
                    <Lock data-icon="inline-start" />
                    Personal
                  </ToggleGroupItem>
                </ToggleGroup>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <Lock className="size-4 shrink-0" />
                  Personal — visible only to you.
                </div>
              )}
              <FieldDescription>
                {scope === 'shared' && canCreateShared
                  ? 'Assign teammates below. Only people you grant access to will see this connection.'
                  : 'Personal connections are private to you and never appear for other users.'}
              </FieldDescription>
            </Field>

            {canCreateShared && scope === 'shared' && (
              <Field>
                <FieldLabel>Team access</FieldLabel>
                <ConnectionAccessEditor
                  users={users}
                  ownerId={currentUser.id}
                  grants={grants}
                  onChange={setGrants}
                />
              </Field>
            )}

            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-px size-4 shrink-0 text-chart-2" />
              <span>
                Host, port, database, and username are encrypted with AES-GCM
                (Web Crypto) before being saved locally, so credentials stay
                unreadable at rest.
              </span>
            </div>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="new-connection-form">
            <Plus data-icon="inline-start" />
            Create connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
