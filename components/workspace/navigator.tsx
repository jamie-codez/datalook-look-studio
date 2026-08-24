'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  ChevronRight,
  Database,
  FolderTree,
  Boxes,
  Table2,
  Eye,
  SquareFunction,
  Columns3,
  KeyRound,
  Link2,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  Search,
  Plus,
  MoreHorizontal,
  Info,
  Play,
  Trash2,
  Server,
  Lock,
  UserCog,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { ManageAccessDialog } from './manage-access-dialog'
import { connectionCapabilities, connectionRoleLabel } from '@/lib/rbac'
import { containerLabel, entityPlural } from '@/lib/drivers'
import { cn } from '@/lib/utils'
import type { Column, Connection, SchemaMeta, TableMeta } from '@/lib/types'

function columnIcon(col: Column) {
  if (col.isPrimaryKey) return KeyRound
  if (col.isForeignKey) return Link2
  const t = col.type.toLowerCase()
  if (t.includes('int') || t.includes('numeric') || t.includes('decimal') || t.includes('serial'))
    return Hash
  if (t.includes('bool')) return ToggleLeft
  if (t.includes('date') || t.includes('time')) return Calendar
  return Type
}

interface RowProps {
  depth: number
  label: React.ReactNode
  icon: React.ReactNode
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
  onActivate?: () => void
  active?: boolean
  trailing?: React.ReactNode
  className?: string
}

function TreeRow({
  depth,
  label,
  icon,
  expandable,
  expanded,
  onToggle,
  onActivate,
  active,
  trailing,
  className,
}: RowProps) {
  return (
    <div
      className={cn(
        'group/row flex h-7 cursor-pointer items-center gap-1 rounded-md pr-1 text-sm select-none hover:bg-sidebar-accent',
        active && 'bg-sidebar-accent',
        className,
      )}
      style={{ paddingLeft: depth * 12 + 4 }}
      onClick={() => (onActivate ? onActivate() : onToggle?.())}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle?.()
        }}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground',
          !expandable && 'invisible',
        )}
        aria-label={expanded ? 'Collapse' : 'Expand'}
      >
        <ChevronRight
          className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
        />
      </button>
      <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </div>
  )
}

function ColumnRow({ col, depth }: { col: Column; depth: number }) {
  const Icon = columnIcon(col)
  return (
    <TreeRow
      depth={depth}
      icon={
        <Icon
          className={cn(
            col.isPrimaryKey && 'text-warning',
            col.isForeignKey && 'text-primary',
            !col.isPrimaryKey && !col.isForeignKey && 'text-muted-foreground',
          )}
        />
      }
      label={
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[13px]">{col.name}</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {col.type}
          </span>
        </span>
      }
    />
  )
}

function TableRow({
  table,
  schemaName,
  connection,
  depth,
}: {
  table: TableMeta
  schemaName: string
  connection: Connection
  depth: number
}) {
  const { openTab } = useWorkspace()
  const [expanded, setExpanded] = React.useState(false)

  function openData() {
    openTab(
      {
        kind: 'data',
        title: table.name,
        connectionId: connection.id,
        schemaName,
        tableId: table.id,
      },
      { focusExisting: true },
    )
  }

  function openProperties() {
    openTab(
      {
        kind: 'properties',
        title: `${table.name} · properties`,
        connectionId: connection.id,
        schemaName,
        tableId: table.id,
      },
      { focusExisting: true },
    )
  }

  function generateSelect() {
    const cols = table.columns.map((c) => c.name).join(', ')
    openTab({
      kind: 'sql',
      title: `SELECT ${table.name}`,
      connectionId: connection.id,
      sql: `SELECT ${cols}\nFROM ${schemaName}.${table.name}\nLIMIT 100;`,
    })
  }

  return (
    <>
      <TreeRow
        depth={depth}
        expandable
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onActivate={openData}
        icon={
          table.kind === 'view' ? (
            <Eye className="text-chart-4" />
          ) : table.kind === 'collection' ? (
            <Boxes className="text-chart-2" />
          ) : table.kind === 'keyspace' ? (
            <KeyRound className="text-chart-5" />
          ) : (
            <Table2 className="text-primary" />
          )
        }
        label={<span className="truncate">{table.name}</span>}
        trailing={
          <div className="flex items-center gap-1">
            <span className="hidden text-[10px] text-muted-foreground tabular-nums group-hover/row:hidden md:inline">
              {table.rowCount.toLocaleString()}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 group-hover/row:opacity-100 data-[popup-open]:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  />
                }
              >
                <MoreHorizontal />
                <span className="sr-only">Table actions</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={openData}>
                    <Table2 />
                    View data
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={generateSelect}>
                    <Play />
                    Generate SELECT
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openProperties}>
                    <Info />
                    Properties
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
      {expanded &&
        table.columns.map((col) => (
          <ColumnRow key={col.name} col={col} depth={depth + 1} />
        ))}
    </>
  )
}

