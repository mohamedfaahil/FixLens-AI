import type { Category, Complaint, Priority } from "./demo-data";
import { detectRecurringIssues, normalizeRoom, normalizeText } from "./triage-engine";
import { calculateDaysUnresolved, isCriticalSafetyHazard } from "./escalation-engine";

export type AnomalyType =
  | "BUILDING_SPIKE"
  | "ROOM_HOTSPOT"
  | "CATEGORY_SURGE"
  | "UNRESOLVED_BACKLOG"
  | "MULTI_STUDENT_HAZARD";

export type AnomalyStatus = "New" | "Investigating" | "Acknowledged" | "Resolved";

export interface AnomalyEvidence {
  label: string;
  value: string | number;
  detail?: string;
}

export interface MaintenanceAnomaly {
  id: string; // Deterministic deduplication key
  title: string;
  anomalyType: AnomalyType;
  severity: Priority;
  building: string;
  room?: string;
  category?: Category;
  description: string;
  evidence: AnomalyEvidence[];
  contributingComplaintIds: string[];
  distinctReporters: number;
  incidentCount: number;
  status: AnomalyStatus;
  detectedAt: string;
  resolvedAt?: string;
  adminNotes?: string;
}

export interface AnomalyDetectionResult {
  anomalies: MaintenanceAnomaly[];
  insufficientData: boolean;
  insufficientDataReason?: string;
  totalEvaluated: number;
  summary: {
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
    activeHotspots: number;
  };
}

export interface AnomalyDetectionOptions {
  minCampusComplaints?: number;
  referenceDateMs?: number;
}

/**
 * Detects campus maintenance anomalies using explainable statistical and pattern-based rules.
 *
 * REUSES:
 * - Phase 1 recurring issue detection and distinct incident counting from triage-engine.
 *
 * SAFEGUARDS:
 * - If complaint data is below minimum threshold (< 3 records), returns an insufficientData state.
 * - Does not count follow-up notes as complaints.
 * - Does not count duplicate reports as separate incidents.
 * - Uses deterministic IDs to deduplicate anomalies.
 * - Supports lifecycle states (New -> Investigating -> Acknowledged -> Resolved).
 */
