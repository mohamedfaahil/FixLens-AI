import { describe, it, expect } from "vitest";
import {
  detectMaintenanceAnomalies,
  type MaintenanceAnomaly,
} from "../lib/anomaly-engine";
import type { Complaint } from "../lib/demo-data";

function createMockComplaint(overrides: Partial<Complaint> = {}): Complaint {
  return {
    id: "FX-100",
    title: "Wi-Fi not working",
    description: "Cannot connect to campus Wi-Fi network.",
    category: "Internet/Wi-Fi",
    building: "CS Block",
    room: "Lab 3",
    urgency: "Medium",
    affected: 20,
    priority: "Medium",
    status: "Submitted",
    date: "2026-11-01",
    reporter: "Student A",
    timeline: [],
    ...overrides,
  };
}

describe("FixLens AI — Feature B: Anomaly Detection Engine", () => {
  it("detects room-level maintenance hotspots when multiple incidents cluster in a room", () => {
    const c1 = createMockComplaint({
      id: "FX-H1",
      title: "Router rebooting constantly in Lab 3",
      description: "Wi-Fi disconnects every few minutes in Lab 3.",
      building: "CS Block",
      room: "Lab 3",
      category: "Internet/Wi-Fi",
      reporter: "Student A",
      date: "2026-10-25",
    });

    const c2 = createMockComplaint({
      id: "FX-H2",
      title: "No signal in Lab 3 second floor",
      description: "Signal dropped completely in Lab 3.",
      building: "CS Block",
      room: "Lab 3",
      category: "Internet/Wi-Fi",
      reporter: "Student B",
      date: "2026-10-28",
    });

    const c3 = createMockComplaint({
      id: "FX-H3",
      title: "Lab 3 Wi-Fi connection failing",
      description: "Students cannot connect to Wi-Fi in Lab 3 practicals.",
      building: "CS Block",
      room: "Lab 3",
      category: "Internet/Wi-Fi",
      reporter: "Student C",
      date: "2026-10-31",
    });

    const result = detectMaintenanceAnomalies([c1, c2, c3]);
    expect(result.insufficientData).toBe(false);

    const hotspot = result.anomalies.find((a) => a.anomalyType === "ROOM_HOTSPOT");
    expect(hotspot).toBeDefined();
    expect(hotspot?.building).toBe("CS Block");
    expect(hotspot?.room).toBe("Lab 3");
    expect(hotspot?.distinctReporters).toBe(3);
    expect(hotspot?.evidence.some((e) => e.label === "Distinct Incidents")).toBe(true);
  });

  it("detects building complaint spikes when volume concentrates in one building", () => {
    const complaints: Complaint[] = [
      createMockComplaint({ id: "FX-S1", building: "Boys Hostel", category: "Plumbing", room: "101" }),
      createMockComplaint({ id: "FX-S2", building: "Boys Hostel", category: "Plumbing", room: "102" }),
      createMockComplaint({ id: "FX-S3", building: "Boys Hostel", category: "Electrical", room: "201" }),
      createMockComplaint({ id: "FX-S4", building: "Boys Hostel", category: "Cleaning", room: "Lobby" }),
      createMockComplaint({ id: "FX-S5", building: "Boys Hostel", category: "Plumbing", room: "301" }),
      createMockComplaint({ id: "FX-S6", building: "CS Block", category: "Furniture", room: "Room 10" }),
    ];

    const result = detectMaintenanceAnomalies(complaints);
    expect(result.insufficientData).toBe(false);

    const spike = result.anomalies.find(
      (a) => a.anomalyType === "BUILDING_SPIKE" && a.building === "Boys Hostel",
    );
    expect(spike).toBeDefined();
    expect(spike?.severity).toBe("High");
    expect(spike?.evidence.some((e) => e.label === "Campus Share")).toBe(true);
  });

  it("returns insufficient-data state when campus complaints are below minimum baseline threshold", () => {
    // Only 1 or 2 complaints in total
    const lowVolumeComplaints = [
      createMockComplaint({ id: "FX-1", building: "CS Block" }),
      createMockComplaint({ id: "FX-2", building: "Library" }),
    ];

    const result = detectMaintenanceAnomalies(lowVolumeComplaints, [], { minCampusComplaints: 3 });
    expect(result.insufficientData).toBe(true);
    expect(result.anomalies).toHaveLength(0);
    expect(result.insufficientDataReason).toContain("Insufficient complaint volume");
  });

  it("preserves anomaly lifecycle state (Acknowledged, Investigating, Resolved) across re-evaluations", () => {
    const c1 = createMockComplaint({ id: "FX-1", building: "CS Block", room: "Lab 1", category: "Electrical" });
    const c2 = createMockComplaint({ id: "FX-2", building: "CS Block", room: "Lab 1", category: "Electrical", date: "2026-10-28" });
    const c3 = createMockComplaint({ id: "FX-3", building: "CS Block", room: "Lab 1", category: "Electrical", date: "2026-11-01" });

    // Initial detection
    const firstRun = detectMaintenanceAnomalies([c1, c2, c3]);
    const firstAnomaly = firstRun.anomalies[0];
    expect(firstAnomaly).toBeDefined();
    expect(firstAnomaly.status).toBe("New");

    // Administrator acknowledges anomaly
    const acknowledgedAnomaly: MaintenanceAnomaly = {
      ...firstAnomaly,
      status: "Acknowledged",
      adminNotes: "Electrician dispatched to check primary circuit.",
    };

    // Re-running detection with acknowledged state
    const secondRun = detectMaintenanceAnomalies([c1, c2, c3], [acknowledgedAnomaly]);
    const reevaluated = secondRun.anomalies.find((a) => a.id === firstAnomaly.id);

    expect(reevaluated?.status).toBe("Acknowledged");
    expect(reevaluated?.adminNotes).toBe("Electrician dispatched to check primary circuit.");
  });

  it("uses deterministic anomaly IDs to prevent duplicate anomaly records", () => {
    const complaints = [
      createMockComplaint({ id: "FX-1", building: "Main Library", room: "Reading Hall", category: "Cleaning" }),
      createMockComplaint({ id: "FX-2", building: "Main Library", room: "Reading Hall", category: "Cleaning", date: "2026-10-27" }),
      createMockComplaint({ id: "FX-3", building: "Main Library", room: "Reading Hall", category: "Cleaning", date: "2026-10-30" }),
    ];

    const run1 = detectMaintenanceAnomalies(complaints);
    const run2 = detectMaintenanceAnomalies(complaints);

    expect(run1.anomalies.map((a) => a.id)).toEqual(run2.anomalies.map((a) => a.id));
  });
});
