import { describe, it, expect } from "vitest";
import {
  generateUniqueComplaintId,
  isComplaintId,
  isDuplicateKeyError,
} from "@/lib/id-generator";

describe("FixLens AI — Complaint ID Generator & Duplicate Key Handling", () => {
  it("generates complaint IDs matching the FX- numeric convention", () => {
    const id = generateUniqueComplaintId();
    expect(id).toMatch(/^FX-\d+$/);
    expect(id.startsWith("FX-")).toBe(true);
    // At least 23 characters (FX- + 13-digit timestamp + 4-digit seq + 6-digit crypto)
    expect(id.length).toBeGreaterThanOrEqual(23);
  });

  it("produces 10,000 strictly unique IDs without collisions in rapid synchronous loops", () => {
    const total = 10000;
    const ids = new Set<string>();

    for (let i = 0; i < total; i++) {
      const id = generateUniqueComplaintId();
      ids.add(id);
    }

    expect(ids.size).toBe(total);
  });

  it("does not produce predictable sequential-only numbers", () => {
    const id1 = generateUniqueComplaintId();
    const id2 = generateUniqueComplaintId();

    expect(id1).not.toBe(id2);
    // The random suffix (last 6 digits) should not be identical or sequential
    const suffix1 = id1.slice(-6);
    const suffix2 = id2.slice(-6);
    expect(suffix1).not.toBe(suffix2);
  });

  it("validates valid complaint IDs with isComplaintId", () => {
    // Modern high-entropy IDs
    expect(isComplaintId(generateUniqueComplaintId())).toBe(true);
    // Legacy demo IDs
    expect(isComplaintId("FX-1042")).toBe(true);
    expect(isComplaintId("FX-1001")).toBe(true);
    // Invalid IDs
    expect(isComplaintId("1234")).toBe(false);
    expect(isComplaintId("IP-201")).toBe(false);
    expect(isComplaintId("")).toBe(false);
    expect(isComplaintId(null)).toBe(false);
    expect(isComplaintId(undefined)).toBe(false);
  });

  it("detects PostgreSQL duplicate key 23505 errors with isDuplicateKeyError", () => {
    // Explicit PostgreSQL code 23505
    expect(isDuplicateKeyError({ code: "23505", message: "unique violation" })).toBe(true);

    // Supabase error message containing duplicate key
    expect(
      isDuplicateKeyError({
        message: 'duplicate key value violates unique constraint "complaints_pkey"',
      }),
    ).toBe(true);

    // Details containing complaints_pkey
    expect(
      isDuplicateKeyError({
        message: "Database error",
        details: "Key (id)=(FX-1048) already exists in complaints_pkey",
      }),
    ).toBe(true);

    // Non-duplicate errors
    expect(
      isDuplicateKeyError({ code: "42501", message: "permission denied for table complaints" }),
    ).toBe(false);
    expect(isDuplicateKeyError(new Error("Network error"))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });
});
