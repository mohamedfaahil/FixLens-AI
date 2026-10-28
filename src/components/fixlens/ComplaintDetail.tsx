import { Building2, CalendarDays, Tag, UserRound, Users } from "lucide-react";
import type { Complaint } from "@/lib/demo-data";
import { PriorityBadge, StatusBadge, Timeline, formatDate } from "./ui-bits";

export function ComplaintSummary({ c }: { c: Complaint }) {
  const meta = [
    { icon: Tag, l: "Category", v: c.category },
    { icon: Building2, l: "Location", v: `${c.building}, ${c.room}` },
    { icon: Users, l: "People affected", v: c.affected },
    { icon: UserRound, l: "Reporter", v: c.reporter },
    { icon: CalendarDays, l: "Submitted", v: formatDate(c.date) },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-primary">{c.id}</span>
        <StatusBadge status={c.status} />
        <PriorityBadge priority={c.priority} />
      </div>
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
      <div>
        <h3 className="mb-3 text-sm font-bold text-foreground">Status timeline</h3>
        <Timeline events={c.timeline} />
      </div>
    </div>
  );
}
