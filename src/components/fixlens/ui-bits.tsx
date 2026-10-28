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
        "flex items-center gap-2 font-display font-extrabold text-foreground",
        className,
      )}
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-elegant">
        <ScanSearch className="size-4.5" />
      </span>
      <span className="text-lg tracking-tight">
        FixLens <span className="text-primary">AI</span>
      </span>
    </Link>
  );
}

export function DemoBadge({ label = "Demo Mode" }: { label?: string }) {
  return (
    <Badge variant="demo" className="gap-1">
      <FlaskConical className="size-3" />
      {label}
    </Badge>
  );
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm text-warning-foreground">
      <FlaskConical className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
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
    <Badge variant={v} className="gap-1">
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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
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
    <section className={cn("surface p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold text-foreground">{title}</h2>}
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
    <div className="surface flex items-start justify-between p-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-2xl font-extrabold text-foreground">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <span className="grid size-9 place-items-center rounded-lg bg-accent text-primary">
        <Icon className="size-4.5" />
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
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-muted/40 px-6 py-12 text-center">
      <Inbox className="size-8 text-muted-foreground" />
      <p className="mt-3 font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function FieldError({ msg }: { msg?: string | undefined }) {
  if (!msg) return null;
  return (
    <p role="alert" className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
      <AlertTriangle className="size-3" />
      {msg}
    </p>
  );
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative ml-2 border-l border-border">
      {events.map((e, i) => (
        <li key={i} className="mb-5 ml-5 last:mb-0">
          <span
            className={cn(
              "absolute -left-[7px] mt-1 size-3.5 rounded-full border-2 border-card",
              i === events.length - 1 ? "bg-primary" : "bg-muted-foreground/40",
            )}
          />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={e.status} />
            <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
          </div>
          <p className="mt-1 text-sm text-foreground">{e.note}</p>
          <p className="text-xs text-muted-foreground">by {e.by}</p>
        </li>
      ))}
    </ol>
  );
}

export const selectCls =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
