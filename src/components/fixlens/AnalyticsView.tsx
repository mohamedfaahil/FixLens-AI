import { useMemo, useState } from "react";
import { AlertTriangle, Download, CheckCircle2, ClipboardList, Flame, Hourglass } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { useDemoStore } from "@/lib/demo-store";
import { CATEGORIES } from "@/lib/demo-data";
import { detectRecurringIssues } from "@/lib/triage-engine";
import { Panel, PriorityBadge, formatDate, selectCls } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { exportAnalyticsSummaryToCSV } from "@/lib/csv-export";
import { toast } from "sonner";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
  "var(--accent-foreground)",
];
const RANGES = { "30": "Last 30 days", "90": "Last 3 months", "180": "Last 6 months" } as const;

export function AnalyticsView({ compact }: { compact?: boolean }) {
  const { complaints, adminAlerts } = useDemoStore();
  const [range, setRange] = useState<keyof typeof RANGES>("180");
  const [cat, setCat] = useState("");

  const filtered = useMemo(() => {
    const baseDate = new Date();
    baseDate.setHours(23, 59, 59, 999);
    const cutoff = new Date(baseDate);
    cutoff.setDate(cutoff.getDate() - Number(range));
    cutoff.setHours(0, 0, 0, 0);

    return complaints.filter((c) => {
      if (cat && c.category !== cat) return false;
      const cDate = new Date(c.date + "T00:00:00");
      return isNaN(cDate.getTime()) || cDate >= cutoff;
    });
  }, [complaints, range, cat]);

  // Dynamic KPI Metrics
  const totalInRange = filtered.length;
  const resolvedInRange = filtered.filter((c) => c.status === "Resolved").length;
  const resolutionRate = totalInRange > 0 ? Math.round((resolvedInRange / totalInRange) * 100) : 0;
  const pendingBacklog = filtered.filter((c) => !["Resolved", "Rejected"].includes(c.status)).length;
  const highPriorityPending = filtered.filter(
    (c) => c.priority === "High" && !["Resolved", "Rejected"].includes(c.status),
  ).length;

  const byCategory = CATEGORIES.map((c) => ({
    name: c,
    value: filtered.filter((x) => x.category === c).length,
  })).filter((d) => d.value);

  const byLocation = Object.entries(
    filtered.reduce<Record<string, number>>(
      (a, c) => ((a[c.building] = (a[c.building] || 0) + 1), a),
      {},
    ),
  ).map(([name, value]) => ({ name, value }));

  // Dynamically calculate monthly trend (Reported vs. Resolved) from actual complaint timestamps
  const dynamicMonthlyTrend = useMemo(() => {
    const now = new Date();
    const numMonths = Math.max(1, Math.round(Number(range) / 30));
    const monthsMap: Record<string, { month: string; complaints: number; resolved: number }> = {};
    const monthKeys: string[] = [];

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short" });
      monthKeys.push(key);
      monthsMap[key] = { month: label, complaints: 0, resolved: 0 };
    }

    for (const c of filtered) {
      if (!c.date) continue;
      const monthKey = c.date.slice(0, 7);
      if (monthsMap[monthKey]) {
        monthsMap[monthKey].complaints++;
      }
      if (c.status === "Resolved") {
        const resolveEvent = c.timeline?.find((t) => t.status === "Resolved");
        const resolvedDate = resolveEvent?.date || c.date;
        const resolvedMonthKey = resolvedDate.slice(0, 7);
        if (monthsMap[resolvedMonthKey]) {
          monthsMap[resolvedMonthKey].resolved++;
        }
      }
    }

    return monthKeys.map((k) => monthsMap[k]);
  }, [filtered, range]);

  const recurring = useMemo(() => {
    const dynamicRecurring = detectRecurringIssues(complaints);
    return dynamicRecurring.filter((r) => !cat || r.category === cat);
  }, [complaints, cat]);

  // Connect to real Phase 2 maintenance anomaly alerts
  const activeAnomalies = useMemo(() => {
    return (adminAlerts || []).filter((a) => !cat || a.category === cat);
  }, [adminAlerts, cat]);

  const tip = {
    contentStyle: { borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 },
  };

  const handleExportSummaryCSV = () => {
    exportAnalyticsSummaryToCSV({
      rangeDays: range,
      totalComplaints: totalInRange,
      openCount: pendingBacklog,
      resolvedCount: resolvedInRange,
      resolutionRatePercent: resolutionRate,
      highPriorityPendingCount: highPriorityPending,
      byCategory,
      byLocation,
      monthlyTrend: dynamicMonthlyTrend,
      recurringIssues: recurring.map((r) => ({
        issue: r.issue,
        location: r.location,
        count: r.count,
        category: r.category,
      })),
    });
    toast.success("Analytics summary exported to CSV.");
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={selectCls + " w-auto"}
            value={range}
            onChange={(e) => setRange(e.target.value as keyof typeof RANGES)}
            aria-label="Date range"
          >
            {Object.entries(RANGES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            className={selectCls + " w-auto"}
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportSummaryCSV}
          className="text-xs flex items-center gap-1.5"
        >
          <Download className="size-3.5" />
          Export Analytics CSV
        </Button>
      </div>

      {/* KPI Executive Summary Cards */}
      {!compact && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Complaints Recorded</p>
              <ClipboardList className="size-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold">{totalInRange}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{RANGES[range]}</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Resolution Rate</p>
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-bold">{resolutionRate}%</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{resolvedInRange} resolved in period</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Pending Backlog</p>
              <Hourglass className="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-bold">{pendingBacklog}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Awaiting resolution</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">High Priority Backlog</p>
              <Flame className="size-4 text-destructive" />
            </div>
            <p className="mt-2 text-2xl font-bold text-destructive">{highPriorityPending}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Requires immediate attention</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Complaints by category">
          {byCategory.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No complaints recorded in this period.
            </p>
          )}
        </Panel>
        <Panel title="Complaints by location">
          {byLocation.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={byLocation} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip {...tip} />
                  <Bar
                    dataKey="value"
                    name="Complaints"
                    fill="var(--chart-1)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No complaints recorded in this period.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Monthly complaint trend">
        {totalInRange > 0 ? (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={dynamicMonthlyTrend}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="complaints"
                  name="Reported"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke="var(--chart-3)"
                  strokeWidth={2.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No complaint activity recorded in this period.
          </p>
        )}
      </Panel>

      {!compact && (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <Panel title="Recurring issues">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2">Issue</th>
                    <th className="pb-2">Location</th>
                    <th className="pb-2">Reports</th>
                    <th className="pb-2">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {recurring.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2.5 font-medium text-foreground">
                        {r.issue}
                        <p className="text-xs text-muted-foreground">{r.category}</p>
                      </td>
                      <td className="py-2.5 text-muted-foreground">{r.location}</td>
                      <td className="py-2.5 text-foreground">
                        <span className="font-semibold">{r.count}</span>
                        {r.incidentCount < r.count ? (
                          <span
                            className="ml-1 text-xs text-muted-foreground"
                            title={`${r.count} reports across ${r.incidentCount} distinct incidents`}
                          >
                            ({r.incidentCount} inc.)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 text-muted-foreground">{formatDate(r.lastSeen)}</td>
                    </tr>
                  ))}
                  {!recurring.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        No recurring issues detected for this category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Anomaly alerts">
            {activeAnomalies.length > 0 ? (
              <ul className="space-y-3">
                {activeAnomalies.map((a) => (
                  <li key={a.id} className="flex gap-3 rounded-lg border p-3">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{a.title}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-muted-foreground">{a.status}</span>
                          <PriorityBadge priority={a.severity} />
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.details}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {a.building} · {a.metric}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No active maintenance anomalies detected.
              </p>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
