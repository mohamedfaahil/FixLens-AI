import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
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
import { CATEGORIES, anomalyAlerts, monthlyTrend } from "@/lib/demo-data";
import { detectRecurringIssues } from "@/lib/triage-engine";
import { DemoNotice, Panel, PriorityBadge, formatDate, selectCls } from "./ui-bits";

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
  const { complaints } = useDemoStore();
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
  const trend = monthlyTrend.slice(-Math.max(1, Math.round(Number(range) / 30)));
  const recurring = useMemo(() => {
    const dynamicRecurring = detectRecurringIssues(complaints);
    return dynamicRecurring.filter((r) => !cat || r.category === cat);
  }, [complaints, cat]);

  const tip = {
    contentStyle: { borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 },
  };

  return (
    <div className="space-y-5">
      <DemoNotice>
        Illustrative demo data. These are not real campus statistics and no live anomaly detection
        is running.
      </DemoNotice>
      <div className="no-print flex flex-wrap gap-2">
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
              No complaints in this range.
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
              No complaints in this range.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Monthly complaint trend">
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
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
            <ul className="space-y-3">
              {anomalyAlerts.map((a) => (
                <li key={a.title} className="flex gap-3 rounded-lg border p-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{a.title}</p>
                      <PriorityBadge priority={a.level} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
