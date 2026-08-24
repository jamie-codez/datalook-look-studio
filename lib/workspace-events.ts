'use client'

import * as React from 'react'

// A tiny typed pub/sub so the top action bar can drive whichever tab is
// currently focused (run query, commit, rollback, export) without threading
// callbacks through the whole tree.
export type WorkspaceEvent =
  | 'run-query'
  | 'commit'
  | 'rollback'
  | 'export'
  | 'format-sql'
  | 'new-sql-tab'

type Handler = () => void

const listeners = new Map<WorkspaceEvent, Set<Handler>>()

export function emitWorkspaceEvent(event: WorkspaceEvent) {
  listeners.get(event)?.forEach((h) => h())
}

export function subscribeWorkspaceEvent(event: WorkspaceEvent, handler: Handler) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  const set = listeners.get(event)!
  set.add(handler)
  return () => {
    set.delete(handler)
  }
}

/** Subscribe to a workspace event for the lifetime of the component. */
export function useWorkspaceEvent(
  event: WorkspaceEvent,
  handler: Handler,
  enabled = true,
) {
  const ref = React.useRef(handler)
  ref.current = handler
  React.useEffect(() => {
    if (!enabled) return
    return subscribeWorkspaceEvent(event, () => ref.current())
  }, [event, enabled])
}