function SchemaBranch({
  schema,
  connection,
  depth,
  filter,
}: {
  schema: SchemaMeta
  connection: Connection
  depth: number
  filter: string
}) {
  const [expanded, setExpanded] = React.useState(depth === 1)
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    tables: true,
    views: false,
    procedures: false,
  })

  // Tables, collections and keyspaces all share the primary "entities" group.
  const tables = schema.tables.filter((t) => t.kind !== 'view')
  const views = schema.tables.filter((t) => t.kind === 'view')

  const matches = (name: string) =>
    !filter || name.toLowerCase().includes(filter.toLowerCase())

  const fTables = tables.filter((t) => matches(t.name))
  const fViews = views.filter((t) => matches(t.name))
  const fProcs = schema.procedures.filter((p) => matches(p.name))

  if (filter && fTables.length + fViews.length + fProcs.length === 0) return null

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <>
      <TreeRow
        depth={depth}
        expandable
        expanded={expanded || !!filter}
        onToggle={() => setExpanded((v) => !v)}
        icon={<FolderTree className="text-chart-3" />}
        label={
          <span className="flex items-baseline gap-2">
            <span className="font-medium">{schema.name}</span>
            <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
              {containerLabel(connection.driver)}
            </span>
          </span>
        }
      />
      {(expanded || filter) && (
        <>
          {/* Entities group (tables / collections / keyspaces) */}
          <TreeRow
            depth={depth + 1}
            expandable
            expanded={openGroups.tables || !!filter}
            onToggle={() => toggleGroup('tables')}
            icon={<Boxes className="text-muted-foreground" />}
            label={entityPlural(connection.driver)}
            trailing={
              <Badge variant="secondary" className="tabular-nums">
                {fTables.length}
              </Badge>
            }
          />
          {(openGroups.tables || filter) &&
            fTables.map((t) => (
              <TableRow
                key={t.id}
                table={t}
                schemaName={schema.name}
                connection={connection}
                depth={depth + 2}
              />
            ))}

          {/* Views group */}
          {views.length > 0 && (
            <>
              <TreeRow
                depth={depth + 1}
                expandable
                expanded={openGroups.views || !!filter}
                onToggle={() => toggleGroup('views')}
                icon={<Eye className="text-muted-foreground" />}
                label="Views"
                trailing={
                  <Badge variant="secondary" className="tabular-nums">
                    {fViews.length}
                  </Badge>
                }
              />
              {(openGroups.views || filter) &&
                fViews.map((t) => (
                  <TableRow
                    key={t.id}
                    table={t}
                    schemaName={schema.name}
                    connection={connection}
                    depth={depth + 2}
                  />
                ))}
            </>
          )}

          {/* Procedures group */}
          {schema.procedures.length > 0 && (
            <>
              <TreeRow
                depth={depth + 1}
                expandable
                expanded={openGroups.procedures || !!filter}
                onToggle={() => toggleGroup('procedures')}
                icon={<SquareFunction className="text-muted-foreground" />}
                label="Procedures"
                trailing={
                  <Badge variant="secondary" className="tabular-nums">
                    {fProcs.length}
                  </Badge>
                }
              />
              {(openGroups.procedures || filter) &&
                fProcs.map((p) => (
                  <TreeRow
                    key={p.id}
                    depth={depth + 2}
                    icon={<SquareFunction className="text-chart-2" />}
                    label={
                      <span className="flex items-baseline gap-2">
                        <span className="font-mono text-[13px]">{p.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          → {p.returns}
                        </span>
                      </span>
                    }
                  />
                ))}
            </>
          )}
        </>
      )}
    </>
  )
}

