import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { DemoStoreProvider, useDemoStore } from "../lib/demo-store";
import { demoPredictPriority } from "../lib/demo-data";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <DemoStoreProvider>{children}</DemoStoreProvider>;
}

describe("FixLens AI - Main Demo Workflow Verification", () => {
  it("verifies the complete 9-step MCA capstone workflow with shared in-memory state", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper });

    // Step 1: Register or enter the student demo
    expect(result.current.currentStudent.name).toBe("Aisha Rahman");
    act(() => {
      result.current.setCurrentStudent({
        name: "Kavya Sharma",
        email: "kavya.sharma@campus.edu",
        department: "Computer Applications (MCA)",
        phone: "+91 91234 56789",
      });
    });
    expect(result.current.currentStudent.name).toBe("Kavya Sharma");
    expect(result.current.currentStudent.email).toBe("kavya.sharma@campus.edu");

    // Step 2: Submit a complaint
    const initialTotal = result.current.complaints.length;
    let submittedComplaintId = "";

    const priorityPrediction = demoPredictPriority({
      description: "Severe water leak flooding the main lab corridor with risk of slipping.",
      category: "Plumbing",
      urgency: "High",
      affected: 75,
    });
    expect(["High", "Medium", "Low"]).toContain(priorityPrediction.priority);
    expect(priorityPrediction.signals.length).toBeGreaterThan(0);

    act(() => {
      const created = result.current.addComplaint({
        title: "Severe water leak flooding lab corridor",
        description: "Severe water leak flooding the main lab corridor with risk of slipping.",
        category: "Plumbing",
        building: "MCA Block",
        room: "Lab corridor, 2nd floor",
        urgency: "High",
        affected: 75,
        priority: priorityPrediction.priority,
        image: "blob:http://localhost:3000/mock-attached-photo-uuid",
      });
      submittedComplaintId = created.id;
    });

    expect(submittedComplaintId).toMatch(/^FX-\d+$/);
    expect(result.current.complaints.length).toBe(initialTotal + 1);

    // Step 3: See that complaint in My Complaints
    const studentComplaints = result.current.complaints.filter(
      (c) => c.reporter === result.current.currentStudent.name,
    );
    expect(studentComplaints.some((c) => c.id === submittedComplaintId)).toBe(true);
    const myComplaint = studentComplaints.find((c) => c.id === submittedComplaintId)!;
    expect(myComplaint.title).toBe("Severe water leak flooding lab corridor");
    expect(myComplaint.status).toBe("Submitted");
    expect(myComplaint.reporter).toBe("Kavya Sharma");
    expect(myComplaint.image).toBe("blob:http://localhost:3000/mock-attached-photo-uuid");

    // Step 4: Open the admin demo - verify all complaints visible in admin pool
    const adminComplaints = result.current.complaints;
    expect(adminComplaints.some((c) => c.id === submittedComplaintId)).toBe(true);
    const adminViewItem = adminComplaints.find((c) => c.id === submittedComplaintId)!;
    expect(adminViewItem.image).toBe("blob:http://localhost:3000/mock-attached-photo-uuid");

    // Step 5: Find the same complaint in the admin queue
    const openComplaints = result.current.complaints.filter(
      (c) => !["Resolved", "Rejected"].includes(c.status),
    );
    const queuedItem = openComplaints.find((c) => c.id === submittedComplaintId);
    expect(queuedItem).toBeDefined();
    expect(queuedItem?.status).toBe("Submitted");

    // Step 6: Update its status and add a resolution note (Admin action)
    act(() => {
      result.current.updateComplaint(submittedComplaintId, {
        status: "In Progress",
        priority: "High",
        note: "Plumber dispatched to inspect valve on 2nd floor.",
      });
    });

    let updatedInAdmin = result.current.complaints.find((c) => c.id === submittedComplaintId)!;
    expect(updatedInAdmin.status).toBe("In Progress");
    expect(updatedInAdmin.resolutionNote).toBe("Plumber dispatched to inspect valve on 2nd floor.");
    expect(updatedInAdmin.timeline.some((t) => t.note.includes("Plumber dispatched"))).toBe(true);

    act(() => {
      result.current.updateComplaint(submittedComplaintId, {
        status: "Resolved",
        note: "Valve replaced, leakage stopped, and corridor floor dried.",
      });
    });

    updatedInAdmin = result.current.complaints.find((c) => c.id === submittedComplaintId)!;
    expect(updatedInAdmin.status).toBe("Resolved");
    expect(updatedInAdmin.resolutionNote).toBe(
      "Valve replaced, leakage stopped, and corridor floor dried.",
    );

    // Step 7: Confirm the student-side view reflects the change
    const updatedInStudent = result.current.complaints.find(
      (c) => c.id === submittedComplaintId && c.reporter === "Kavya Sharma",
    )!;
    expect(updatedInStudent.status).toBe("Resolved");
    expect(updatedInStudent.resolutionNote).toBe(
      "Valve replaced, leakage stopped, and corridor floor dried.",
    );
    expect(updatedInStudent.timeline.length).toBeGreaterThanOrEqual(3);

    // Step 8: Create an improvement proposal and test voting
    const initialProposalsCount = result.current.proposals.length;
    let newProposalId = "";

    act(() => {
      const createdProp = result.current.addProposal({
        title: "Install Emergency Slip-Resistant Mats in Corridors",
        description:
          "Heavy rains cause corridors to become slippery; slip-resistant rubber mats are needed.",
        category: "Safety",
        location: "MCA Block",
      });
      newProposalId = createdProp.id;
    });

    expect(newProposalId).toMatch(/^IP-\d+$/);
    expect(result.current.proposals.length).toBe(initialProposalsCount + 1);

    const createdProp = result.current.proposals.find((p) => p.id === newProposalId)!;
    expect(createdProp.author).toBe("Kavya Sharma");
    expect(createdProp.support).toBe(1); // creator auto-votes

    // Test voting prevention on duplicate vote by same demo session
    let secondVoteAllowed = true;
    act(() => {
      secondVoteAllowed = result.current.vote(newProposalId);
    });
    expect(secondVoteAllowed).toBe(false);
    expect(result.current.proposals.find((p) => p.id === newProposalId)!.support).toBe(1);

    // Test admin review on proposal
    act(() => {
      result.current.reviewProposal(
        newProposalId,
        "Approved",
        "Approved for installation during weekend maintenance.",
      );
    });
    const reviewedProp = result.current.proposals.find((p) => p.id === newProposalId)!;
    expect(reviewedProp.status).toBe("Approved");
    expect(reviewedProp.adminNote).toBe("Approved for installation during weekend maintenance.");

    // Step 9: Confirm dashboard summaries reflect the shared demo data
    const totalComplaints = result.current.complaints.length;
    const resolvedCount = result.current.complaints.filter((c) => c.status === "Resolved").length;
    const openCount = result.current.complaints.filter(
      (c) => !["Resolved", "Rejected"].includes(c.status),
    ).length;
    const approvedProposals = result.current.proposals.filter(
      (p) => p.status === "Approved",
    ).length;

    expect(totalComplaints).toBe(initialTotal + 1);
    expect(resolvedCount).toBeGreaterThan(0);
    expect(totalComplaints).toBe(
      openCount +
        result.current.complaints.filter((c) => ["Resolved", "Rejected"].includes(c.status)).length,
    );
    expect(approvedProposals).toBeGreaterThan(0);
  });
});
