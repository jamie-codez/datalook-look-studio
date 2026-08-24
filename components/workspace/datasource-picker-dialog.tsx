'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { driverLabel } from '@/lib/drivers'
import type { Connection, SchemaMeta, TableMeta } from '@/lib/types'

export interface DatasourceSelection {
  connectionId: string
  schemaName?: string
  tableId?: string
}

interface DatasourcePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (selection: DatasourceSelection) => void
  title?: string
  description?: string
  showTable?: boolean
}

export function DatasourcePickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Choose data source',
  description = 'Select a connection, schema, and table to continue.',
  showTable = true,
}: DatasourcePickerDialogProps) {
  const { connections } = useWorkspace()
  const userConnections = connections.filter((c) => !c.isSystem)

  const [connectionId, setConnectionId] = React.useState<string>('')
  const [schemaName, setSchemaName] = React.useState<string>('')
  const [tableId, setTableId] = React.useState<string>('')

  React.useEffect(() => {
    if (open) {
      setConnectionId(userConnections[0]?.id ?? '')
      setSchemaName('')
      setTableId('')
    }
  }, [open])

  const selectedConnection: Connection | undefined = connections.find(
    (c) => c.id === connectionId,
  )

  const schemas: SchemaMeta[] = selectedConnection?.schemas ?? []
  const selectedSchema = schemas.find((s) => s.name === schemaName)
  const tables: TableMeta[] = selectedSchema?.tables ?? []

  function handleConfirm() {
    if (!connectionId) return
    onSelect({ connectionId, schemaName: schemaName || undefined, tableId: tableId || undefined })
    onOpenChange(false)
  }

  const canConfirm = connectionId && (!showTable || (schemaName && tableId))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {userConnections.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No connections configured yet. Create a connection first.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Connection</label>
                <Select value={connectionId} onValueChange={(v) => { setConnectionId(v ?? ''); setSchemaName(''); setTableId('') }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a connection">
                      {(value) => {
                        const conn = connections.find((c) => c.id === value)
                        return conn ? `${conn.name} · ${driverLabel(conn.driver)}` : 'Select a connection'
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {userConnections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: conn.accent }}
                          aria-hidden
                        />
                        {conn.name}
                        <span className="text-xs text-muted-foreground">
                          · {driverLabel(conn.driver)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {schemas.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Schema</label>
                  <Select value={schemaName} onValueChange={(v) => { setSchemaName(v ?? ''); setTableId('') }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a schema" />
                    </SelectTrigger>
                    <SelectContent>
                      {schemas.map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showTable && selectedSchema && tables.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Table</label>
                  <Select value={tableId} onValueChange={(v) => setTableId(v ?? '')}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          <span className="text-xs text-muted-foreground capitalize">
                            · {t.kind}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!canConfirm}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