function ConnectionBranch({
  connection,
  filter,
}: {
  connection: Connection
  filter: string
}) {
  const { openTab, removeConnection, logAudit, connectionRoleFor } =
    useWorkspace()
  const [expanded, setExpanded] = React.useState(connection.status === 'connected')
  const [manageOpen, setManageOpen] = React.useState(false)

  // The connection is only rendered when visible, so the role is non-null.
  const connRole = connectionRoleFor(connection)
  const caps = connRole ? connectionCapabilities(connRole) : null
  const isShared = connection.scope === 'shared'
  const canManageAccess = isShared && !!caps?.canManageAccess

  const statusColor =
    connection.status === 'connected'
      ? 'bg-success'
      : connection.status === 'error'
        ? 'bg-destructive'
        : 'bg-muted-foreground'

  function handleRemove() {
    if (!caps?.canDelete) {
      logAudit('Remove connection', connection.name, 'blocked')
      toast.error('Permission denied', {
        description: isShared
          ? 'Admin access on this connection is required to remove it.'
          : 'You cannot remove this connection.',
      })
      return
    }
    removeConnection(connection.id)
    logAudit('Remove connection', connection.name, 'allowed')
    toast.success(`Removed "${connection.name}"`)
  }

  return (
    <div className="mb-0.5">
      {isShared && (
        <ManageAccessDialog
          connection={connection}
          open={manageOpen}
          onOpenChange={setManageOpen}
        />
      )}
      <TreeRow
        depth={0}
        expandable
        expanded={expanded || !!filter}
        onToggle={() => setExpanded((v) => !v)}
        icon={<Database style={{ color: connection.accent }} />}
        label={
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium">{connection.name}</span>
            {connection.readOnly && (
              <Lock className="size-3 shrink-0 text-muted-foreground" />
            )}
            {connection.isSystem ? (
              <span className="shrink-0 rounded-sm bg-primary/15 px-1 py-px text-[9px] font-medium tracking-wide text-primary uppercase">
                System
              </span>
            ) : isShared ? (
              connRole && (
                <span className="shrink-0 rounded-sm bg-secondary px-1 py-px text-[9px] font-medium tracking-wide text-secondary-foreground uppercase">
                  {connectionRoleLabel(connRole)}
                </span>
              )
            ) : (
              <span className="flex shrink-0 items-center gap-0.5 rounded-sm bg-chart-2/15 px-1 py-px text-[9px] font-medium tracking-wide text-chart-2 uppercase">
                <Lock className="size-2.5" />
                Private
              </span>
            )}
          </span>
        }
        trailing={
          <div className="flex items-center gap-1">
            <span
              className={cn('size-2 shrink-0 rounded-full', statusColor)}
              aria-hidden
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 group-hover/row:opacity-100 data-[popup-open]:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  />
                }
              >
                <MoreHorizontal />
                <span className="sr-only">Connection actions</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() =>
                      openTab(
                        {
                          kind: 'server-status',
                          title: `${connection.name} · status`,
                          connectionId: connection.id,
                        },
                        { focusExisting: true },
                      )
                    }
                  >
                    <Server />
                    Server status
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      openTab({
                        kind: 'sql',
                        title: 'Untitled query',
                        connectionId: connection.id,
                        sql: '',
                      })
                    }
                  >
                    <Play />
                    New SQL editor
                  </DropdownMenuItem>
                  {canManageAccess && (
                    <DropdownMenuItem onClick={() => setManageOpen(true)}>
                      <UserCog />
                      Manage access
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                {caps?.canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={handleRemove}
                    >
                      <Trash2 />
                      Remove connection
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
      {(expanded || filter) &&
        connection.schemas.map((schema) => (
          <SchemaBranch
            key={schema.id}
            schema={schema}
            connection={connection}
            depth={1}
            filter={filter}
          />
        ))}
    </div>
  )
}

export function Navigator() {
  const { connections } = useWorkspace()
  const [filter, setFilter] = React.useState('')

  // Pin the system store to the top; keep the rest in their existing order.
  const sortedConnections = React.useMemo(
    () =>
      [...connections].sort(
        (a, b) => Number(!!b.isSystem) - Number(!!a.isSystem),
      ),
    [connections],
  )

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Navigator
        </span>
        <Badge variant="secondary" className="tabular-nums">
          {connections.length} sources
        </Badge>
      </div>
      <div className="p-2">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Filter tables & schemas…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </InputGroup>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2 pb-2">
        <div className="scrollbar-thin">
          {connections.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-muted-foreground">
              No connections. Use New Connection to add a data source.
            </p>
          ) : (
            sortedConnections.map((c) => (
              <ConnectionBranch key={c.id} connection={c} filter={filter} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
