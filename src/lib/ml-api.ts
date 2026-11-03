import { type Priority, demoPredictPriority } from "./demo-data";

const isTestMode =
  typeof process !== "undefined" &&
  (process.env.NODE_ENV === "test" || process.env.VITEST === "true");

let hasWarmedUp = false;

export const DEFAULT_CLOUD_ML_URL = "https://fixlens-ml-api.onrender.com";

/**
 * Resolves the active ML API base URL.
 * 1. If VITE_ML_API_URL is configured (in .env or Vercel Environment Variables), use it (trimmed, no trailing slash).
 * 2. In production or development without explicit config, defaults to the live Render ML endpoint.
 */
const configuredEnvUrl = (import.meta.env.VITE_ML_API_URL as string | undefined)?.trim();

export const IS_ML_API_CONFIGURED = true;

export const ML_API_BASE_URL = configuredEnvUrl
  ? configuredEnvUrl.replace(/\/+$/, "")
  : DEFAULT_CLOUD_ML_URL;

/**
 * Fires an early background GET /health ping to the ML API
 * to wake up Render free-tier instances as soon as the user opens the report form.
 */
export function warmupMLService(): void {
  if (hasWarmedUp) return;
  hasWarmedUp = true;
  try {
    const urls = Array.from(new Set([ML_API_BASE_URL, DEFAULT_CLOUD_ML_URL])).filter(Boolean);
    urls.forEach((u) => {
      fetch(`${u}/health`, { method: "GET" }).catch(() => {
        // Ignored: early background ping
      });
    });
  } catch {
    // Ignored
  }
}

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
      source: "Preliminary Rule-Based Recommendation",
      signals: fallback.signals.filter(
        (s) =>
          !s.toLowerCase().includes("fallback") &&
          !s.toLowerCase().includes("offline") &&
          !s.includes("http://"),
      ),
      isTrainedModel: false,
      error: errorMsg,
    };
  }

  const normalizedCategory = input.category?.trim() || "Other";
  const normalizedUrgency =
    input.urgency && ["High", "Medium", "Low"].includes(input.urgency)
      ? input.urgency
      : "Medium";
  const normalizedAffected = Math.max(1, Math.min(10000, Number(input.affected) || 1));

  const postPayload = JSON.stringify({
    description: desc,
    category: normalizedCategory,
    urgency: normalizedUrgency,
    affected: normalizedAffected,
  });

  const sendRequest = async (baseUrl: string, timeoutMs: number): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${baseUrl}/predict-priority`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: postPayload,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let res: Response;
    let activeUrl = ML_API_BASE_URL;

    try {
      // First attempt: 15s timeout (completes instantly if Render instance is warm)
      res = await sendRequest(activeUrl, 15000);
    } catch (phase1Err: any) {
      if (!isTestMode) {
        // If local dev server was unreachable, seamlessly fail over to live Render cloud endpoint
        const isLocal = activeUrl.includes("127.0.0.1") || activeUrl.includes("localhost");
        if (isLocal && DEFAULT_CLOUD_ML_URL) {
          activeUrl = DEFAULT_CLOUD_ML_URL;
        }
        // Cold start recovery / failover: wait 1s and retry with 30s timeout
        await new Promise((resolve) => setTimeout(resolve, 1000));
        res = await sendRequest(activeUrl, 30000);
      } else {
        throw phase1Err;
      }
    }

    // If Render cold-start gateway returned 502/503/504 during boot, retry once
    if (!res.ok && [502, 503, 504].includes(res.status) && !isTestMode) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      res = await sendRequest(activeUrl, 25000);
    }

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
    // Graceful fallback to preliminary heuristic when backend API is offline
    const fallback = demoPredictPriority({
      description: desc,
      category: normalizedCategory,
      urgency: normalizedUrgency,
      affected: normalizedAffected,
    });
    const isTimeout = err?.name === "AbortError";
    const errorMsg = isTimeout
      ? "AI assessment timed out while service was waking up"
      : `Python ML API service offline or unreachable at ${ML_API_BASE_URL || "configured URL"}`;

    return {
      priority: fallback.priority,
      source: "Preliminary Rule-Based Recommendation",
      signals: fallback.signals.filter(
        (s) =>
          !s.toLowerCase().includes("fallback") &&
          !s.toLowerCase().includes("offline") &&
          !s.includes("http://"),
      ),
      isTrainedModel: false,
      error: errorMsg,
    };
  }
}
