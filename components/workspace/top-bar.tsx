'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  Database,
  Play,
  Plus,
  Download,
  GitCommitHorizontal,
  Undo2,
  Sun,
  Moon,
  ChevronsUpDown,
  Check,
  ShieldCheck,
  Users,
  ScrollText,
  LogOut,
  Bell,
  UserCircle,
  Settings,
  LayoutDashboard,
  PanelLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RoleBadge } from './role-badge'
import { NewConnectionDialog } from './new-connection-dialog'
import { DatasourcePickerDialog } from './datasource-picker-dialog'
import { useTheme } from '@/components/providers/theme-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { useRBAC } from '@/components/providers/auth-provider'
import { emitWorkspaceEvent } from '@/lib/workspace-events'
import { roleSummary } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import { isProduction } from '@/lib/env'

interface NotificationItem {
  id: string
  title: string
  detail: string
  time: string
}

const NOTIFICATIONS: NotificationItem[] = [
  { id: 'n-1', title: 'Query completed', detail: 'SELECT on customers finished in 84ms', time: '2m ago' },
  { id: 'n-2', title: 'New grant', detail: "You were given editor access to 'Staging — MySQL'", time: '1h ago' },
  { id: 'n-3', title: 'Connection restored', detail: "'Cache — Redis' is back online", time: '3h ago' },
]

function ActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  disabledReason,
  variant = 'ghost',
}: {
  label: string
  icon: typeof Play
  onClick: () => void
  disabled?: boolean
  disabledReason?: string
  variant?: 'ghost' | 'default' | 'outline'
}) {
  const tip = disabled && disabledReason ? disabledReason : label
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={variant}
            size="sm"
            onClick={onClick}
            disabled={disabled}
          />
        }
      >
        <Icon data-icon="inline-start" />
        <span className="hidden lg:inline">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}

