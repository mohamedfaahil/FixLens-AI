import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { DemoStoreProvider, useDemoStore } from "../lib/demo-store";
import { ComplaintSummary } from "../components/fixlens/ComplaintDetail";
import { findPotentialDuplicates, detectRecurringIssues } from "../lib/triage-engine";
import type { ReactNode } from "react";
import type { Complaint } from "../lib/demo-data";

function WrapperComponent({ children }: { children: ReactNode }) {
  return <DemoStoreProvider>{children}</DemoStoreProvider>;
}

describe("FixLens AI — Same-Student Repeat Submission Control", () => {
  it("creates a new complaint normally on first submission", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper: WrapperComponent });

    act(() => {
      result.current.setCurrentStudent({
        name: "Arjun Mehta",
        email: "arjun.mehta@campus.edu",
        department: "Computer Applications",
      });
    });

    const initialTotal = result.current.complaints.length;
    let createdComplaint: Complaint | undefined;

    act(() => {
      createdComplaint = result.current.addComplaint({
        title: "Ceiling fan sparking violently in Room 302",
        description: "Ceiling fan motor is smoking and emitting sparks when turned to speed 3.",
        category: "Electrical",
        building: "Science Block",
        room: "Room 302",
        urgency: "High",
        affected: 30,
        priority: "High",
      });
    });

    expect(createdComplaint).toBeDefined();
    expect(createdComplaint?.id).toMatch(/^FX-\d+$/);
    expect(createdComplaint?.status).toBe("Submitted");
    expect(createdComplaint?.reporter).toBe("Arjun Mehta");
    expect(createdComplaint?.timeline[0].note).toBe("Complaint received (demo).");
    expect(result.current.complaints.length).toBe(initialTotal + 1);
  });

  it("identifies active repeat submission when the same student reports the same issue again", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper: WrapperComponent });

    act(() => {
      result.current.setCurrentStudent({
        name: "Arjun Mehta",
        email: "arjun.mehta@campus.edu",
        department: "Computer Applications",
      });
    });

    let firstComplaint: Complaint | undefined;
    act(() => {
      firstComplaint = result.current.addComplaint({
        title: "Water leaking from AC in Lab 1",
        description: "Water is continuously dripping from split AC unit onto the back desk row.",
        category: "Plumbing",
        building: "CS Block",
        room: "Lab 1",
        urgency: "Medium",
        affected: 25,
        priority: "Medium",
      });
    });

    // Check candidate repeat report by the SAME student
    const candidateReport = {
      title: "AC dripping water in Lab 1",
      description: "Water still leaking from the AC in Lab 1 onto computer tables.",
      category: "Plumbing",
      building: "CS Block",
      room: "Lab 1",
    };

    const activeDuplicates = findPotentialDuplicates(candidateReport, result.current.complaints, {
      threshold: 0.5,
      activeOnly: true,
    });

    expect(activeDuplicates.length).toBeGreaterThan(0);
    const matched = activeDuplicates.find((d) => d.complaint.id === firstComplaint?.id);
    expect(matched).toBeDefined();

    // Verify same student reporter check
    const isSameStudentRepeat =
      matched?.complaint.reporter.toLowerCase().trim() ===
      result.current.currentStudent.name.toLowerCase().trim();
    expect(isSameStudentRepeat).toBe(true);
    expect(matched?.complaint.status).toBe("Submitted");
  });

  it("appends follow-up to existing complaint without creating a new complaint or mutating status", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper: WrapperComponent });

    act(() => {
      result.current.setCurrentStudent({
        name: "Sneha Patel",
        email: "sneha.patel@campus.edu",
        department: "Information Technology",
      });
    });

    let originalComplaint: Complaint | undefined;
    act(() => {
      originalComplaint = result.current.addComplaint({
        title: "Projector lamp burnt out in Seminar Hall A",
        description: "Projector blinks orange warning light and will not display video input.",
        category: "Electrical",
        building: "Main Auditorium",
        room: "Seminar Hall A",
        urgency: "Medium",
        affected: 60,
        priority: "Medium",
      });
    });

    // Admin updates complaint status to "In Progress" with admin note
    act(() => {
      result.current.updateComplaint(originalComplaint!.id, {
        status: "In Progress",
        note: "Electrician assigned to replace lamp.",
      });
    });

    const countBeforeFollowUp = result.current.complaints.length;

    // Student submits follow-up note
    let updatedComplaint: Complaint | undefined;
    act(() => {
      updatedComplaint = result.current.addFollowUp(
        originalComplaint!.id,
        "Update: Class starts in 30 minutes, please expedite if possible.",
      );
    });

    expect(updatedComplaint).toBeDefined();
    // In-memory complaint count must NOT increase
    expect(result.current.complaints.length).toBe(countBeforeFollowUp);

    // Complaint status, priority, and resolution notes must remain preserved
    expect(updatedComplaint?.status).toBe("In Progress");
    expect(updatedComplaint?.priority).toBe("Medium");
    expect(updatedComplaint?.resolutionNote).toBe("Electrician assigned to replace lamp.");

    // Follow-up history is stored with content, date, timestamp, and author
    expect(updatedComplaint?.followUps).toHaveLength(1);
    const fu = updatedComplaint!.followUps![0];
    expect(fu.id).toMatch(/^FU-/);
    expect(fu.content).toBe("Update: Class starts in 30 minutes, please expedite if possible.");
    expect(fu.by).toBe("Sneha Patel");
    expect(fu.date).toBeDefined();
    expect(fu.timestamp).toBeDefined();

    // Timeline event is appended to status timeline
    const latestTimeline = updatedComplaint!.timeline[updatedComplaint!.timeline.length - 1];
    expect(latestTimeline.by).toBe("Sneha Patel");
    expect(latestTimeline.status).toBe("In Progress");
    expect(latestTimeline.note).toContain("Follow-up:");
  });

  it("handles 5 submissions in one day by keeping 1 complaint and recording 5 follow-up notes", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper: WrapperComponent });

    act(() => {
      result.current.setCurrentStudent({
        name: "Vikram Sen",
        email: "vikram.sen@campus.edu",
        department: "Mechanical Engineering",
      });
    });

    let mainComplaint: Complaint | undefined;
    act(() => {
      mainComplaint = result.current.addComplaint({
        title: "Broken door hinge in Workshop 2",
        description: "Heavy metal door is hanging off bottom hinge and does not shut safely.",
        category: "Safety/Security",
        building: "Mechanical Workshop",
        room: "Workshop 2",
        urgency: "High",
        affected: 35,
        priority: "High",
      });
    });

    const initialComplaintsCount = result.current.complaints.length;

    // Student submits 4 additional follow-up updates throughout the day
    const followUpMessages = [
      "10:00 AM update: Door is scraping the floor now.",
      "12:30 PM update: Students are having trouble opening the entrance.",
      "02:15 PM update: Wind caused the door to slam and bend the hinge further.",
      "04:45 PM update: Lab technician placed a cone in front of the door.",
    ];

    for (const msg of followUpMessages) {
      act(() => {
        result.current.addFollowUp(mainComplaint!.id, msg);
      });
    }

    // Still exactly 1 complaint in store (not 5 separate complaints)
    expect(result.current.complaints.length).toBe(initialComplaintsCount);

    const storedComplaint = result.current.complaints.find((c) => c.id === mainComplaint!.id);
    expect(storedComplaint).toBeDefined();

    // All 4 follow-ups are preserved in order, none discarded
    expect(storedComplaint?.followUps).toHaveLength(4);
    expect(storedComplaint?.followUps?.[0].content).toBe(followUpMessages[0]);
    expect(storedComplaint?.followUps?.[1].content).toBe(followUpMessages[1]);
    expect(storedComplaint?.followUps?.[2].content).toBe(followUpMessages[2]);
    expect(storedComplaint?.followUps?.[3].content).toBe(followUpMessages[3]);
  });

  it("allows submitting a new complaint when student confirms it is genuinely a separate incident", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper: WrapperComponent });

    act(() => {
      result.current.setCurrentStudent({
        name: "Devika Nair",
        email: "devika.nair@campus.edu",
        department: "Civil Engineering",
      });
    });

    let incidentA: Complaint | undefined;
    act(() => {
      incidentA = result.current.addComplaint({
        title: "Leaking faucet in Chemistry Lab 1",
        description: "Cold water tap at sink 3 will not turn off completely.",
        category: "Plumbing",
        building: "Science Block",
        room: "Chemistry Lab 1",
        urgency: "Low",
        affected: 5,
        priority: "Low",
      });
    });

    const initialTotal = result.current.complaints.length;

    // Student reports a separate incident at the same room (e.g. overhead drain leak)
    let incidentB: Complaint | undefined;
    act(() => {
      incidentB = result.current.addComplaint({
        title: "Overhead pipe leaking in Chemistry Lab 1",
        description: "Different issue: overhead ceiling pipe is dripping dirty water near safety shower.",
        category: "Plumbing",
        building: "Science Block",
        room: "Chemistry Lab 1",
        urgency: "High",
        affected: 20,
        priority: "High",
      });
    });

    expect(incidentB).toBeDefined();
    expect(incidentB?.id).not.toBe(incidentA?.id);
    expect(result.current.complaints.length).toBe(initialTotal + 1);

    const savedA = result.current.complaints.find((c) => c.id === incidentA?.id);
    const savedB = result.current.complaints.find((c) => c.id === incidentB?.id);
    expect(savedA).toBeDefined();
    expect(savedB).toBeDefined();
  });

  it("links new complaint to earlier ticket when an issue recurs after being resolved", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper: WrapperComponent });

    act(() => {
      result.current.setCurrentStudent({
        name: "Sameer Joshi",
        email: "sameer.joshi@campus.edu",
        department: "Electrical Engineering",
      });
    });

    // Earlier complaint that was resolved
    let earlierComplaint: Complaint | undefined;
    act(() => {
      earlierComplaint = result.current.addComplaint({
        title: "AC thermostat error in EE Lab 2",
        description: "Thermostat shows error code E4 and AC compressor shuts down.",
        category: "Electrical",
        building: "Engineering Block",
        room: "EE Lab 2",
        urgency: "Medium",
        affected: 30,
        priority: "Medium",
      });
    });

    act(() => {
      result.current.updateComplaint(earlierComplaint!.id, {
        status: "Resolved",
        note: "Thermostat sensor cleaned and re-calibrated.",
      });
    });

    // Check duplicate detection with activeOnly: false
    const resolvedMatches = findPotentialDuplicates(
      {
        title: "AC thermostat error code E4 recurring in EE Lab 2",
        description: "Thermostat error code E4 is back again and compressor stopped working.",
        category: "Electrical",
        building: "Engineering Block",
        room: "EE Lab 2",
      },
      result.current.complaints,
      { threshold: 0.5, activeOnly: false },
    );

    const resolvedMatch = resolvedMatches.find(
      (d) =>
        d.complaint.status === "Resolved" &&
        d.complaint.reporter.toLowerCase().trim() ===
          result.current.currentStudent.name.toLowerCase().trim(),
    );
    expect(resolvedMatch).toBeDefined();
    expect(resolvedMatch?.complaint.id).toBe(earlierComplaint?.id);

    // Submitting with linkedComplaintId
    let reopenedComplaint: Complaint | undefined;
    act(() => {
      reopenedComplaint = result.current.addComplaint({
        title: "AC thermostat error code E4 recurring in EE Lab 2",
        description: "Thermostat error code E4 is back again and compressor stopped working.",
        category: "Electrical",
        building: "Engineering Block",
        room: "EE Lab 2",
        urgency: "High",
        affected: 30,
        priority: "High",
        linkedComplaintId: resolvedMatch?.complaint.id,
      });
    });

    expect(reopenedComplaint).toBeDefined();
    expect(reopenedComplaint?.linkedComplaintId).toBe(earlierComplaint?.id);
    expect(reopenedComplaint?.timeline[0].note).toContain(
      `Reopened recurrence linked to ${earlierComplaint?.id}`,
    );
  });

  it("preserves independent student submissions and tracks distinct reporters in triage engine", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper: WrapperComponent });

    // Student A submits
    act(() => {
      result.current.setCurrentStudent({
        name: "Student Alpha",
        email: "alpha@campus.edu",
        department: "MCA",
      });
    });

    let compAlpha: Complaint | undefined;
    act(() => {
      compAlpha = result.current.addComplaint({
        title: "Main router rebooting in Library 2nd floor",
        description: "Wi-Fi cuts off every 15 minutes on second floor study area.",
        category: "Internet/Wi-Fi",
        building: "Central Library",
        room: "2nd Floor Study Hall",
        urgency: "High",
        affected: 50,
        priority: "High",
      });
    });

    // Student Alpha adds 2 follow-ups
    act(() => {
      result.current.addFollowUp(compAlpha!.id, "Still disconnected after 1 hour.");
      result.current.addFollowUp(compAlpha!.id, "Library staff notified us it is widespread.");
    });

    // Switch to Student Beta
    act(() => {
      result.current.setCurrentStudent({
        name: "Student Beta",
        email: "beta@campus.edu",
        department: "B.Tech",
      });
    });

    // Student Beta submits an independent complaint for the same problem
    let compBeta: Complaint | undefined;
    act(() => {
      compBeta = result.current.addComplaint({
        title: "Wi-Fi constantly dropping in Library 2nd floor",
        description: "Unable to load online journals on the 2nd floor study tables due to Wi-Fi drops.",
        category: "Internet/Wi-Fi",
        building: "Central Library",
        room: "2nd Floor Study Hall",
        urgency: "High",
        affected: 45,
        priority: "High",
      });
    });

    expect(compBeta?.id).not.toBe(compAlpha?.id);

    // Calculate recurring issues across campus
    const recurring = detectRecurringIssues(result.current.complaints);
    const libraryIssue = recurring.find(
      (r) => r.building === "Central Library" && r.category === "Internet/Wi-Fi",
    );

    expect(libraryIssue).toBeDefined();
    // Two reports from distinct students
    expect(libraryIssue?.totalReports).toBe(2);
    // Distinct reporters is exactly 2 (Student Alpha and Student Beta)
    expect(libraryIssue?.distinctReporters).toBe(2);
    expect(libraryIssue?.reporters).toContain("Student Alpha");
    expect(libraryIssue?.reporters).toContain("Student Beta");
  });

  it("renders follow-up history and linked complaint badge in ComplaintSummary", () => {
    const testComplaint: Complaint = {
      id: "FX-2050",
      title: "Broken power outlet at desk 4",
      description: "Outlet has cracked cover and loose neutral wire.",
      category: "Electrical",
      building: "CS Block",
      room: "Room 101",
      urgency: "High",
      affected: 2,
      priority: "High",
      status: "In Progress",
      date: "2026-10-30",
      reporter: "Karan Singh",
      linkedComplaintId: "FX-1012",
      followUps: [
        {
          id: "FU-001",
          date: "2026-10-30",
          timestamp: "11:15 AM",
          content: "Sparking noticed when someone plugged in a laptop charger.",
          by: "Karan Singh",
        },
      ],
      timeline: [
        {
          status: "Submitted",
          date: "2026-10-30",
          note: "Complaint received.",
          by: "Karan Singh",
        },
      ],
    };

    // Render for own student view
    const { rerender } = render(
      <WrapperComponent>
        <ComplaintSummary c={testComplaint} isSharedView={false} />
      </WrapperComponent>,
    );

    // Verify linked complaint badge
    const linkedBadge = screen.getByTestId("linked-complaint-badge");
    expect(linkedBadge).toBeInTheDocument();
    expect(linkedBadge.textContent).toContain("Linked to FX-1012");

    // Verify follow-up history is displayed
    const followUpSection = screen.getByTestId("follow-up-history");
    expect(followUpSection).toBeInTheDocument();
    expect(
      within(followUpSection).getByText(/Sparking noticed when someone plugged in a laptop charger/),
    ).toBeInTheDocument();
    expect(within(followUpSection).getByText("Karan Singh")).toBeInTheDocument();

    // Rerender for peer student shared view (isSharedView = true)
    rerender(
      <WrapperComponent>
        <ComplaintSummary c={testComplaint} isSharedView={true} />
      </WrapperComponent>,
    );

    // Follow-up author is sanitized to "Student Reporter"
    const sharedFollowUpSection = screen.getByTestId("follow-up-history");
    expect(within(sharedFollowUpSection).queryByText("Karan Singh")).not.toBeInTheDocument();
    expect(within(sharedFollowUpSection).getByText("Student Reporter")).toBeInTheDocument();
  });
});
