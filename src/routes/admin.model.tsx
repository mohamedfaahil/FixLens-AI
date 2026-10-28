import { createFileRoute } from "@tanstack/react-router";
import { Brain, CheckCircle2, Circle, Database, FileText, Server, Sigma } from "lucide-react";
import { DemoNotice, PageHeader, Panel } from "@/components/fixlens/ui-bits";
import { MethodExplainer } from "@/components/fixlens/PriorityPanel";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/model")({
  head: () =>
    pageHead(
      "AI Priority Model",
      "How FixLens AI predicts complaint priority with TF-IDF and Random Forest.",
    ),
  component: Model,
});

const steps = [
  {
    icon: Database,
    t: "Labeled complaints",
    d: "Collect past complaints with verified Low / Medium / High labels and check label quality.",
  },
  {
    icon: FileText,
    t: "Text cleaning",
    d: "Lowercase, remove punctuation and stop-words from complaint descriptions.",
  },
  {
    icon: Sigma,
    t: "TF-IDF features",
    d: "Convert text to numeric features, combined with category, urgency and people affected.",
  },
  {
    icon: Brain,
    t: "Random Forest",
    d: "Train the classifier and evaluate it on held-out data it has never seen.",
  },
  {
    icon: Server,
    t: "Serve predictions",
    d: "Save the fitted pipeline and return predictions from the backend for staff review.",
  },
];

const checklist = [
  { t: "UI shows suggested priority for staff review", done: true },
  { t: "Demo keyword rule active in browser frontend prototype", done: true },
  { t: "Labeled dataset prepared (108 campus complaints across categories)", done: true },
  {
    t: "TF-IDF + Random Forest model trained and evaluated in Python (95.45% accuracy)",
    done: true,
  },
  { t: "Real-time prediction API connected to production backend", done: false },
];

const evaluatedMetrics = [
  { name: "Accuracy", value: "95.5%", note: "Overall test set accuracy" },
  { name: "Macro Precision", value: "95.8%", note: "Balanced across priority tiers" },
  { name: "Macro Recall", value: "95.8%", note: "High sensitivity on emergencies" },
  { name: "Macro F1-Score", value: "95.6%", note: "Harmonic mean of precision/recall" },
];

function Model() {
  return (
    <>
      <PageHeader
        title="AI priority model"
        description="The machine-learning pipeline behind priority classification."
      />
      <DemoNotice>
        The browser frontend runs an explainable demo rule. The verified TF-IDF + Random Forest
        model has been evaluated separately in Python (<code>ml/train_priority_model.py</code>) and
        is ready for backend API connection.
      </DemoNotice>
      <Panel className="mt-5" title="Pipeline">
        <ol className="grid gap-3 md:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.t} className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-primary">
                <s.icon className="size-4" />
                <span className="text-xs font-bold">STEP {i + 1}</span>
              </div>
              <p className="mt-2 font-semibold text-foreground">{s.t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </Panel>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Standalone Model Evaluation (Held-out Test Set)">
          <div className="grid grid-cols-2 gap-3">
            {evaluatedMetrics.map((m) => (
              <div key={m.name} className="rounded-lg border p-4 bg-accent/20">
                <p className="text-xs font-medium text-muted-foreground">{m.name}</p>
                <p className="mt-1 text-2xl font-extrabold text-primary">{m.value}</p>
                <p className="text-[11px] text-muted-foreground">{m.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground border-t pt-2">
            Evaluated on held-out test data in <code>ml/evaluation_results.json</code> with 100-tree
            balanced Random Forest.
          </p>
        </Panel>
        <Panel title="Progress">
          <ul className="space-y-3">
            {checklist.map((c) => (
              <li key={c.t} className="flex items-start gap-2 text-sm">
                {c.done ? (
                  <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                ) : (
                  <Circle className="mt-0.5 size-4 text-muted-foreground" />
                )}
                <span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.t}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel className="mt-5" title="About the current frontend demo rule">
        <MethodExplainer />
      </Panel>
    </>
  );
}
