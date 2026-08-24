'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Database,
  ChevronRight,
  Table2,
  Folder,
  Loader2,
  Check,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  fetchDatabases,
  fetchSchemas,
  fetchTables,
  type ColumnDef,
  type FieldSample,
} from '@/lib/db/api-client'
import type { Connection } from '@/lib/types'
import { driverMeta, containerLabel, entityPlural } from '@/lib/drivers'

interface DatabaseBrowserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: Connection
  onSelect: (database: string, schema: string | undefined, table: string) => void
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

export function DatabaseBrowserDialog({
  open,
  onOpenChange,
  connection,
  onSelect,
}: DatabaseBrowserDialogProps) {
  const [databases, setDatabases] = React.useState<string[]>([])
  const [dbState, setDbState] = React.useState<LoadState>('idle')
  const [selectedDb, setSelectedDb] = React.useState<string | null>(null)
  const [schemas, setSchemas] = React.useState<string[]>([])
  const [schemaState, setSchemaState] = useState<LoadState>('idle')
  const [selectedSchema, setSelectedSchema] = React.useState<string | null>(null)
  const [tables, setTables] = React.useState<string[]>([])
  const [tableState, setTableState] = useState<LoadState>('idle')
  const [selectedTable, setSelectedTable] = React.useState<string | null>(null)
  const [structure, setStructure] = React.useState<ColumnDef[] | FieldSample | null>(null)
  const [structureState, setStructureState] = useState<LoadState>('idle')

  const meta = driverMeta(connection.driver)
  const hasSchemas = meta.category === 'sql'

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setDatabases([])
      setDbState('idle')
      setSelectedDb(null)
      setSchemas([])
      setSchemaState('idle')
      setSelectedSchema(null)
      setTables([])
      setTableState('idle')
      setSelectedTable(null)
      setStructure(null)
      setStructureState('idle')
    }
  }, [open])

  // Load databases when dialog opens
  React.useEffect(() => {
    if (!open || dbState !== 'idle') return
    setDbState('loading')
    fetchDatabases(connection.id)
      .then((dbs) => {
        setDatabases(dbs)
        setDbState('loaded')
        // Auto-select if only one database
        if (dbs.length === 1) {
          setSelectedDb(dbs[0])
        }
      })
      .catch((err) => {
        setDbState('error')
        toast.error('Failed to load databases', { description: err.message })
      })
  }, [open, dbState, connection.id])

  // Load schemas when a database is selected
  React.useEffect(() => {
    if (!selectedDb || schemaState !== 'idle') return
    if (!hasSchemas) {
      // For NoSQL, skip schemas and go straight to tables
      setSchemas([])
      setSchemaState('loaded')
      return
    }
    setSchemaState('loading')
    fetchSchemas(connection.id, selectedDb)
      .then((ss) => {
        setSchemas(ss)
        setSchemaState('loaded')
        if (ss.length === 1) setSelectedSchema(ss[0])
      })
      .catch((err) => {
        setSchemaState('error')
        toast.error('Failed to load schemas', { description: err.message })
      })
  }, [selectedDb, schemaState, connection.id, hasSchemas])

  // Load tables when schema is selected (or database for NoSQL)
  React.useEffect(() => {
    if (!selectedDb || tableState !== 'idle') return
    if (hasSchemas && !selectedSchema) return
    setTableState('loading')
    fetchTables(connection.id, selectedDb, selectedSchema || undefined)
      .then((ts) => {
        setTables(ts)
        setTableState('loaded')
      })
      .catch((err) => {
        setTableState('error')
        toast.error('Failed to load tables', { description: err.message })
      })
  }, [selectedDb, selectedSchema, tableState, connection.id, hasSchemas])

  function handleDatabaseClick(db: string) {
    setSelectedDb(db)
    setSelectedSchema(null)
    setSchemas([])
    setSchemaState('idle')
    setTables([])
    setTableState('idle')
    setSelectedTable(null)
    setStructure(null)
    setStructureState('idle')
  }

  function handleSchemaClick(schema: string) {
    setSelectedSchema(schema)
    setTables([])
    setTableState('idle')
    setSelectedTable(null)
    setStructure(null)
    setStructureState('idle')
  }

  function handleTableClick(table: string) {
    setSelectedTable(table)
    setStructure(null)
    setStructureState('idle')
  }

  function handleSelect() {
    if (!selectedDb || !selectedTable) return
    onSelect(selectedDb, selectedSchema || undefined, selectedTable)
    onOpenChange(false)
  }

  function handleRefresh() {
    setDbState('idle')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="size-4" style={{ color: connection.accent }} />
            Browse {connection.name}
          </DialogTitle>
          <DialogDescription>
            Select a database, {hasSchemas ? 'schema, ' : ''}and {entityPlural(connection.driver).toLowerCase()} to open.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 h-[400px]">
          {/* Databases column */}
          <BrowserColumn
            title={containerLabel(connection.driver) + 's'}
            items={databases}
            state={dbState}
            selectedItem={selectedDb}
            onItemClick={handleDatabaseClick}
            onRefresh={handleRefresh}
            icon={<Database className="size-3.5" />}
          />

          {/* Schemas column (SQL only) */}
          {hasSchemas && (
            <BrowserColumn
              title="Schemas"
              items={schemas}
              state={schemaState}
              selectedItem={selectedSchema}
              onItemClick={handleSchemaClick}
              onRefresh={() => {
                setSchemaState('idle')
              }}
              icon={<Folder className="size-3.5" />}
              emptyMessage={selectedDb ? 'No schemas' : 'Select a database first'}
            />
          )}

          {/* Tables column */}
          <BrowserColumn
            title={entityPlural(connection.driver)}
            items={tables}
            state={tableState}
            selectedItem={selectedTable}
            onItemClick={handleTableClick}
            onRefresh={() => {
              setTableState('idle')
            }}
            icon={<Table2 className="size-3.5" />}
            emptyMessage={
              !selectedDb
                ? 'Select a database first'
                : hasSchemas && !selectedSchema
                  ? 'Select a schema first'
                  : 'No tables found'
            }
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!selectedDb || !selectedTable}>
            <Check className="size-4" />
            Open {selectedTable || 'table'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function useState<T>(initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  return React.useState(initial)
}

interface BrowserColumnProps {
  title: string
  items: string[]
  state: LoadState
  selectedItem: string | null
  onItemClick: (item: string) => void
  onRefresh: () => void
  icon: React.ReactNode
  emptyMessage?: string
}

function BrowserColumn({
  title,
  items,
  state,
  selectedItem,
  onItemClick,
  onRefresh,
  icon,
  emptyMessage,
}: BrowserColumnProps) {
  return (
    <div className="flex-1 min-w-0 rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary text-xs font-medium text-muted-foreground border-b border-border">
        <span className="uppercase tracking-wide">{title}</span>
        <button
          onClick={onRefresh}
          className="opacity-50 hover:opacity-100 transition-opacity"
          title="Refresh"
        >
          <RefreshCw className="size-3" />
        </button>
      </div>
      <ScrollArea className="h-[340px]">
        {state === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {state === 'error' && (
          <div className="px-3 py-4 text-xs text-destructive">
            Failed to load. Click refresh to retry.
          </div>
        )}
        {state === 'loaded' && items.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            {emptyMessage || 'Empty'}
          </div>
        )}
        {state === 'loaded' && items.length > 0 && (
          <div className="py-1">
            {items.map((item) => (
              <button
                key={item}
                onClick={() => onItemClick(item)}
                className={cn(
                  'flex items-center gap-1.5 w-full px-3 py-1.5 text-sm text-left hover:bg-secondary/50 transition-colors',
                  selectedItem === item && 'bg-primary/10 text-primary font-medium',
                )}
              >
                {icon}
                <span className="truncate">{item}</span>
                <ChevronRight className="size-3 ml-auto opacity-30" />
              </button>
            ))}
          </div>
        )}
        {state === 'idle' && (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            {emptyMessage || 'Select an item from the left'}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
