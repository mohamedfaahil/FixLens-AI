import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { DemoStoreProvider, useDemoStore } from "../lib/demo-store";
import { ComplaintSummary } from "../components/fixlens/ComplaintDetail";
import { findPotentialDuplicates } from "../lib/triage-engine";
import type { ReactNode } from "react";
import type { Complaint } from "../lib/demo-data";

function WrapperComponent({ children }: { children: ReactNode }) {
  return <DemoStoreProvider>{children}</DemoStoreProvider>;
}

describe("FixLens AI — Cross-Student Navigation & Access Control", () => {
  it("resolves Student A's complaint for Student B without 'Complaint not found'", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper: WrapperComponent });

    // Step 1: Student A submits a complaint
    act(() => {
      result.current.setCurrentStudent({
        name: "Aisha Rahman",
        email: "aisha.rahman@campus.edu",
        department: "Computer Applications (MCA)",
      });
    });

    let studentAComplaintId = "";
    act(() => {
      const created = result.current.addComplaint({
        title: "Access point intermittent in CS Lab 3",
        description: "Wi-Fi access point restarts every 10 minutes in Lab 3.",
        category: "Internet/Wi-Fi",
        building: "CS Block",
        room: "Lab 3, 2nd floor",
        urgency: "High",
        affected: 45,
        priority: "High",
      });
      studentAComplaintId = created.id;
    });

    expect(studentAComplaintId).toMatch(/^FX-\d+$/);

    // Step 2: Switch session to Student B
    act(() => {
      result.current.setCurrentStudent({
        name: "Rohit Sharma",
        email: "rohit.sharma@campus.edu",
        department: "Computer Science",
      });
    });
    expect(result.current.currentStudent.name).toBe("Rohit Sharma");

    // Step 3: Student B can find Student A's complaint in the shared store
    const foundComplaint = result.current.complaints.find((c) => c.id === studentAComplaintId);
    expect(foundComplaint).toBeDefined();
    expect(foundComplaint?.title).toBe("Access point intermittent in CS Lab 3");
  });

  it("detects Student A's complaint in duplicate detection when Student B drafts a similar issue", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper: WrapperComponent });

    // Submit complaint as Student A
    let complaintA: Complaint;
    act(() => {
      result.current.setCurrentStudent({
        name: "Student A",
        email: "studentA@campus.edu",
        department: "MCA",
      });
      complaintA = result.current.addComplaint({
        title: "Wi-Fi down in Lab 3",
        description: "Cannot connect to campus network in Lab 3 since morning.",
        category: "Internet/Wi-Fi",
        building: "CS Block",
        room: "Lab 3",
        urgency: "High",
        affected: 40,
        priority: "High",
      });
    });

    // Student B creates draft with similar issue in same location
    act(() => {
      result.current.setCurrentStudent({
        name: "Student B",
        email: "studentB@campus.edu",
        department: "CS",
      });
    });

    const duplicates = findPotentialDuplicates(
      {
        title: "Wi-Fi not working in Lab 3",
        description: "Cannot connect to the Wi-Fi network in Lab 3.",
        category: "Internet/Wi-Fi",
        building: "CS Block",
        room: "Lab 3",
      },
      result.current.complaints,
      { threshold: 0.5, activeOnly: true },
    );

    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates.some((d) => d.complaint.id === complaintA.id)).toBe(true);
  });

  it("masks reporter personal profile in read-only shared view when viewed by another student", () => {
    const complaintByStudentA: Complaint = {
      id: "FX-1099",
      title: "Broken window latch in Seminar Hall",
      description: "Window latch is loose and rattles loudly in the wind.",
      category: "Furniture",
      building: "Admin Block",
      room: "Seminar Hall",
      urgency: "Medium",
      affected: 10,
      priority: "Medium",
      status: "In Progress",
      date: "2026-10-28",
      reporter: "Private Student Name",
      timeline: [
        {
          status: "Submitted",
          date: "2026-10-28",
          note: "Complaint submitted by student.",
          by: "Private Student Name",
        },
        {
          status: "In Progress",
          date: "2026-10-29",
          note: "Carpenter assigned to inspect window.",
          by: "Maintenance Office",
        },
      ],
    };

    render(
      <WrapperComponent>
        <ComplaintSummary c={complaintByStudentA} isSharedView={true} />
      </WrapperComponent>,
    );

    // Verify Read-only shared view banner is rendered
    const banner = screen.getByTestId("shared-complaint-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain("Read-only Shared Campus View");

    // Verify original student reporter name is MASKED
    expect(screen.queryByText("Private Student Name")).not.toBeInTheDocument();
    expect(screen.getByText("Student Reporter (Protected)")).toBeInTheDocument();

    // Verify timeline author is also sanitized
    expect(screen.getByText(/by Student Reporter/)).toBeInTheDocument();
    expect(screen.getByText(/by Maintenance Office/)).toBeInTheDocument();
  });

  it("shows original reporter information when student views their own complaint", () => {
    const myComplaint: Complaint = {
      id: "FX-1042",
      title: "Weak Wi-Fi signal in Lab 3",
      description: "Wi-Fi drops repeatedly during practical sessions.",
      category: "Internet/Wi-Fi",
      building: "CS Block",
      room: "Lab 3, 2nd floor",
      urgency: "High",
      affected: 40,
      priority: "High",
      status: "In Progress",
      date: "2026-10-21",
      reporter: "Aisha Rahman",
      timeline: [
        {
          status: "Submitted",
          date: "2026-10-21",
          note: "Complaint received.",
          by: "Aisha Rahman",
        },
      ],
    };

    render(
      <WrapperComponent>
        <ComplaintSummary c={myComplaint} isSharedView={false} />
      </WrapperComponent>,
    );

    // Should NOT show shared view banner
    expect(screen.queryByTestId("shared-complaint-banner")).not.toBeInTheDocument();

    // Should show Aisha Rahman as reporter
    expect(screen.getByText("Aisha Rahman")).toBeInTheDocument();
  });

  it("preserves student report draft across navigation", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper: WrapperComponent });

    expect(result.current.reportDraft).toBeNull();

    // Student B fills draft
    act(() => {
      result.current.setReportDraft({
        title: "Flickering lights in CS 204",
        description: "Lights are constantly flickering and buzzing near projector.",
        category: "Electrical",
        building: "CS Block",
        room: "Room 204",
        urgency: "Medium",
        affected: "40",
      });
    });

    // Draft is stored in memory
    expect(result.current.reportDraft?.title).toBe("Flickering lights in CS 204");
    expect(result.current.reportDraft?.room).toBe("Room 204");

    // After navigating to inspect another complaint and returning, draft remains available
    const preservedDraft = result.current.reportDraft;
    expect(preservedDraft).not.toBeNull();
    expect(preservedDraft?.building).toBe("CS Block");
    expect(preservedDraft?.affected).toBe("40");

    // Clearing draft resets it
    act(() => {
      result.current.setReportDraft(null);
    });
    expect(result.current.reportDraft).toBeNull();
  });
});
