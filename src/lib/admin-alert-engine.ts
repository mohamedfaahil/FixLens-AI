import type { Complaint, Priority } from "./demo-data";
import { evaluateAllEscalations, type ComplaintEscalationResult } from "./escalation-engine";
import {
  detectMaintenanceAnomalies,
  type MaintenanceAnomaly,
  type AnomalyDetectionResult,
} from "./anomaly-engine";

export type AdminAlertType =
  | "PRIORITY_ESCALATION"
  | "SAFETY_HAZARD"
  | "MAINTENANCE_ANOMALY"
  | "ROOM_HOTSPOT"
  | "UNRESOLVED_DURATION";

export type AlertStatus = "New" | "Investigating" | "Acknowledged" | "Resolved";

export interface AdminAlert {
  id: string;
  title: string;
  type: AdminAlertType;
  severity: Priority;
  building: string;
  room?: string;
  complaintId?: string;
  anomalyId?: string;
  description: string;
  reasons: string[];
  detectedAt: string;
  status: AlertStatus;
  adminNotes?: string;
  resolvedAt?: string;
}

export interface AdminAlertsSnapshot {
  alerts: AdminAlert[];
  anomalies: MaintenanceAnomaly[];
  escalations: ComplaintEscalationResult[];
  insufficientData: boolean;
  insufficientDataReason?: string;
  summary: {
    totalActiveAlerts: number;
    criticalHazards: number;
    escalatedComplaints: number;
    activeAnomalies: number;
    acknowledgedCount: number;
    resolvedCount: number;
  };
}

/**
 * Generates unified dynamic administrative alerts by synthesizing:
 * 1. Escalated tickets and safety hazards from the escalation engine
 * 2. Spatial and category anomalies from the anomaly detection engine
 *
 * PRESERVES:
 * - Admin lifecycle states (Acknowledged, Investigating, Resolved)
 * - Deterministic deduplication across re-renders
 */
export function generateAdminAlerts(
  complaints: Complaint[],
  existingAlerts: AdminAlert[] = [],
  existingAnomalies: MaintenanceAnomaly[] = [],
  options: { referenceDateMs?: number } = {},
): AdminAlertsSnapshot {
  const { referenceDateMs = Date.now() } = options;

  // 1. Evaluate Escalations
  const escalations = evaluateAllEscalations(complaints, { referenceDateMs });

  // 2. Evaluate Anomalies
  const anomalyResult: AnomalyDetectionResult = detectMaintenanceAnomalies(
    complaints,
    existingAnomalies,
    { referenceDateMs },
  );

  const existingAlertsMap = new Map<string, AdminAlert>();
  for (const a of existingAlerts) {
    existingAlertsMap.set(a.id, a);
  }

  const generatedAlerts: AdminAlert[] = [];

  // Transform Escalations into Admin Alerts
  for (const esc of escalations) {
    const complaint = complaints.find((c) => c.id === esc.complaintId);
    if (!complaint) continue;

    const isSafety = esc.isSafetyCritical;
    const alertId = `alert-esc-${esc.complaintId}`;

    const title = isSafety
      ? `Critical Safety Hazard: ${complaint.building}, ${complaint.room || "Facility"}`
      : `Priority Escalation: Ticket ${esc.complaintId} (${esc.adminPriority} -> ${esc.escalatedPriority || esc.currentOperationalPriority})`;

    const alertType: AdminAlertType = isSafety
      ? "SAFETY_HAZARD"
      : esc.triggerTypes.includes("UNRESOLVED_DURATION")
        ? "UNRESOLVED_DURATION"
        : "PRIORITY_ESCALATION";

    const severity: Priority = isSafety ? "High" : esc.escalatedPriority || esc.currentOperationalPriority;

    const existing = existingAlertsMap.get(alertId);

    generatedAlerts.push({
      id: alertId,
      title,
      type: alertType,
      severity,
      building: complaint.building,
      room: complaint.room,
      complaintId: esc.complaintId,
      description: isSafety
        ? `Immediate hazard identified in ticket ${esc.complaintId}: ${complaint.title}. Requires urgent facilities inspection.`
        : `Operational priority escalated to ${esc.escalatedPriority} due to ${esc.reasons.join(" ")}`,
      reasons: esc.reasons,
      detectedAt: existing ? existing.detectedAt : new Date(referenceDateMs).toISOString(),
      status: existing ? existing.status : "New",
      adminNotes: existing?.adminNotes,
      resolvedAt: existing?.resolvedAt,
    });
  }

  // Transform Anomalies into Admin Alerts
  for (const anom of anomalyResult.anomalies) {
    const alertId = `alert-anom-${anom.id}`;
    const existing = existingAlertsMap.get(alertId);

    const alertType: AdminAlertType =
      anom.anomalyType === "ROOM_HOTSPOT" ? "ROOM_HOTSPOT" : "MAINTENANCE_ANOMALY";

    generatedAlerts.push({
      id: alertId,
      title: anom.title,
      type: alertType,
      severity: anom.severity,
      building: anom.building,
      room: anom.room,
      anomalyId: anom.id,
      complaintId: anom.contributingComplaintIds[0],
      description: anom.description,
      reasons: anom.evidence.map((e) => `${e.label}: ${e.value}${e.detail ? ` (${e.detail})` : ""}`),
      detectedAt: existing ? existing.detectedAt : anom.detectedAt,
      status: existing ? existing.status : anom.status,
      adminNotes: existing?.adminNotes || anom.adminNotes,
      resolvedAt: existing?.resolvedAt || anom.resolvedAt,
    });
  }

  // Preserve any previously resolved/acknowledged alerts no longer triggered
  for (const a of existingAlerts) {
    if (!generatedAlerts.some((g) => g.id === a.id)) {
      if (a.status === "Resolved" || a.status === "Acknowledged") {
        generatedAlerts.push(a);
      }
    }
  }

  // Compute summary metrics
  const totalActiveAlerts = generatedAlerts.filter((a) => a.status !== "Resolved").length;
  const criticalHazards = generatedAlerts.filter(
    (a) => a.type === "SAFETY_HAZARD" && a.status !== "Resolved",
  ).length;
  const escalatedComplaints = generatedAlerts.filter(
    (a) => a.type === "PRIORITY_ESCALATION" && a.status !== "Resolved",
  ).length;
  const activeAnomalies = generatedAlerts.filter(
    (a) => (a.type === "MAINTENANCE_ANOMALY" || a.type === "ROOM_HOTSPOT") && a.status !== "Resolved",
  ).length;
  const acknowledgedCount = generatedAlerts.filter((a) => a.status === "Acknowledged").length;
  const resolvedCount = generatedAlerts.filter((a) => a.status === "Resolved").length;

  return {
    alerts: generatedAlerts,
    anomalies: anomalyResult.anomalies,
    escalations,
    insufficientData: anomalyResult.insufficientData,
    insufficientDataReason: anomalyResult.insufficientDataReason,
    summary: {
      totalActiveAlerts,
      criticalHazards,
      escalatedComplaints,
      activeAnomalies,
      acknowledgedCount,
      resolvedCount,
    },
  };
}
