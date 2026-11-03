import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline: "text-foreground border-border",
        success: "border-success/30 bg-success/15 text-success dark:text-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/10",
        warning: "border-warning/30 bg-warning/15 text-warning-foreground dark:text-amber-300 dark:border-amber-500/30 dark:bg-amber-500/10",
        info: "border-primary/25 bg-primary/10 text-primary dark:text-indigo-400 dark:border-indigo-500/30 dark:bg-indigo-500/10",
        danger: "border-destructive/30 bg-destructive/15 text-destructive dark:text-rose-400 dark:border-rose-500/30 dark:bg-rose-500/10",
        neutral: "border-border bg-muted/80 text-muted-foreground",
        demo: "border-warning/40 bg-warning/15 text-warning-foreground uppercase tracking-wider text-[10px] font-bold dark:text-amber-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
