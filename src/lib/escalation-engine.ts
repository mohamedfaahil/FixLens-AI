import type { Complaint, Priority } from "./demo-data";
import { getRecurrenceForComplaint, normalizeText } from "./triage-engine";

export type EscalationTriggerType =
  | "SAFETY_HAZARD"
  | "RECURRING_INCIDENTS"
  | "INDEPENDENT_REPORTERS"
  | "HIGH_IMPACT"
  | "UNRESOLVED_DURATION"
  | "FREQUENCY_SURGE";

export const SAFETY_HAZARD_KEYWORDS = [
  "spark",
  "sparking",
  "exposed wire",
  "live wire",
  "electric shock",
  "shock",
  "short circuit",
  "fire",
  "smoke",
  "flame",
  "burning",
  "gas leak",
  "chemical leak",
  "ceiling collapse",
  "structural",
  "flooding near panel",
] as const;

export interface EscalationFactors {
  safetyHazard: boolean;
  distinctReporters: number;
  incidentCount: number;
  affectedCount: number;
  daysUnresolved: number;
  isRecurring: boolean;
}

export interface EscalationAuditRecord {
  id: string;
  complaintId: string;
  previousPriority: Priority;
  escalatedPriority: Priority;
  reasons: string[];
  triggerTypes: EscalationTriggerType[];
  factors: EscalationFactors;
  timestamp: string;
  adminReviewed: boolean;
}

export interface ComplaintEscalationResult {
  complaintId: string;
  isEscalated: boolean;
  studentUrgency: Priority;
  predictedPriority: Priority;
  adminPriority: Priority;
  currentOperationalPriority: Priority;
  escalatedPriority?: Priority;
  reasons: string[];
  triggerTypes: EscalationTriggerType[];
  needsAdminReview: boolean;
  isSafetyCritical: boolean;
  factors: EscalationFactors;
  auditRecord?: EscalationAuditRecord;
}

const PRIORITY_ORDER: Record<Priority, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
};

const NUM_TO_PRIORITY: Record<number, Priority> = {
  1: "Low",
  2: "Medium",
  3: "High",
};

/**
 * Checks if a complaint text or category indicates an immediate safety hazard.
 */
export function isCriticalSafetyHazard(complaint: Pick<Complaint, "title" | "description" | "category">): boolean {
  if (complaint.category === "Safety") return true;

  const content = normalizeText(`${complaint.title} ${complaint.description}`);
  for (const kw of SAFETY_HAZARD_KEYWORDS) {
    if (content.includes(kw)) {
      return true;
    }
  }
  return false;
}

/**
 * Computes the age of a complaint in days since creation.
 */
