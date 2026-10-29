import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState, PageHeader, Panel, selectCls } from "@/components/fixlens/ui-bits";
import { ComplaintSummary } from "@/components/fixlens/ComplaintDetail";
import { PredictionCard } from "@/components/fixlens/PriorityPanel";
import { useDemoStore } from "@/lib/demo-store";
import {
  demoPredictPriority,
  PRIORITIES,
  STATUSES,
  type Priority,
  type Status,
} from "@/lib/demo-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/complaints/$id")({
  head: ({ params }) =>
    pageHead(`Manage ${params.id}`, "Update complaint status, priority and resolution notes."),
  component: AdminDetail,
});

function AdminDetail() {
  const { id } = Route.useParams();
  const { complaints, updateComplaint } = useDemoStore();
  const c = complaints.find((x) => x.id === id);
  const [status, setStatus] = useState<Status | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [note, setNote] = useState("");
  const back = (
    <Button variant="ghost" asChild>
      <Link to="/admin/complaints">
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

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    updateComplaint(c.id, { status: status || c.status, priority: priority || c.priority, note });
    setNote("");
    toast.success("Complaint updated (demo).");
  };

  return (
    <>
      <div className="mb-2">{back}</div>
      <PageHeader title={c.title} />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel>
          <ComplaintSummary c={c} />
        </Panel>
        <div className="space-y-5">
          <Panel title="Update complaint">
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="st">Status</Label>
                <select
                  id="st"
                  className={selectCls}
                  value={status || c.status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pr">Priority</Label>
                <select
                  id="pr"
                  className={selectCls}
                  value={priority || c.priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="note">Note to student</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Electrician scheduled for Thursday."
                />
              </div>
              <Button type="submit" className="w-full">
                Save changes
              </Button>
            </form>
          </Panel>
          <PredictionCard
            priority={pred.priority}
            signals={pred.signals}
            source={pred.source}
            confidence={pred.confidence}
            classProbabilities={pred.classProbabilities}
            isTrainedModel={pred.isTrainedModel}
          />
        </div>
      </div>
    </>
  );
}
