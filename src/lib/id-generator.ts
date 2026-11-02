/**
 * FixLens AI — Collision-Resistant Unique Complaint ID Generator
 *
 * Requirements:
 * 1. Compatible with existing PostgreSQL TEXT primary key in public.complaints
 * 2. Compatible with TEXT foreign keys in complaint_timeline, complaint_follow_ups, complaint_escalations
 * 3. Starts with "FX-" matching existing complaint reference convention
 * 4. Strictly non-predictable: combines millisecond epoch timestamp, monotonic sequence counter,
 *    and cryptographically strong random entropy
 * 5. Matches /^FX-\d+$/ for backwards compatibility with existing UI format expectations and tests
 * 6. High collision resistance across distributed clients and rapid concurrent submissions
 */

let processSequenceCounter = Math.floor(Math.random() * 1000);

/**
 * Generates a collision-resistant unique complaint ID.
 *
 * Structure:
 * - Prefix: "FX-"
 * - Millisecond timestamp (13 digits): chronological ordering
 * - Monotonic process counter (4 digits: 0000-9999): guarantees local uniqueness in rapid loops
 * - Cryptographically secure random digits (6 digits: 000000-999999): distributed entropy
 *
 * Format: "FX-<timestamp><seq><random>"
 * Example: "FX-1730542385920042189342"
 */
export function generateUniqueComplaintId(): string {
  const timestamp = Date.now().toString();

  // Monotonic process counter (0000-9999) guarantees local uniqueness in rapid synchronous loops
  processSequenceCounter = (processSequenceCounter + 1) % 10000;
  const seqPart = processSequenceCounter.toString().padStart(4, "0");

  // Cryptographically strong random entropy (6 digits) ensures distributed collision resistance
  let randomPart = "";
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    randomPart = (buffer[0] % 1000000).toString().padStart(6, "0");
  } else {
    randomPart = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
  }

  return `FX-${timestamp}${seqPart}${randomPart}`;
}

/**
 * Validates whether an ID matches the FixLens AI complaint ID format.
 * Supports both legacy demo IDs (e.g. FX-1042) and new high-entropy IDs.
 */
export function isComplaintId(id: unknown): boolean {
  if (typeof id !== "string") return false;
  return /^FX-[0-9a-zA-Z_-]+$/.test(id.trim());
}

/**
 * Detects whether a database error is caused by a unique constraint violation
 * on the complaints table (PostgreSQL error code 23505).
 */
export function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { code?: string; message?: string; details?: string };

  if (anyErr.code === "23505") return true;

  const combined = `${anyErr.message || ""} ${anyErr.details || ""}`.toLowerCase();
  return (
    combined.includes("duplicate key") ||
    combined.includes("unique constraint") ||
    combined.includes("complaints_pkey") ||
    combined.includes("23505")
  );
}
