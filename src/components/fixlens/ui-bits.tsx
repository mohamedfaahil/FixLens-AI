import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ScanSearch,
  FlaskConical,
  Inbox,
  AlertTriangle,
  ArrowUp,
  Minus,
  ArrowDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Priority, ProposalStatus, Status, TimelineEvent } from "@/lib/demo-data";

export function Logo({ to = "/", className }: { to?: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-2.5 font-display font-extrabold text-foreground transition-opacity hover:opacity-90",
        className,
      )}
    >
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-elegant transition-transform duration-200 group-hover:scale-105">
        <ScanSearch className="size-5" />
      </span>
      <span className="text-lg tracking-tight">
        FixLens <span className="bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">AI</span>
      </span>
    </Link>
  );
}

export function DemoBadge({ label = "Demo Mode" }: { label?: string }) {
  return (
    <Badge variant="demo" className="gap-1 shadow-xs">
      <FlaskConical className="size-3" />
      {label}
    </Badge>
  );
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm text-warning-foreground shadow-xs">
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

const statusVariant: Record<
  Status | ProposalStatus,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  Submitted: "neutral",
  "Under Review": "info",
  "In Progress": "warning",
  Resolved: "success",
  Rejected: "danger",
  Approved: "success",
  Planned: "info",
  Completed: "success",
};

export function StatusBadge({ status }: { status: Status | ProposalStatus }) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const Icon = priority === "High" ? ArrowUp : priority === "Medium" ? Minus : ArrowDown;
  const v = priority === "High" ? "danger" : priority === "Medium" ? "warning" : "success";
  return (
    <Badge variant={v} className="gap-1 font-semibold">
      <Icon className="size-3" />
      {priority}
    </Badge>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3.5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface p-5 sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-border/60 pb-3">
          {title && (
            <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: typeof Inbox;
  hint?: string;
}) {
  return (
    <div className="surface surface-hover flex items-start justify-between p-5 rounded-2xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1.5 font-display text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
          {value}
        </p>
        {hint && (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <span className="size-1 rounded-full bg-primary/60 inline-block" />
            {hint}
          </p>
        )}
      </div>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary shadow-xs transition-colors">
        <Icon className="size-5" />
      </span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center backdrop-blur-xs">
      <div className="grid size-14 place-items-center rounded-2xl bg-muted/70 text-muted-foreground shadow-xs">
        <Inbox className="size-7" />
      </div>
      <p className="mt-4 font-bold tracking-tight text-foreground text-base">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function FieldError({ msg }: { msg?: string | undefined }) {
  if (!msg) return null;
  return (
    <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span>{msg}</span>
    </p>
  );
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative ml-2.5 border-l-2 border-border/80">
      {events.map((e, i) => {
        const isLatest = i === events.length - 1;
        return (
          <li key={i} className="mb-6 ml-6 last:mb-0">
            <span
              className={cn(
                "absolute -left-[9px] mt-1.5 size-4 rounded-full border-2 border-card shadow-xs transition-colors",
                isLatest ? "bg-primary ring-4 ring-primary/20" : "bg-muted-foreground/40",
              )}
            />
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge status={e.status} />
              <span className="text-xs font-medium text-muted-foreground">{formatDate(e.date)}</span>
            </div>
            <p className="mt-1.5 text-sm font-medium text-foreground leading-relaxed">{e.note}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Recorded by {e.by}</p>
          </li>
        );
      })}
    </ol>
  );
}

export const selectCls =
  "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary";

export function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
