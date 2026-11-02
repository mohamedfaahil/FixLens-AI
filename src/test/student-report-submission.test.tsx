import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { DemoStoreProvider, useDemoStore } from "../lib/demo-store";
import * as supabaseData from "../lib/supabase-data";
import type { ReactNode } from "react";

function Wrapper({ children }: { children: ReactNode }) {
  return <DemoStoreProvider>{children}</DemoStoreProvider>;
}

describe("FixLens AI — Student Report Submission & Rollback on Database Failure", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully persists complaint when authenticated and keeps complaint in store", async () => {
    const mockPersisted = {
      id: "FX-17305499990001",
      title: "Broken projector in CS Seminar Hall",
      description: "Projector bulb blew out during class.",
      category: "Electrical" as const,
      building: "CS Block",
      room: "Seminar Hall",
      urgency: "Medium" as const,
      affected: 60,
      priority: "Medium" as const,
      status: "Submitted" as const,
      date: "2026-11-02",
      reporter: "Amina Khan",
      reporterId: "student-uuid-999",
      timeline: [
        {
          status: "Submitted" as const,
          date: "2026-11-02",
          note: "Complaint received.",
          by: "Amina Khan",
        },
      ],
    };

    vi.spyOn(supabaseData, "createComplaintInSupabase").mockResolvedValueOnce(mockPersisted);

    const { result } = renderHook(() => useDemoStore(), { wrapper: Wrapper });

    act(() => {
      result.current.setCurrentStudent({
        id: "student-uuid-999",
        name: "Amina Khan",
        email: "amina.khan@campus.edu",
        department: "Computer Applications",
      });
    });

    const initialCount = result.current.complaints.length;

    let submissionPromise: any;
    act(() => {
      submissionPromise = result.current.addComplaint({
        title: "Broken projector in CS Seminar Hall",
        description: "Projector bulb blew out during class.",
        category: "Electrical",
        building: "CS Block",
        room: "Seminar Hall",
        urgency: "Medium",
        affected: 60,
        priority: "Medium",
      });
    });

    // Complaint object is available immediately with collision-resistant ID
    expect(submissionPromise.id).toMatch(/^FX-\d+$/);

    // Awaiting submission confirms database persistence
    let persisted: any;
    await act(async () => {
      persisted = await submissionPromise;
    });

    expect(persisted.id).toBe("FX-17305499990001");
    expect(result.current.complaints.length).toBe(initialCount + 1);
    expect(result.current.complaints.some((c) => c.id === "FX-17305499990001")).toBe(true);
  });

  it("rolls back optimistic complaint from store when database persistence fails", async () => {
    vi.spyOn(supabaseData, "createComplaintInSupabase").mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "complaints_pkey"'),
    );

    const { result } = renderHook(() => useDemoStore(), { wrapper: Wrapper });

    act(() => {
      result.current.setCurrentStudent({
        id: "student-uuid-888",
        name: "Dev Patel",
        email: "dev.patel@campus.edu",
        department: "Information Technology",
      });
    });

    const initialCount = result.current.complaints.length;

    let submissionPromise: any;
    act(() => {
      submissionPromise = result.current.addComplaint({
        title: "AC leaking onto desks in IT Lab 1",
        description: "Water continuously dripping from split AC unit onto workstation 12.",
        category: "Electrical",
        building: "IT Block",
        room: "Lab 1",
        urgency: "High",
        affected: 25,
        priority: "High",
      });
    });

    const optimisticId = submissionPromise.id;
    expect(optimisticId).toMatch(/^FX-\d+$/);

    // Verify rejection is caught and state is reverted
    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await submissionPromise;
      } catch (err: any) {
        caughtError = err;
      }
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain("complaints_pkey");

    // The unpersisted complaint must be removed from store complaints
    expect(result.current.complaints.length).toBe(initialCount);
    expect(result.current.complaints.some((c) => c.id === optimisticId)).toBe(false);
  });

  it("preserves draft state across failed attempts until explicitly cleared", () => {
    const { result } = renderHook(() => useDemoStore(), { wrapper: Wrapper });

    const draft = {
      title: "Broken hand dryer in 2nd floor restroom",
      description: "Dryer does not blow warm air and smells burnt.",
      category: "Electrical",
      building: "Science Block",
      room: "Restroom 2F",
      urgency: "Low" as const,
      affected: "10",
    };

    act(() => {
      result.current.setReportDraft(draft);
    });

    expect(result.current.reportDraft).toEqual(draft);
    expect(result.current.reportDraft?.title).toBe("Broken hand dryer in 2nd floor restroom");
  });
});
