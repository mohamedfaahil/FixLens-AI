import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatCopilot } from "@/components/fixlens/ChatCopilot";
import { DemoStoreProvider } from "@/lib/demo-store";
import { extractComplaintParams, processUserMessage } from "@/lib/chatbot-engine";
import { initialComplaints, initialProposals } from "@/lib/demo-data";

// Mock router link
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: () => ({ location: { pathname: "/" } }),
}));

describe("FixLens AI Copilot Engine & UI Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractComplaintParams (NLP Parser vs Inquiry Filter)", () => {
    it("identifies complaint intent for genuine defects", () => {
      const input = "Broken switch and sparking socket in CS Block Room 204 affecting 5 students";
      const result = extractComplaintParams(input);

      expect(result.isComplaintIntent).toBe(true);
      expect(result.category).toBe("Electrical");
      expect(result.building).toBe("CS Block");
      expect(result.room).toBe("Room 204");
      expect(result.affected).toBe(5);
    });

    it("identifies 'drainage overflow near the main library' as a valid Plumbing complaint in Main Library", () => {
      const input = "drainage overflow near the main library";
      const result = extractComplaintParams(input);

      expect(result.isComplaintIntent).toBe(true);
      expect(result.category).toBe("Plumbing");
      expect(result.building).toBe("Main Library");
      expect(result.hasExplicitBuilding).toBe(true);
    });

    it("rejects inquiry questions from being treated as complaints", () => {
      const queries = [
        "show me the all complaints i made",
        "show my complaints",
        "list all complaints",
        "what did i report?",
        "where is the maintenance office?",
      ];

      for (const q of queries) {
        const result = extractComplaintParams(q);
        expect(result.isComplaintIntent).toBe(false);
      }
    });

    it("extracts plumbing leak in Main Library", () => {
      const input = "Severe water leak and overflowing washroom in Main Library 2nd floor urgent";
      const result = extractComplaintParams(input);

      expect(result.isComplaintIntent).toBe(true);
      expect(result.category).toBe("Plumbing");
      expect(result.building).toBe("Main Library");
      expect(result.urgency).toBe("High");
    });
  });

  describe("processUserMessage (Role-Aware Logic & Multi-Turn Memory)", () => {
    it("drafts 'drainage overflow near the main library' with ML priority card", async () => {
      const reply = await processUserMessage({
        text: "drainage overflow near the main library",
        portal: "Student",
        userName: "Faahil",
        userEmail: "student@fixlens.test",
        complaints: initialComplaints,
        proposals: initialProposals,
      });

      expect(reply.sender).toBe("bot");
      expect(reply.actionCard?.type).toBe("complaint-draft");
      if (reply.actionCard?.type === "complaint-draft") {
        expect(reply.actionCard.category).toBe("Plumbing");
        expect(reply.actionCard.building).toBe("Main Library");
        expect(reply.actionCard.predictedPriority).toBeDefined();
      }
    });

    it("handles 'show me the all complaints i made' by returning complaint-list card instead of drafting", async () => {
      const reply = await processUserMessage({
        text: "show me the all complaints i made",
        portal: "Student",
        userName: "Faahil",
        userEmail: "student@fixlens.test",
        complaints: initialComplaints,
        proposals: initialProposals,
      });

      expect(reply.sender).toBe("bot");
      expect(reply.actionCard?.type).toBe("complaint-list");
      if (reply.actionCard?.type === "complaint-list") {
        expect(reply.actionCard.complaints.length).toBeGreaterThan(0);
      }
    });

    it("handles greetings and casual help requests", async () => {
      const reply = await processUserMessage({
        text: "Hello",
        portal: "Student",
        userName: "Faahil",
        userEmail: "student@fixlens.test",
        complaints: initialComplaints,
        proposals: initialProposals,
      });

      expect(reply.sender).toBe("bot");
      expect(reply.text).toContain("FixLens Campus Copilot");
      expect(reply.quickReplies?.length).toBeGreaterThan(0);
    });

    it("handles gratitude and closure politely", async () => {
      const reply = await processUserMessage({
        text: "Thank you so much!",
        portal: "Student",
        userName: "Faahil",
        userEmail: "student@fixlens.test",
        complaints: initialComplaints,
        proposals: initialProposals,
      });

      expect(reply.sender).toBe("bot");
      expect(reply.text).toContain("You're very welcome");
    });

    it("provides admin operational queue summary", async () => {
      const reply = await processUserMessage({
        text: "how many complaints are there",
        portal: "Administrator",
        userName: "Admin User",
        userEmail: "admin@fixlens.test",
        complaints: initialComplaints,
        proposals: initialProposals,
      });

      expect(reply.sender).toBe("bot");
      expect(reply.text).toContain("Total Registered Complaints");
      expect(reply.actionCard?.type).toBe("admin-summary");
    });

    it("filters high priority complaints for administrator", async () => {
      const reply = await processUserMessage({
        text: "show high priority complaints",
        portal: "Administrator",
        userName: "Admin User",
        userEmail: "admin@fixlens.test",
        complaints: initialComplaints,
        proposals: initialProposals,
      });

      expect(reply.sender).toBe("bot");
      expect(reply.actionCard?.type).toBe("complaint-list");
      if (reply.actionCard?.type === "complaint-list") {
        expect(reply.actionCard.filterLabel).toBe("High Priority Tickets");
      }
    });

    it("detects SLA escalations for administrator", async () => {
      const reply = await processUserMessage({
        text: "Check SLA escalations",
        portal: "Administrator",
        userName: "Admin User",
        userEmail: "admin@fixlens.test",
        complaints: initialComplaints,
        proposals: initialProposals,
      });

      expect(reply.sender).toBe("bot");
      expect(reply.text).toBeDefined();
    });

    it("provides building hotspot analysis for administrator", async () => {
      const reply = await processUserMessage({
        text: "which building has the most complaints",
        portal: "Administrator",
        userName: "Admin User",
        userEmail: "admin@fixlens.test",
        complaints: initialComplaints,
        proposals: initialProposals,
      });

      expect(reply.sender).toBe("bot");
      expect(reply.text).toContain("Complaint Distribution by Campus Facility");
    });

    it("triggers multi-turn clarification when student omits campus building", async () => {
      // Step 1: Student describes issue without specifying building
      const firstTurn = await processUserMessage({
        text: "AC is leaking water on desks",
        portal: "Student",
        userName: "Faahil",
        userEmail: "student@fixlens.test",
        complaints: initialComplaints,
        proposals: initialProposals,
      });

      expect(firstTurn.sender).toBe("bot");
      expect(firstTurn.text).toContain("Which campus building is this in?");
      expect(firstTurn.pendingContext).toBeDefined();
      expect(firstTurn.quickReplies?.length).toBeGreaterThan(0);

      // Step 2: Student replies with building location
      const secondTurn = await processUserMessage({
        text: "Main Library 2nd floor",
        portal: "Student",
        userName: "Faahil",
        userEmail: "student@fixlens.test",
        complaints: initialComplaints,
        proposals: initialProposals,
        pendingContext: firstTurn.pendingContext,
      });

      expect(secondTurn.sender).toBe("bot");
      expect(secondTurn.text).toContain("finalized your complaint draft");
      expect(secondTurn.actionCard?.type).toBe("complaint-draft");
      if (secondTurn.actionCard?.type === "complaint-draft") {
        expect(secondTurn.actionCard.building).toBe("Main Library");
        expect(secondTurn.actionCard.category).toBe("Electrical");
      }
    });
  });

  describe("ChatCopilot Component UI Interactions", () => {
    it("renders floating action button and toggles chat modal open and closed", () => {
      render(
        <DemoStoreProvider>
          <ChatCopilot portal="Student" user={{ name: "Faahil", sub: "student@fixlens.test" }} />
        </DemoStoreProvider>,
      );

      const fab = screen.getByRole("button", { name: /Open FixLens AI Copilot/i });
      expect(fab).toBeDefined();

      // Click to open
      fireEvent.click(fab);
      expect(screen.getByRole("dialog", { name: /FixLens AI Copilot Chat/i })).toBeDefined();
      expect(screen.getByText("Student Assistant")).toBeDefined();

      // Check for voice dictation mic button
      const micBtn = screen.getByTitle(/Speak to dictate issue/i);
      expect(micBtn).toBeDefined();

      // Click to close
      const closeBtn = screen.getByTitle("Close chat");
      fireEvent.click(closeBtn);
      expect(screen.queryByRole("dialog", { name: /FixLens AI Copilot Chat/i })).toBeNull();
    });

    it("renders Admin Ops Mode badge when opened in Administrator portal", () => {
      render(
        <DemoStoreProvider>
          <ChatCopilot
            portal="Administrator"
            user={{ name: "Chief Warden", sub: "admin@fixlens.test" }}
          />
        </DemoStoreProvider>,
      );

      const fab = screen.getByRole("button", { name: /Open FixLens AI Copilot/i });
      fireEvent.click(fab);

      expect(screen.getByText("Admin Ops Mode")).toBeDefined();
      expect(screen.getByText("📊 Queue summary")).toBeDefined();
    });
  });
});
