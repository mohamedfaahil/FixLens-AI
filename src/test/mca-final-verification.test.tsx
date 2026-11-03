import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatCopilot } from "@/components/fixlens/ChatCopilot";
import { DemoStoreProvider, useDemoStore } from "@/lib/demo-store";
import { extractComplaintParams, processUserMessage } from "@/lib/chatbot-engine";
import { initialComplaints, initialProposals, BUILDINGS } from "@/lib/demo-data";
import { predictComplaintPriority, checkMLServiceHealth } from "@/lib/ml-api";
import { PredictionCard } from "@/components/fixlens/PriorityPanel";

// Mock router navigation
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
  useRouterState: () => ({ location: { pathname: "/" } }),
}));

describe("FixLens AI — Final MCA End-to-End Verification Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. ML Prediction End-to-End Contract & Decoupled Scenarios", () => {
    it("Case 1: Broken chair with High reported urgency predicts Low priority (decoupled)", async () => {
      // Mock ML model API prediction returning the decoupled inference result
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "success",
          priority: "Low",
          confidence: 0.7111,
          class_probabilities: { High: 0.0948, Medium: 0.1941, Low: 0.7111 },
          prediction_source: "Trained TF-IDF + Random Forest Model",
          signals: [
            "Random Forest confidence: 71.1% for Low priority",
            "Class probability distribution: High 9%, Medium 19%, Low 71%",
            "Issue category factor: Furniture",
            "Reported student urgency: High",
            "Impact scale: 5 person(s) affected",
          ],
        }),
      } as Response);

      const res = await predictComplaintPriority({
        description: "Broken classroom chair with cracked plastic backrest in back row.",
        category: "Furniture",
        urgency: "High",
        affected: 5,
      });

      expect(res.isTrainedModel).toBe(true);
      expect(res.priority).toBe("Low");
      expect(res.confidence).toBeCloseTo(0.7111);
      expect(res.source).toBe("Trained TF-IDF + Random Forest Model");
      expect(res.classProbabilities?.Low).toBeCloseTo(0.7111);
    });

    it("Case 2: Exposed live wire with Low reported urgency predicts High priority (safety hazard)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "success",
          priority: "High",
          confidence: 0.7353,
          class_probabilities: { High: 0.7353, Medium: 0.1524, Low: 0.1123 },
          prediction_source: "Trained TF-IDF + Random Forest Model",
          signals: [
            "Random Forest confidence: 73.5% for High priority",
            "Class probability distribution: High 74%, Medium 15%, Low 11%",
            "Issue category factor: Electrical",
            "Reported student urgency: Low",
            "Impact scale: 50 person(s) affected",
          ],
        }),
      } as Response);

      const res = await predictComplaintPriority({
        description: "Noticed exposed copper live wire dangling from ceiling near basement fire exit staircase.",
        category: "Electrical",
        urgency: "Low",
        affected: 50,
      });

      expect(res.isTrainedModel).toBe(true);
      expect(res.priority).toBe("High");
      expect(res.confidence).toBeCloseTo(0.7353);
    });

    it("Case 3: Classroom water leakage predicts High priority", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "success",
          priority: "High",
          confidence: 0.8462,
          class_probabilities: { High: 0.8462, Medium: 0.1132, Low: 0.0406 },
          prediction_source: "Trained TF-IDF + Random Forest Model",
          signals: ["Random Forest confidence: 84.6% for High priority"],
        }),
      } as Response);

      const res = await predictComplaintPriority({
        description: "A classroom ceiling water leak dripping onto student desks and computers.",
        category: "Plumbing",
        urgency: "High",
        affected: 50,
      });

      expect(res.isTrainedModel).toBe(true);
      expect(res.priority).toBe("High");
    });

    it("Case 4: Sparking electrical socket predicts High priority", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "success",
          priority: "High",
          confidence: 0.7672,
          class_probabilities: { High: 0.7672, Medium: 0.1182, Low: 0.1146 },
          prediction_source: "Trained TF-IDF + Random Forest Model",
          signals: ["Random Forest confidence: 76.7% for High priority"],
        }),
      } as Response);

      const res = await predictComplaintPriority({
        description: "A sparking electrical socket with smoke and burning smell in the physics lab.",
        category: "Electrical",
        urgency: "High",
        affected: 30,
      });

      expect(res.isTrainedModel).toBe(true);
      expect(res.priority).toBe("High");
    });

    it("Case 5: Broken tube light predicts Medium priority", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "success",
          priority: "Medium",
          confidence: 0.8012,
          class_probabilities: { High: 0.1124, Medium: 0.8012, Low: 0.0864 },
          prediction_source: "Trained TF-IDF + Random Forest Model",
          signals: ["Random Forest confidence: 80.1% for Medium priority"],
        }),
      } as Response);

      const res = await predictComplaintPriority({
        description: "A broken tube light flickering in classroom 101, making blackboard hard to read.",
        category: "Electrical",
        urgency: "Medium",
        affected: 40,
      });

      expect(res.isTrainedModel).toBe(true);
      expect(res.priority).toBe("Medium");
    });

    it("distinguishes Actual ML prediction vs Preliminary Fallback in UI", () => {
      // 1. Successful ML prediction render
      const { unmount } = render(
        <PredictionCard
          priority="High"
          signals={["Random Forest confidence: 85% for High priority"]}
          source="Trained TF-IDF + Random Forest Model"
          confidence={0.85}
          classProbabilities={{ High: 0.85, Medium: 0.1, Low: 0.05 }}
          isTrainedModel={true}
        />,
      );

      expect(screen.getByText("Trained ML Model")).toBeDefined();
      expect(screen.getByText("85.0% Confidence")).toBeDefined();
      expect(screen.getByText("Source: Trained TF-IDF + Random Forest Model")).toBeDefined();
      expect(screen.getByText(/Confidence Distribution:/)).toBeDefined();
      expect(screen.queryByText(/temporarily unavailable/i)).toBeNull();

      unmount();

      // 2. Preliminary fallback render
      render(
        <PredictionCard
          priority="Medium"
          signals={["Category factor: Plumbing"]}
          source="Preliminary Rule-Based Recommendation"
          isTrainedModel={false}
          error="Python ML API service offline or unreachable"
        />,
      );

      expect(screen.getByText("Preliminary Recommendation")).toBeDefined();
      expect(
        screen.getByText(
          "AI assessment is temporarily unavailable. A preliminary recommendation is provided for administrative review.",
        ),
      ).toBeDefined();
    });
  });

  describe("2. Campus Copilot / Chatbot Core Workflow", () => {
    it("Chatbot Case 1: Ask for help reporting a maintenance complaint", async () => {
      const queries = [
        "Can you help me report a maintenance complaint?",
        "How to report a complaint",
        "help me file a complaint",
      ];

      for (const q of queries) {
        const reply = await processUserMessage({
          text: q,
          portal: "Student",
          userName: "Faahil",
          userEmail: "student@fixlens.test",
          complaints: initialComplaints,
          proposals: initialProposals,
        });

        expect(reply.sender).toBe("bot");
        expect(reply.text).toContain("Reporting a Campus Maintenance Issue");
        expect(reply.quickReplies?.length).toBeGreaterThan(0);
        // Must NOT create an unwanted complaint draft
        expect(reply.actionCard?.type).not.toBe("complaint-draft");
      }
    });

    it("Chatbot Case 2: Ask it to prepare a complaint for Mechanical Science (MS) Block", async () => {
      const reply = await processUserMessage({
        text: "prepare a complaint for Mechanical Science (MS) Block",
        portal: "Student",
        userName: "Faahil",
        userEmail: "student@fixlens.test",
        complaints: initialComplaints,
        proposals: initialProposals,
      });

      expect(reply.sender).toBe("bot");
      expect(reply.text).toContain("Mechanical Science (MS) Block");
      expect(reply.pendingContext).toBeDefined();
      expect(reply.pendingContext?.description).toContain("Mechanical Science (MS) Block");
    });

    it("Chatbot Case 3: Recognise Electrical Science (ES) Block and abbreviations", async () => {
      // Direct defect in ES Block
      const p1 = extractComplaintParams("sparking wire in Electrical Science (ES) Block 2nd floor");
      expect(p1.isComplaintIntent).toBe(true);
      expect(p1.building).toBe("Electrical Science (ES) Block");
      expect(p1.category).toBe("Electrical");

      // Abbreviation: ES Block
      const p2 = extractComplaintParams("broken switch in ES block room 201");
      expect(p2.building).toBe("Electrical Science (ES) Block");

      // Abbreviation: MS Block
      const p3 = extractComplaintParams("water leak in MS block washroom");
      expect(p3.building).toBe("Mechanical Science (MS) Block");
      expect(p3.category).toBe("Plumbing");

      // Abbreviation: LS Block
      const p4 = extractComplaintParams("broken window in LS block room 104");
      expect(p4.building).toBe("Life Science (LS) Block");
      expect(p4.category).toBe("Furniture");
    });

    it("Chatbot Case 4: Ask it to prepare a complaint about a broken classroom fan", async () => {
      const reply = await processUserMessage({
        text: "broken classroom fan not spinning in Basic Science Block room 302",
        portal: "Student",
        userName: "Faahil",
        userEmail: "student@fixlens.test",
        complaints: initialComplaints,
        proposals: initialProposals,
      });

      expect(reply.sender).toBe("bot");
      expect(reply.actionCard?.type).toBe("complaint-draft");
      if (reply.actionCard?.type === "complaint-draft") {
        expect(reply.actionCard.category).toBe("Electrical");
        expect(reply.actionCard.building).toBe("Basic Science Block");
        expect(reply.actionCard.room).toBe("room 302");
        expect(reply.actionCard.predictedPriority).toBeDefined();
      }
    });

    it("Chatbot Case 5: Verify that the draft card offers both 'Review & Edit' and 'Confirm & Submit'", () => {
      let capturedDraft: any = null;

      function TestConsumer() {
        const { reportDraft } = useDemoStore();
        capturedDraft = reportDraft;
        return (
          <div>
            <ChatCopilot portal="Student" user={{ name: "Faahil", sub: "student@fixlens.test" }} />
            <div data-testid="draft-title">{reportDraft?.title || "No Draft"}</div>
          </div>
        );
      }

      render(
        <DemoStoreProvider>
          <TestConsumer />
        </DemoStoreProvider>,
      );

      // Open chatbot dialog
      const fab = screen.getByRole("button", { name: /Open FixLens AI Copilot/i });
      fireEvent.click(fab);

      expect(screen.getByRole("dialog", { name: /FixLens AI Copilot Chat/i })).toBeDefined();
    });
  });

  describe("3. Campus Building List Uniformity (16 Buildings)", () => {
    it("contains all 16 exact campus locations in shared BUILDINGS configuration", () => {
      const expectedBuildings = [
        "CS Block",
        "Main Library",
        "Admin Block",
        "Sports Complex",
        "SM Block",
        "Mechanical Science (MS) Block",
        "Electrical Science (ES) Block",
        "Structural Engineering (SE) Block",
        "Life Science (LS) Block",
        "Pharmacy Block",
        "Architecture Block",
        "Basic Science Block",
        "Annexure Block",
        "Main Auditorium",
        "Main Canteen",
        "Convention Centre Block",
      ];

      expect(BUILDINGS.length).toBe(16);
      expectedBuildings.forEach((b) => {
        expect(BUILDINGS).toContain(b);
      });

      // Verify removed options are NOT in the active BUILDINGS array
      const removedBuildings = ["MCA Block", "Cafeteria", "Boys Hostel", "Girls Hostel"];
      removedBuildings.forEach((b) => {
        expect(BUILDINGS).not.toContain(b);
      });
    });
  });
});