export function calculateDaysUnresolved(dateStr: string, referenceDateMs = Date.now()): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
  const createdMs = isNaN(d.getTime()) ? referenceDateMs : d.getTime();
  const diffDays = Math.floor((referenceDateMs - createdMs) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Evaluates whether an individual complaint should be escalated based on:
 * 1. Immediate safety hazards
 * 2. Distinct recurring incidents & independent student reporters
 * 3. High number of people affected
 * 4. Duration unresolved while open
 *
 * SAFETY GUARDS:
 * - Resolved and Rejected complaints are strictly ineligible for automatic escalation.
 * - Repeated follow-up notes from the same student NEVER count as distinct incidents or reporters.
 * - Administrator overrides are respected and never silently replaced; flagged for review if conflicting.
 * - Priority is capped at "High".
 */
export function evaluateComplaintEscalation(
  complaint: Complaint,
  allComplaints: Complaint[],
  options: { referenceDateMs?: number } = {},
): ComplaintEscalationResult {
  const { referenceDateMs = Date.now() } = options;

  const studentUrgency: Priority = complaint.urgency || "Low";
  const predictedPriority: Priority = complaint.predictedPriority || complaint.priority || "Low";
  const adminPriority: Priority = complaint.priority || predictedPriority;

  // Rule 1: Resolved or Rejected tickets NEVER receive automatic escalation
  const isClosed = complaint.status === "Resolved" || complaint.status === "Rejected";

  const daysUnresolved = calculateDaysUnresolved(complaint.date, referenceDateMs);
  const safetyHazard = isCriticalSafetyHazard(complaint);
  const recurrence = getRecurrenceForComplaint(complaint, allComplaints);
  const affectedCount = complaint.affected || 1;

  const factors: EscalationFactors = {
    safetyHazard,
    distinctReporters: recurrence.isRecurring && recurrence.recurringIssue ? recurrence.recurringIssue.distinctReporters : 1,
    incidentCount: recurrence.isRecurring ? recurrence.incidentCount : 1,
    affectedCount,
    daysUnresolved,
    isRecurring: recurrence.isRecurring,
  };

  if (isClosed) {
    return {
      complaintId: complaint.id,
      isEscalated: false,
      studentUrgency,
      predictedPriority,
      adminPriority,
      currentOperationalPriority: adminPriority,
      reasons: [],
      triggerTypes: [],
      needsAdminReview: false,
      isSafetyCritical: safetyHazard,
      factors,
    };
  }

  const reasons: string[] = [];
  const triggerTypes: EscalationTriggerType[] = [];

  let targetRank = PRIORITY_ORDER[adminPriority] || 1;

  // Factor A: Safety Hazard -> Immediate High priority
  if (safetyHazard) {
    targetRank = Math.max(targetRank, 3);
    triggerTypes.push("SAFETY_HAZARD");
    reasons.push("Immediate safety hazard detected (electrical/fire/safety hazard keywords).");
  }

  // Factor B: Recurring incidents & independent reporters
  if (recurrence.isRecurring && recurrence.recurringIssue) {
    const { distinctReporters, incidentCount } = recurrence.recurringIssue;

    if (distinctReporters >= 3 || incidentCount >= 3) {
      targetRank = Math.max(targetRank, 3);
      triggerTypes.push("INDEPENDENT_REPORTERS");
      reasons.push(
        `Critical recurrence: ${distinctReporters} distinct student reporters across ${incidentCount} confirmed incidents.`,
      );
    } else if (distinctReporters >= 2 || incidentCount >= 2) {
      targetRank = Math.max(targetRank, 2);
      triggerTypes.push("RECURRING_INCIDENTS");
      reasons.push(
        `Repeated reports: ${distinctReporters} students reported ${incidentCount} incidents for this issue.`,
      );
    }
  }

  // Factor C: High student population affected
  if (affectedCount >= 30) {
    if (targetRank < 2) {
      targetRank = 2;
      triggerTypes.push("HIGH_IMPACT");
      reasons.push(`High campus impact: ${affectedCount} students affected.`);
    } else if (daysUnresolved >= 2 && targetRank < 3) {
      targetRank = 3;
      triggerTypes.push("HIGH_IMPACT");
      reasons.push(`High campus impact (${affectedCount} students) remaining unresolved for over 48 hours.`);
    }
  }

  // Factor D: Duration unresolved
  if (daysUnresolved >= 10 && targetRank < 3) {
    targetRank = 3;
    triggerTypes.push("UNRESOLVED_DURATION");
    reasons.push(`Ticket unresolved for ${daysUnresolved} days without final resolution.`);
  } else if (daysUnresolved >= 5 && targetRank < 2) {
    targetRank = 2;
    triggerTypes.push("UNRESOLVED_DURATION");
    reasons.push(`Ticket unresolved for ${daysUnresolved} days.`);
  }

  const calculatedPriority = NUM_TO_PRIORITY[Math.min(3, targetRank)];
  const isEscalated = PRIORITY_ORDER[calculatedPriority] > PRIORITY_ORDER[adminPriority];

  // If administrator manually overrode priority, do not silently replace it; flag for review
  const hasAdminOverride = Boolean((complaint as any).isAdminOverride);
  const needsAdminReview = hasAdminOverride && isEscalated;
  const currentOperationalPriority = hasAdminOverride ? adminPriority : calculatedPriority;

  let auditRecord: EscalationAuditRecord | undefined;
  if (isEscalated) {
    auditRecord = {
      id: `ESC-${complaint.id}-${Date.now()}`,
      complaintId: complaint.id,
      previousPriority: adminPriority,
      escalatedPriority: calculatedPriority,
      reasons,
      triggerTypes,
      factors,
      timestamp: new Date(referenceDateMs).toISOString(),
      adminReviewed: !needsAdminReview,
    };
  }

  return {
    complaintId: complaint.id,
    isEscalated,
    studentUrgency,
    predictedPriority,
    adminPriority,
    currentOperationalPriority,
    escalatedPriority: isEscalated ? calculatedPriority : undefined,
    reasons,
    triggerTypes,
    needsAdminReview,
    isSafetyCritical: safetyHazard,
    factors,
    auditRecord,
  };
}

/**
 * Evaluates all open complaints in the system and returns all currently escalated complaints.
 */
export function evaluateAllEscalations(
  complaints: Complaint[],
  options: { referenceDateMs?: number } = {},
): ComplaintEscalationResult[] {
  return complaints
    .map((c) => evaluateComplaintEscalation(c, complaints, options))
    .filter((res) => res.isEscalated || res.isSafetyCritical || res.needsAdminReview);
}
