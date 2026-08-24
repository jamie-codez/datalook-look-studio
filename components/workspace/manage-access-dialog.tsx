'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { ConnectionAccessEditor } from './connection-access-editor'
import type { Connection, ConnectionGrant } from '@/lib/types'

export function ManageAccessDialog({
  connection,
  open,
  onOpenChange,
}: {
  connection: Connection
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { updateConnectionGrants, logAudit } = useWorkspace()
  const { users } = useAuth()
  const [grants, setGrants] = React.useState<ConnectionGrant[]>(connection.grants)

  // Re-sync local edits whenever a different connection is opened.
  React.useEffect(() => {
    if (open) setGrants(connection.grants)
  }, [open, connection.grants])

  function handleSave() {
    updateConnectionGrants(connection.id, grants)
    logAudit('Update access', connection.name, 'allowed')
    toast.success('Access updated', {
      description: `${grants.length} ${grants.length === 1 ? 'member has' : 'members have'} access to "${connection.name}"`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage access</DialogTitle>
          <DialogDescription>
            Choose who can access{' '}
            <span className="font-medium text-foreground">
              {connection.name}
            </span>{' '}
            and what they can do.
          </DialogDescription>
        </DialogHeader>

        <ConnectionAccessEditor
          users={users}
          ownerId={connection.ownerId}
          grants={grants}
          onChange={setGrants}
        />

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            <Check data-icon="inline-start" />
            Save access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
