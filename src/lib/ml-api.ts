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

/**
 * Resolves the active ML API base URL.
 * 1. If VITE_ML_API_URL is configured (in .env or Vercel Environment Variables), use it (trimmed, no trailing slash).
 * 2. In local development or testing (import.meta.env.DEV), default to local FastAPI server: http://127.0.0.1:8000.
 * 3. In production, if VITE_ML_API_URL is not set, we do not point to localhost (which fails on client browsers).
 */
const configuredEnvUrl = (import.meta.env.VITE_ML_API_URL as string | undefined)?.trim();

export const IS_ML_API_CONFIGURED = Boolean(configuredEnvUrl) || Boolean(import.meta.env.DEV);

export const ML_API_BASE_URL = configuredEnvUrl
  ? configuredEnvUrl.replace(/\/+$/, "")
  : import.meta.env.DEV
    ? "http://127.0.0.1:8000"
    : "";

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
  if (!ML_API_BASE_URL) {
    return {
      healthy: false,
      modelLoaded: false,
      message:
        "VITE_ML_API_URL not configured. Add your Render service URL in Vercel project environment variables.",
    };
  }

  try {
    const controller = new AbortController();
    // Allow up to 10 seconds for health check to account for Render free-tier cold-start
    const timer = setTimeout(() => controller.abort(), 10000);
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
      message:
        err?.name === "AbortError"
          ? "Health check timed out (service waking up or unreachable)"
          : `Python ML API service offline or unreachable at ${ML_API_BASE_URL}`,
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

  // If not configured in production, return fallback with actionable guidance
  if (!ML_API_BASE_URL) {
    const fallback = demoPredictPriority(input);
    const errorMsg =
      "Python ML API service offline (VITE_ML_API_URL environment variable is not configured on Vercel)";
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

  try {
    const controller = new AbortController();
    // Allow up to 12s to accommodate Render free tier spin-up
    const timer = setTimeout(() => controller.abort(), 12000);

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
      ? "API inference request timed out (>12s) — Render service may be waking up from cold start"
      : `Python ML API service offline or unreachable at ${ML_API_BASE_URL}`;

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
