import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DemoStoreProvider, useDemoStore } from "../lib/demo-store";
import { findPotentialDuplicates, detectRecurringIssues, getRecurrenceForComplaint } from "../lib/triage-engine";
import { ComplaintSummary } from "../components/fixlens/ComplaintDetail";
import { ComplaintList } from "../components/fixlens/ComplaintList";
import type { ReactNode } from "react";
import type { Complaint } from "../lib/demo-data";

function ProviderWrapper({ children }: { children: ReactNode }) {
  return <DemoStoreProvider>{children}</DemoStoreProvider>;
}

describe("FixLens AI — Duplicate Detection Integration", () => {
  it("warns about an active duplicate when student enters matching building, category, and room", () => {
    const existingComplaints: Complaint[] = [
      {
        id: "FX-1042",
        title: "Weak Wi-Fi signal in Lab 3",
        description: "Wi-Fi drops repeatedly during practical sessions in Lab 3. Around 40 students cannot access compiler.",
        category: "Internet/Wi-Fi",
        building: "CS Block",
        room: "Lab 3, 2nd floor",
        urgency: "High",
        affected: 40,
        priority: "High",
        status: "In Progress",
        date: "2026-10-21",
        reporter: "Aisha Rahman",
        timeline: [],
      },
    ];

    const candidate = {
      title: "Wi-Fi not working in Lab 3",
      description: "Internet drops constantly during lab practicals in Lab 3.",
      category: "Internet/Wi-Fi",
      building: "CS Block",
      room: "Lab 3",
    };

    const matches = findPotentialDuplicates(candidate, existingComplaints, {
      threshold: 0.5,
      activeOnly: true,
    });

    expect(matches.length).toBe(1);
    expect(matches[0].complaint.id).toBe("FX-1042");
    expect(matches[0].similarity).toBeGreaterThanOrEqual(0.5);
    expect(matches[0].complaint.building).toBe("CS Block");
    expect(matches[0].complaint.status).toBe("In Progress");
  });

  it("does not flag resolved complaints as duplicates when activeOnly is true", () => {
    const existingComplaints: Complaint[] = [
      {
        id: "FX-1038",
        title: "Leaking tap in 1st floor washroom",
        description: "The tap near the entrance keeps running and water is pooling on the floor.",
        category: "Plumbing",
        building: "MCA Block",
        room: "Washroom, 1st floor",
        urgency: "Medium",
        affected: 15,
        priority: "Medium",
        status: "Resolved",
        date: "2026-10-14",
        reporter: "Aisha Rahman",
        timeline: [],
      },
    ];

    const candidate = {
      title: "Tap leaking in washroom",
      description: "Water leaking on floor in 1st floor washroom.",
      category: "Plumbing",
      building: "MCA Block",
      room: "Washroom, 1st floor",
    };

    const matches = findPotentialDuplicates(candidate, existingComplaints, {
      threshold: 0.5,
      activeOnly: true,
    });

    expect(matches.length).toBe(0);
  });

  it("allows submission without blocking: submission logic functions independently of duplicate warning", () => {
    // Verify that finding duplicates does not mutate complaint submission payload or priority
    const newComplaint = {
      title: "Wi-Fi down in Lab 3",
      description: "Cannot connect to Wi-Fi in Lab 3 for the past 2 hours.",
      category: "Internet/Wi-Fi" as const,
      building: "CS Block",
      room: "Lab 3",
      urgency: "High" as const,
      affected: 30,
      priority: "High" as const,
    };

    // Candidate should yield a duplicate match against existing initial complaints
    const matches = findPotentialDuplicates(newComplaint, [
      {
        ...newComplaint,
        id: "FX-1042",
        status: "In Progress",
        date: "2026-10-21",
        reporter: "Aisha Rahman",
        timeline: [],
      },
    ]);
    expect(matches.length).toBeGreaterThan(0);

    // But the payload preserves original student urgency and AI priority untouched
    expect(newComplaint.urgency).toBe("High");
    expect(newComplaint.priority).toBe("High");
  });
});

