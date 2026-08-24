"use client"

import * as React from "react"
import { toast } from "sonner"
import { useAuth } from "@/components/providers/auth-provider"
import { useWorkspace } from "@/components/providers/workspace-provider"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import {
  ShieldXIcon,
  UsersIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  Trash2Icon,
  Lock,
  CheckIcon,
  MinusIcon,
  PlusIcon,
  PencilIcon,
} from "lucide-react"
import { UserManagementTab } from "./user-management-tab"
import { AuditLogTab } from "./audit-log-tab"
import { driverLabel } from "@/lib/drivers"
import { permissionsFor, roleSummary, type Permission } from "@/lib/rbac"
import { RoleBadge } from "@/components/workspace/role-badge"
import type { CustomRole, Role } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

const ALL_ROLES: Role[] = ["Admin", "Editor", "Viewer"]
const ALL_PERMISSIONS: { permission: Permission; label: string }[] = [
  { permission: "query.read", label: "Run read (SELECT) queries" },
  { permission: "query.write", label: "Run write (INSERT/UPDATE/DELETE)" },
  { permission: "query.ddl", label: "Run schema changes (DDL)" },
  { permission: "data.edit", label: "Edit rows inline in the data grid" },
  { permission: "transaction.control", label: "Commit / rollback transactions" },
  { permission: "connection.manage", label: "Create, edit & delete connections" },
  { permission: "users.manage", label: "Manage users & roles" },
  { permission: "audit.view", label: "View audit logs" },
]

const ROLE_COLORS = [
  "bg-primary/15 text-primary",
  "bg-warning/15 text-warning",
  "bg-muted text-muted-foreground",
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
]

