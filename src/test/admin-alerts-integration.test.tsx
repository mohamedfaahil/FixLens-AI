import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { DemoStoreProvider, useDemoStore } from "../lib/demo-store";
import { AdminAlertsPanel } from "../components/fixlens/AdminAlertsPanel";
import { ComplaintEscalationDetail } from "../components/fixlens/ComplaintEscalationDetail";
import { generateAdminAlerts } from "../lib/admin-alert-engine";
import type { Complaint } from "../lib/demo-data";
import type { ReactNode } from "react";

function Wrapper({ children }: { children: ReactNode }) {
  return <DemoStoreProvider>{children}</DemoStoreProvider>;
}

describe("FixLens AI — Feature C: Dynamic Admin Alerts & UI Integration", () => {
  it("synthesizes priority escalations and anomalies into unified admin alerts", () => {
    const complaints: Complaint[] = [
      {
        id: "FX-1",
        title: "Sparking switchgear in CS Lab 2",
        description: "Dangerous sparks emitting from circuit switchgear, electrical hazard.",
        category: "Electrical",
        building: "CS Block",
        room: "Lab 2",
        urgency: "Medium",
        affected: 30,
        priority: "Low",
        status: "Submitted",
        date: "2026-11-01",
        reporter: "Aisha Rahman",
        timeline: [],
      },
      {
        id: "FX-2",
        title: "Water pipe leaking in CS Lab 2",
        description: "Pipe leaking onto floor in Lab 2.",
        category: "Plumbing",
        building: "CS Block",
        room: "Lab 2",
        urgency: "Low",
        affected: 10,
        priority: "Low",
        status: "Submitted",
        date: "2026-10-28",
        reporter: "Bilal",
        timeline: [],
      },
      {
        id: "FX-3",
        title: "Ceiling leak in CS Lab 2",
        description: "Water dripping from ceiling in Lab 2.",
        category: "Plumbing",
        building: "CS Block",
        room: "Lab 2",
        urgency: "Low",
        affected: 10,
        priority: "Low",
        status: "Submitted",
        date: "2026-10-31",
        reporter: "Chirag",
        timeline: [],
      },
    ];

    const snapshot = generateAdminAlerts(complaints);
    expect(snapshot.alerts.length).toBeGreaterThanOrEqual(1);

    // Hazard alert should be generated
    const safetyAlert = snapshot.alerts.find((a) => a.type === "SAFETY_HAZARD");
    expect(safetyAlert).toBeDefined();
    expect(safetyAlert?.severity).toBe("High");
    expect(safetyAlert?.complaintId).toBe("FX-1");
  });

  it("renders AdminAlertsPanel with interactive status transitions in DemoStore", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper: Wrapper });

    // Ensure store has alerts
    expect(result.current.adminAlerts).toBeDefined();

    const firstAlert = result.current.adminAlerts[0];
    if (firstAlert) {
      act(() => {
        result.current.acknowledgeAlert(firstAlert.id);
      });

      const updated = result.current.adminAlerts.find((a) => a.id === firstAlert.id);
      expect(updated?.status).toBe("Acknowledged");

      act(() => {
        result.current.resolveAlert(firstAlert.id);
      });

      const resolved = result.current.adminAlerts.find((a) => a.id === firstAlert.id);
      expect(resolved?.status).toBe("Resolved");
    }
  });

  it("renders ComplaintEscalationDetail showing 4 distinct priorities", () => {
    const testComplaint: Complaint = {
      id: "FX-TEST-1",
      title: "Broken window latch",
      description: "Window latch loose in room 101.",
      category: "Furniture",
      building: "CS Block",
      room: "101",
      urgency: "Low", // 1. Student Urgency
      predictedPriority: "Medium", // 2. ML Prediction
      priority: "Low", // 3. Admin Assigned
      status: "Submitted",
      date: "2026-11-01",
      affected: 5,
      reporter: "Student A",
      timeline: [],
    };

    render(
      <Wrapper>
        <ComplaintEscalationDetail c={testComplaint} />
      </Wrapper>,
    );

    // Verify 4 distinct priority sections are present
    expect(screen.getByText("Student Urgency")).toBeInTheDocument();
    expect(screen.getByText("AI ML Prediction")).toBeInTheDocument();
    expect(screen.getByText("Admin Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Escalated Priority")).toBeInTheDocument();
  });
});
