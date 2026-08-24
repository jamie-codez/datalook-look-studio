"use client"

import * as React from "react"
import { Moon, Sun, Database, ShieldCheck, Bell, Palette, Save, User, FileText, Download, Server } from "lucide-react"
import { useAuth, useRBAC } from "@/components/providers/auth-provider"
import { useWorkspace } from "@/components/providers/workspace-provider"
import { useTheme, type AccentColor, ACCENT_PRESETS } from "@/components/providers/theme-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RoleBadge } from "@/components/workspace/role-badge"
import { driverLabel } from "@/lib/drivers"
import { AdminConsoleTab } from "./admin-console-tab"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type SettingsSection = "appearance" | "account" | "system" | "connections" | "notifications" | "admin"

interface NavItem {
  id: SettingsSection
  label: string
  icon: typeof Palette
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "account", label: "Account", icon: User },
  { id: "system", label: "System store", icon: Database },
  { id: "connections", label: "Connections", icon: Server },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "admin", label: "Administration", icon: ShieldCheck, adminOnly: true },
]

export function SettingsTab() {
  const { currentUser, updateCurrentUser } = useAuth()
  const { can } = useRBAC()
  const { theme, setTheme, accentColor, setAccentColor } = useTheme()
  const { connections, auditLog } = useWorkspace()
  const systemStore = connections.find((c) => c.isSystem)
  const isAdmin = can("users.manage")

  const [activeSection, setActiveSection] = React.useState<SettingsSection>("appearance")

  // Listen for external requests to navigate to a specific settings section
  // (e.g. from the avatar dropdown "Account" link).
  React.useEffect(() => {
    function handleNavigate(e: Event) {
      const section = (e as CustomEvent<SettingsSection>).detail
      if (section) setActiveSection(section)
    }
    window.addEventListener('settings:navigate', handleNavigate as EventListener)
    return () => window.removeEventListener('settings:navigate', handleNavigate as EventListener)
  }, [])
  const [editName, setEditName] = React.useState(currentUser.name)
  const [editEmail, setEditEmail] = React.useState(currentUser.email)
  const [editPassword, setEditPassword] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setEditName(currentUser.name)
    setEditEmail(currentUser.email)
  }, [currentUser.name, currentUser.email])

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  function handleSave() {
    setSaving(true)
    updateCurrentUser({
      name: editName.trim() || undefined,
      email: editEmail.trim().toLowerCase() || undefined,
      password: editPassword || undefined,
    })
    setEditPassword("")
    setSaving(false)
    toast.success("Account updated", {
      description: "Your profile changes have been saved.",
    })
  }

  const hasChanges =
    editName !== currentUser.name ||
    editEmail !== currentUser.email ||
    editPassword.length > 0

  function exportAuditLog() {
    const data = JSON.stringify(auditLog, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "audit-log.json"
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Audit log exported")
  }

  return (
    <div className="flex h-full">
      {/* Settings sidebar */}
      <nav className="hidden w-52 shrink-0 border-r border-border bg-card/50 p-3 md:block">
        <div className="mb-3 px-2">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Workspace preferences</p>
        </div>
        <ul className="flex flex-col gap-0.5">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                  activeSection === item.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile section selector */}
      <div className="flex w-full flex-col md:hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors",
                activeSection === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <item.icon className="size-3.5 shrink-0" aria-hidden />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <ScrollArea className="min-w-0 flex-1">
        <div className="p-6">
          {/* Appearance */}
          {activeSection === "appearance" && (
            <SettingsPanel
              icon={Palette}
              title="Appearance"
              description="Choose how Datalook Studio looks on this device."
            >
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Theme mode</Label>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("light")}
                    >
                      <Sun data-icon="inline-start" />
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("dark")}
                    >
                      <Moon data-icon="inline-start" />
                      Dark
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Accent color</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(Object.keys(ACCENT_PRESETS) as AccentColor[]).map((color) => (
                      <button
                        key={color}
                        onClick={() => setAccentColor(color)}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs capitalize transition-colors",
                          accentColor === color
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border hover:bg-accent",
                        )}
                      >
                        <span
                          className="size-3.5 rounded-full"
                          style={{ backgroundColor: theme === 'dark' ? ACCENT_PRESETS[color].dark : ACCENT_PRESETS[color].light }}
                          aria-hidden
                        />
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SettingsPanel>
          )}

          {/* Account */}
          {activeSection === "account" && (
            <SettingsPanel
              icon={User}
              title="Account"
              description="Your identity and access level in this workspace."
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{currentUser.name}</p>
                    <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                  </div>
                  <RoleBadge role={currentUser.role} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-name" className="text-xs text-muted-foreground">Display name</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your name"
                      disabled={saving}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-email" className="text-xs text-muted-foreground">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="you@example.com"
                      disabled={saving}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="edit-password" className="text-xs text-muted-foreground">New password</Label>
                    <Input
                      id="edit-password"
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Leave blank to keep current password"
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
                    {saving ? <Save data-icon="inline-start" className="size-3.5 animate-pulse" /> : <Save data-icon="inline-start" className="size-3.5" />}
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            </SettingsPanel>
          )}

          {/* System store */}
          {activeSection === "system" && (
            <SettingsPanel
              icon={Database}
              title="System store"
              description="The pinned connection that backs the app's own metadata."
            >
              {systemStore ? (
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{systemStore.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {driverLabel(systemStore.driver)} &middot; {systemStore.database}
                    </p>
                  </div>
                  <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-primary uppercase">
                    System
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No system store configured yet.</p>
              )}
            </SettingsPanel>
          )}

          {/* Server status */}
          {activeSection === "connections" && (
            <SettingsPanel
              icon={Server}
              title="Connections"
              description="Overview of all configured data sources and their connection status."
            >
              <div className="flex flex-col gap-2">
                {connections.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No connections configured.</p>
                ) : (
                  connections.map((conn) => (
                    <div
                      key={conn.id}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`size-2 rounded-full ${conn.status === 'connected' ? 'bg-chart-2' : 'bg-muted-foreground/40'}`}
                          aria-hidden
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">{conn.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {driverLabel(conn.driver)} &middot; {conn.host}:{conn.port}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {conn.topology && conn.topology !== 'standalone' && (
                          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                            {conn.topology}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground capitalize">
                          {conn.status ?? 'offline'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SettingsPanel>
          )}

          {/* Notifications */}
          {activeSection === "notifications" && (
            <SettingsPanel
              icon={Bell}
              title="Notifications"
              description="Toast alerts for permission checks and query results are always on in this demo."
            >
              <p className="text-xs text-muted-foreground">Nothing to configure yet — check back soon.</p>
            </SettingsPanel>
          )}

          {/* Admin */}
          {activeSection === "admin" && isAdmin && (
            <SettingsPanel
              icon={ShieldCheck}
              title="Administration"
              description="Manage users, roles, connections, and review activity across the workspace."
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  <span className="text-xs text-muted-foreground">{auditLog.length} audit events</span>
                </div>
                <Button variant="outline" size="sm" onClick={exportAuditLog}>
                  <Download data-icon="inline-start" className="size-3.5" />
                  Export audit log
                </Button>
              </div>
              <div className="rounded-lg border border-border">
                <AdminConsoleTab />
              </div>
            </SettingsPanel>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function SettingsPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Palette
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{description}</p>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        {children}
      </div>
    </div>
  )
}
