"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked = false, onCheckedChange, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={(e) => {
          e.preventDefault()
          onCheckedChange?.(!checked)
        }}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm border border-input transition-colors",
          checked ? "bg-primary text-primary-foreground" : "bg-background",
          className,
        )}
        {...props}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </button>
    )
  },
)
Checkbox.displayName = "Checkbox"
