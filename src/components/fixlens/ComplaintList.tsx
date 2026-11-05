import { useMemo, useState } from "react";
import { Search, ChevronRight, Image as ImageIcon, RotateCcw, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORIES, PRIORITIES, STATUSES, type Complaint } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";
import { detectRecurringIssues } from "@/lib/triage-engine";
import { EmptyState, PriorityBadge, StatusBadge, formatDate, selectCls } from "./ui-bits";
import { SLABadge } from "./SLABadge";
import { calculateComplaintSLA } from "@/lib/sla-engine";
import { exportComplaintsToCSV } from "@/lib/csv-export";
import { toast } from "sonner";

export function ComplaintList({
  complaints,
  onOpen,
  showReporter,
  showExport,
}: {
  complaints: Complaint[];
  onOpen: (c: Complaint) => void;
  showReporter?: boolean;
  showExport?: boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [st, setSt] = useState("");
  const [pr, setPr] = useState("");
  const [slaFilter, setSlaFilter] = useState("");

  const list = useMemo(
    () =>
      complaints.filter((c) => {
        const t = `${c.id} ${c.title} ${c.building} ${c.room}`.toLowerCase();
        const sla = calculateComplaintSLA(c);
        const matchesSla =
          !slaFilter ||
          (slaFilter === "overdue" && (sla.status === "breached" || sla.status === "resolved_breached")) ||
          (slaFilter === "near_breach" && sla.status === "near_breach") ||
          (slaFilter === "on_track" && (sla.status === "on_track" || sla.status === "resolved_within_sla"));

        return (
          (!q || t.includes(q.toLowerCase())) &&
          (!cat || c.category === cat) &&
          (!st || c.status === st) &&
          (!pr || c.priority === pr) &&
          matchesSla
        );
      }),
    [complaints, q, cat, st, pr, slaFilter],
  );

  const recurringMap = useMemo(() => {
    const recurring = detectRecurringIssues(complaints);
    const map = new Map<string, { count: number; incidents: number }>();
    for (const r of recurring) {
      for (const id of r.complaintIds) {
        map.set(id, { count: r.totalReports, incidents: r.incidentCount });
      }
    }
    return map;
  }, [complaints]);

  const { isSupabaseConnected } = useDemoStore();

  return (
    <div>
      <div
        className={`mb-4 grid gap-2.5 sm:grid-cols-2 ${
          showExport
            ? "lg:grid-cols-[1fr_150px_130px_120px_150px_auto]"
            : "lg:grid-cols-[1fr_150px_140px_130px_160px]"
        }`}
      >
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ID, title or location..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9.5 h-10 rounded-xl"
            aria-label="Search complaints"
          />
        </div>
        <select
          className={selectCls}
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          className={selectCls}
          value={st}
          onChange={(e) => setSt(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          className={selectCls}
          value={pr}
          onChange={(e) => setPr(e.target.value)}
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          className={selectCls}
          value={slaFilter}
          onChange={(e) => setSlaFilter(e.target.value)}
          aria-label="Filter by SLA status"
        >
          <option value="">All SLA windows</option>
          <option value="overdue">⚠️ Overdue / Breached</option>
          <option value="near_breach">⏳ Approaching Deadline</option>
          <option value="on_track">✅ On Track (Within SLA)</option>
        </select>
        {showExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const dateStr = new Date().toISOString().slice(0, 10);
              exportComplaintsToCSV(list, `fixlens_filtered_complaints_${dateStr}.csv`);
              toast.success(`Exported ${list.length} filtered complaints to CSV.`);
            }}
            className="text-xs h-10 rounded-xl flex items-center gap-2 font-medium"
            disabled={list.length === 0}
            title={list.length === 0 ? "No complaints match filters" : `Export ${list.length} filtered complaints to CSV`}
          >
            <Download className="size-3.5" />
            <span>Export CSV ({list.length})</span>
          </Button>
        )}
      </div>

      {complaints.length === 0 ? (
        <EmptyState
          title="No complaints found"
          description="There are currently no maintenance complaints recorded in the system."
        />
      ) : list.length === 0 ? (
        <EmptyState
          title="No complaints match filters"
          description="Try broadening your search query or clearing active category and status filters."
        />
      ) : (
        <div className="surface overflow-hidden rounded-2xl">
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">ID</th>
                <th className="px-5 py-3.5">Complaint</th>
                {showReporter && <th className="px-5 py-3.5">Reporter</th>}
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Priority</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">SLA Timeline</th>
                <th className="w-8 pr-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {list.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onOpen(c)}
                  className="group cursor-pointer transition-colors duration-150 hover:bg-muted/50"
                >
                  <td className="px-5 py-3.5 font-mono text-xs font-bold text-primary">{c.id}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        className="text-left font-semibold text-foreground group-hover:text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(c);
                        }}
                      >
                        {c.title}
                      </button>
                      {c.image && (
                        <span
                          title="Photo attached"
                          className="inline-flex items-center text-primary/80"
                        >
                          <ImageIcon className="size-3.5 shrink-0" />
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {c.category} · {c.building}, {c.room}
                      </p>
                      {recurringMap.has(c.id) && (
                        <span
                          title={`Recurring issue: ${recurringMap.get(c.id)!.count} reports (${recurringMap.get(c.id)!.incidents} distinct incidents)`}
                          className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold text-warning-foreground"
                        >
                          <RotateCcw className="size-2.5" /> Recurring
                        </span>
                      )}
                    </div>
                  </td>
                  {showReporter && (
                    <td className="px-5 py-3.5 text-xs text-muted-foreground font-medium">{c.reporter}</td>
                  )}
                  <td className="whitespace-nowrap px-5 py-3.5 text-xs text-muted-foreground font-medium">
                    {formatDate(c.date)}
                  </td>
                  <td className="px-5 py-3.5">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <SLABadge complaint={c} />
                  </td>
                  <td className="pr-4 text-right">
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-border/60 md:hidden">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onOpen(c)}
                  className="w-full p-4 text-left transition-colors active:bg-muted/70 hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-primary">{c.id}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(c.date)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <p className="font-semibold text-foreground text-sm">{c.title}</p>
                    {c.image && <ImageIcon className="size-3.5 text-primary shrink-0" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.building}, {c.room} · {c.category}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={c.priority} />
                    <StatusBadge status={c.status} />
                    <SLABadge complaint={c} />
                    {recurringMap.has(c.id) && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold text-warning-foreground">
                        <RotateCcw className="size-2.5" /> Recurring ({recurringMap.get(c.id)!.count})
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs font-medium text-muted-foreground">
        Showing {list.length} of {complaints.length} {isSupabaseConnected ? "complaints" : "demo complaints"}
      </p>
    </div>
  );
}