function RolesSection() {
  const { customRoles, addCustomRole, updateCustomRole, removeCustomRole } = useAuth()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formName, setFormName] = React.useState("")
  const [formDesc, setFormDesc] = React.useState("")
  const [formColor, setFormColor] = React.useState(ROLE_COLORS[3])
  const [formPerms, setFormPerms] = React.useState<Set<Permission>>(new Set())

  function openCreate() {
    setEditingId(null)
    setFormName("")
    setFormDesc("")
    setFormColor(ROLE_COLORS[3])
    setFormPerms(new Set(["query.read"]))
    setDialogOpen(true)
  }

  function openEdit(role: CustomRole) {
    setEditingId(role.id)
    setFormName(role.name)
    setFormDesc(role.description)
    setFormColor(role.color)
    setFormPerms(new Set(role.permissions))
    setDialogOpen(true)
  }

  function togglePerm(perm: Permission) {
    setFormPerms((prev) => {
      const next = new Set(prev)
      if (next.has(perm)) next.delete(perm)
      else next.add(perm)
      return next
    })
  }

  function handleSave() {
    if (!formName.trim()) {
      toast.error("Role name is required")
      return
    }
    const payload = {
      name: formName.trim(),
      description: formDesc.trim(),
      color: formColor,
      permissions: Array.from(formPerms),
    }
    if (editingId) {
      updateCustomRole(editingId, payload)
      toast.success(`Updated role "${payload.name}"`)
    } else {
      addCustomRole(payload)
      toast.success(`Created role "${payload.name}"`)
    }
    setDialogOpen(false)
  }

  function handleDelete(role: CustomRole) {
    removeCustomRole(role.id)
    toast.success(`Deleted role "${role.name}"`)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Built-in roles */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">Built-in roles</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {ALL_ROLES.map((role) => (
            <div key={role} className="rounded-lg border border-border bg-card p-3">
              <RoleBadge role={role} />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{roleSummary(role)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Permission matrix for built-in roles */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-secondary text-left">
              <th className="px-4 py-2.5 font-medium text-muted-foreground">Permission</th>
              {ALL_ROLES.map((role) => (
                <th key={role} className="px-4 py-2.5 text-center font-medium text-muted-foreground">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((p) => (
              <tr key={p.permission} className="border-t border-border">
                <td className="px-4 py-2.5 text-foreground">{p.label}</td>
                {ALL_ROLES.map((role) => {
                  const granted = permissionsFor(role).includes(p.permission)
                  return (
                    <td key={role} className="px-4 py-2.5 text-center">
                      {granted ? (
                        <CheckIcon className="mx-auto size-4 text-success" aria-label="Allowed" />
                      ) : (
                        <MinusIcon className="mx-auto size-4 text-muted-foreground" aria-label="Not allowed" />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Custom roles */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Custom roles</h3>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <PlusIcon data-icon="inline-start" className="size-3.5" />
            Create role
          </Button>
        </div>
        {customRoles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No custom roles yet. Create one to define fine-grained permission policies.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {customRoles.map((role) => (
              <div key={role.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Badge variant="secondary" className={role.color}>
                      {role.name}
                    </Badge>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {role.description || "No description"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {role.permissions.map((p) => (
                        <span
                          key={p}
                          className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(role)}
                      aria-label="Edit role"
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(role)}
                      aria-label="Delete role"
                    >
                      <Trash2Icon className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit custom role dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit role" : "Create custom role"}</DialogTitle>
            <DialogDescription>
              Define a role with specific permission policies that can be assigned to users.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-name" className="text-xs text-muted-foreground">Name</Label>
              <Input
                id="role-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Data Analyst"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-desc" className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                id="role-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="What can this role do?"
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Badge color</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormColor(color)}
                    className={`flex size-6 items-center justify-center rounded-md ${color} ${
                      formColor === color ? "ring-2 ring-primary ring-offset-1" : ""
                    }`}
                    aria-label="Select color"
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Permissions</Label>
              <div className="grid gap-2">
                {ALL_PERMISSIONS.map((p) => (
                  <label
                    key={p.permission}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <Checkbox
                      checked={formPerms.has(p.permission)}
                      onCheckedChange={() => togglePerm(p.permission)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingId ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OverviewSection() {
  const { users } = useAuth()
  const { connections, auditLog } = useWorkspace()
  const stats = [
    { label: "Users", value: users.length, icon: UsersIcon },
    { label: "Connections", value: connections.length, icon: DatabaseIcon },
    {
      label: "Blocked actions",
      value: auditLog.filter((a) => a.status === "blocked").length,
      icon: ShieldXIcon,
    },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <s.icon className="size-4" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wide">{s.label}</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{s.value}</p>
        </div>
      ))}
    </div>
  )
}

function ConnectionsSection() {
  const { connections, removeConnection, logAudit } = useWorkspace()

  function handleRemove(id: string, name: string) {
    removeConnection(id)
    logAudit("Remove connection", name, "allowed")
    toast.success(`Removed "${name}"`)
  }

  if (connections.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <DatabaseIcon />
          </EmptyMedia>
          <EmptyTitle>No connections yet</EmptyTitle>
          <EmptyDescription>
            Connections added from the top bar will show up here for management.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-secondary text-left">
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Connection</th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Driver</th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Scope</th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="w-12 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {connections.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: c.accent }}
                    aria-hidden
                  />
                  {c.name}
                  {c.readOnly && <Lock className="size-3 text-muted-foreground" aria-hidden />}
                </div>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{driverLabel(c.driver)}</td>
              <td className="px-4 py-2.5">
                <Badge variant="secondary" className="capitalize">
                  {c.scope}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={
                    "inline-flex items-center gap-1.5 text-xs " +
                    (c.status === "connected"
                      ? "text-success"
                      : c.status === "error"
                        ? "text-destructive"
                        : "text-muted-foreground")
                  }
                >
                  <span className="size-1.5 rounded-full bg-current" aria-hidden />
                  {c.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right">
                {!c.isSystem && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemove(c.id, c.name)}
                  >
                    <Trash2Icon className="text-destructive" />
                    <span className="sr-only">Remove {c.name}</span>
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AdminConsoleTab() {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          <LayoutDashboardIcon className="size-5 text-primary" aria-hidden />
          Admin console
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage users, roles, connections, and review activity across the workspace.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-2">
          <OverviewSection />
        </TabsContent>
        <TabsContent value="users" className="mt-2">
          <UserManagementTab />
        </TabsContent>
        <TabsContent value="roles" className="mt-2">
          <RolesSection />
        </TabsContent>
        <TabsContent value="connections" className="mt-2">
          <ConnectionsSection />
        </TabsContent>
        <TabsContent value="audit" className="mt-2">
          <div className="h-[28rem]">
            <AuditLogTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
