import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel } from "@/components/fixlens/ui-bits";
import { ComplaintSummary } from "@/components/fixlens/ComplaintDetail";
import { MethodExplainer, PredictionCard } from "@/components/fixlens/PriorityPanel";
import { useDemoStore } from "@/lib/demo-store";
import { demoPredictPriority } from "@/lib/demo-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/student/complaints/$id")({
  head: ({ params }) =>
    pageHead(`Complaint ${params.id}`, "Complaint details and status timeline."),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const c = useDemoStore().complaints.find((x) => x.id === id);
  const back = (
    <Button variant="ghost" asChild>
      <Link to="/student/complaints">
        <ArrowLeft /> Back to list
      </Link>
    </Button>
  );
  if (!c)
    return (
      <>
        <div className="mb-4">{back}</div>
        <EmptyState
          title="Complaint not found"
          description="Demo complaints you add disappear after a page refresh."
        />
      </>
    );
  const pred = demoPredictPriority(c);
  return (
    <>
      <div className="mb-2">{back}</div>
      <PageHeader title={c.title} />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel>
          <ComplaintSummary c={c} />
        </Panel>
        <div className="space-y-5">
          <PredictionCard priority={pred.priority} signals={pred.signals} />
          <Panel title="About priority prediction">
            <MethodExplainer />
          </Panel>
        </div>
      </div>
    </>
  );
}
