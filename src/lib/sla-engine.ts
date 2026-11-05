import type { Complaint, Priority } from "./demo-data";

/**
 * Service Level Agreement (SLA) policy specification by Priority tier.
 * Based on institutional campus facility management best practices:
 * - High Priority (Safety hazards, power outage, flooded lab): 24 Hours
 * - Medium Priority (Classroom lighting, leaking tap, broken chair): 48 Hours
 * - Low Priority (Aesthetic touch-ups, routine inspection, signage): 120 Hours (5 Days)
 */
export interface SLAPolicy {
  priority: Priority;
  targetHours: number;
  label: string;
  description: string;
}

export const SLA_POLICIES: Record<Priority, SLAPolicy> = {
  High: {
    priority: "High",
    targetHours: 24,
    label: "24h Urgent SLA",
    description: "Urgent resolution required within 24 hours of filing.",
  },
  Medium: {
    priority: "Medium",
    targetHours: 48,
    label: "48h Standard SLA",
    description: "Standard facility resolution required within 48 hours.",
  },
  Low: {
    priority: "Low",
    targetHours: 120, // 5 Days
    label: "5-Day Routine SLA",
    description: "Routine maintenance target of 5 calendar days (120 hours).",
  },
};

export type SLAStatus =
  | "on_track"
  | "near_breach"
  | "breached"
  | "resolved_within_sla"
  | "resolved_breached";

export type SLASeverity = "normal" | "warning" | "critical" | "success" | "muted_warning";

export interface ComplaintSLAResult {
  complaintId: string;
  priority: Priority;
  targetHours: number;
  policyLabel: string;
  createdAt: Date;
  deadline: Date;
  resolvedAt?: Date;
  elapsedHours: number;
  remainingHours: number;
  isOverdue: boolean;
  isNearBreach: boolean;
  status: SLAStatus;
  severity: SLASeverity;
  badgeText: string;
  progressPercent: number; // 0 to 100
  explanation: string;
}

export interface CampusSLAStats {
  totalActive: number;
  activeOverdue: number;
  activeNearBreach: number;
  activeOnTrack: number;
  totalResolved: number;
  resolvedWithinSLA: number;
  resolvedBreached: number;
  overallComplianceRate: number; // 0 to 100 percentage
  highPriorityComplianceRate: number;
  mediumPriorityComplianceRate: number;
  lowPriorityComplianceRate: number;
  avgResolutionHours: number;
}

/**
 * Formats a duration in fractional hours into a clean human string (e.g. "14h", "2d 4h").
 */
