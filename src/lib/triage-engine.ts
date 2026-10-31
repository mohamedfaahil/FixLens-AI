import type { Category, Complaint } from "./demo-data";

/**
 * Common English stop words to ignore during similarity matching.
 * Kept concise to avoid filtering domain-critical terms (e.g., 'no', 'not', 'water').
 */
const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "me",
  "more",
  "most",
  "my",
  "of",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "ours",
  "out",
  "over",
  "own",
  "same",
  "she",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "you",
  "your",
  "yours",
]);

/**
 * Lightweight word stemmer for common inflectional suffixes.
 * Unifies variations like "drops" / "dropping" -> "drop", "leaks" / "leaking" -> "leak".
 */
export function stemWord(word: string): string {
  if (word.length <= 3) return word;
  return word
    .replace(/(?:ing|edly|ingly|ed|ies|es|s|ly|ment|tion|tions)$/i, "")
    .replace(/([a-z])\1$/i, "$1"); // Collapse double consonants, e.g. "dropp" -> "drop"
}

/**
 * Normalizes text: lowercase, strip punctuation, collapse whitespace.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenizes text into normalized, stemmed words, optionally stripping stop words.
 */
export function tokenize(
  text: string | null | undefined,
  removeStopWords = true,
  applyStemming = true,
): string[] {
  const norm = normalizeText(text);
  if (!norm) return [];
  const words = norm.split(" ").filter((w) => w.length > 1);
  const filtered = removeStopWords ? words.filter((w) => !STOP_WORDS.has(w)) : words;
  if (!applyStemming) return filtered;
  return filtered.map(stemWord).filter((w) => w.length > 1);
}

/**
 * Computes Jaccard similarity between two token collections:
 * J(A, B) = |A ∩ B| / |A ∪ B|
 * Returns 0 if either collection is empty.
 */
export function calculateJaccardSimilarity(
  tokensA: string[] | Set<string>,
  tokensB: string[] | Set<string>,
): number {
  const setA = tokensA instanceof Set ? tokensA : new Set(tokensA);
  const setB = tokensB instanceof Set ? tokensB : new Set(tokensB);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection++;
    }
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Normalizes room/area identifiers for resilient comparison.
 * Strips noise words like 'room', 'rm', 'floor', 'flr', 'st', 'nd', etc.
 */
