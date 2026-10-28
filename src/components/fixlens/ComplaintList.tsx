import { useMemo, useState } from "react";
import { Search, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CATEGORIES, PRIORITIES, STATUSES, type Complaint } from "@/lib/demo-data";
import { EmptyState, PriorityBadge, StatusBadge, formatDate, selectCls } from "./ui-bits";

export function ComplaintList({
  complaints,
  onOpen,
  showReporter,
}: {
  complaints: Complaint[];
  onOpen: (c: Complaint) => void;
  showReporter?: boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [st, setSt] = useState("");
  const [pr, setPr] = useState("");

  const list = useMemo(
    () =>
      complaints.filter((c) => {
        const t = `${c.id} ${c.title} ${c.building} ${c.room}`.toLowerCase();
        return (
          (!q || t.includes(q.toLowerCase())) &&
          (!cat || c.category === cat) &&
          (!st || c.status === st) &&
          (!pr || c.priority === pr)
        );
      }),
    [complaints, q, cat, st, pr],
  );

  return (
    <div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_170px_150px_130px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ID, title or location"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-card pl-9"
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
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No complaints match"
          description="Try changing the search text or filters."
        />
      ) : (
        <div className="surface overflow-hidden">
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Complaint</th>
                {showReporter && <th className="px-4 py-3">Reporter</th>}
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onOpen(c)}
                  className="cursor-pointer border-b last:border-0 hover:bg-accent/50"
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{c.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        className="text-left font-semibold text-foreground hover:text-primary"
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
                          className="inline-flex items-center text-primary"
                        >
                          <ImageIcon className="size-3.5 shrink-0" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.category} · {c.building}, {c.room}
                    </p>
                  </td>
                  {showReporter && (
                    <td className="px-4 py-3 text-muted-foreground">{c.reporter}</td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDate(c.date)}
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="pr-3">
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y md:hidden">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onOpen(c)}
                  className="w-full p-4 text-left hover:bg-accent/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-primary">{c.id}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(c.date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className="mt-1 font-semibold text-foreground">{c.title}</p>
                    {c.image && <ImageIcon className="size-3.5 text-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.building}, {c.room}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <PriorityBadge priority={c.priority} />
                    <StatusBadge status={c.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Showing {list.length} of {complaints.length} demo complaints
      </p>
    </div>
  );
}
