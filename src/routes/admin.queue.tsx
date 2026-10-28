import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import {
  DemoNotice,
  EmptyState,
  PageHeader,
  Panel,
  PriorityBadge,
  StatusBadge,
  formatDate,
} from "@/components/fixlens/ui-bits";
import { useDemoStore } from "@/lib/demo-store";
import { demoPredictPriority, PRIORITIES, type Priority } from "@/lib/demo-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/queue")({
  head: () =>
    pageHead("Priority Queue", "Open complaints ranked by AI-suggested priority for staff review."),
  component: Queue,
});

const rank: Record<Priority, number> = { High: 3, Medium: 2, Low: 1 };

function Queue() {
  const { complaints } = useDemoStore();
  const nav = useNavigate();
  const open = complaints
    .filter((c) => !["Resolved", "Rejected"].includes(c.status))
    .map((c) => ({ c, pred: demoPredictPriority(c) }))
    .sort((a, b) => rank[b.pred.priority] - rank[a.pred.priority] || b.c.affected - a.c.affected);

  return (
    <>
      <PageHeader
        title="Priority queue"
        description="Open complaints sorted by suggested priority. Staff confirm the final priority."
      />
      <DemoNotice>
        Suggestions come from a simple demo rule. The planned TF-IDF + Random Forest model will
        replace it once trained and evaluated.
      </DemoNotice>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {PRIORITIES.slice()
          .reverse()
          .map((p) => (
            <Panel key={p}>
              <div className="flex items-center justify-between">
                <PriorityBadge priority={p} />
                <span className="text-2xl font-bold text-foreground">
                  {open.filter((x) => x.pred.priority === p).length}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                suggested {p.toLowerCase()} priority
              </p>
            </Panel>
          ))}
      </div>
      <Panel
        className="mt-5"
        title={
          <span className="flex items-center gap-2">
            <Flame className="size-4 text-primary" /> Review queue
          </span>
        }
      >
        {open.length === 0 ? (
          <EmptyState title="Queue is empty" description="All complaints are resolved." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Complaint</th>
                  <th>Suggested</th>
                  <th>Current</th>
                  <th>Status</th>
                  <th className="text-right">Affected</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {open.map(({ c, pred }) => (
                  <tr
                    key={c.id}
                    onClick={() => nav({ to: "/admin/complaints/$id", params: { id: c.id } })}
                    className="cursor-pointer hover:bg-muted"
                  >
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-foreground">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.id} · {c.building} · {formatDate(c.date)}
                      </p>
                    </td>
                    <td>
                      <PriorityBadge priority={pred.priority} />
                    </td>
                    <td>
                      <PriorityBadge priority={c.priority} />
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="text-right font-medium">{c.affected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