export function normalizeRoom(room: string | null | undefined): string {
  if (!room) return "";
  return normalizeText(room)
    .replace(/(\d+)(st|nd|rd|th)\b/gi, "$1") // e.g. "2nd" -> "2", "1st" -> "1"
    .replace(/\b(room|rm|no|number|floor|flr|block|blk)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compares two room strings and returns a similarity score from 0.0 to 1.0.
 * If either room is missing, returns 0.5 (neutral uncertainty, not a contradiction).
 */
export function compareRooms(
  roomA: string | null | undefined,
  roomB: string | null | undefined,
): number {
  const normA = normalizeRoom(roomA);
  const normB = normalizeRoom(roomB);

  // Missing room info on either side -> neutral uncertainty
  if (!normA || !normB) return 0.5;

  if (normA === normB) return 1.0;

  // Substring containment (e.g. "lab 3" in "lab 3 2")
  if (normA.includes(normB) || normB.includes(normA)) return 0.85;

  // Token Jaccard check for multi-word room descriptions
  const tokensA = normA.split(" ").filter(Boolean);
  const tokensB = normB.split(" ").filter(Boolean);
  return calculateJaccardSimilarity(tokensA, tokensB);
}

export interface DuplicateCandidate {
  title?: string;
  description: string;
  category?: string;
  building?: string;
  room?: string;
}

export interface DuplicateMatch {
  complaint: Complaint;
  similarity: number; // 0.0 to 1.0
  reasons: string[];
}

export interface FindDuplicatesOptions {
  threshold?: number;
  activeOnly?: boolean;
  maxResults?: number;
  excludeId?: string;
}

/**
 * Finds potential duplicate complaints in existing complaints.
 * Safeguards against false matches across different buildings or unrelated issues.
 */
export function findPotentialDuplicates(
  candidate: DuplicateCandidate,
  existingComplaints: Complaint[],
  options: FindDuplicatesOptions = {},
): DuplicateMatch[] {
  const { threshold = 0.5, activeOnly = true, maxResults = 3, excludeId } = options;

  const candidateDesc = candidate.description?.trim() || "";
  const candidateTitle = candidate.title?.trim() || "";
  const candidateBuilding = candidate.building?.trim() || "";
  const candidateCategory = candidate.category?.trim() || "";

  // Require at least a building and some descriptive text to evaluate duplicates
  if (!candidateBuilding || (candidateDesc.length < 5 && candidateTitle.length < 3)) {
    return [];
  }

  const candidateTokens = tokenize(`${candidateTitle} ${candidateDesc}`);
  if (candidateTokens.length === 0) return [];

  const matches: DuplicateMatch[] = [];

  for (const existing of existingComplaints) {
    if (excludeId && existing.id === excludeId) continue;
    if (activeOnly && ["Resolved", "Rejected"].includes(existing.status)) continue;

    // Building mismatch is an immediate disqualifier for facility duplicates
    if (normalizeText(existing.building) !== normalizeText(candidateBuilding)) {
      continue;
    }

    const sameCategory = candidateCategory
      ? normalizeText(existing.category) === normalizeText(candidateCategory)
      : false;

    // Calculate room similarity
    const roomScore = compareRooms(candidate.room, existing.room);
    const roomConflicting = roomScore <= 0.2;

    // Calculate description & title token similarity (with stemming applied)
    const existingTokens = tokenize(`${existing.title} ${existing.description}`);
    const textSim = calculateJaccardSimilarity(candidateTokens, existingTokens);

    // If different categories and text similarity is not overwhelmingly high, skip
    if (candidateCategory && !sameCategory && textSim < 0.7) {
      continue;
    }

    // If rooms conflict within the same building (e.g. Room 101 vs Room 204),
    // they are distinct physical fixtures unless text similarity is nearly identical
    if (roomConflicting && textSim < 0.7) {
      continue;
    }

    // Compute composite similarity score
    let compositeScore = 0;
    const reasons: string[] = [];

    if (sameCategory) {
      reasons.push(`Same category (${existing.category}) in ${existing.building}`);
    } else {
      reasons.push(`Same building (${existing.building})`);
    }

    if (roomScore >= 0.8) {
      reasons.push(`Matching room/location (${existing.room})`);
      // Strong location match + text similarity
      compositeScore = 0.35 * roomScore + 0.65 * textSim;
    } else if (roomConflicting) {
      // Conflicting room: heavily penalized
      compositeScore = 0.1 * roomScore + 0.5 * textSim;
    } else {
      // Room missing or unspecific on either side: base on text similarity with moderate confidence
      reasons.push("General building area match");
      compositeScore = 0.85 * textSim;
    }

    // Boost score if title tokens match strongly
    const candidateTitleTokens = tokenize(candidateTitle);
    const existingTitleTokens = tokenize(existing.title);
    const titleSim = calculateJaccardSimilarity(candidateTitleTokens, existingTitleTokens);
    if (titleSim >= 0.4) {
      compositeScore = Math.min(1.0, compositeScore + 0.15);
      reasons.push(`Title match (${Math.round(titleSim * 100)}%)`);
    }

    if (textSim >= 0.3) {
      reasons.push(`Issue description overlap (${Math.round(textSim * 100)}%)`);
    }

    if (compositeScore >= threshold) {
      matches.push({
        complaint: existing,
        similarity: Math.round(compositeScore * 100) / 100,
        reasons,
      });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity).slice(0, maxResults);
}

export interface RecurringIssue {
  id: string;
  issue: string;
  category: Category;
  building: string;
  room: string;
  location: string;
  count: number; // Raw complaint count for UI compatibility
  totalReports: number;
  incidentCount: number; // Deduplicated distinct incidents
  distinctReporters: number; // Number of unique students who reported
  reporters: string[]; // List of unique reporter names
  lastSeen: string;
  complaintIds: string[];
  complaints: Complaint[];
}

export interface RecurringDetectionOptions {
  minReports?: number;
  incidentWindowDays?: number; // Reports within this window with similar text count as 1 incident
}

/**
 * Helper to parse YYYY-MM-DD into a timestamp in ms.
 */
function parseDateMs(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Evaluates in-memory complaints to detect recurring issues.
 * Groups by building, room (or general area), and category.
 *
 * Safeguard: Avoids counting duplicate reports of the same incident as separate recurring occurrences.
 */
export function detectRecurringIssues(
  complaints: Complaint[],
  options: RecurringDetectionOptions = {},
): RecurringIssue[] {
  const { minReports = 2, incidentWindowDays = 2 } = options;
  const windowMs = incidentWindowDays * 24 * 60 * 60 * 1000;

  // Cluster complaints by building + category + room similarity
  interface Cluster {
    building: string;
    category: Category;
    room: string;
    complaints: Complaint[];
  }

  const clusters: Cluster[] = [];

  for (const c of complaints) {
    let matchedCluster: Cluster | null = null;

    for (const cluster of clusters) {
      if (
        normalizeText(cluster.building) === normalizeText(c.building) &&
        normalizeText(cluster.category) === normalizeText(c.category)
      ) {
        // Check room compatibility
        const roomSim = compareRooms(cluster.room, c.room);
        if (roomSim >= 0.75 || (!cluster.room && !c.room)) {
          matchedCluster = cluster;
          break;
        }
      }
    }

    if (matchedCluster) {
      matchedCluster.complaints.push(c);
      // Keep the more descriptive room string
      if (!matchedCluster.room && c.room) {
        matchedCluster.room = c.room;
      }
    } else {
      clusters.push({
        building: c.building,
        category: c.category,
        room: c.room || "",
        complaints: [c],
      });
    }
  }

  const recurringList: RecurringIssue[] = [];

  for (const cluster of clusters) {
    if (cluster.complaints.length < minReports) continue;

    // Sort complaints chronologically
    const sorted = [...cluster.complaints].sort(
      (a, b) => parseDateMs(a.date) - parseDateMs(b.date),
    );

    // Deduplicate reports within the incident window to identify distinct incidents
    const incidents: Complaint[][] = [];

    for (const c of sorted) {
      const cTime = parseDateMs(c.date);
      const cTokens = tokenize(`${c.title} ${c.description}`);

      let merged = false;
      for (const inc of incidents) {
        const lastInInc = inc[inc.length - 1];
        const timeDiff = Math.abs(cTime - parseDateMs(lastInInc.date));

        if (timeDiff <= windowMs) {
          const incTokens = tokenize(`${lastInInc.title} ${lastInInc.description}`);
          const sim = calculateJaccardSimilarity(cTokens, incTokens);
          // If close in time and either text similarity or matching room, treat as same incident report
          if (sim >= 0.3 || compareRooms(c.room, lastInInc.room) >= 0.75) {
            inc.push(c);
            merged = true;
            break;
          }
        }
      }

      if (!merged) {
        incidents.push([c]);
      }
    }

    // Pick representative details
    const latest = sorted[sorted.length - 1];
    const representativeRoom = cluster.room || latest.room || "";
    const displayLocation = representativeRoom
      ? `${latest.building}, ${representativeRoom}`
      : latest.building;

    // Pick the most descriptive title
    const bestTitle =
      [...sorted].sort((a, b) => b.title.length - a.title.length)[0]?.title || latest.title;

    const bNorm = normalizeText(latest.building).replace(/\s+/g, "-");
    const rNorm = normalizeRoom(representativeRoom).replace(/\s+/g, "-") || "general";
    const cNorm = normalizeText(latest.category).replace(/\s+/g, "-");
    const issueId = `${bNorm}-${rNorm}-${cNorm}`;

    const uniqueReporters = Array.from(
      new Set(sorted.map((c) => c.reporter.trim()).filter(Boolean)),
    );

    recurringList.push({
      id: issueId,
      issue: bestTitle,
      category: latest.category,
      building: latest.building,
      room: representativeRoom,
      location: displayLocation,
      count: sorted.length,
      totalReports: sorted.length,
      incidentCount: incidents.length,
      distinctReporters: uniqueReporters.length,
      reporters: uniqueReporters,
      lastSeen: latest.date,
      complaintIds: sorted.map((c) => c.id),
      complaints: sorted,
    });
  }

  // Sort by total reports descending, then by lastSeen descending
  return recurringList.sort((a, b) => {
    if (b.totalReports !== a.totalReports) return b.totalReports - a.totalReports;
    return parseDateMs(b.lastSeen) - parseDateMs(a.lastSeen);
  });
}

/**
 * Checks if an individual complaint is part of a recurring issue across all complaints.
 */
export function getRecurrenceForComplaint(
  complaint: Complaint,
  allComplaints: Complaint[],
): {
  isRecurring: boolean;
  recurringIssue?: RecurringIssue;
  totalReports: number;
  incidentCount: number;
  otherComplaintIds: string[];
} {
  const recurringIssues = detectRecurringIssues(allComplaints, { minReports: 2 });
  const match = recurringIssues.find((r) => r.complaintIds.includes(complaint.id));

  if (!match) {
    return {
      isRecurring: false,
      totalReports: 1,
      incidentCount: 1,
      otherComplaintIds: [],
    };
  }

  return {
    isRecurring: true,
    recurringIssue: match,
    totalReports: match.totalReports,
    incidentCount: match.incidentCount,
    otherComplaintIds: match.complaintIds.filter((id) => id !== complaint.id),
  };
}