export function detectMaintenanceAnomalies(
  complaints: Complaint[],
  existingAnomalies: MaintenanceAnomaly[] = [],
  options: AnomalyDetectionOptions = {},
): AnomalyDetectionResult {
  const { minCampusComplaints = 3, referenceDateMs = Date.now() } = options;

  // Filter to active / relevant complaints
  const activeComplaints = complaints.filter(
    (c) => c.status !== "Rejected",
  );

  if (activeComplaints.length < minCampusComplaints) {
    return {
      anomalies: [],
      insufficientData: true,
      insufficientDataReason: `Insufficient complaint volume to evaluate campus anomalies (${activeComplaints.length}/${minCampusComplaints} required records).`,
      totalEvaluated: activeComplaints.length,
      summary: {
        highSeverity: 0,
        mediumSeverity: 0,
        lowSeverity: 0,
        activeHotspots: 0,
      },
    };
  }

  const detected: MaintenanceAnomaly[] = [];
  const detectedAtStr = new Date(referenceDateMs).toISOString();

  // ------------------------------------------------------------------
  // Rule 1: Room & Laboratory Maintenance Hotspots
  // ------------------------------------------------------------------
  const recurringIssues = detectRecurringIssues(activeComplaints, { minReports: 2 });

  for (const issue of recurringIssues) {
    // Hotspot trigger: at least 2 distinct incidents OR at least 3 total reports in the same room/lab
    if (issue.incidentCount >= 2 || issue.totalReports >= 3) {
      const isElectricalOrSafety = issue.category === "Electrical" || issue.category === "Safety";
      const hasSafetyKeyword = issue.complaints.some((c) => isCriticalSafetyHazard(c));
      const isHighSeverity = isElectricalOrSafety || hasSafetyKeyword || issue.distinctReporters >= 3;

      const bNorm = normalizeText(issue.building).replace(/\s+/g, "-");
      const rNorm = normalizeRoom(issue.room).replace(/\s+/g, "-") || "general";
      const cNorm = normalizeText(issue.category).replace(/\s+/g, "-");
      const id = `hotspot-${bNorm}-${rNorm}-${cNorm}`;

      detected.push({
        id,
        title: `Maintenance Hotspot: ${issue.building}, ${issue.room || "Facility Area"}`,
        anomalyType: "ROOM_HOTSPOT",
        severity: isHighSeverity ? "High" : "Medium",
        building: issue.building,
        room: issue.room,
        category: issue.category,
        description: `Persistent ${issue.category.toLowerCase()} issues detected with ${issue.totalReports} reports across ${issue.incidentCount} distinct incidents by ${issue.distinctReporters} students.`,
        evidence: [
          { label: "Distinct Incidents", value: issue.incidentCount, detail: "Deduplicated physical occurrences" },
          { label: "Total Reports", value: issue.totalReports, detail: "All student submissions" },
          { label: "Unique Reporters", value: issue.distinctReporters, detail: issue.reporters.join(", ") },
          { label: "Maintenance Category", value: issue.category },
          { label: "Location", value: `${issue.building}, ${issue.room || "General"}` },
        ],
        contributingComplaintIds: issue.complaintIds,
        distinctReporters: issue.distinctReporters,
        incidentCount: issue.incidentCount,
        status: "New",
        detectedAt: detectedAtStr,
      });
    }
  }

  // ------------------------------------------------------------------
  // Rule 2: Building Complaint Spikes / Disproportionate Concentration
  // ------------------------------------------------------------------
  const buildingCounts = new Map<string, Complaint[]>();
  for (const c of activeComplaints) {
    const list = buildingCounts.get(c.building) || [];
    list.push(c);
    buildingCounts.set(c.building, list);
  }

  const totalActive = activeComplaints.length;
  for (const [building, bComplaints] of buildingCounts.entries()) {
    const ratio = bComplaints.length / totalActive;
    // Trigger if building has >= 3 complaints AND accounts for >= 35% of all active complaints
    if (bComplaints.length >= 3 && (ratio >= 0.35 || bComplaints.length >= 5)) {
      const bNorm = normalizeText(building).replace(/\s+/g, "-");
      const id = `spike-${bNorm}`;

      const uniqueReporters = new Set(bComplaints.map((c) => c.reporter.trim()).filter(Boolean)).size;
      const categories = Array.from(new Set(bComplaints.map((c) => c.category))).join(", ");
      const isHigh = bComplaints.length >= 5 || ratio >= 0.5;

      detected.push({
        id,
        title: `Elevated Maintenance Volume in ${building}`,
        anomalyType: "BUILDING_SPIKE",
        severity: isHigh ? "High" : "Medium",
        building,
        description: `${building} accounts for ${Math.round(ratio * 100)}% of all campus maintenance complaints (${bComplaints.length} active tickets across ${categories}).`,
        evidence: [
          { label: "Active Complaints", value: bComplaints.length },
          { label: "Campus Share", value: `${Math.round(ratio * 100)}%`, detail: "Of all campus maintenance records" },
          { label: "Independent Reporters", value: uniqueReporters },
          { label: "Primary Categories", value: categories },
        ],
        contributingComplaintIds: bComplaints.map((c) => c.id),
        distinctReporters: uniqueReporters,
        incidentCount: bComplaints.length,
        status: "New",
        detectedAt: detectedAtStr,
      });
    }
  }

  // ------------------------------------------------------------------
  // Rule 3: Category Cluster Surges in a Building
  // ------------------------------------------------------------------
  const buildingCategoryCounts = new Map<string, Complaint[]>();
  for (const c of activeComplaints) {
    const key = `${c.building}:::${c.category}`;
    const list = buildingCategoryCounts.get(key) || [];
    list.push(c);
    buildingCategoryCounts.set(key, list);
  }

  for (const [key, bcComplaints] of buildingCategoryCounts.entries()) {
    const [building, category] = key.split(":::") as [string, Category];
    if (bcComplaints.length >= 3) {
      const bNorm = normalizeText(building).replace(/\s+/g, "-");
      const cNorm = normalizeText(category).replace(/\s+/g, "-");
      const id = `catsurge-${bNorm}-${cNorm}`;

      // Avoid duplicating if already flagged by room hotspot
      const alreadyCovered = detected.some(
        (a) => a.anomalyType === "ROOM_HOTSPOT" && a.building === building && a.category === category,
      );

      if (!alreadyCovered) {
        const uniqueReporters = new Set(bcComplaints.map((c) => c.reporter.trim()).filter(Boolean)).size;
        const totalAffected = bcComplaints.reduce((acc, c) => acc + (c.affected || 1), 0);
        const isHazardous = category === "Electrical" || category === "Safety" || category === "Plumbing";

        detected.push({
          id,
          title: `Category Surge: ${category} in ${building}`,
          anomalyType: "CATEGORY_SURGE",
          severity: isHazardous ? "High" : "Medium",
          building,
          category,
          description: `Unusual concentration of ${bcComplaints.length} ${category.toLowerCase()} issues in ${building} impacting approximately ${totalAffected} people.`,
          evidence: [
            { label: "Category Complaints", value: bcComplaints.length },
            { label: "Total Students Impacted", value: totalAffected },
            { label: "Unique Reporters", value: uniqueReporters },
          ],
          contributingComplaintIds: bcComplaints.map((c) => c.id),
          distinctReporters: uniqueReporters,
          incidentCount: bcComplaints.length,
          status: "New",
          detectedAt: detectedAtStr,
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // Rule 4: Unresolved Backlog Accumulation
  // ------------------------------------------------------------------
  for (const [building, bComplaints] of buildingCounts.entries()) {
    const unresolvedLong = bComplaints.filter(
      (c) => c.status !== "Resolved" && calculateDaysUnresolved(c.date, referenceDateMs) >= 3,
    );

    if (unresolvedLong.length >= 4) {
      const bNorm = normalizeText(building).replace(/\s+/g, "-");
      const id = `backlog-${bNorm}`;

      detected.push({
        id,
        title: `Unresolved Backlog Accumulation in ${building}`,
        anomalyType: "UNRESOLVED_BACKLOG",
        severity: unresolvedLong.length >= 6 ? "High" : "Medium",
        building,
        description: `${unresolvedLong.length} complaints in ${building} remain open for 3 or more days without resolution.`,
        evidence: [
          { label: "Aging Complaints", value: unresolvedLong.length, detail: "Open >= 3 days" },
          { label: "Earliest Open Ticket", value: unresolvedLong[0]?.date || "N/A" },
        ],
        contributingComplaintIds: unresolvedLong.map((c) => c.id),
        distinctReporters: new Set(unresolvedLong.map((c) => c.reporter.trim())).size,
        incidentCount: unresolvedLong.length,
        status: "New",
        detectedAt: detectedAtStr,
      });
    }
  }

  // ------------------------------------------------------------------
  // Reconcile with existing anomaly states (Preserve admin lifecycle!)
  // ------------------------------------------------------------------
  const existingMap = new Map<string, MaintenanceAnomaly>();
  for (const a of existingAnomalies) {
    existingMap.set(a.id, a);
  }

  const mergedAnomalies: MaintenanceAnomaly[] = detected.map((d) => {
    const existing = existingMap.get(d.id);
    if (existing) {
      return {
        ...d,
        status: existing.status,
        adminNotes: existing.adminNotes,
        resolvedAt: existing.resolvedAt,
        detectedAt: existing.detectedAt, // Preserve first detected timestamp
      };
    }
    return d;
  });

  // Also include previously resolved or acknowledged anomalies that are still tracked
  for (const a of existingAnomalies) {
    if (!mergedAnomalies.some((m) => m.id === a.id)) {
      if (a.status === "Resolved" || a.status === "Acknowledged") {
        mergedAnomalies.push(a);
      }
    }
  }

  const highSeverity = mergedAnomalies.filter((a) => a.severity === "High" && a.status !== "Resolved").length;
  const mediumSeverity = mergedAnomalies.filter((a) => a.severity === "Medium" && a.status !== "Resolved").length;
  const lowSeverity = mergedAnomalies.filter((a) => a.severity === "Low" && a.status !== "Resolved").length;
  const activeHotspots = mergedAnomalies.filter((a) => a.anomalyType === "ROOM_HOTSPOT" && a.status !== "Resolved").length;

  return {
    anomalies: mergedAnomalies,
    insufficientData: false,
    totalEvaluated: activeComplaints.length,
    summary: {
      highSeverity,
      mediumSeverity,
      lowSeverity,
      activeHotspots,
    },
  };
}