export function formatDurationHours(rawHours: number): string {
  const positiveHours = Math.max(0, Math.round(rawHours * 10) / 10);
  if (positiveHours < 1) {
    const mins = Math.max(1, Math.round(positiveHours * 60));
    return `${mins}m`;
  }
  if (positiveHours < 24) {
    const intHours = Math.round(positiveHours);
    return `${intHours}h`;
  }
  const days = Math.floor(positiveHours / 24);
  const remHours = Math.round(positiveHours % 24);
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

/**
 * Parses a complaint creation timestamp safely from timeline or date field.
 */
export function getComplaintCreationDate(complaint: Complaint): Date {
  if (complaint.date) {
    // If date string contains time or ISO format, parse directly; otherwise normalize to start of day
    const parsed = new Date(complaint.date.includes("T") ? complaint.date : `${complaint.date}T09:00:00`);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (complaint.timeline && complaint.timeline.length > 0) {
    const firstEvent = complaint.timeline[0];
    const parsed = new Date(firstEvent.date.includes("T") ? firstEvent.date : `${firstEvent.date}T09:00:00`);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/**
 * Parses the resolution date for a complaint from its timeline.
 */
export function getComplaintResolutionDate(complaint: Complaint): Date | undefined {
  if (!["Resolved", "Rejected"].includes(complaint.status)) {
    return undefined;
  }
  if (complaint.timeline && complaint.timeline.length > 0) {
    const resolvedEvent = [...complaint.timeline]
      .reverse()
      .find((ev) => ev.status === "Resolved" || ev.status === "Rejected");
    if (resolvedEvent) {
      const parsed = new Date(
        resolvedEvent.date.includes("T") ? resolvedEvent.date : `${resolvedEvent.date}T17:00:00`,
      );
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  return getComplaintCreationDate(complaint);
}

/**
 * Calculates real-time SLA metrics, deadline, progress and breach status for a single complaint.
 */
export function calculateComplaintSLA(
  complaint: Complaint,
  referenceTime?: number | Date,
): ComplaintSLAResult {
  const priority: Priority = complaint.priority || "Medium";
  const policy = SLA_POLICIES[priority] || SLA_POLICIES.Medium;
  const targetHours = policy.targetHours;

  const createdAt = getComplaintCreationDate(complaint);
  const deadline = new Date(createdAt.getTime() + targetHours * 3600 * 1000);
  const now = referenceTime ? new Date(referenceTime).getTime() : Date.now();

  const isResolved = ["Resolved", "Rejected"].includes(complaint.status);

  if (isResolved) {
    const resolvedAt = getComplaintResolutionDate(complaint) || createdAt;
    const durationMs = Math.max(0, resolvedAt.getTime() - createdAt.getTime());
    const durationHours = durationMs / (3600 * 1000);
    const metSLA = durationHours <= targetHours;
    const progressPercent = Math.min(100, Math.round((durationHours / targetHours) * 100));

    return {
      complaintId: complaint.id,
      priority,
      targetHours,
      policyLabel: policy.label,
      createdAt,
      deadline,
      resolvedAt,
      elapsedHours: Math.round(durationHours * 10) / 10,
      remainingHours: 0,
      isOverdue: !metSLA,
      isNearBreach: false,
      status: metSLA ? "resolved_within_sla" : "resolved_breached",
      severity: metSLA ? "success" : "muted_warning",
      badgeText: metSLA
        ? `Resolved in ${formatDurationHours(durationHours)} (Within SLA)`
        : `Resolved in ${formatDurationHours(durationHours)} (SLA Exceeded)`,
      progressPercent,
      explanation: metSLA
        ? `Resolved successfully within the ${targetHours}-hour target window.`
        : `Resolution took ${formatDurationHours(durationHours)}, exceeding the ${targetHours}-hour SLA deadline.`,
    };
  }

  // Active / Open ticket evaluation
  const elapsedMs = Math.max(0, now - createdAt.getTime());
  const elapsedHours = elapsedMs / (3600 * 1000);
  const remainingHours = targetHours - elapsedHours;
  const isOverdue = remainingHours < 0;
  // Near breach if less than 25% of target time remains (e.g. < 6h for High, < 12h for Medium)
  const isNearBreach = !isOverdue && remainingHours <= targetHours * 0.25;

  let status: SLAStatus = "on_track";
  let severity: SLASeverity = "normal";
  let badgeText = `${formatDurationHours(remainingHours)} remaining`;
  let explanation = `On track. Target resolution deadline is ${deadline.toLocaleDateString()} ${deadline.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`;

  if (isOverdue) {
    status = "breached";
    severity = "critical";
    badgeText = `Overdue by ${formatDurationHours(Math.abs(remainingHours))}`;
    explanation = `SLA Breached! Ticket has exceeded the ${targetHours}-hour resolution threshold by ${formatDurationHours(Math.abs(remainingHours))}. Escalation advised.`;
  } else if (isNearBreach) {
    status = "near_breach";
    severity = "warning";
    badgeText = `${formatDurationHours(remainingHours)} left (Urgent)`;
    explanation = `Approaching SLA deadline! Less than ${formatDurationHours(remainingHours)} remaining to complete resolution.`;
  }

  const rawPercent = Math.round((elapsedHours / targetHours) * 100);
  const progressPercent = Math.min(100, Math.max(0, rawPercent));

  return {
    complaintId: complaint.id,
    priority,
    targetHours,
    policyLabel: policy.label,
    createdAt,
    deadline,
    elapsedHours: Math.round(elapsedHours * 10) / 10,
    remainingHours: Math.round(remainingHours * 10) / 10,
    isOverdue,
    isNearBreach,
    status,
    severity,
    badgeText,
    progressPercent,
    explanation,
  };
}

/**
 * Computes institutional SLA performance analytics across an array of complaints.
 */
export function getCampusSLAStats(
  complaints: Complaint[],
  referenceTime?: number | Date,
): CampusSLAStats {
  const active = complaints.filter((c) => !["Resolved", "Rejected"].includes(c.status));
  const resolved = complaints.filter((c) => c.status === "Resolved");

  let activeOverdue = 0;
  let activeNearBreach = 0;
  let activeOnTrack = 0;

  for (const c of active) {
    const sla = calculateComplaintSLA(c, referenceTime);
    if (sla.status === "breached") {
      activeOverdue++;
    } else if (sla.status === "near_breach") {
      activeNearBreach++;
    } else {
      activeOnTrack++;
    }
  }

  let resolvedWithinSLA = 0;
  let resolvedBreached = 0;
  let totalResolutionHours = 0;

  for (const c of resolved) {
    const sla = calculateComplaintSLA(c, referenceTime);
    if (sla.status === "resolved_within_sla") {
      resolvedWithinSLA++;
    } else {
      resolvedBreached++;
    }
    totalResolutionHours += sla.elapsedHours;
  }

  // Calculate compliance rate (resolved within SLA + active on track / total)
  const totalEvaluated = resolved.length + active.length;
  const compliantCount = resolvedWithinSLA + activeOnTrack;
  const overallComplianceRate =
    totalEvaluated > 0 ? Math.round((compliantCount / totalEvaluated) * 100) : 100;

  const calculatePriorityCompliance = (p: Priority) => {
    const pComplaints = complaints.filter((c) => c.priority === p);
    if (pComplaints.length === 0) return 100;
    const pCompliant = pComplaints.filter((c) => {
      const sla = calculateComplaintSLA(c, referenceTime);
      return sla.status === "on_track" || sla.status === "resolved_within_sla";
    }).length;
    return Math.round((pCompliant / pComplaints.length) * 100);
  };

  const avgResolutionHours =
    resolved.length > 0 ? Math.round((totalResolutionHours / resolved.length) * 10) / 10 : 0;

  return {
    totalActive: active.length,
    activeOverdue,
    activeNearBreach,
    activeOnTrack,
    totalResolved: resolved.length,
    resolvedWithinSLA,
    resolvedBreached,
    overallComplianceRate,
    highPriorityComplianceRate: calculatePriorityCompliance("High"),
    mediumPriorityComplianceRate: calculatePriorityCompliance("Medium"),
    lowPriorityComplianceRate: calculatePriorityCompliance("Low"),
    avgResolutionHours,
  };
}