describe("FixLens AI — Recurring Complaint Intelligence & UI Indicators", () => {
  it("renders recurrence badge and location recurrence notice in ComplaintSummary", () => {
    // FX-1042 in CS Block Lab 3 has historical complaint FX-1025 in initialComplaints
    const recurringComplaint: Complaint = {
      id: "FX-1042",
      title: "Weak Wi-Fi signal in Lab 3",
      description: "Wi-Fi drops repeatedly during practical sessions in Lab 3.",
      category: "Internet/Wi-Fi",
      building: "CS Block",
      room: "Lab 3, 2nd floor",
      urgency: "High",
      affected: 40,
      priority: "High",
      status: "In Progress",
      date: "2026-10-21",
      reporter: "Aisha Rahman",
      timeline: [],
    };

    render(
      <ProviderWrapper>
        <ComplaintSummary c={recurringComplaint} />
      </ProviderWrapper>,
    );

    // Should render recurrence badge
    const badge = screen.getByTestId("recurrence-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("Recurring");

    // Should render recurrence notice card
    const notice = screen.getByTestId("recurrence-notice");
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toContain("Repeated issue detected at this location");
    expect(notice.textContent).toContain("CS Block, Lab 3, 2nd floor");
  });

  it("renders recurring indicator in ComplaintList table rows", () => {
    const complaints: Complaint[] = [
      {
        id: "FX-1042",
        title: "Weak Wi-Fi signal in Lab 3",
        description: "Wi-Fi drops repeatedly in Lab 3.",
        category: "Internet/Wi-Fi",
        building: "CS Block",
        room: "Lab 3",
        urgency: "High",
        affected: 40,
        priority: "High",
        status: "In Progress",
        date: "2026-10-21",
        reporter: "Aisha",
        timeline: [],
      },
      {
        id: "FX-1025",
        title: "Disconnections in Lab 3",
        description: "Wi-Fi disconnects in Lab 3.",
        category: "Internet/Wi-Fi",
        building: "CS Block",
        room: "Lab 3",
        urgency: "Medium",
        affected: 30,
        priority: "Medium",
        status: "Resolved",
        date: "2026-10-11",
        reporter: "Kiran",
        timeline: [],
      },
      {
        id: "FX-1035",
        title: "Broken chairs in Seminar Hall",
        description: "Chairs broken.",
        category: "Furniture",
        building: "Admin Block",
        room: "Seminar Hall",
        urgency: "Low",
        affected: 6,
        priority: "Low",
        status: "Under Review",
        date: "2026-10-18",
        reporter: "Aisha",
        timeline: [],
      },
    ];

    render(
      <ComplaintList
        complaints={complaints}
        onOpen={vi.fn()}
      />,
    );

    // ComplaintList should mark the 2 recurring Wi-Fi complaints with Recurring pills
    const recurringElements = screen.getAllByText(/Recurring/i);
    expect(recurringElements.length).toBeGreaterThan(0);
  });

  it("safeguards: separates report count from distinct incident count", () => {
    const complaintsWithDuplicates: Complaint[] = [
      // 3 reports of the same power cut on 2026-10-25 in MCA Block Room 101
      {
        id: "FX-2001",
        title: "Power cut in Room 101",
        description: "No power in Room 101.",
        category: "Electrical",
        building: "MCA Block",
        room: "Room 101",
        urgency: "High",
        affected: 50,
        priority: "High",
        status: "Submitted",
        date: "2026-10-25",
        reporter: "Student 1",
        timeline: [],
      },
      {
        id: "FX-2002",
        title: "No electricity in Room 101",
        description: "Lights and fans off in Room 101.",
        category: "Electrical",
        building: "MCA Block",
        room: "Room 101",
        urgency: "High",
        affected: 50,
        priority: "High",
        status: "Submitted",
        date: "2026-10-25",
        reporter: "Student 2",
        timeline: [],
      },
      {
        id: "FX-2003",
        title: "Electricity failure in 101",
        description: "Complete blackout in Room 101.",
        category: "Electrical",
        building: "MCA Block",
        room: "Room 101",
        urgency: "High",
        affected: 50,
        priority: "High",
        status: "Submitted",
        date: "2026-10-25",
        reporter: "Student 3",
        timeline: [],
      },
    ];

    const recurring = detectRecurringIssues(complaintsWithDuplicates);
    expect(recurring.length).toBe(1);
    const item = recurring[0];
    expect(item.totalReports).toBe(3); // 3 reports
    expect(item.incidentCount).toBe(1); // Merged into 1 single incident
  });
});
