'use client'

import * as React from 'react'
import type { ConnectionGrant, ConnectionRole, User } from '@/lib/types'
import {
  CONNECTION_ROLES,
  connectionRoleLabel,
  connectionRoleSummary,
} from '@/lib/rbac'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ShieldCheck } from 'lucide-react'

const NO_ACCESS = 'none'

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/**
 * Editable list of per-user access grants for a shared connection. The owner
 * is shown as a fixed Admin row and cannot be demoted here.
 */
export function ConnectionAccessEditor({
  users,
  ownerId,
  grants,
  onChange,
}: {
  users: User[]
  ownerId: string
  grants: ConnectionGrant[]
  onChange: (grants: ConnectionGrant[]) => void
}) {
  const owner = users.find((u) => u.id === ownerId)
  const assignable = users.filter((u) => u.id !== ownerId)

  const roleOf = (userId: string): ConnectionRole | typeof NO_ACCESS =>
    grants.find((g) => g.userId === userId)?.role ?? NO_ACCESS

  function setRole(userId: string, value: string) {
    const next = grants.filter((g) => g.userId !== userId)
    if (value !== NO_ACCESS) {
      next.push({ userId, role: value as ConnectionRole })
    }
    onChange(next)
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {owner && (
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-medium text-primary">
            {owner.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {owner.name}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                (owner)
              </span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {owner.email}
            </p>
          </div>
          <span className="flex items-center gap-1 rounded-sm bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
            <ShieldCheck className="size-3" />
            Admin
          </span>
        </div>
      )}

      <ScrollArea className="max-h-56">
        <div className="scrollbar-thin divide-y divide-border">
          {assignable.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No other users to assign.
            </p>
          ) : (
            assignable.map((user) => {
              const value = roleOf(user.id)
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-medium text-secondary-foreground">
                    {user.initials || initials(user.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <Select
                    value={value}
                    onValueChange={(v) => v && setRole(user.id, v)}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-32"
                      aria-label={`Access for ${user.name}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ACCESS}>No access</SelectItem>
                      {CONNECTION_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {connectionRoleLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      <p className="border-t border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
        {CONNECTION_ROLES.map((r) => `${connectionRoleLabel(r)}: ${connectionRoleSummary(r)}`).join(
          '  ·  ',
        )}
      </p>
    </div>
  )
}
