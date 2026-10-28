import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/fixlens/ui-bits";
import { AnalyticsView } from "@/components/fixlens/AnalyticsView";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/analytics")({
  head: () => pageHead("Analytics", "Complaint trends by category, location and recurring issues."),
  component: () => (
    <>
      <PageHeader
        title="Analytics"
        description="Trends, hotspots and recurring issues across campus."
      />
      <AnalyticsView />
    </>
  ),
});
