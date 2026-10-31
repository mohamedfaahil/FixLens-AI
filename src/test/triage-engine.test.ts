import { describe, it, expect } from "vitest";
import {
  normalizeText,
  tokenize,
  calculateJaccardSimilarity,
  normalizeRoom,
  compareRooms,
  findPotentialDuplicates,
  detectRecurringIssues,
  getRecurrenceForComplaint,
} from "../lib/triage-engine";
import type { Complaint } from "../lib/demo-data";

describe("Triage Engine — Text Normalization & Tokenization", () => {
  it("normalizes text by lowercasing, stripping punctuation, and collapsing whitespace", () => {
    expect(normalizeText("  Wi-Fi   Drops in Lab 3!!  ")).toBe("wi fi drops in lab 3");
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });

  it("tokenizes text with stop words removed and stemming applied by default", () => {
    const tokens = tokenize("The tube lights in Room 204 are not working and flickering");
    expect(tokens).toContain("tube");
    expect(tokens).toContain("light"); // stemmed from lights
    expect(tokens).toContain("room");
    expect(tokens).toContain("204");
    expect(tokens).toContain("work"); // stemmed from working
    expect(tokens).toContain("flicker"); // stemmed from flickering
    // Standard stop words removed
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("in");
    expect(tokens).not.toContain("are");
    expect(tokens).not.toContain("and");

    // Without stemming
    const unstemmed = tokenize("The tube lights in Room 204", true, false);
    expect(unstemmed).toContain("lights");
  });

  it("handles empty or single-character inputs gracefully", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("a")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("Triage Engine — Jaccard Similarity", () => {
  it("returns 1.0 for identical token sets", () => {
    const tokens = ["wifi", "disconnected", "lab"];
    expect(calculateJaccardSimilarity(tokens, tokens)).toBe(1.0);
  });

  it("returns 0.0 for disjoint token sets", () => {
    const tokensA = ["wifi", "router", "signal"];
    const tokensB = ["plumbing", "leak", "tap"];
    expect(calculateJaccardSimilarity(tokensA, tokensB)).toBe(0.0);
  });

  it("calculates partial overlap accurately", () => {
    const tokensA = ["wifi", "signal", "weak", "lab"];
    const tokensB = ["wifi", "signal", "down", "hall"];
    // Intersection: ['wifi', 'signal'] (2)
    // Union: ['wifi', 'signal', 'weak', 'lab', 'down', 'hall'] (6)
    // Jaccard: 2 / 6 = 0.3333...
    const sim = calculateJaccardSimilarity(tokensA, tokensB);
    expect(sim).toBeCloseTo(0.333, 2);
  });

  it("returns 0 when either or both sets are empty", () => {
    expect(calculateJaccardSimilarity([], ["wifi"])).toBe(0);
    expect(calculateJaccardSimilarity(["wifi"], [])).toBe(0);
    expect(calculateJaccardSimilarity([], [])).toBe(0);
  });
});

describe("Triage Engine — Room Normalization & Comparison", () => {
  it("normalizes noise words in room identifiers", () => {
    expect(normalizeRoom("Room 204, 2nd Floor")).toBe("204 2");
    expect(normalizeRoom("Lab 3, 2nd floor")).toBe("lab 3 2");
    expect(normalizeRoom("Seminar Hall")).toBe("seminar hall");
    expect(normalizeRoom("")).toBe("");
  });

  it("compares room strings accurately", () => {
    expect(compareRooms("Room 204", "Room 204")).toBe(1.0);
    // Substring containment
    expect(compareRooms("Lab 3", "Lab 3, 2nd floor")).toBe(0.85);
    // Completely conflicting rooms
    expect(compareRooms("Room 204", "Room 101")).toBeLessThanOrEqual(0.2);
  });

  it("handles missing room numbers with neutral uncertainty score (0.5)", () => {
    expect(compareRooms("", "Room 204")).toBe(0.5);
    expect(compareRooms("Room 204", undefined)).toBe(0.5);
    expect(compareRooms(undefined, undefined)).toBe(0.5);
  });
});

describe("Triage Engine — Duplicate Detection", () => {
  const mockComplaints: Complaint[] = [
    {
      id: "FX-1042",
      title: "Weak Wi-Fi signal in Lab 3",
      description: "Wi-Fi drops repeatedly during practical sessions in Lab 3. Around 40 students affected.",
      category: "Internet/Wi-Fi",
      building: "CS Block",
      room: "Lab 3, 2nd floor",
      urgency: "High",
      affected: 40,
      priority: "High",
      status: "In Progress",
      date: "2026-10-21",
      reporter: "Aisha Rahman",
      timeline: [],
    },
    {
      id: "FX-1045",
      title: "Tube lights not working in Room 204",
      description: "Three tube lights are off in Room 204, making it hard to see the board.",
      category: "Electrical",
      building: "CS Block",
      room: "Room 204",
      urgency: "Medium",
      affected: 60,
      priority: "Medium",
      status: "Under Review",
      date: "2026-10-24",
      reporter: "Sneha Iyer",
      timeline: [],
    },
    {
      id: "FX-1038",
      title: "Leaking tap in washroom",
      description: "Tap keeps running and water is flooding the washroom floor.",
      category: "Plumbing",
      building: "MCA Block",
      room: "Washroom, 1st floor",
      urgency: "Medium",
      affected: 15,
      priority: "Medium",
      status: "Resolved",
      date: "2026-10-14",
      reporter: "Aisha Rahman",
      timeline: [],
    },
  ];

  it("identifies an active duplicate with matching building, category, and room", () => {
    const duplicates = findPotentialDuplicates(
      {
        title: "Wi-Fi not working in Lab 3",
        description: "Wi-Fi is repeatedly dropping in Lab 3 during class and practicals.",
        category: "Internet/Wi-Fi",
        building: "CS Block",
        room: "Lab 3",
      },
      mockComplaints,
    );

    expect(duplicates.length).toBeGreaterThan(0);
    const top = duplicates[0];
    expect(top.complaint.id).toBe("FX-1042");
    expect(top.similarity).toBeGreaterThanOrEqual(0.5);
    expect(top.reasons.some((r) => r.includes("Same category"))).toBe(true);
  });

  it("does not flag complaints from a different building as duplicates", () => {
    const duplicates = findPotentialDuplicates(
      {
        title: "Weak Wi-Fi signal in Lab 3",
        description: "Wi-Fi drops repeatedly during practical sessions in Lab 3.",
        category: "Internet/Wi-Fi",
        building: "Main Library", // Different building!
        room: "Lab 3",
      },
      mockComplaints,
    );

    expect(duplicates.length).toBe(0);
  });

  it("avoids false matches between unrelated issues in different rooms of the same building", () => {
    const duplicates = findPotentialDuplicates(
      {
        title: "Tube lights broken in Room 101",
        description: "Lights are not turning on in Room 101.",
        category: "Electrical",
        building: "CS Block",
        room: "Room 101", // Different room from Room 204!
      },
      mockComplaints,
    );

    expect(duplicates.length).toBe(0);
  });

  it("safeguards against missing room numbers without throwing errors", () => {
    const duplicates = findPotentialDuplicates(
      {
        title: "Weak Wi-Fi in CS Block",
        description: "Wi-Fi drops repeatedly during practical sessions for students.",
        category: "Internet/Wi-Fi",
        building: "CS Block",
        room: "", // Missing room
      },
      mockComplaints,
    );

    expect(Array.isArray(duplicates)).toBe(true);
  });

  it("safeguards against empty or very short descriptions", () => {
    expect(
      findPotentialDuplicates(
        {
          title: "",
          description: "",
          category: "Electrical",
          building: "CS Block",
        },
        mockComplaints,
      ),
    ).toEqual([]);
  });

  it("ignores resolved complaints by default (activeOnly = true)", () => {
    const duplicates = findPotentialDuplicates(
      {
        title: "Leaking tap in washroom",
        description: "Water is running continuously and flooding the washroom floor.",
        category: "Plumbing",
        building: "MCA Block",
        room: "Washroom, 1st floor",
      },
      mockComplaints,
      { activeOnly: true },
    );

    // FX-1038 is Resolved, so it should not be returned when activeOnly = true
    expect(duplicates.some((d) => d.complaint.id === "FX-1038")).toBe(false);
  });

  it("includes resolved complaints if activeOnly is false", () => {
    const duplicates = findPotentialDuplicates(
      {
        title: "Leaking tap in washroom",
        description: "Water is running continuously and flooding the washroom floor.",
        category: "Plumbing",
        building: "MCA Block",
        room: "Washroom, 1st floor",
      },
      mockComplaints,
      { activeOnly: false },
    );

    expect(duplicates.some((d) => d.complaint.id === "FX-1038")).toBe(true);
  });
});

describe("Triage Engine — Recurring Complaint Intelligence", () => {
  const recurringDataset: Complaint[] = [
    // 2 complaints for Wi-Fi in Lab 3 submitted 10 days apart (2 distinct incidents)
    {
      id: "FX-1010",
      title: "Wi-Fi disconnections in Lab 3",
      description: "Access point disconnects constantly during practical exams.",
      category: "Internet/Wi-Fi",
      building: "CS Block",
      room: "Lab 3",
      urgency: "Medium",
      affected: 35,
      priority: "Medium",
      status: "Resolved",
      date: "2026-10-10",
      reporter: "Student A",
      timeline: [],
    },
    {
      id: "FX-1042",
      title: "Weak Wi-Fi signal in Lab 3",
      description: "Wi-Fi drops repeatedly during practical sessions in Lab 3.",
      category: "Internet/Wi-Fi",
      building: "CS Block",
      room: "Lab 3, 2nd floor",
      urgency: "High",
      affected: 40,
      priority: "High",
      status: "In Progress",
      date: "2026-10-21",
      reporter: "Student B",
      timeline: [],
    },
    // 2 complaints for water leak on the SAME DAY (duplicate reports of 1 incident)
    {
      id: "FX-1021",
      title: "Corridor tap leaking",
      description: "Water leaking near washroom 1st floor.",
      category: "Plumbing",
      building: "Boys Hostel",
      room: "1st floor washroom",
      urgency: "High",
      affected: 20,
      priority: "High",
      status: "Resolved",
      date: "2026-10-15",
      reporter: "Student C",
      timeline: [],
    },
    {
      id: "FX-1022",
      title: "Water leak in washroom",
      description: "Water running continuously from broken tap.",
      category: "Plumbing",
      building: "Boys Hostel",
      room: "1st floor washroom",
      urgency: "Medium",
      affected: 25,
      priority: "Medium",
      status: "In Progress",
      date: "2026-10-15",
      reporter: "Student D",
      timeline: [],
    },
    // Single isolated complaint
    {
      id: "FX-1035",
      title: "Broken chairs in Seminar Hall",
      description: "Chairs have broken backrests.",
      category: "Furniture",
      building: "Admin Block",
      room: "Seminar Hall",
      urgency: "Low",
      affected: 6,
      priority: "Low",
      status: "Under Review",
      date: "2026-10-18",
      reporter: "Student E",
      timeline: [],
    },
  ];

  it("detects recurring issues grouped by building, room, and category", () => {
    const recurring = detectRecurringIssues(recurringDataset);

    // Should find the CS Block Lab 3 Wi-Fi issue and Boys Hostel washroom plumbing
    expect(recurring.length).toBeGreaterThanOrEqual(2);

    const wifiIssue = recurring.find((r) => r.building === "CS Block");
    expect(wifiIssue).toBeDefined();
    expect(wifiIssue?.category).toBe("Internet/Wi-Fi");
    expect(wifiIssue?.totalReports).toBe(2);
    expect(wifiIssue?.incidentCount).toBe(2); // Two separate incidents across dates
  });

  it("safeguard: deduplicates same-day/same-incident reports so they don't count as independent incidents", () => {
    const recurring = detectRecurringIssues(recurringDataset);

    const plumbingIssue = recurring.find((r) => r.building === "Boys Hostel");
    expect(plumbingIssue).toBeDefined();
    expect(plumbingIssue?.totalReports).toBe(2); // 2 reports received
    expect(plumbingIssue?.incidentCount).toBe(1); // Merged into 1 incident cluster due to same date and room
  });

  it("checks recurrence for a specific complaint correctly", () => {
    const wifiComplaint = recurringDataset.find((c) => c.id === "FX-1042")!;
    const res = getRecurrenceForComplaint(wifiComplaint, recurringDataset);

    expect(res.isRecurring).toBe(true);
    expect(res.totalReports).toBe(2);
    expect(res.incidentCount).toBe(2);
    expect(res.otherComplaintIds).toContain("FX-1010");

    // Single complaint has no recurrence
    const isolated = recurringDataset.find((c) => c.id === "FX-1035")!;
    const isolatedRes = getRecurrenceForComplaint(isolated, recurringDataset);
    expect(isolatedRes.isRecurring).toBe(false);
    expect(isolatedRes.totalReports).toBe(1);
  });
});
