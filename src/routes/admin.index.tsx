import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ClipboardList, Flame, Hourglass } from "lucide-react";
import {
  DemoNotice,
  PageHeader,
  Panel,
  PriorityBadge,
  StatCard,
} from "@/components/fixlens/ui-bits";
import { AnalyticsView } from "@/components/fixlens/AnalyticsView";
import { useDemoStore } from "@/lib/demo-store";
import { anomalyAlerts, DEMO_ADMIN } from "@/lib/demo-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/")({
  head: () =>
    pageHead(
      "Admin Overview",
      "Campus-wide complaint summary, alerts and trends for administrators.",
    ),
  component: AdminOverview,
});

function AdminOverview() {
  const { complaints } = useDemoStore();
  const open = complaints.filter((c) => !["Resolved", "Rejected"].includes(c.status));
  return (
    <>
      <PageHeader
        title={`Good day, ${DEMO_ADMIN.name}`}
        description="Campus maintenance at a glance."
      />
      <DemoNotice>All figures come from sample demo data held in your browser.</DemoNotice>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total complaints"
          value={complaints.length}
          icon={ClipboardList}
          hint="Demo data"
        />
        <StatCard label="Open" value={open.length} icon={Hourglass} hint="Demo data" />
        <StatCard
          label="High priority open"
          value={open.filter((c) => c.priority === "High").length}
          icon={Flame}
          hint="Demo data"
        />
        <StatCard
          label="Resolved"
          value={complaints.filter((c) => c.status === "Resolved").length}
          icon={CheckCircle2}
          hint="Demo data"
        />
      </div>
      <Panel
        className="mt-5"
        title="Anomaly alerts"
        action={
          <Link
            to="/admin/complaints"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Review complaints
          </Link>
        }
      >
        <ul className="divide-y">
          {anomalyAlerts.map((a) => (
            <li key={a.title} className="flex items-start gap-3 py-3">
              <AlertTriangle className="mt-0.5 size-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.detail}</p>
              </div>
              <PriorityBadge priority={a.level} />
            </li>
          ))}
        </ul>
      </Panel>
      <div className="mt-5">
        <AnalyticsView compact />
      </div>
    </>
  );
}
