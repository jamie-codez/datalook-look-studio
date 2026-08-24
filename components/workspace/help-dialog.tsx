"use client"

import { LifeBuoy, BookOpen, MessageCircle, Keyboard } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"

const SHORTCUTS: { label: string; keys: string[] }[] = [
  { label: "Run query", keys: ["Ctrl", "Enter"] },
  { label: "New SQL editor", keys: ["Ctrl", "T"] },
  { label: "Close tab", keys: ["Ctrl", "W"] },
]

export function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LifeBuoy className="size-4" aria-hidden />
          </div>
          <DialogTitle>Get Help</DialogTitle>
          <DialogDescription>
            Datalook Studio is a browser-based workspace for exploring and querying databases.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          <a
            href="https://ui.shadcn.com/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
          >
            <BookOpen className="size-4 text-muted-foreground" aria-hidden />
            Documentation
          </a>
          <a
            href="mailto:support@datalook.dev"
            className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
          >
            <MessageCircle className="size-4 text-muted-foreground" aria-hidden />
            Contact support
          </a>
        </div>

        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Keyboard className="size-3.5" aria-hidden />
            Keyboard shortcuts
          </p>
          <ul className="flex flex-col gap-1.5">
            {SHORTCUTS.map((s) => (
              <li
                key={s.label}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span>{s.label}</span>
                <span className="flex items-center gap-1">
                  {s.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
