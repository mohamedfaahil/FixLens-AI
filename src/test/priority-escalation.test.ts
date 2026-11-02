import { describe, it, expect } from "vitest";
import {
  evaluateComplaintEscalation,
  evaluateAllEscalations,
  isCriticalSafetyHazard,
  calculateDaysUnresolved,
} from "../lib/escalation-engine";
import type { Complaint } from "../lib/demo-data";

function createMockComplaint(overrides: Partial<Complaint> = {}): Complaint {
  return {
    id: "FX-9001",
    title: "Water dripping from pipe",
    description: "Small drip in the corner of the lab.",
    category: "Plumbing",
    building: "CS Block",
    room: "Room 101",
    urgency: "Low",
    affected: 5,
    priority: "Low",
    status: "Submitted",
    date: "2026-11-01",
    reporter: "Student One",
    reporterId: "user-1",
    timeline: [],
    ...overrides,
  };
}

describe("FixLens AI — Feature A: Priority Escalation Engine", () => {
  it("detects critical safety hazards and recommends immediate High priority", () => {
    const hazardComplaint = createMockComplaint({
      id: "FX-HAZ-1",
      title: "Exposed live wire sparking near outlet",
      description: "Live wire is hanging loose and sparks occasionally when touched.",
      category: "Electrical",
      priority: "Low",
      urgency: "Low",
    });

    expect(isCriticalSafetyHazard(hazardComplaint)).toBe(true);

    const result = evaluateComplaintEscalation(hazardComplaint, [hazardComplaint]);
    expect(result.isSafetyCritical).toBe(true);
    expect(result.isEscalated).toBe(true);
    expect(result.escalatedPriority).toBe("High");
    expect(result.triggerTypes).toContain("SAFETY_HAZARD");
    expect(result.reasons.some((r) => r.includes("safety hazard"))).toBe(true);
  });

  it("escalates tickets when multiple distinct students report the same issue (recurrence)", () => {
    // 3 distinct students reporting plumbing leak in same room across 3 distinct dates
    const c1 = createMockComplaint({
      id: "FX-REC-1",
      title: "Sink leaking in washroom",
      description: "Water leaking under the sink.",
      building: "MCA Block",
      room: "Washroom 2",
      category: "Plumbing",
      reporter: "Aisha Rahman",
      date: "2026-10-25",
    });

    const c2 = createMockComplaint({
      id: "FX-REC-2",
      title: "Sink pipe burst and leaking",
      description: "Water pooling on the floor from sink leak.",
      building: "MCA Block",
      room: "Washroom 2",
      category: "Plumbing",
      reporter: "Bilal Khan",
      date: "2026-10-28",
    });

    const c3 = createMockComplaint({
      id: "FX-REC-3",
      title: "Major water leak under sink",
      description: "Sink continues to leak severely.",
      building: "MCA Block",
      room: "Washroom 2",
      category: "Plumbing",
      reporter: "Chirag Patel",
      date: "2026-10-31",
    });

    const all = [c1, c2, c3];
    const result = evaluateComplaintEscalation(c3, all);

    expect(result.isEscalated).toBe(true);
    expect(result.escalatedPriority).toBe("High");
    expect(result.factors.distinctReporters).toBe(3);
    expect(result.factors.incidentCount).toBe(3);
    expect(result.triggerTypes).toContain("INDEPENDENT_REPORTERS");
  });

  it("does NOT escalate merely because the same student submits repeated follow-ups", () => {
    const singleComplaint = createMockComplaint({
      id: "FX-FU-1",
      title: "Chair leg wobbly in CS 201",
      description: "Back left leg of chair is loose.",
      category: "Furniture",
      priority: "Low",
      urgency: "Low",
      reporter: "Same Student",
      followUps: [
        { id: "FU-1", content: "Still loose.", date: "2026-11-01", timestamp: "10:00", by: "Same Student" },
        { id: "FU-2", content: "Any updates?", date: "2026-11-01", timestamp: "12:00", by: "Same Student" },
        { id: "FU-3", content: "Still waiting.", date: "2026-11-01", timestamp: "14:00", by: "Same Student" },
      ],
    });

    const result = evaluateComplaintEscalation(singleComplaint, [singleComplaint]);
    // Should NOT be escalated merely for followups
    expect(result.isEscalated).toBe(false);
    expect(result.factors.distinctReporters).toBe(1);
    expect(result.factors.incidentCount).toBe(1);
  });

  it("strictly disables automated escalation for Resolved and Rejected tickets", () => {
    const resolvedComplaint = createMockComplaint({
      id: "FX-RES-1",
      title: "Sparking switch in laboratory",
      description: "Severe electric sparks when flipping switch.",
      category: "Electrical",
      priority: "Low",
      status: "Resolved",
      resolutionNote: "Replaced faulty switchgear on Nov 1.",
    });

    const result = evaluateComplaintEscalation(resolvedComplaint, [resolvedComplaint]);
    expect(result.isEscalated).toBe(false);
    expect(result.escalatedPriority).toBeUndefined();
  });

  it("preserves administrator manual override without silently overwriting it", () => {
    const overriddenComplaint = createMockComplaint({
      id: "FX-OVR-1",
      title: "Broken window latch",
      description: "Latch is broken on window.",
      category: "Safety",
      priority: "Low", // Admin deliberately chose Low
      status: "Under Review",
      isAdminOverride: true,
    });

    const result = evaluateComplaintEscalation(overriddenComplaint, [overriddenComplaint]);
    // The target priority would be High due to category Safety
    expect(result.needsAdminReview).toBe(true);
    // Operational priority must respect the admin override
    expect(result.currentOperationalPriority).toBe("Low");
    expect(result.adminPriority).toBe("Low");
    expect(result.escalatedPriority).toBe("High");
  });

  it("escalates tickets unresolved for extended duration", () => {
    const oldComplaint = createMockComplaint({
      id: "FX-OLD-1",
      title: "Ceiling fan squeaking",
      description: "Fan makes squeaking noise at top speed.",
      category: "Electrical",
      priority: "Low",
      date: "2026-10-15", // 18 days ago
    });

    const refDateMs = new Date("2026-11-02T12:00:00Z").getTime();
    const days = calculateDaysUnresolved(oldComplaint.date, refDateMs);
    expect(days).toBeGreaterThanOrEqual(10);

    const result = evaluateComplaintEscalation(oldComplaint, [oldComplaint], {
      referenceDateMs: refDateMs,
    });

    expect(result.isEscalated).toBe(true);
    expect(result.triggerTypes).toContain("UNRESOLVED_DURATION");
    expect(result.escalatedPriority).toBe("High");
  });

  it("generates structured audit records with factors and timestamps", () => {
    const complaint = createMockComplaint({
      id: "FX-AUD-1",
      title: "Broken glass on stairwell",
      description: "Broken window glass scattered on stairs, safety hazard.",
      category: "Safety",
      priority: "Low",
    });

    const result = evaluateComplaintEscalation(complaint, [complaint]);
    expect(result.auditRecord).toBeDefined();
    expect(result.auditRecord?.complaintId).toBe("FX-AUD-1");
    expect(result.auditRecord?.previousPriority).toBe("Low");
    expect(result.auditRecord?.escalatedPriority).toBe("High");
    expect(result.auditRecord?.factors.safetyHazard).toBe(true);
  });
});
