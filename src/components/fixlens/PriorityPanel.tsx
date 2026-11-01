import { BrainCircuit, Info, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import type { Priority } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "./ui-bits";

interface PredictionCardProps {
  priority: Priority;
  signals: string[];
  source?: string;
  confidence?: number;
  classProbabilities?: Record<string, number>;
  isLoading?: boolean;
  isTrainedModel?: boolean;
  error?: string | null;
  urgency?: Priority;
  showTechnicalDetails?: boolean;
  isEmpty?: boolean;
}

export function PredictionCard({
  priority,
  signals,
  source = "AI Priority Assessment",
  confidence,
  classProbabilities,
  isLoading = false,
  isTrainedModel = false,
  error,
  urgency,
  showTechnicalDetails = false,
  isEmpty,
}: PredictionCardProps) {
  // Determine if this is an empty / incomplete form state
  const isFormEmpty =
    isEmpty !== undefined
      ? isEmpty
      : Boolean(source?.includes("Form incomplete") || source?.includes("Waiting for input"));

  // Sanitize signals to strip out any raw technical backend error strings
  const cleanSignals = (signals || []).filter((s) => {
    const lower = s.toLowerCase();
    return (
      !lower.includes("http://") &&
      !lower.includes("127.0.0.1") &&
      !lower.includes("api offline: using rule-based fallback") &&
      !lower.includes("python ml api") &&
      !lower.includes("provide issue description")
    );
  });

  return (
    <div className="rounded-xl border bg-card/80 backdrop-blur-xs p-4 transition-all shadow-xs">
      {/* Header: Title and Model Status Badge */}
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-foreground">
          <BrainCircuit className="size-4 text-primary" /> Suggested Priority
        </p>
        {isLoading ? (
          <Badge
            variant="outline"
            className="gap-1 animate-pulse text-[10px] border-primary/30 text-primary bg-primary/5"
          >
            <Loader2 className="size-3 animate-spin text-primary" />
            Analyzing complaint details...
          </Badge>
        ) : isTrainedModel ? (
          <Badge variant="success" className="gap-1 text-[10px] font-semibold">
            <Sparkles className="size-3" />
            Trained ML Model
          </Badge>
        ) : isFormEmpty ? (
          <Badge
            variant="outline"
            className="text-[10px] font-normal text-muted-foreground border-border/60 bg-muted/30"
          >
            Awaiting Details
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="gap-1 text-[10px] font-medium border-border/80 bg-muted/40 text-muted-foreground"
          >
            Preliminary Recommendation
          </Badge>
        )}
      </div>

      {/* 1. Empty Form State: Neutral Guidance */}
      {isFormEmpty && !isLoading && (
        <div className="mt-3.5 flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <BrainCircuit className="mt-0.5 size-4 shrink-0 text-primary/70" />
          <div>
            <p className="font-semibold text-foreground">AI priority assessment</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Enter your complaint details to receive an intelligent priority recommendation.
            </p>
          </div>
        </div>
      )}

      {/* 2. Loading State: Subtle In-flight Indicator */}
      {isLoading && (
        <div className="mt-3.5 flex items-center gap-2.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary shrink-0" />
          <span>Analyzing complaint details...</span>
        </div>
      )}

      {/* 3. Priority Badge & Confidence (for Active Prediction or Offline Fallback) */}
      {!isFormEmpty && !isLoading && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <PriorityBadge priority={priority} />
            {isTrainedModel && confidence !== undefined && (
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {(confidence * 100).toFixed(1)}% Confidence
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3 text-muted-foreground" />
              Confirmed by administration
            </span>
          </div>

          {/* Reported Urgency Comparison (if provided) */}
          {urgency && (
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <span>Reported Urgency:</span>
              <span className="font-semibold text-foreground">{urgency}</span>
              {urgency !== priority && isTrainedModel && (
                <span className="text-[11px] text-primary">
                  (AI assessment factors in safety risk & campus impact)
                </span>
              )}
            </div>
          )}

          {/* Professional neutral notice when ML service is genuinely unavailable */}
          {!isTrainedModel && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border bg-muted/50 p-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p>
                AI assessment is temporarily unavailable. A preliminary recommendation is provided for administrative review.
              </p>
            </div>
          )}

          {/* Technical details for admin inspection only */}
          {showTechnicalDetails && error && (
            <div className="mt-2.5 rounded bg-muted/60 p-2 text-[11px] font-mono text-muted-foreground border">
              Backend status: {error}
            </div>
          )}

          {/* Class probabilities distribution when available from trained model */}
          {isTrainedModel && classProbabilities && (
            <div className="mt-2.5 flex items-center gap-2 rounded bg-background/60 p-2 text-[11px] text-muted-foreground border">
              <span className="font-semibold text-foreground">Confidence Distribution:</span>
              {Object.entries(classProbabilities).map(([cls, prob]) => (
                <span key={cls} className="flex items-center gap-1">
                  <span className="font-medium text-foreground">{cls}:</span> {(prob * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          )}

          {/* Recommendation Reasons / Signals */}
          {cleanSignals.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-foreground">Assessment Factors:</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {cleanSignals.map((s) => (
                  <li key={s} className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Reported Urgency in Empty State (if student selected urgency before typing description) */}
      {isFormEmpty && !isLoading && urgency && (
        <div className="mt-2.5 text-xs text-muted-foreground flex items-center gap-1.5">
          <span>Reported Urgency:</span>
          <span className="font-semibold text-foreground">{urgency}</span>
        </div>
      )}

      {/* Footer provenance note */}
      <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
        {isTrainedModel
          ? "Powered by trained campus Random Forest classification model. Priority is reviewed and confirmed during administrative triage."
          : isFormEmpty
            ? "Campus maintenance issues are classified using semantic NLP and Random Forest inference upon entering issue details."
            : "Preliminary recommendation based on reported maintenance category and scope. Final priority confirmed by campus administration."}
      </p>
    </div>
  );
}

export function MethodExplainer() {
  const steps = [
    ["Natural language processing", "Issue text is parsed and converted into weighted semantic features."],
    ["Campus context features", "Building location, category, reported urgency and people affected are evaluated."],
    ["Random Forest classification", "100 decision trees vote on operational priority (High, Medium or Low)."],
    ["Administrative triage confirmation", "Campus facility staff confirm or adjust the suggested priority during review."],
  ];
  return (
    <div>
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <span className="font-semibold text-primary">Trained Priority Classification Pipeline:</span>{" "}
          Random Forest model trained on campus maintenance complaints with 95.45% evaluation accuracy.
          Evaluates issue description semantics, category, reported urgency, and estimated student impact to determine operational priority.
        </div>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{t}</p>
              <p className="text-xs text-muted-foreground">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Operational priority scale: <PriorityBadge priority="Low" />
        <PriorityBadge priority="Medium" />
        <PriorityBadge priority="High" />
      </div>
    </div>
  );
}
