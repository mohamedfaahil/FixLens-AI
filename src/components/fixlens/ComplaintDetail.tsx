import { useState, useEffect } from "react";
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
  Camera,
  ZoomIn,
  X,
  ImageOff,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Complaint } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";
import { getRecurrenceForComplaint } from "@/lib/triage-engine";
import { resolveSignedImageUrl } from "@/lib/supabase-data";
import { PriorityBadge, StatusBadge, Timeline, formatDate } from "./ui-bits";
import { SLABadge, SLADetailCard } from "./SLABadge";

export function ComplaintSummary({
  c,
  isSharedView = false,
}: {
  c: Complaint;
  isSharedView?: boolean;
}) {
  const { complaints } = useDemoStore();
  const recurrence = getRecurrenceForComplaint(c, complaints);

  const [resolvedImage, setResolvedImage] = useState<string | undefined>(() => {
    if (!c.image) return undefined;
    if (
      c.image.startsWith("http://") ||
      c.image.startsWith("https://") ||
      c.image.startsWith("blob:") ||
      c.image.startsWith("data:")
    ) {
      return c.image;
    }
    return undefined;
  });

  const [imgError, setImgError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (c.image && !resolvedImage) {
      resolveSignedImageUrl(c.image).then((url) => {
        if (url) setResolvedImage(url);
      });
    }
  }, [c.image]);

  useEffect(() => {
    if (!isZoomed) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsZoomed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZoomed]);

  const displayImageUrl =
    resolvedImage ||
    (c.image &&
    (c.image.startsWith("http://") ||
      c.image.startsWith("https://") ||
      c.image.startsWith("data:image/") ||
      c.image.startsWith("blob:"))
      ? c.image
      : undefined);

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
        <SLABadge complaint={c} />
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
          <div key={m.l} className="rounded-xl border border-border bg-card/60 p-3.5 shadow-2xs">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <m.icon className="size-3.5 text-primary/80" />
              {m.l}
            </dt>
            <dd className="mt-1 text-sm font-bold text-foreground">{m.v}</dd>
          </div>
        ))}
      </dl>
      <SLADetailCard complaint={c} />
      {c.image && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Camera className="size-3.5 text-primary" />
              Attached Campus Photo
            </span>
            {displayImageUrl && !imgError && (
              <button
                type="button"
                onClick={() => setIsZoomed(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ZoomIn className="size-3.5" />
                View Full Size
              </button>
            )}
          </div>

          {imgError ? (
            <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 p-4 text-xs text-muted-foreground">
              <ImageOff className="size-5 shrink-0 text-muted-foreground/70" />
              <div>
                <p className="font-semibold text-foreground">Attachment Preview Unavailable</p>
                <p className="mt-0.5">The image file could not be loaded or was stored in temporary session memory.</p>
              </div>
            </div>
          ) : displayImageUrl ? (
            <div className="group relative overflow-hidden rounded-2xl border border-border bg-black/5 shadow-xs">
              <img
                src={displayImageUrl}
                alt="Attached by reporter"
                onError={() => setImgError(true)}
                onClick={() => setIsZoomed(true)}
                className="max-h-80 w-auto cursor-zoom-in rounded-2xl object-contain transition-transform duration-200 group-hover:scale-[1.01]"
              />
              <div
                onClick={() => setIsZoomed(true)}
                className="absolute inset-0 flex cursor-zoom-in items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <span className="flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-xs">
                  <ZoomIn className="size-3.5" />
                  Click to enlarge
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
              <div className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Loading secure photo from storage...</span>
            </div>
          )}

          {/* Full-Screen Lightbox Modal */}
          {isZoomed && displayImageUrl && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-150"
              onClick={() => setIsZoomed(false)}
            >
              <div
                className="relative max-h-[92vh] max-w-[92vw] overflow-hidden rounded-2xl bg-black/40 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsZoomed(false)}
                    aria-label="Close enlarged photo"
                    className="rounded-full bg-black/60 p-2 text-white shadow-md hover:bg-black/90 transition-colors"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <img
                  src={displayImageUrl}
                  alt="Attached photo enlarged"
                  className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain"
                />
                <div className="border-t border-white/10 bg-black/80 px-4 py-2.5 text-center text-xs text-white/80">
                  <span>Reported Incident Photo &bull; {c.building} ({c.room || "Campus"})</span>
                </div>
              </div>
            </div>
          )}
        </div>
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
