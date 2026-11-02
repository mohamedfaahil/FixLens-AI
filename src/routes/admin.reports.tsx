import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/fixlens/ui-bits";
import { useDemoStore } from "@/lib/demo-store";
import { CATEGORIES, PROPOSAL_STATUSES, STATUSES } from "@/lib/demo-data";
import { detectRecurringIssues } from "@/lib/triage-engine";
import { pageHead } from "@/lib/seo";
import {
  exportComplaintsToCSV,
  exportProposalsToCSV,
  exportAnalyticsSummaryToCSV,
} from "@/lib/csv-export";
import { toast } from "sonner";

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
  const recurring = detectRecurringIssues(complaints);

  const handleExportComplaints = () => {
    exportComplaintsToCSV(complaints);
    toast.success(`Exported ${complaints.length} complaints to CSV.`);
  };

  const handleExportProposals = () => {
    exportProposalsToCSV(proposals);
    toast.success(`Exported ${proposals.length} proposals to CSV.`);
  };

  const handleExportSummary = () => {
    const now = new Date();
    const monthsMap: Record<string, { month: string; complaints: number; resolved: number }> = {};
    const monthKeys: string[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short" });
      monthKeys.push(key);
      monthsMap[key] = { month: label, complaints: 0, resolved: 0 };
    }

    for (const c of complaints) {
      if (!c.date) continue;
      const mKey = c.date.slice(0, 7);
      if (monthsMap[mKey]) monthsMap[mKey].complaints++;
      if (c.status === "Resolved") {
        const resEvent = c.timeline?.find((t) => t.status === "Resolved");
        const resDate = resEvent?.date || c.date;
        const resMKey = resDate.slice(0, 7);
        if (monthsMap[resMKey]) monthsMap[resMKey].resolved++;
      }
    }

    const buildingCounts = Object.entries(
      complaints.reduce<Record<string, number>>(
        (acc, c) => ((acc[c.building] = (acc[c.building] || 0) + 1), acc),
        {},
      ),
    ).map(([name, value]) => ({ name, value }));

    const pendingCount = complaints.filter((c) => !["Resolved", "Rejected"].includes(c.status)).length;
    const highPriPending = complaints.filter(
      (c) => c.priority === "High" && !["Resolved", "Rejected"].includes(c.status),
    ).length;

    exportAnalyticsSummaryToCSV({
      rangeDays: 180,
      totalComplaints: complaints.length,
      openCount: pendingCount,
      resolvedCount: resolved,
      resolutionRatePercent: complaints.length ? Math.round((resolved / complaints.length) * 100) : 0,
      highPriorityPendingCount: highPriPending,
      byCategory: byCat.map((x) => ({ name: x.c, value: x.n })),
      byLocation: buildingCounts,
      monthlyTrend: monthKeys.map((k) => monthsMap[k]),
      recurringIssues: recurring.map((r) => ({
        issue: r.issue,
        location: r.location,
        count: r.count,
        category: r.category,
      })),
    });
    toast.success("Executive planning summary exported to CSV.");
  };

  return (
    <>
      <PageHeader
        title="Planning report"
        description="A one-page summary for campus planning meetings."
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportComplaints} className="text-xs">
              <FileSpreadsheet className="size-3.5 mr-1.5" />
              Complaints CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportProposals} className="text-xs">
              <FileSpreadsheet className="size-3.5 mr-1.5" />
              Proposals CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportSummary} className="text-xs">
              <Download className="size-3.5 mr-1.5" />
              Summary CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="text-xs">
              <Printer className="size-3.5 mr-1.5" />
              Print
            </Button>
          </div>
        }
      />
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
          {recurring.map((r) => (
            <li key={r.id} className="flex justify-between py-2">
              <span className="text-foreground">
                {r.issue} — {r.location}
              </span>
              <span className="text-muted-foreground">
                {r.count} reports {r.incidentCount < r.count ? `(${r.incidentCount} inc.)` : ""}
              </span>
            </li>
          ))}
          {!recurring.length && (
            <li className="py-4 text-center text-muted-foreground text-sm">
              No recurring issues detected.
            </li>
          )}
        </ul>
      </Panel>
    </>
  );
}
