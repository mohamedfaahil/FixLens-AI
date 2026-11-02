import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ClipboardList, Flame, Hourglass } from "lucide-react";
import {
  DemoNotice,
  PageHeader,
  StatCard,
} from "@/components/fixlens/ui-bits";
import { AnalyticsView } from "@/components/fixlens/AnalyticsView";
import { AdminAlertsPanel } from "@/components/fixlens/AdminAlertsPanel";
import { useDemoStore } from "@/lib/demo-store";
import { DEMO_ADMIN } from "@/lib/demo-data";
import { ADMIN_ACCOUNT } from "@/lib/supabase-auth";
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
  const { complaints, isSupabaseConnected } = useDemoStore();
  const open = complaints.filter((c) => !["Resolved", "Rejected"].includes(c.status));
  return (
    <>
      <PageHeader
        title={`Good day, ${isSupabaseConnected ? ADMIN_ACCOUNT.name : DEMO_ADMIN.name}`}
        description="Campus maintenance at a glance."
      />
      {!isSupabaseConnected && (
        <DemoNotice>All figures come from sample demo data held in your browser.</DemoNotice>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total complaints"
          value={complaints.length}
          icon={ClipboardList}
          hint={isSupabaseConnected ? "Live database" : "Demo data"}
        />
        <StatCard
          label="Open"
          value={open.length}
          icon={Hourglass}
          hint={isSupabaseConnected ? "Live database" : "Demo data"}
        />
        <StatCard
          label="High priority open"
          value={open.filter((c) => c.priority === "High").length}
          icon={Flame}
          hint={isSupabaseConnected ? "Live database" : "Demo data"}
        />
        <StatCard
          label="Resolved"
          value={complaints.filter((c) => c.status === "Resolved").length}
          icon={CheckCircle2}
          hint={isSupabaseConnected ? "Live database" : "Demo data"}
        />
      </div>
      <AdminAlertsPanel />
      <div className="mt-5">
        <AnalyticsView compact />
      </div>
    </>
  );
}
