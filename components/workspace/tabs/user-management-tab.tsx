"use client"

import * as React from "react"
import { toast } from "sonner"
import { useAuth, useRBAC } from "@/components/providers/auth-provider"
import { useWorkspace } from "@/components/providers/workspace-provider"
import { roleSummary } from "@/lib/rbac"
import type { Role } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { RoleBadge } from "@/components/workspace/role-badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ShieldXIcon, UserPlusIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react"

const ROLES: Role[] = ["Admin", "Editor", "Viewer"]

export function UserManagementTab() {
  const { currentUser, users, addUser, updateUserRole, removeUser } = useAuth()
  const { can } = useRBAC()
  const { logAudit } = useWorkspace()
  const allowed = can("users.manage")

  const [addOpen, setAddOpen] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newEmail, setNewEmail] = React.useState("")
  const [newRole, setNewRole] = React.useState<Role>("Viewer")

  if (!allowed) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <ShieldXIcon />
          </EmptyMedia>
          <EmptyTitle>Access denied</EmptyTitle>
          <EmptyDescription>
            User management is restricted to Admins. Your current role is {currentUser.role}. Switch to an
            Admin identity from the account menu to manage users.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newEmail.trim()) {
      toast.error("Name and email are required")
      return
    }
    addUser({ name: newName.trim(), email: newEmail.trim(), role: newRole })
    logAudit("Add user", `${newName.trim()} (${newRole})`, "allowed")
    toast.success(`Added ${newName.trim()} as ${newRole}`)
    setNewName("")
    setNewEmail("")
    setNewRole("Viewer")
    setAddOpen(false)
  }

  function handleRoleChange(userId: string, name: string, role: Role) {
    updateUserRole(userId, role)
    logAudit("Change role", `${name} → ${role}`, "allowed")
    toast.success(`${name} is now ${role}`)
  }

  function handleRemove(userId: string, name: string) {
    if (userId === currentUser.id) {
      toast.error("You cannot remove your own account")
      return
    }
    removeUser(userId)
    logAudit("Remove user", name, "allowed")
    toast.success(`Removed ${name}`)
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-4xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Users &amp; roles</h2>
            <p className="text-sm text-muted-foreground">
              {users.length} members. Roles map directly to database permissions.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <UserPlusIcon data-icon="inline-start" />
            Add user
          </Button>
        </div>

        {/* Role legend */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {ROLES.map((role) => (
            <div key={role} className="rounded-lg border border-border bg-card p-3">
              <RoleBadge role={role} />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{roleSummary(role)}</p>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-secondary text-left">
                <th className="px-4 py-2.5 font-medium text-muted-foreground">User</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Role</th>
                <th className="w-12 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-muted text-xs font-semibold">
                          {user.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col leading-tight">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          {user.name}
                          {user.id === currentUser.id && (
                            <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                              you
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={user.role}
                      onValueChange={(v: Role | null) => v && handleRoleChange(user.id, user.name, v)}
                    >
                      <SelectTrigger size="sm" className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                        <MoreHorizontalIcon />
                        <span className="sr-only">User actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleRemove(user.id, user.name)}
                          >
                            <Trash2Icon />
                            Remove user
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>Invite a team member and assign a role.</DialogDescription>
          </DialogHeader>
          <form id="add-user-form" onSubmit={handleAdd}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="user-name">Name</FieldLabel>
                <Input
                  id="user-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jane Doe"
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="user-email">Email</FieldLabel>
                <Input
                  id="user-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jane@datalook.dev"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="user-role">Role</FieldLabel>
                <Select value={newRole} onValueChange={(v: Role | null) => v && setNewRole(v)}>
                  <SelectTrigger id="user-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </form>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-user-form">
              <UserPlusIcon data-icon="inline-start" />
              Add user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}
