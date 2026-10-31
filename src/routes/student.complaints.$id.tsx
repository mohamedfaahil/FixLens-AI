import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel } from "@/components/fixlens/ui-bits";
import { ComplaintSummary } from "@/components/fixlens/ComplaintDetail";
import { MethodExplainer, PredictionCard } from "@/components/fixlens/PriorityPanel";
import { useDemoStore } from "@/lib/demo-store";
import { demoPredictPriority } from "@/lib/demo-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/student/complaints/$id")({
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  head: ({ params }) =>
    pageHead(`Complaint ${params.id}`, "Complaint details and status timeline."),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const { from } = Route.useSearch();
  const navigate = useNavigate();
  const { complaints, currentStudent } = useDemoStore();
  const c = complaints.find((x) => x.id === id);

  const isFromReport = from === "report";
  const back = (
    <Button
      variant="ghost"
      onClick={() => {
        if (isFromReport) {
          navigate({ to: "/student/report" });
        } else {
          navigate({ to: "/student/complaints" });
        }
      }}
      className="inline-flex items-center gap-1.5"
    >
      <ArrowLeft className="size-4" />
      {isFromReport ? "Back to report form" : "Back to list"}
    </Button>
  );

  if (!c)
    return (
      <>
        <div className="mb-4">{back}</div>
        <EmptyState
          title="Complaint not found"
          description={`Complaint reference "${id}" was not found in campus records.`}
        />
      </>
    );

  const isOwnComplaint =
    c.reporter.toLowerCase().trim() === currentStudent.name.toLowerCase().trim();
  const isSharedView = !isOwnComplaint;

  // Use saved ML prediction metadata if present; otherwise fall back to demoPredictPriority
  const hasSavedPrediction = c.isTrainedModel !== undefined;
  const pred = hasSavedPrediction
    ? {
        priority: c.predictedPriority ?? c.priority,
        signals: c.signals ?? [],
        source:
          c.predictionSource ??
          (c.isTrainedModel ? "Trained TF-IDF + Random Forest Model" : "Demo Fallback"),
        confidence: c.confidence,
        classProbabilities: c.classProbabilities,
        isTrainedModel: c.isTrainedModel,
      }
    : {
        ...demoPredictPriority(c),
        source: "Demo Prediction",
        confidence: undefined,
        classProbabilities: undefined,
        isTrainedModel: false,
      };

  return (
    <>
      <div className="mb-2">{back}</div>
      <PageHeader
        title={c.title}
        description={
          isSharedView
            ? "Viewing existing campus complaint (Read-only shared view)"
            : undefined
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel>
          <ComplaintSummary c={c} isSharedView={isSharedView} />
        </Panel>
        <div className="space-y-5">
          <PredictionCard
            priority={pred.priority}
            signals={pred.signals}
            source={pred.source}
            confidence={pred.confidence}
            classProbabilities={pred.classProbabilities}
            isTrainedModel={pred.isTrainedModel}
          />
          <Panel title="About priority prediction">
            <MethodExplainer />
          </Panel>
        </div>
      </div>
    </>
  );
}
