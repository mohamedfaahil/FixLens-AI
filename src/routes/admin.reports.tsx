import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoNotice, PageHeader, Panel } from "@/components/fixlens/ui-bits";
import { useDemoStore } from "@/lib/demo-store";
import { CATEGORIES, PROPOSAL_STATUSES, STATUSES, recurringIssues } from "@/lib/demo-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/reports")({
  head: () =>
    pageHead(
      "Planning Reports",
      "Printable campus maintenance and improvement summary for planning.",
    ),
  component: Reports,
});

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="grid grid-cols-[140px_1fr_32px] items-center gap-3 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${max ? (value / max) * 100 : 0}%` }}
        />
      </div>
      <span className="text-right font-semibold text-foreground">{value}</span>
    </div>
  );
}

function Reports() {
  const { complaints, proposals } = useDemoStore();
  const byCat = CATEGORIES.map((c) => ({
    c,
    n: complaints.filter((x) => x.category === c).length,
  }));
  const byStatus = STATUSES.map((s) => ({ s, n: complaints.filter((x) => x.status === s).length }));
  const byProp = PROPOSAL_STATUSES.map((s) => ({
    s,
    n: proposals.filter((x) => x.status === s).length,
  }));
  const max = (xs: { n: number }[]) => Math.max(...xs.map((x) => x.n));
  const resolved = complaints.filter((c) => c.status === "Resolved").length;
  const top = [...proposals].sort((a, b) => b.support - a.support).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Planning report"
        description="A one-page summary for campus planning meetings."
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        }
      />
      <DemoNotice>Generated from sample demo data in this browser tab.</DemoNotice>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Panel>
          <p className="text-xs text-muted-foreground">Total complaints</p>
          <p className="text-3xl font-bold text-foreground">{complaints.length}</p>
        </Panel>
        <Panel>
          <p className="text-xs text-muted-foreground">Resolution rate</p>
          <p className="text-3xl font-bold text-foreground">
            {complaints.length ? Math.round((resolved / complaints.length) * 100) : 0}%
          </p>
        </Panel>
        <Panel>
          <p className="text-xs text-muted-foreground">Improvement proposals</p>
          <p className="text-3xl font-bold text-foreground">{proposals.length}</p>
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Complaints by category">
          <div className="space-y-2">
            {byCat.map((x) => (
              <Bar key={x.c} label={x.c} value={x.n} max={max(byCat)} />
            ))}
          </div>
        </Panel>
        <Panel title="Complaints by status">
          <div className="space-y-2">
            {byStatus.map((x) => (
              <Bar key={x.s} label={x.s} value={x.n} max={max(byStatus)} />
            ))}
          </div>
        </Panel>
        <Panel title="Proposal decisions">
          <div className="space-y-2">
            {byProp.map((x) => (
              <Bar key={x.s} label={x.s} value={x.n} max={max(byProp)} />
            ))}
          </div>
        </Panel>
        <Panel title="Most supported proposals">
          <ol className="space-y-2 text-sm">
            {top.map((p, i) => (
              <li key={p.id} className="flex gap-3">
                <span className="font-bold text-primary">{i + 1}.</span>
                <span className="flex-1 text-foreground">{p.title}</span>
                <span className="font-semibold">{p.support}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
      <Panel className="mt-5" title="Recurring issues to plan for">
        <ul className="divide-y text-sm">
          {recurringIssues.map((r) => (
            <li key={r.issue + r.location} className="flex justify-between py-2">
              <span className="text-foreground">
                {r.issue} — {r.location}
              </span>
              <span className="text-muted-foreground">{r.count} reports</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
