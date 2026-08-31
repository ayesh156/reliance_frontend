import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm",
        secondary:
          "border-transparent bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100",
        destructive:
          "border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
        outline:
          "text-slate-950 dark:text-zinc-50 border border-slate-200 dark:border-zinc-800",
        success:
          "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
        info:
          "border-transparent bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
        warning:
          "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full",
            variant === "success" && "bg-emerald-500",
            variant === "destructive" && "bg-rose-500",
            variant === "warning" && "bg-amber-500",
            variant === "info" && "bg-blue-500",
            !variant && "bg-current"
          )}
        />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }