import {
  Building2,
  CalendarDays,
  Tag,
  UserRound,
  Users,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  Link2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Complaint } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";
import { getRecurrenceForComplaint } from "@/lib/triage-engine";
import { PriorityBadge, StatusBadge, Timeline, formatDate } from "./ui-bits";

export function ComplaintSummary({
  c,
  isSharedView = false,
}: {
  c: Complaint;
  isSharedView?: boolean;
}) {
  const { complaints } = useDemoStore();
  const recurrence = getRecurrenceForComplaint(c, complaints);

  const reporterDisplay = isSharedView ? "Student Reporter (Protected)" : c.reporter;

  const meta = [
    { icon: Tag, l: "Category", v: c.category },
    { icon: AlertTriangle, l: "Reported urgency", v: c.urgency },
    { icon: Building2, l: "Location", v: `${c.building}, ${c.room}` },
    { icon: Users, l: "People affected", v: c.affected },
    { icon: UserRound, l: "Reporter", v: reporterDisplay },
    { icon: CalendarDays, l: "Submitted", v: formatDate(c.date) },
  ];

  const displayTimeline = isSharedView
    ? c.timeline.map((ev) => ({
        ...ev,
        by: ev.by === c.reporter ? "Student Reporter" : ev.by,
      }))
    : c.timeline;

  return (
    <div className="space-y-5">
      {isSharedView && (
        <div
          data-testid="shared-complaint-banner"
          className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground"
        >
          <span className="font-semibold text-primary">Read-only Shared Campus View:</span>{" "}
          This issue was reported by a fellow student. Personal contact details and private reporter information are protected.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-primary">{c.id}</span>
        <StatusBadge status={c.status} />
        <PriorityBadge priority={c.priority} />
        {c.linkedComplaintId && (
          <span
            data-testid="linked-complaint-badge"
            className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
          >
            <Link2 className="size-3" /> Linked to {c.linkedComplaintId}
          </span>
        )}
        {recurrence.isRecurring && (
          <span
            data-testid="recurrence-badge"
            className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning-foreground"
          >
            <RotateCcw className="size-3" /> Recurring ({recurrence.totalReports} reports)
          </span>
        )}
      </div>

      {recurrence.isRecurring && (
        <div
          data-testid="recurrence-notice"
          className="rounded-lg border border-warning/35 bg-warning/10 p-3.5 text-sm"
        >
          <div className="flex items-start gap-2.5">
            <RotateCcw className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                Repeated issue detected at this location
              </p>
              <p className="text-xs text-muted-foreground">
                This location ({c.building}, {c.room}) has recorded {recurrence.totalReports} total maintenance reports ({recurrence.incidentCount}{" "}
                {recurrence.incidentCount === 1 ? "distinct incident" : "distinct incidents"}) for {c.category}.
                {recurrence.otherComplaintIds.length > 0 && (
                  <span className="block mt-1 font-mono text-[11px] text-foreground">
                    Other reports: {recurrence.otherComplaintIds.join(", ")}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm leading-relaxed text-foreground">{c.description}</p>
      <dl className="grid grid-cols-2 gap-3">
        {meta.map((m) => (
          <div key={m.l} className="rounded-lg border bg-muted/30 p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <m.icon className="size-3.5" />
              {m.l}
            </dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">{m.v}</dd>
          </div>
        ))}
      </dl>
      {c.image && (
        <img
          src={c.image}
          alt="Attached by reporter"
          className="max-h-56 rounded-lg border object-cover"
        />
      )}
      {c.resolutionNote && (
        <div className="rounded-lg border border-success/25 bg-success/5 p-3 text-sm">
          <p className="text-xs font-semibold text-success">Resolution note</p>
          <p className="mt-0.5 text-foreground">{c.resolutionNote}</p>
        </div>
      )}
      {c.followUps && c.followUps.length > 0 && (
        <div data-testid="follow-up-history" className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" />
            Follow-up History ({c.followUps.length})
          </h3>
          <div className="space-y-2">
            {c.followUps.map((fu) => (
              <div key={fu.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="font-semibold text-foreground">
                    {isSharedView ? "Student Reporter" : fu.by}
                  </span>
                  <span>
                    {formatDate(fu.date)} {fu.timestamp ? `at ${fu.timestamp}` : ""}
                  </span>
                </div>
                <p className="text-foreground">{fu.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <h3 className="mb-3 text-sm font-bold text-foreground">Status timeline</h3>
        <Timeline events={displayTimeline} />
      </div>
    </div>
  );
}
