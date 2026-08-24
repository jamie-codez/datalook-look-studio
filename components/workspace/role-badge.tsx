import { ShieldCheck, Pencil, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Role } from '@/lib/types'

const ROLE_STYLES: Record<Role, { className: string; Icon: typeof Eye }> = {
  Admin: {
    className: 'bg-primary/15 text-primary',
    Icon: ShieldCheck,
  },
  Editor: {
    className: 'bg-warning/15 text-warning',
    Icon: Pencil,
  },
  Viewer: {
    className: 'bg-muted text-muted-foreground',
    Icon: Eye,
  },
}

export function RoleBadge({
  role,
  className,
  showIcon = true,
}: {
  role: Role
  className?: string
  showIcon?: boolean
}) {
  const { className: roleClass, Icon } = ROLE_STYLES[role]
  return (
    <Badge variant="secondary" className={cn(roleClass, className)}>
      {showIcon && <Icon />}
      {role}
    </Badge>
  )
}
