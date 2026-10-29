import { type Priority, demoPredictPriority } from "./demo-data";

export interface MLPredictionResult {
  priority: Priority;
  confidence?: number;
  classProbabilities?: Record<string, number>;
  source: string;
  signals: string[];
  isTrainedModel: boolean;
  error?: string | null;
}

export const ML_API_BASE_URL =
  (import.meta.env.VITE_ML_API_URL as string) || "http://127.0.0.1:8000";

/**
 * Checks if the FastAPI Random Forest service is online and healthy.
 */
export async function checkMLServiceHealth(): Promise<{
  healthy: boolean;
  modelLoaded: boolean;
  algorithm?: string;
  classes?: string[];
  message: string;
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${ML_API_BASE_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        healthy: false,
        modelLoaded: false,
        message: `Backend API responded with status ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      healthy: data.status === "healthy",
      modelLoaded: Boolean(data.model_loaded),
      algorithm: data.algorithm,
      classes: data.supported_classes,
      message: data.status === "healthy" ? "Service operational" : "Model degraded",
    };
  } catch (err: any) {
    return {
      healthy: false,
      modelLoaded: false,
      message: err?.name === "AbortError" ? "Health check timed out" : "API service offline",
    };
  }
}

/**
 * Sends complaint features to the FastAPI ML backend service for Random Forest inference.
 * Falls back transparently to the honest demo rule if the service is unreachable.
 */
export async function predictComplaintPriority(input: {
  description: string;
  category: string;
  urgency: Priority;
  affected: number;
}): Promise<MLPredictionResult> {
  const desc = input.description.trim();

  // If description is empty or too short, return fallback immediately
  if (desc.length < 3) {
    const fallback = demoPredictPriority(input);
    return {
      priority: fallback.priority,
      source: "Demo Heuristic (Form incomplete)",
      signals: fallback.signals,
      isTrainedModel: false,
      error: null,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${ML_API_BASE_URL}/predict-priority`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: desc,
        category: input.category || "Other",
        urgency: input.urgency,
        affected: Math.max(1, Math.min(5000, Number(input.affected) || 1)),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`API responded with status code ${res.status}`);
    }

    const data = await res.json();
    return {
      priority: data.priority as Priority,
      confidence: data.confidence,
      classProbabilities: data.class_probabilities,
      source: data.prediction_source || "Trained TF-IDF + Random Forest Model",
      signals: Array.isArray(data.signals) ? data.signals : [],
      isTrainedModel: true,
      error: null,
    };
  } catch (err: any) {
    // Graceful fallback to demo heuristic when backend API is offline
    const fallback = demoPredictPriority(input);
    const isTimeout = err?.name === "AbortError";
    const errorMsg = isTimeout
      ? "API inference request timed out (>4s)"
      : "Python ML API service offline or unreachable at " + ML_API_BASE_URL;

    return {
      priority: fallback.priority,
      source: "Demo Heuristic (API Offline)",
      signals: [
        `API offline: Using rule-based fallback (${errorMsg})`,
        ...fallback.signals,
      ],
      isTrainedModel: false,
      error: errorMsg,
    };
  }
}
