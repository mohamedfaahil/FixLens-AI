import { Clock, AlertTriangle, CheckCircle2, AlertCircle, Timer } from "lucide-react";
import type { Complaint } from "@/lib/demo-data";
import { calculateComplaintSLA, type ComplaintSLAResult } from "@/lib/sla-engine";

export function SLABadge({
  complaint,
  compact = false,
  referenceTime,
}: {
  complaint: Complaint;
  compact?: boolean;
  referenceTime?: number | Date;
}) {
  const sla: ComplaintSLAResult = calculateComplaintSLA(complaint, referenceTime);

  let colorClasses = "";
  let IconComponent = Clock;

  switch (sla.status) {
    case "breached":
      colorClasses =
        "border-destructive/40 bg-destructive/10 text-destructive font-bold animate-pulse";
      IconComponent = AlertCircle;
      break;
    case "near_breach":
      colorClasses =
        "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold";
      IconComponent = AlertTriangle;
      break;
    case "on_track":
      colorClasses =
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium";
      IconComponent = Timer;
      break;
    case "resolved_within_sla":
      colorClasses =
        "border-primary/30 bg-primary/10 text-primary font-medium";
      IconComponent = CheckCircle2;
      break;
    case "resolved_breached":
      colorClasses =
        "border-border bg-muted/40 text-muted-foreground font-medium";
      IconComponent = Clock;
      break;
  }

  return (
    <span
      data-testid="sla-badge"
      data-sla-status={sla.status}
      title={sla.explanation}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors ${colorClasses}`}
    >
      <IconComponent className="size-3 shrink-0" />
      <span>{compact ? sla.badgeText.split(" ")[0] : sla.badgeText}</span>
    </span>
  );
}

export function SLADetailCard({
  complaint,
  referenceTime,
}: {
  complaint: Complaint;
  referenceTime?: number | Date;
}) {
  const sla = calculateComplaintSLA(complaint, referenceTime);

  let barColor = "bg-primary";
  if (sla.status === "breached") barColor = "bg-destructive";
  else if (sla.status === "near_breach") barColor = "bg-amber-500";
  else if (sla.status === "on_track") barColor = "bg-emerald-500";

  return (
    <div
      data-testid="sla-detail-card"
      className="rounded-xl border border-border bg-card/60 p-4 shadow-2xs space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h4 className="text-sm font-bold text-foreground">Service Level Agreement (SLA)</h4>
        </div>
        <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
          {sla.policyLabel} ({sla.targetHours}h)
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Resolution Progress</span>
          <span className="font-semibold text-foreground">{sla.progressPercent}% elapsed</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all duration-300 ${barColor}`}
            style={{ width: `${sla.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
        <div>
          <span className="text-muted-foreground block">Deadline</span>
          <span className="font-medium text-foreground">
            {sla.deadline.toLocaleDateString()} {sla.deadline.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block">Current SLA State</span>
          <SLABadge complaint={complaint} referenceTime={referenceTime} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
        {sla.explanation}
      </p>
    </div>
  );
}
