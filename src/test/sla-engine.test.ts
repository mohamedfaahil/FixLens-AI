import { describe, it, expect } from "vitest";
import {
  calculateComplaintSLA,
  getCampusSLAStats,
  formatDurationHours,
  SLA_POLICIES,
} from "../lib/sla-engine";
import type { Complaint } from "../lib/demo-data";

describe("FixLens AI — Service Level Agreement (SLA) Engine", () => {
  const BASE_TIME = new Date("2026-11-01T12:00:00.000Z").getTime();

  it("defines institutional SLA policies for all three priority tiers", () => {
    expect(SLA_POLICIES.High.targetHours).toBe(24);
    expect(SLA_POLICIES.Medium.targetHours).toBe(48);
    expect(SLA_POLICIES.Low.targetHours).toBe(120);
  });

  describe("formatDurationHours", () => {
    it("formats minutes when less than 1 hour", () => {
      expect(formatDurationHours(0.5)).toBe("30m");
      expect(formatDurationHours(0.2)).toBe("12m");
    });

    it("formats hours when between 1 and 23 hours", () => {
      expect(formatDurationHours(5)).toBe("5h");
      expect(formatDurationHours(23.2)).toBe("23h");
    });

    it("formats days and hours when 24 hours or greater", () => {
      expect(formatDurationHours(24)).toBe("1d");
      expect(formatDurationHours(28)).toBe("1d 4h");
      expect(formatDurationHours(48)).toBe("2d");
      expect(formatDurationHours(52.5)).toBe("2d 5h");
    });
  });

  describe("calculateComplaintSLA — Active Complaints", () => {
    it("evaluates a High priority ticket filed 6 hours ago as on_track (18h remaining)", () => {
      const createdAt = new Date(BASE_TIME - 6 * 3600 * 1000).toISOString();
      const complaint: Complaint = {
        id: "FX-2001",
        title: "Sparking electrical outlet",
        description: "Outlet in Lab 204 sparking when plugged in.",
        category: "Electrical",
        building: "SM Block",
        room: "Lab 204",
        urgency: "High",
        affected: 20,
        priority: "High",
        status: "In Progress",
        date: createdAt,
        reporter: "Student User",
        timeline: [{ status: "Submitted", date: createdAt, note: "Reported", by: "Student" }],
      };

      const result = calculateComplaintSLA(complaint, BASE_TIME);
      expect(result.priority).toBe("High");
      expect(result.targetHours).toBe(24);
      expect(result.status).toBe("on_track");
      expect(result.isOverdue).toBe(false);
      expect(result.isNearBreach).toBe(false);
      expect(result.remainingHours).toBe(18);
      expect(result.progressPercent).toBe(25);
      expect(result.badgeText).toContain("18h remaining");
    });

    it("evaluates a High priority ticket filed 20 hours ago as near_breach (<25% time remaining)", () => {
      const createdAt = new Date(BASE_TIME - 20 * 3600 * 1000).toISOString();
      const complaint: Complaint = {
        id: "FX-2002",
        title: "Main pipeline burst",
        description: "Water gushing into hallway.",
        category: "Plumbing",
        building: "CS Block",
        room: "Corridor",
        urgency: "High",
        affected: 50,
        priority: "High",
        status: "Under Review",
        date: createdAt,
        timeline: [{ status: "Submitted", date: createdAt, note: "Reported", by: "Student" }],
        reporter: "Student",
      };

      const result = calculateComplaintSLA(complaint, BASE_TIME);
      expect(result.status).toBe("near_breach");
      expect(result.isNearBreach).toBe(true);
      expect(result.isOverdue).toBe(false);
      expect(result.remainingHours).toBe(4);
      expect(result.badgeText).toContain("4h left (Urgent)");
    });

    it("evaluates a High priority ticket filed 28 hours ago as breached (overdue by 4h)", () => {
      const createdAt = new Date(BASE_TIME - 28 * 3600 * 1000).toISOString();
      const complaint: Complaint = {
        id: "FX-2003",
        title: "Hazardous exposed cable",
        description: "Live wire hanging from ceiling.",
        category: "Electrical",
        building: "Admin Block",
        room: "Room 101",
        urgency: "High",
        affected: 30,
        priority: "High",
        status: "Submitted",
        date: createdAt,
        timeline: [{ status: "Submitted", date: createdAt, note: "Reported", by: "Student" }],
        reporter: "Student",
      };

      const result = calculateComplaintSLA(complaint, BASE_TIME);
      expect(result.status).toBe("breached");
      expect(result.isOverdue).toBe(true);
      expect(result.remainingHours).toBe(-4);
      expect(result.badgeText).toBe("Overdue by 4h");
      expect(result.explanation).toContain("SLA Breached");
    });

    it("evaluates a Medium priority ticket (48h target) filed 36 hours ago as on_track (12h remaining)", () => {
      const createdAt = new Date(BASE_TIME - 36 * 3600 * 1000).toISOString();
      const complaint: Complaint = {
        id: "FX-2004",
        title: "Flickering projector",
        description: "Projector bulb flickering during lecture.",
        category: "Equipment",
        building: "Main Auditorium",
        room: "Stage A",
        urgency: "Medium",
        affected: 15,
        priority: "Medium",
        status: "In Progress",
        date: createdAt,
        timeline: [{ status: "Submitted", date: createdAt, note: "Reported", by: "Student" }],
        reporter: "Faculty",
      };

      const result = calculateComplaintSLA(complaint, BASE_TIME);
      expect(result.targetHours).toBe(48);
      expect(result.remainingHours).toBe(12);
      expect(result.status).toBe("near_breach"); // 12h is exactly 25% of 48h
    });
  });

  describe("calculateComplaintSLA — Resolved Complaints", () => {
    it("evaluates a complaint resolved within target as resolved_within_sla", () => {
      const createdAt = "2026-10-10T10:00:00.000Z";
      const resolvedAt = "2026-10-10T22:00:00.000Z"; // 12 hours later
      const complaint: Complaint = {
        id: "FX-2005",
        title: "Leaking faucet",
        description: "Washroom faucet leaking.",
        category: "Plumbing",
        building: "CS Block",
        room: "1st Floor Restroom",
        urgency: "High",
        affected: 10,
        priority: "High", // 24h SLA
        status: "Resolved",
        date: createdAt,
        reporter: "Student",
        timeline: [
          { status: "Submitted", date: createdAt, note: "Reported", by: "Student" },
          { status: "Resolved", date: resolvedAt, note: "Washer replaced", by: "Plumber" },
        ],
      };

      const result = calculateComplaintSLA(complaint);
      expect(result.status).toBe("resolved_within_sla");
      expect(result.isOverdue).toBe(false);
      expect(result.elapsedHours).toBe(12);
      expect(result.badgeText).toContain("Within SLA");
    });

    it("evaluates a complaint resolved past target as resolved_breached", () => {
      const createdAt = "2026-10-10T10:00:00.000Z";
      const resolvedAt = "2026-10-12T10:00:00.000Z"; // 48 hours later (target was 24h)
      const complaint: Complaint = {
        id: "FX-2006",
        title: "Short circuit",
        description: "Breaker tripped.",
        category: "Electrical",
        building: "Main Library",
        room: "Reading Hall",
        urgency: "High",
        affected: 25,
        priority: "High", // 24h SLA
        status: "Resolved",
        date: createdAt,
        reporter: "Student",
        timeline: [
          { status: "Submitted", date: createdAt, note: "Reported", by: "Student" },
          { status: "Resolved", date: resolvedAt, note: "Breaker replaced", by: "Electrician" },
        ],
      };

      const result = calculateComplaintSLA(complaint);
      expect(result.status).toBe("resolved_breached");
      expect(result.isOverdue).toBe(true);
      expect(result.elapsedHours).toBe(48);
      expect(result.badgeText).toContain("SLA Exceeded");
    });
  });

  describe("getCampusSLAStats", () => {
    it("accurately calculates campus compliance metrics across a fleet of complaints", () => {
      const c1: Complaint = {
        id: "FX-3001",
        title: "High On Track",
        description: "desc",
        category: "Electrical",
        building: "SM Block",
        room: "101",
        urgency: "High",
        priority: "High",
        status: "In Progress",
        affected: 1,
        date: new Date(BASE_TIME - 4 * 3600 * 1000).toISOString(), // 4h old (target 24h)
        reporter: "Student",
        timeline: [],
      };

      const c2: Complaint = {
        id: "FX-3002",
        title: "High Overdue",
        description: "desc",
        category: "Electrical",
        building: "SM Block",
        room: "102",
        urgency: "High",
        priority: "High",
        status: "In Progress",
        affected: 1,
        date: new Date(BASE_TIME - 30 * 3600 * 1000).toISOString(), // 30h old (target 24h) -> overdue
        reporter: "Student",
        timeline: [],
      };

      const c3: Complaint = {
        id: "FX-3003",
        title: "Medium Resolved within SLA",
        description: "desc",
        category: "Plumbing",
        building: "CS Block",
        room: "201",
        urgency: "Medium",
        priority: "Medium",
        status: "Resolved",
        affected: 1,
        date: "2026-10-01T10:00:00.000Z",
        reporter: "Student",
        timeline: [
          { status: "Submitted", date: "2026-10-01T10:00:00.000Z", note: "Reported", by: "Student" },
          { status: "Resolved", date: "2026-10-02T10:00:00.000Z", note: "Done", by: "Admin" }, // 24h (target 48h)
        ],
      };

      const stats = getCampusSLAStats([c1, c2, c3], BASE_TIME);
      expect(stats.totalActive).toBe(2);
      expect(stats.activeOverdue).toBe(1);
      expect(stats.activeOnTrack).toBe(1);
      expect(stats.totalResolved).toBe(1);
      expect(stats.resolvedWithinSLA).toBe(1);
      expect(stats.resolvedBreached).toBe(0);
      // 2 compliant out of 3 total = 67%
      expect(stats.overallComplianceRate).toBe(67);
      expect(stats.highPriorityComplianceRate).toBe(50);
      expect(stats.mediumPriorityComplianceRate).toBe(100);
      expect(stats.avgResolutionHours).toBe(24);
    });
  });
});
