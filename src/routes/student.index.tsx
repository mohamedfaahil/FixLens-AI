import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  Hourglass,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DemoNotice,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
  PriorityBadge,
  formatDate,
  EmptyState,
} from "@/components/fixlens/ui-bits";
import { useDemoStore } from "@/lib/demo-store";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/student/")({
  head: () => pageHead("Student Overview", "Your campus maintenance complaints and quick actions."),
  component: Overview,
});

function Overview() {
  const { complaints, proposals, currentStudent } = useDemoStore();
  const nav = useNavigate();
  const mine = complaints.filter((c) => c.reporter === currentStudent.name);
  const open = mine.filter((c) => !["Resolved", "Rejected"].includes(c.status)).length;
  return (
    <>
      <PageHeader
        title={`Welcome back, ${currentStudent.name.split(" ")[0] || "Student"}`}
        description="Here is a summary of your maintenance reports."
        actions={
          <Button asChild>
            <Link to="/student/report">
              <FilePlus2 /> Report Complaint
            </Link>
          </Button>
        }
      />
      <DemoNotice>The figures below come from sample demo data held in your browser.</DemoNotice>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My complaints" value={mine.length} icon={ClipboardList} hint="Demo data" />
        <StatCard label="Open" value={open} icon={Hourglass} hint="Demo data" />
        <StatCard
          label="Resolved"
          value={mine.filter((c) => c.status === "Resolved").length}
          icon={CheckCircle2}
          hint="Demo data"
        />
        <StatCard
          label="Active proposals"
          value={proposals.filter((p) => p.status === "Under Review").length}
          icon={Lightbulb}
          hint="Demo data"
        />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Recent complaints"
          action={
            <Link
              to="/student/complaints"
              className="text-sm font-semibold text-primary hover:underline"
            >
              View all
            </Link>
          }
        >
          {mine.length === 0 ? (
            <EmptyState
              title="No complaints yet"
              description="You have not submitted any complaints yet. Report an issue to track its status here."
              action={
                <Button asChild>
                  <Link to="/student/report">
                    <FilePlus2 className="size-4" /> Report Complaint
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y">
              {mine.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => nav({ to: "/student/complaints/$id", params: { id: c.id } })}
                    className="flex w-full items-center gap-3 py-3 text-left hover:text-primary"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.id} · {formatDate(c.date)} · {c.building}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <PriorityBadge priority={c.priority} />
                    </div>
                    <StatusBadge status={c.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Quick actions">
          <div className="space-y-2">
            {[
              { to: "/student/report", l: "Report a new issue", i: FilePlus2 },
              { to: "/student/complaints", l: "Track my complaints", i: ClipboardList },
              { to: "/student/improvements", l: "Browse improvement proposals", i: Lightbulb },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="flex items-center gap-3 rounded-lg border p-3 text-sm font-semibold text-foreground hover:border-primary hover:text-primary"
              >
                <a.i className="size-4 text-primary" />
                {a.l}
                <ArrowRight className="ml-auto size-4" />
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
