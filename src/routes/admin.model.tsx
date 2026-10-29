import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, CheckCircle2, Circle, Database, FileText, Server, Sigma, Activity, RefreshCw } from "lucide-react";
import { DemoNotice, PageHeader, Panel } from "@/components/fixlens/ui-bits";
import { MethodExplainer } from "@/components/fixlens/PriorityPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { checkMLServiceHealth, ML_API_BASE_URL } from "@/lib/ml-api";
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
  { t: "UI shows suggested priority for staff review across student and admin queues", done: true },
  { t: "Honest demo keyword heuristic fallback active in frontend prototype when offline", done: true },
  { t: "Decoupled dataset curated (120 campus complaints across categories in ml/dataset.csv)", done: true },
  {
    t: "TF-IDF + Random Forest pipeline trained and evaluated (75.0% accuracy on held-out split in ml/priority_model.joblib)",
    done: true,
  },
  {
    t: "FastAPI inference service implemented (backend/main.py) with GET /health and POST /predict-priority",
    done: true,
  },
  {
    t: "Frontend complaint form wired to Python prediction API with loading indicator and fallback",
    done: true,
  },
];

const evaluatedMetrics = [
  { name: "Accuracy", value: "75.0%", note: "Overall held-out test split accuracy" },
  { name: "Macro Precision", value: "75.0%", note: "Balanced across decoupled priority tiers" },
  { name: "Macro Recall", value: "75.0%", note: "High sensitivity on true emergencies" },
  { name: "Macro F1-Score", value: "73.8%", note: "Harmonic mean of precision/recall" },
];

function Model() {
  const [health, setHealth] = useState<{
    loading: boolean;
    healthy: boolean;
    modelLoaded: boolean;
    classes?: string[];
    algorithm?: string;
    message: string;
  }>({
    loading: true,
    healthy: false,
    modelLoaded: false,
    message: "Checking service...",
  });

  const checkStatus = () => {
    setHealth((prev) => ({ ...prev, loading: true }));
    checkMLServiceHealth().then((res) => {
      setHealth({
        loading: false,
        healthy: res.healthy,
        modelLoaded: res.modelLoaded,
        classes: res.classes,
        algorithm: res.algorithm,
        message: res.message,
      });
    });
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <>
      <PageHeader
        title="AI priority model"
        description="The machine-learning pipeline behind priority classification."
      />
      <DemoNotice>
        The FixLens AI complaint submission form queries the local FastAPI prediction service at{" "}
        <code>{ML_API_BASE_URL}</code>. When the service is active, predictions are computed in real time by
        the trained Random Forest pipeline (<code>ml/priority_model.joblib</code>). If offline, a rule-based
        fallback is used transparently.
      </DemoNotice>

      {/* Live API Health Status Card */}
      <Panel className="mt-5" title="Inference Service Status (FastAPI Backend)">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`size-3 rounded-full ${health.healthy ? "bg-success animate-pulse" : "bg-warning"}`}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {health.healthy ? "Python ML Service Operational" : "Service Offline / Unreachable"}
                </span>
                <Badge variant={health.healthy ? "success" : "demo"}>
                  {health.healthy ? "Port 8000 Active" : "Using Fallback"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target endpoint: <code>{ML_API_BASE_URL}/predict-priority</code> — {health.message}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={checkStatus} disabled={health.loading}>
            <RefreshCw className={`mr-1.5 size-3.5 ${health.loading ? "animate-spin" : ""}`} />
            Recheck API
          </Button>
        </div>

        {!health.healthy && (
          <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground border">
            <p className="font-medium text-foreground">How to start the Python ML API service:</p>
            <pre className="mt-1.5 overflow-x-auto rounded bg-background p-2 font-mono text-[11px] text-foreground">
              uvicorn backend.main:app --port 8000 --reload
            </pre>
            <p className="mt-1 text-[11px]">
              Or run: <code>python backend/main.py</code>. Once started, click "Recheck API" above to verify.
            </p>
          </div>
        )}
      </Panel>

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
        <Panel title="Trained Model Evaluation (Held-out Test Set)">
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
        <Panel title="Implementation & Integration Progress">
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
      <Panel className="mt-5" title="Model Architecture & Verification">
        <MethodExplainer />
      </Panel>
    </>
  );
}
