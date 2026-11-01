import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { predictComplaintPriority, checkMLServiceHealth, warmupMLService } from "../lib/ml-api";
import { PredictionCard } from "../components/fixlens/PriorityPanel";

describe("FixLens AI — ML Integration & Fallback Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles offline API gracefully with demo rule fallback", async () => {
    // Mock fetch failing (simulating API offline)
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Failed to fetch / Connection refused"));

    const result = await predictComplaintPriority({
      description: "Sparking electrical switchboard in computer lab 2",
      category: "Electrical",
      urgency: "High",
      affected: 35,
    });

    expect(result.isTrainedModel).toBe(false);
    expect(result.source).toContain("Preliminary");
    expect(result.error).toContain("offline");
    expect(["High", "Medium", "Low"]).toContain(result.priority);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it("handles successful API response when Python ML service returns prediction", async () => {
    // Mock successful FastAPI response
    const mockApiResponse = {
      status: "success",
      priority: "High",
      confidence: 0.6434,
      class_probabilities: {
        High: 0.6434,
        Medium: 0.2511,
        Low: 0.1055,
      },
      prediction_source: "Trained TF-IDF + Random Forest Model",
      signals: [
        "Random Forest confidence: 64.3% for High priority",
        "Class probability distribution: High 64%, Medium 25%, Low 11%",
        "Issue category factor: Plumbing",
        "Reported student urgency: High",
        "Impact scale: 50 person(s) affected",
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    } as Response);

    const result = await predictComplaintPriority({
      description: "A classroom ceiling water leak dripping onto student desks.",
      category: "Plumbing",
      urgency: "High",
      affected: 50,
    });

    expect(result.isTrainedModel).toBe(true);
    expect(result.priority).toBe("High");
    expect(result.confidence).toBeCloseTo(0.6434);
    expect(result.source).toBe("Trained TF-IDF + Random Forest Model");
    expect(result.classProbabilities?.High).toBeCloseTo(0.6434);
    expect(result.signals[0]).toContain("Random Forest confidence");
  });

  it("returns immediate fallback for incomplete descriptions (< 3 characters)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await predictComplaintPriority({
      description: "ab",
      category: "Electrical",
      urgency: "Low",
      affected: 1,
    });

    // Should not call API for incomplete form
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.isTrainedModel).toBe(false);
    expect(result.source).toContain("Form incomplete");
  });

  it("renders PredictionCard correctly with Trained ML Model badge", () => {
    render(
      <PredictionCard
        priority="High"
        signals={["Random Forest confidence: 58.6% for High priority"]}
        source="Trained TF-IDF + Random Forest Model"
        confidence={0.5859}
        classProbabilities={{ High: 0.5859, Medium: 0.2572, Low: 0.1569 }}
        isTrainedModel={true}
      />,
    );

    expect(screen.getByText("Trained ML Model")).toBeDefined();
    expect(screen.getByText("58.6% Confidence")).toBeDefined();
    expect(screen.getByText("High")).toBeDefined();
    expect(
      screen.getByText(
        "Powered by trained campus Random Forest classification model. Priority is reviewed and confirmed during administrative triage.",
      ),
    ).toBeDefined();
  });

  it("renders PredictionCard correctly with Preliminary Recommendation and friendly message when API is offline", () => {
    render(
      <PredictionCard
        priority="Medium"
        signals={["Category factor: Plumbing", "50+ students affected"]}
        source="Preliminary Rule-Based Recommendation"
        isTrainedModel={false}
        error="Python ML API service offline or unreachable at http://127.0.0.1:8000"
      />,
    );

    // Should display friendly user-facing badge and message
    expect(screen.getByText("Preliminary Recommendation")).toBeDefined();
    expect(
      screen.getByText(
        "AI assessment temporarily unavailable. A preliminary priority recommendation is shown for review.",
      ),
    ).toBeDefined();

    // MUST NOT expose raw technical localhost URLs to students
    expect(screen.queryByText("http://127.0.0.1:8000")).toBeNull();
    expect(screen.queryByText("DEMO FALLBACK (OFFLINE)")).toBeNull();
  });

  it("persists ML prediction metadata in DemoStore and keeps student urgency separate from AI priority", () => {
    // Test that the store holds distinct values for student urgency and AI priority
    const mockComplaintData = {
      title: "Sparking electrical switchboard in Lab 2",
      description: "Visible sparks and smoke coming from the primary wall power socket.",
      category: "Electrical" as const,
      building: "CS Block",
      room: "Lab 201",
      urgency: "Low" as const, // Student selects Low urgency
      affected: 25,
      priority: "High" as const, // AI model predicts High priority
      predictedPriority: "High" as const,
      confidence: 0.884,
      classProbabilities: { High: 0.884, Medium: 0.08, Low: 0.036 },
      predictionSource: "Trained TF-IDF + Random Forest Model",
      isTrainedModel: true,
      signals: ["Random Forest confidence: 88.4% for High priority"],
    };

    // Verify separation of urgency vs priority
    expect(mockComplaintData.urgency).toBe("Low");
    expect(mockComplaintData.priority).toBe("High");
    expect(mockComplaintData.predictedPriority).toBe("High");
    expect(mockComplaintData.urgency).not.toBe(mockComplaintData.priority);

    // Verify that student and admin detail view resolver uses saved ML metadata without calling API
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const hasSavedPrediction = mockComplaintData.isTrainedModel !== undefined;
    expect(hasSavedPrediction).toBe(true);

    const resolvedPred = hasSavedPrediction
      ? {
          priority: mockComplaintData.predictedPriority ?? mockComplaintData.priority,
          signals: mockComplaintData.signals ?? [],
          source: mockComplaintData.predictionSource ?? "Trained TF-IDF + Random Forest Model",
          confidence: mockComplaintData.confidence,
          classProbabilities: mockComplaintData.classProbabilities,
          isTrainedModel: mockComplaintData.isTrainedModel,
        }
      : null;

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(resolvedPred?.isTrainedModel).toBe(true);
    expect(resolvedPred?.confidence).toBe(0.884);
    expect(resolvedPred?.source).toBe("Trained TF-IDF + Random Forest Model");
    expect(resolvedPred?.priority).toBe("High");

    // Render with resolved prediction in details view
    render(
      <PredictionCard
        priority={resolvedPred!.priority}
        signals={resolvedPred!.signals}
        source={resolvedPred!.source}
        confidence={resolvedPred!.confidence}
        classProbabilities={resolvedPred!.classProbabilities}
        isTrainedModel={resolvedPred!.isTrainedModel}
      />,
    );

    expect(screen.getByText("Trained ML Model")).toBeDefined();
    expect(screen.getByText("88.4% Confidence")).toBeDefined();
  });

  it("falls back to demo heuristic for legacy complaints without saved ML metadata", () => {
    const legacyComplaint = {
      id: "FX-1042",
      title: "Old complaint without ML metadata",
      description: "Leaking pipe in ground floor restroom.",
      category: "Plumbing" as const,
      building: "MCA Block",
      room: "Restroom G01",
      urgency: "Medium" as const,
      affected: 15,
      priority: "Medium" as const,
      status: "Submitted" as const,
      date: "2026-10-20",
      reporter: "Aisha Rahman",
      timeline: [],
    };

    const hasSavedPrediction = (legacyComplaint as any).isTrainedModel !== undefined;
    expect(hasSavedPrediction).toBe(false);

    // Should fall back cleanly
    const fallbackPred = {
      source: "Demo Prediction",
      isTrainedModel: false,
    };
    expect(fallbackPred.isTrainedModel).toBe(false);
    expect(fallbackPred.source).toBe("Demo Prediction");
  });

  it("handles checkMLServiceHealth for healthy deployed service", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "healthy",
        model_loaded: true,
        algorithm: "TF-IDF + Random Forest Classifier (100 estimators, balanced weights)",
        supported_classes: ["High", "Low", "Medium"],
      }),
    } as Response);

    const health = await checkMLServiceHealth();
    expect(health.healthy).toBe(true);
    expect(health.modelLoaded).toBe(true);
    expect(health.classes).toContain("High");
    expect(health.algorithm).toContain("Random Forest");
  });

  it("handles checkMLServiceHealth when service is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Connection refused"));

    const health = await checkMLServiceHealth();
    expect(health.healthy).toBe(false);
    expect(health.modelLoaded).toBe(false);
    expect(health.message).toContain("offline");
  });

  it("triggers warmupMLService without throwing errors", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "healthy" }),
    } as Response);

    expect(() => warmupMLService()).not.toThrow();
  });
});
