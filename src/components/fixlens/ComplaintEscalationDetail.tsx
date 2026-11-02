import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Brain,
  CheckCircle2,
  Clock,
  Flame,
  Info,
  ShieldAlert,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PriorityBadge, Panel } from "./ui-bits";
import { useDemoStore } from "@/lib/demo-store";
import {
  evaluateComplaintEscalation,
  type ComplaintEscalationResult,
} from "@/lib/escalation-engine";
import type { Complaint, Priority } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export function ComplaintEscalationDetail({ c }: { c: Complaint }) {
  const { complaints, updateComplaint } = useDemoStore();
  const [applying, setApplying] = useState(false);

  const escalation: ComplaintEscalationResult = evaluateComplaintEscalation(c, complaints);

  const handleApplyEscalation = (targetPriority: Priority) => {
    setApplying(true);
    try {
      updateComplaint(c.id, {
        priority: targetPriority,
        escalatedPriority: targetPriority,
        escalationReasons: escalation.reasons,
        isAdminOverride: false,
        note: `Operational priority updated to ${targetPriority} via automated escalation rules (${escalation.reasons.join(", ")}).`,
      });
      toast.success(`Priority updated to ${targetPriority} based on escalation review.`);
    } finally {
      setApplying(false);
    }
  };

  const isClosed = c.status === "Resolved" || c.status === "Rejected";

  return (
    <Panel
      title="Priority Architecture & Escalation Assessment"
      className="space-y-4"
    >
      <p className="text-xs text-muted-foreground leading-relaxed">
        FixLens AI distinguishes student-reported urgency, trained machine learning predictions, staff operational overrides, and dynamic escalation triggers.
      </p>

      {/* 4 Priorities Matrix */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* 1. Student Urgency */}
        <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
            <Users className="size-3 text-muted-foreground" />
            Student Urgency
          </p>
          <div className="pt-0.5">
            <PriorityBadge priority={escalation.studentUrgency} />
          </div>
          <p className="text-[10px] text-muted-foreground pt-0.5">Reported at filing</p>
        </div>

        {/* 2. ML Prediction */}
        <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
            <Brain className="size-3 text-primary" />
            AI ML Prediction
          </p>
          <div className="pt-0.5">
            <PriorityBadge priority={escalation.predictedPriority} />
          </div>
          <p className="text-[10px] text-muted-foreground pt-0.5">
            {c.confidence ? `${Math.round(c.confidence * 100)}% confidence` : "ML pipeline"}
          </p>
        </div>

        {/* 3. Admin Operational Priority */}
        <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
            <UserCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
            Admin Confirmed
          </p>
          <div className="pt-0.5">
            <PriorityBadge priority={escalation.adminPriority} />
          </div>
          <p className="text-[10px] text-muted-foreground pt-0.5">
            {(c as any).isAdminOverride ? "Manual override active" : "Staff confirmed"}
          </p>
        </div>

        {/* 4. Current Escalated Priority */}
        <div
          className={cn(
            "rounded-lg border p-2.5 space-y-1",
            escalation.isEscalated
              ? "border-amber-500/40 bg-amber-500/10"
              : "bg-muted/30",
          )}
        >
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
            <Zap className="size-3 text-amber-500" />
            Escalated Priority
          </p>
          <div className="pt-0.5">
            {escalation.isEscalated && escalation.escalatedPriority ? (
              <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 text-xs">
                <ArrowUpRight className="size-3.5" />
                {escalation.escalatedPriority}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground font-medium">Standard</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground pt-0.5">
            {escalation.isEscalated ? "Escalation active" : "No escalation"}
          </p>
        </div>
      </div>

      {/* Escalation Status & Action Block */}
      {isClosed ? (
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="size-4 text-success" />
          <span>Ticket is {c.status.toLowerCase()}. Automatic escalation rules are disengaged for resolved issues.</span>
        </div>
      ) : escalation.isEscalated && escalation.escalatedPriority ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400">
                <Flame className="size-4 text-amber-600 dark:text-amber-400" />
                Priority Escalation Recommended: {escalation.adminPriority} &rarr; {escalation.escalatedPriority}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This ticket has met automatic operational escalation criteria based on campus impact and recurring activity.
              </p>
            </div>
            {c.priority !== escalation.escalatedPriority && (
              <Button
                size="sm"
                disabled={applying}
                onClick={() => handleApplyEscalation(escalation.escalatedPriority!)}
                className="shrink-0 h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
              >
                Apply {escalation.escalatedPriority} Priority
              </Button>
            )}
          </div>

          {/* Trigger Factors Breakdown */}
          <div className="space-y-1.5 border-t border-amber-500/20 pt-2.5 text-xs">
            <p className="text-[11px] font-semibold text-foreground">Trigger Factors & Evidence:</p>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              {escalation.reasons.map((r, i) => (
                <li key={i} className="leading-snug">{r}</li>
              ))}
            </ul>
          </div>

          {/* Metric Badges */}
          <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
            {escalation.factors.distinctReporters > 1 && (
              <span className="rounded bg-muted px-2 py-0.5 font-medium text-foreground">
                {escalation.factors.distinctReporters} distinct student reporters
              </span>
            )}
            {escalation.factors.incidentCount > 1 && (
              <span className="rounded bg-muted px-2 py-0.5 font-medium text-foreground">
                {escalation.factors.incidentCount} confirmed incidents
              </span>
            )}
            {escalation.factors.daysUnresolved > 0 && (
              <span className="rounded bg-muted px-2 py-0.5 font-medium text-foreground">
                {escalation.factors.daysUnresolved} days unresolved
              </span>
            )}
            {escalation.factors.safetyHazard && (
              <span className="rounded bg-destructive/15 px-2 py-0.5 font-semibold text-destructive">
                Critical safety indicators present
              </span>
            )}
          </div>
        </div>
      ) : escalation.needsAdminReview ? (
        <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 text-xs text-purple-900 dark:text-purple-300 flex items-start gap-2">
          <Info className="size-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
          <div className="space-y-1">
            <p className="font-semibold">Manual Administrator Override Retained</p>
            <p className="text-muted-foreground leading-relaxed">
              This ticket was manually set to {c.priority}. Automated rules indicate potential escalation, but your manual override takes precedence.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span>Operational priority matches baseline. No escalation criteria triggered at this time.</span>
        </div>
      )}
    </Panel>
  );
}