export function TopBar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { theme, toggleTheme } = useTheme()
  const { currentUser, users, switchUser, logout } = useAuth()
  const { can } = useRBAC()
  const { activeTab, openTab, connections, logAudit } = useWorkspace()
  const [connectionDialogOpen, setConnectionDialogOpen] = React.useState(false)
  const [datasourcePickerOpen, setDatasourcePickerOpen] = React.useState(false)
  const [pickerMode, setPickerMode] = React.useState<'query' | 'browse'>('query')

  const isSqlTab = activeTab?.kind === 'sql'
  const isDataOrSql = activeTab?.kind === 'sql' || activeTab?.kind === 'data'
  const canWrite = can('transaction.control')

  function handleNewConnection() {
    // Every signed-in user can create a connection. Admins may make it shared;
    // everyone else creates a personal (owner-only) connection. The dialog
    // enforces that distinction.
    setConnectionDialogOpen(true)
  }

  function openAdmin(
    _kind: 'users' | 'audit' | 'admin',
    title: string,
    permission: 'users.manage' | 'audit.view',
    label: string,
  ) {
    if (!can(permission)) {
      logAudit(`Open ${label}`, 'admin', 'blocked')
      toast.error('Permission denied', {
        description: `${currentUser.role} role cannot access ${label}. Switch to Admin to continue.`,
      })
    }
    openTab({ kind: 'settings', title: 'Settings' }, { focusExisting: true })
  }

  function handleTransaction(kind: 'commit' | 'rollback') {
    if (!canWrite) {
      logAudit(kind === 'commit' ? 'Commit' : 'Rollback', 'transaction', 'blocked')
      toast.error('Permission denied', {
        description: `${currentUser.role} role cannot control transactions.`,
      })
      return
    }
    emitWorkspaceEvent(kind)
    logAudit(kind === 'commit' ? 'Commit' : 'Rollback', 'transaction', 'allowed')
    toast.success(kind === 'commit' ? 'Transaction committed' : 'Transaction rolled back')
  }

  return (
    <TooltipProvider delay={300}>
      <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-sidebar px-2">
        {/* Mobile sidebar toggle */}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <PanelLeft />
          </Button>
        )}

        {/* Brand */}
        <div className="flex items-center gap-2 pr-1 pl-1">
          <img src="/favicon.svg" alt="Datalook Studio" className="size-7 rounded-md" />
          <div className="hidden flex-col leading-none sm:flex">
            <span className="text-sm font-semibold tracking-tight">Datalook</span>
            <span className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground">
              STUDIO
            </span>
          </div>
        </div>

        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:inline" />

        {/* Primary actions */}
        <div className="hidden items-center gap-0.5 sm:flex">
          <ActionButton
            label="New Connection"
            icon={Plus}
            onClick={handleNewConnection}
          />
          <ActionButton
            label="New Query"
            icon={Database}
            onClick={() => {
              const userConnections = connections.filter((c) => !c.isSystem)
              if (userConnections.length === 0 || !activeTab?.connectionId) {
                setPickerMode('query')
                setDatasourcePickerOpen(true)
              } else {
                openTab({
                  kind: 'sql',
                  title: 'Untitled query',
                  connectionId: activeTab.connectionId,
                  sql: '',
                })
              }
            }}
          />
          <ActionButton
            label="Run"
            icon={Play}
            variant="default"
            onClick={() => emitWorkspaceEvent('run-query')}
            disabled={!isSqlTab}
            disabledReason="Open a SQL editor tab to run a query"
          />
          <ActionButton
            label="Export"
            icon={Download}
            onClick={() => emitWorkspaceEvent('export')}
            disabled={!isDataOrSql}
            disabledReason="Open a query or table to export results"
          />
        </div>

        <Separator orientation="vertical" className="mx-1 hidden h-6 lg:inline" />

        {/* Transaction controls */}
        <div className="hidden items-center gap-0.5 lg:flex">
          <ActionButton
            label="Commit"
            icon={GitCommitHorizontal}
            onClick={() => handleTransaction('commit')}
            disabled={!canWrite}
            disabledReason={`${currentUser.role} role cannot control transactions`}
          />
          <ActionButton
            label="Rollback"
            icon={Undo2}
            onClick={() => handleTransaction('rollback')}
            disabled={!canWrite}
            disabledReason={`${currentUser.role} role cannot control transactions`}
          />
        </div>

        <Separator orientation="vertical" className="mx-1 hidden h-6 lg:inline" />

        {/* Admin menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" className="hidden lg:flex" />}
          >
            <ShieldCheck data-icon="inline-start" />
            <span className="hidden lg:inline">Admin</span>
            <ChevronsUpDown className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-2 py-1.5 text-sm font-medium">Administration</div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() =>
                  openAdmin('admin', 'Admin console', 'users.manage', 'the admin console')
                }
              >
                <LayoutDashboard />
                Admin console
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  openAdmin('users', 'Users & roles', 'users.manage', 'user management')
                }
              >
                <Users />
                Users &amp; roles
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openAdmin('audit', 'Audit log', 'audit.view', 'audit logs')}
              >
                <ScrollText />
                Audit log
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <div className="flex-1" />

        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon-sm" onClick={toggleTheme} />
            }
          >
            {theme === 'dark' ? <Moon /> : <Sun />}
            <span className="sr-only">Toggle theme</span>
          </TooltipTrigger>
          <TooltipContent>
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </TooltipContent>
        </Tooltip>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" className="relative" />}
          >
            <Bell />
            {NOTIFICATIONS.length > 0 && (
              <span className="absolute top-1 right-1 flex size-1.5 rounded-full bg-primary" aria-hidden />
            )}
            <span className="sr-only">Notifications</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm font-medium">Notifications</span>
              <Badge variant="secondary" className="tabular-nums">
                {NOTIFICATIONS.length}
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {NOTIFICATIONS.map((n) => (
                <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 whitespace-normal">
                  <span className="text-sm font-medium text-foreground">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{n.detail}</span>
                  <span className="text-[10px] text-muted-foreground">{n.time}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* User switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" className="gap-2 pl-1" />}
          >
            <Avatar className="size-6">
              <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
                {currentUser.initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-left leading-none md:flex md:flex-col md:gap-0.5">
              <span className="text-xs font-medium">{currentUser.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {currentUser.role}
              </span>
            </span>
            <ChevronsUpDown className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <div className="px-2 pt-1.5 text-sm font-medium">{currentUser.name}</div>
            <p className="px-2 pb-1.5 text-xs text-muted-foreground">
              {currentUser.email} · {roleSummary(currentUser.role)}
            </p>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => {
                  openTab({ kind: 'settings', title: 'Settings' }, { focusExisting: true })
                  window.dispatchEvent(new CustomEvent('settings:navigate', { detail: 'account' }))
                }}
              >
                <UserCircle />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  openTab({ kind: 'settings', title: 'Settings' }, { focusExisting: true })
                }
              >
                <Settings />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {!isProduction && (
            <>
            <DropdownMenuSeparator />
            <div className="px-2 pt-1.5 text-xs font-medium text-muted-foreground">
              Switch identity (demo)
            </div>
            <DropdownMenuGroup>
              {users
                .filter((u) =>
                  ['u-admin', 'u-editor', 'u-viewer'].includes(u.id),
                )
                .map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => {
                      switchUser(user.id)
                      toast.info(`Signed in as ${user.name}`, {
                        description: `Role: ${user.role}`,
                      })
                    }}
                    className="gap-2"
                  >
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-muted text-[10px] font-semibold">
                        {user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 flex-col leading-tight">
                      <span className="text-sm">{user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                    <RoleBadge role={user.role} showIcon={false} />
                    <Check
                      className={cn(
                        'size-4 text-primary',
                        currentUser.id === user.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </DropdownMenuItem>
                ))}
            </DropdownMenuGroup>
            </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => {
                  logout()
                  toast.success('Signed out')
                }}
                className="text-destructive"
              >
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <NewConnectionDialog
          open={connectionDialogOpen}
          onOpenChange={setConnectionDialogOpen}
        />
        <DatasourcePickerDialog
          open={datasourcePickerOpen}
          onOpenChange={setDatasourcePickerOpen}
          title={pickerMode === 'query' ? 'New query — choose data source' : 'Browse table — choose data source'}
          description={pickerMode === 'query' ? 'Select a connection to run queries against.' : 'Select a connection, schema, and table to browse.'}
          showTable={pickerMode === 'browse'}
          onSelect={(sel) => {
            if (pickerMode === 'query') {
              openTab({
                kind: 'sql',
                title: 'Untitled query',
                connectionId: sel.connectionId,
                sql: '',
              })
            } else {
              const conn = connections.find((c) => c.id === sel.connectionId)
              const schema = conn?.schemas.find((s) => s.name === sel.schemaName)
              const table = schema?.tables.find((t) => t.id === sel.tableId)
              if (table) {
                openTab({
                  kind: 'data',
                  title: table.name,
                  connectionId: sel.connectionId,
                  schemaName: sel.schemaName,
                  tableId: sel.tableId,
                })
              }
            }
          }}
        />
      </header>
    </TooltipProvider>
  )
}
