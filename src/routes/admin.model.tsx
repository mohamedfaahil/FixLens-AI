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
  { t: "Demo keyword rule in place of the model", done: true },
  { t: "Labeled dataset prepared", done: false },
  { t: "Model trained and evaluated (accuracy, precision, recall, F1)", done: false },
  { t: "Prediction service connected", done: false },
];

const metrics = ["Accuracy", "Precision", "Recall", "F1-score"];

function Model() {
  return (
    <>
      <PageHeader
        title="AI priority model"
        description="The planned machine-learning pipeline behind priority suggestions."
      />
      <DemoNotice>
        No model is trained yet. Results below stay empty until real evaluation is done — no
        performance is claimed.
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
        <Panel title="Evaluation results">
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((m) => (
              <div key={m} className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">{m}</p>
                <p className="mt-1 text-2xl font-bold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground">Not measured yet</p>
              </div>
            ))}
          </div>
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
      <Panel className="mt-5" title="About the current demo rule">
        <MethodExplainer />
      </Panel>
    </>
  );
}
