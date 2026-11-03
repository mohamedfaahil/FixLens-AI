/**
 * FixLens AI — Intelligent Role-Aware Campus Copilot Engine
 *
 * Provides natural-language triage, complaint inquiry & tracking,
 * robust defect detection, multi-turn complaint drafting, campus FAQ handling,
 * and operational management for Students and Administrators.
 */

import {
  CATEGORIES,
  BUILDINGS,
  type Category,
  type Building,
  type Priority,
  type Complaint,
  type Proposal,
} from "./demo-data";
import { predictComplaintPriority, type MLPredictionResult } from "./ml-api";
import type { StudentUser } from "./demo-store";

export interface PendingComplaintContext {
  description: string;
  category: Category;
  urgency: Priority;
  affected: number;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
  pendingContext?: PendingComplaintContext | null;
  quickReplies?: string[];
  actionCard?:
    | {
        type: "complaint-draft";
        title: string;
        description: string;
        category: Category;
        building: Building;
        room: string;
        urgency: Priority;
        affected: number;
        predictedPriority: Priority;
        confidence?: number;
        signals?: string[];
      }
    | {
        type: "complaint-status";
        complaint: Complaint;
      }
    | {
        type: "complaint-list";
        complaints: Complaint[];
        isPersonal: boolean;
        filterLabel?: string;
      }
    | {
        type: "admin-summary";
        total: number;
        highPriority: number;
        inProgress: number;
        resolved: number;
        unassigned: number;
        escalatedCount: number;
      };
}

/**
 * Extracts campus maintenance parameters from natural language user input.
 */
export function extractComplaintParams(input: string): {
  isComplaintIntent: boolean;
  hasExplicitBuilding: boolean;
  category: Category;
  building: Building;
  room: string;
  urgency: Priority;
  affected: number;
  extractedDescription: string;
} {
  const lower = input.toLowerCase().trim();

  // 1. INQUIRY CHECK: If user is asking to view, list, count, or ask questions
  const inquiryRegex =
    /^(show|list|view|display|check|track|all|see|what did i|my complaints|complaints i|how to|where is|who is|can i|tell me|explain|how many)\b/i;
  const isAskingInquiry = inquiryRegex.test(lower);

  // 2. Comprehensive Defect & Problem Keywords
  const defectKeywords = [
    // Water & Plumbing defects
    "overflow",
    "overflowing",
    "leak",
    "leaking",
    "leakage",
    "seep",
    "seeping",
    "seepage",
    "dripping",
    "clog",
    "clogged",
    "choke",
    "choked",
    "block",
    "blocked",
    "drainage",
    "drain",
    "gutter",
    "sewer",
    "sewage",
    "no water",
    "dirty water",

    // Electrical defects
    "spark",
    "sparking",
    "sparked",
    "burn",
    "burnt",
    "burning",
    "shock",
    "short circuit",
    "power cut",
    "no power",
    "no electricity",
    "voltage",
    "flicker",
    "flickering",
    "tripped",
    "tripping",
    "blown",
    "not working",
    "wont work",
    "won't work",
    "stopped",
    "dead",
    "cut wire",
    "hanging wire",
    "loose wire",
    "ac not cooling",

    // Physical equipment damage
    "broken",
    "broke",
    "break",
    "damaged",
    "damage",
    "faulty",
    "fault",
    "shattered",
    "crack",
    "cracked",
    "pothole",
    "stuck",
    "jammed",
    "loose",
    "hanging",

    // Cleaning & hygiene
    "dirty",
    "dustbin",
    "garbage",
    "trash",
    "waste",
    "litter",
    "smell",
    "smelling",
    "stink",
    "stinking",
    "foul",

    // Network & Wi-Fi
    "no wifi",
    "no internet",
    "wifi disconnected",
    "internet down",
    "portal down",

    // Safety hazards
    "danger",
    "hazard",
    "unsafe",
    "risk",
    "fire",
    "smoke",
  ];

  const hasDefectKeyword = defectKeywords.some((k) => lower.includes(k));

  // Facility nouns
  const facilityNouns = [
    "drainage",
    "drain",
    "pipe",
    "tap",
    "water",
    "flush",
    "toilet",
    "washroom",
    "sink",
    "socket",
    "switch",
    "plug",
    "wire",
    "light",
    "bulb",
    "tubelight",
    "fan",
    "ac",
    "cooler",
    "wifi",
    "router",
    "internet",
    "chair",
    "desk",
    "table",
    "bench",
    "door",
    "window",
    "projector",
    "elevator",
    "lift",
  ];

  const hasFacilityNoun = facilityNouns.some((n) => lower.includes(n));

  // It is a complaint intent if:
  // - It has a defect keyword (e.g. "overflow", "leaking", "broken", "sparking")
  // - AND is not an inquiry ("show me", "list", "what is")
  const isComplaintIntent =
    (hasDefectKeyword || (hasFacilityNoun && lower.includes("issue"))) && !isAskingInquiry;

  // Category detection
  let detectedCategory: Category = "Other";
  if (
    lower.includes("spark") ||
    lower.includes("wire") ||
    lower.includes("light") ||
    lower.includes("bulb") ||
    lower.includes("tubelight") ||
    lower.includes("fan") ||
    lower.includes("socket") ||
    lower.includes("switch") ||
    lower.includes("plug") ||
    lower.includes("power") ||
    lower.includes("electricity") ||
    lower.includes("voltage") ||
    lower.includes("ac") ||
    lower.includes("cooler")
  ) {
    detectedCategory = "Electrical";
  } else if (
    lower.includes("leak") ||
    lower.includes("pipe") ||
    lower.includes("tap") ||
    lower.includes("water") ||
    lower.includes("washroom") ||
    lower.includes("flush") ||
    lower.includes("toilet") ||
    lower.includes("drain") ||
    lower.includes("drainage") ||
    lower.includes("overflow") ||
    lower.includes("sink") ||
    lower.includes("sewer") ||
    lower.includes("sewage") ||
    lower.includes("gutter")
  ) {
    detectedCategory = "Plumbing";
  } else if (
    lower.includes("wifi") ||
    lower.includes("wi-fi") ||
    lower.includes("internet") ||
    lower.includes("network") ||
    lower.includes("router") ||
    lower.includes("ethernet") ||
    lower.includes("connection") ||
    lower.includes("portal")
  ) {
    detectedCategory = "Internet/Wi-Fi";
  } else if (
    lower.includes("chair") ||
    lower.includes("desk") ||
    lower.includes("table") ||
    lower.includes("bench") ||
    lower.includes("door") ||
    lower.includes("window") ||
    lower.includes("board") ||
    lower.includes("blackboard") ||
    lower.includes("whiteboard") ||
    lower.includes("cupboard") ||
    lower.includes("lock") ||
    lower.includes("handle") ||
    lower.includes("glass")
  ) {
    detectedCategory = "Furniture";
  } else if (
    lower.includes("dirty") ||
    lower.includes("dustbin") ||
    lower.includes("garbage") ||
    lower.includes("trash") ||
    lower.includes("cleaning") ||
    lower.includes("sweep") ||
    lower.includes("mop") ||
    lower.includes("waste") ||
    lower.includes("litter")
  ) {
    detectedCategory = "Cleaning";
  } else if (
    lower.includes("fire") ||
    lower.includes("extinguisher") ||
    lower.includes("emergency") ||
    lower.includes("hazard") ||
    lower.includes("smoke") ||
    lower.includes("safety") ||
    lower.includes("security") ||
    lower.includes("danger")
  ) {
    detectedCategory = "Safety";
  }

  // Building detection
  let detectedBuilding: Building = "CS Block";
  let hasExplicitBuilding = false;

  for (const b of BUILDINGS) {
    const bLower = b.toLowerCase();
    if (lower.includes(bLower)) {
      detectedBuilding = b;
      hasExplicitBuilding = true;
      break;
    }
  }

  if (!hasExplicitBuilding) {
    if (lower.includes("library")) {
      detectedBuilding = "Main Library";
      hasExplicitBuilding = true;
    } else if (lower.includes("boys hostel") || lower.includes("mens hostel")) {
      detectedBuilding = "Boys Hostel";
      hasExplicitBuilding = true;
    } else if (lower.includes("girls hostel") || lower.includes("ladies hostel")) {
      detectedBuilding = "Girls Hostel";
      hasExplicitBuilding = true;
    } else if (
      lower.includes("canteen") ||
      lower.includes("cafeteria") ||
      lower.includes("food court")
    ) {
      detectedBuilding = "Cafeteria";
      hasExplicitBuilding = true;
    } else if (
      lower.includes("gym") ||
      lower.includes("ground") ||
      lower.includes("sports")
    ) {
      detectedBuilding = "Sports Complex";
      hasExplicitBuilding = true;
    } else if (lower.includes("mca")) {
      detectedBuilding = "MCA Block";
      hasExplicitBuilding = true;
    } else if (lower.includes("admin")) {
      detectedBuilding = "Admin Block";
      hasExplicitBuilding = true;
    }
  }

  // Room / Specific Location detection
  let room = "General Area / Grounds";
  const roomMatch = input.match(
    /(?:(?:room|lab|hall|floor|cabin|class)\s*(?:no\.?|number)?\s*([a-z0-9\-]+))|(?:([0-9]+(?:st|nd|rd|th)?|ground)\s*(?:floor|floor\s*washroom|lab|hall|room))|(?:near\s*(?:the\s*)?[a-z0-9\s]+)/i,
  );
  if (roomMatch) {
    room = roomMatch[0].trim();
  }

  // Urgency detection
  let urgency: Priority = "Medium";
  if (
    lower.includes("urgent") ||
    lower.includes("emergency") ||
    lower.includes("immediately") ||
    lower.includes("danger") ||
    lower.includes("fire") ||
    lower.includes("critical") ||
    lower.includes("hazard") ||
    lower.includes("severe") ||
    lower.includes("overflow") ||
    lower.includes("spark")
  ) {
    urgency = "High";
  } else if (
    lower.includes("minor") ||
    lower.includes("low urgency") ||
    lower.includes("whenever possible") ||
    lower.includes("not urgent")
  ) {
    urgency = "Low";
  }

  // Affected count detection
  let affected = 1;
  const numMatch = input.match(/(\d+)\s*(?:students|people|staff|classmates|persons)/i);
  if (numMatch && numMatch[1]) {
    affected = Math.max(1, parseInt(numMatch[1], 10));
  } else if (lower.includes("whole class") || lower.includes("entire lab")) {
    affected = 35;
  } else if (lower.includes("hostel floor") || lower.includes("near the main library")) {
    affected = 20;
  }

  return {
    isComplaintIntent,
    hasExplicitBuilding,
    category: detectedCategory,
    building: detectedBuilding,
    room,
    urgency,
    affected,
    extractedDescription: input.trim(),
  };
}

/**
 * Generates an intelligent, context-aware reply for Students or Admins.
 */
export async function processUserMessage({
  text,
  portal,
  userName,
  userEmail,
  currentStudent,
  complaints,
  proposals,
  pendingContext,
}: {
  text: string;
  portal: "Student" | "Administrator";
  userName: string;
  userEmail: string;
  currentStudent?: StudentUser;
  complaints: Complaint[];
  proposals: Proposal[];
  pendingContext?: PendingComplaintContext | null;
}): Promise<ChatMessage> {
  const query = text.trim();
  const lower = query.toLowerCase();
  const timestamp = new Date();
  const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // ==========================================
  // 1. GREETINGS & CASUAL INTENTS
  // ==========================================
  if (
    /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|yo|hola)\b/i.test(lower) &&
    lower.length < 25
  ) {
    const greetingText =
      portal === "Administrator"
        ? `Hello ${userName || "Administrator"}! 👋\n\nI am your **FixLens Ops Copilot**. I can help you with:\n` +
          `• 📊 **Queue Summaries:** Ask *"Show queue summary"* or *"How many high priority tickets?"*\n` +
          `• ⚠️ **SLA Escalations:** Ask *"Check overdue complaints"*\n` +
          `• 📍 **Facility Breakdown:** Ask *"Which building has the most issues?"*\n` +
          `• 🔍 **Ticket Lookup:** Give me any ID like \`FX-1042\` to inspect.\n\n` +
          `What would you like to review?`
        : `Hello ${userName || "Student"}! 👋\n\nI am your **FixLens Campus Copilot**. I can help you with:\n` +
          `• 📋 **View Complaints:** Ask *"Show all complaints I made"* or *"Check my tickets"*\n` +
          `• 🔍 **Track Status:** Ask *"What is the status of FX-1042?"*\n` +
          `• ⚡ **Report Issues:** Describe any broken facility (e.g. *"Drainage overflow near Main Library"*)\n` +
          `• 💡 **Campus FAQs:** Ask about hostel repairs, Wi-Fi, or proposals.\n\n` +
          `How can I assist you right now?`;

    return {
      id,
      sender: "bot",
      text: greetingText,
      timestamp,
      quickReplies:
        portal === "Administrator"
          ? ["📊 Queue summary", "⚠️ Check SLA escalations", "📍 Building hotspots"]
          : ["📋 Show all complaints I made", "⚡ Report an issue", "💡 Active proposals"],
    };
  }

  // ==========================================
  // 2. GRATITUDE & CLOSURE
  // ==========================================
  if (
    /^(thanks|thank you|thx|awesome|great|perfect|ok|okay|got it|sounds good|bye)\b/i.test(lower) &&
    lower.length < 25
  ) {
    return {
      id,
      sender: "bot",
      text: `You're very welcome! 😊 Always here to keep our campus facilities in top shape. Let me know if you need anything else!`,
      timestamp,
    };
  }

  // ==========================================
  // 3. MULTI-TURN CONTEXT RESOLUTION (Student or Admin location follow-up)
  // ==========================================
  if (pendingContext) {
    const locExtracted = extractComplaintParams(query);
    const combinedDesc = `${pendingContext.description} (Location details: ${query})`;
    const resolvedBuilding = locExtracted.hasExplicitBuilding
      ? locExtracted.building
      : "Main Library";
    const resolvedRoom =
      locExtracted.room !== "General Area / Grounds" ? locExtracted.room : query;

    let predictedPriority: Priority = pendingContext.urgency;
    let confidence: number | undefined;
    let signals: string[] | undefined;

    try {
      const mlRes: MLPredictionResult = await predictComplaintPriority({
        description: combinedDesc,
        category: pendingContext.category,
        urgency: pendingContext.urgency,
        affected: pendingContext.affected,
      });
      predictedPriority = mlRes.priority;
      confidence = mlRes.confidence;
      signals = mlRes.signals;
    } catch {
      predictedPriority = pendingContext.urgency;
    }

    const title = `${pendingContext.category} issue at ${resolvedBuilding}`;

    return {
      id,
      sender: "bot",
      text: `Thanks for providing the location! 🎯\n\nI've finalized your complaint draft with our **AI Priority Prediction Model**:\n\n` +
        `• **Category:** ${pendingContext.category}\n` +
        `• **Location:** ${resolvedBuilding} (${resolvedRoom})\n` +
        `• **AI Predicted Priority:** **${predictedPriority}**${
          confidence ? ` (${(confidence * 100).toFixed(0)}% confidence)` : ""
        }\n` +
        `• **Impact:** ${pendingContext.affected} person(s)\n\n` +
        `Click **"Confirm & Submit Complaint"** below to dispatch it immediately:`,
      timestamp,
      pendingContext: null,
      actionCard: {
        type: "complaint-draft",
        title,
        description: combinedDesc,
        category: pendingContext.category,
        building: resolvedBuilding,
        room: resolvedRoom,
        urgency: pendingContext.urgency,
        affected: pendingContext.affected,
        predictedPriority,
        confidence,
        signals,
      },
    };
  }

  // ==========================================
  // 4. RETRIEVE / LIST COMPLAINTS INTENT
  // ==========================================
  const isListComplaintsQuery =
    /\b(show|list|view|all|see|get|track|find|display)\b.*\b(complaint|complaints|ticket|tickets|issues|reports)\b/i.test(
      lower,
    ) ||
    /\b(complaint|complaints|ticket|tickets|issues|reports)\b.*\b(i made|i filed|i submitted|by me|mine|registered)\b/i.test(
      lower,
    ) ||
    lower === "my complaints" ||
    lower === "my tickets" ||
    lower === "show complaints" ||
    lower === "all complaints" ||
    lower === "show all complaints";

  if (isListComplaintsQuery) {
    if (portal === "Administrator") {
      if (
        lower.includes("high priority") ||
        lower.includes("urgent") ||
        lower.includes("critical")
      ) {
        const highTickets = complaints.filter(
          (c) => c.priority === "High" && c.status !== "Resolved",
        );
        return {
          id,
          sender: "bot",
          text: `Found **${highTickets.length} active High Priority complaint(s)** requiring urgent triage:`,
          timestamp,
          actionCard: {
            type: "complaint-list",
            complaints: highTickets.length > 0 ? highTickets : complaints.slice(0, 3),
            isPersonal: false,
            filterLabel: "High Priority Tickets",
          },
        };
      }

      const openComplaints = complaints.slice(0, 6);
      return {
        id,
        sender: "bot",
        text: `Here are the latest complaints in the campus queue (**${complaints.length} total** registered):`,
        timestamp,
        actionCard: {
          type: "complaint-list",
          complaints: openComplaints,
          isPersonal: false,
          filterLabel: "Campus Review Queue",
        },
      };
    }

    // Student list query
    const studentTickets = complaints.filter((c) => {
      if (currentStudent?.id && c.reporterId) {
        return c.reporterId === currentStudent.id;
      }
      if (currentStudent?.name && c.reporter) {
        return c.reporter.toLowerCase() === currentStudent.name.toLowerCase();
      }
      if (userName && c.reporter) {
        return c.reporter.toLowerCase() === userName.toLowerCase();
      }
      return false;
    });

    const displayTickets =
      studentTickets.length > 0 ? studentTickets : complaints.slice(0, 4);

    return {
      id,
      sender: "bot",
      text:
        studentTickets.length > 0
          ? `You have **${studentTickets.length} complaint(s)** registered under your account:\n\nHere is your active complaint overview:`
          : `You currently have **0 personal complaints** registered under **${userName || "your profile"}**.\n\nHere are recent campus maintenance reports currently tracked in the system:`,
      timestamp,
      actionCard: {
        type: "complaint-list",
        complaints: displayTickets,
        isPersonal: studentTickets.length > 0,
        filterLabel: studentTickets.length > 0 ? "My Registered Complaints" : "Active Campus Tickets",
      },
    };
  }

  // ==========================================
  // 5. TICKET LOOKUP BY ID (Both Student & Admin)
  // ==========================================
  const idMatch = query.match(/(?:CMP-\d{4}-[A-Z0-9]{4}|FX-\d+|CMP-\d+)/i);
  if (idMatch) {
    const targetId = idMatch[0].toUpperCase();
    const found = complaints.find(
      (c) =>
        c.id.toUpperCase() === targetId ||
        c.id.toUpperCase().includes(targetId) ||
        targetId.includes(c.id.toUpperCase()),
    );

    if (found) {
      return {
        id,
        sender: "bot",
        text: `I located complaint record **${found.id}**:\n\n` +
          `• **Title:** ${found.title}\n` +
          `• **Status:** ${found.status}\n` +
          `• **Priority:** ${found.priority}\n` +
          `• **Location:** ${found.building} (${found.room || "General Area"})\n` +
          `• **Category:** ${found.category}\n` +
          `• **Reported Date:** ${found.date || "Recent"}\n` +
          (found.resolutionNote ? `• **Resolution Note:** ${found.resolutionNote}\n` : ""),
        timestamp,
        actionCard: {
          type: "complaint-status",
          complaint: found,
        },
      };
    } else {
      return {
        id,
        sender: "bot",
        text: `I searched the database for **${targetId}**, but couldn't find a matching complaint record. Please verify the ticket ID (e.g., \`FX-1042\`).`,
        timestamp,
      };
    }
  }

  // ==========================================
  // 6. ADMIN OPERATIONS & ANALYTICS
  // ==========================================
  if (portal === "Administrator") {
    // 6A. Filter High Priority Complaints
    if (
      lower.includes("high priority") ||
      lower.includes("urgent") ||
      lower.includes("critical complaints")
    ) {
      const highTickets = complaints.filter(
        (c) => c.priority === "High" && c.status !== "Resolved",
      );
      return {
        id,
        sender: "bot",
        text: `Found **${highTickets.length} active High Priority complaint(s)** requiring urgent triage:`,
        timestamp,
        actionCard: {
          type: "complaint-list",
          complaints: highTickets.length > 0 ? highTickets : complaints.slice(0, 3),
          isPersonal: false,
          filterLabel: "High Priority Tickets",
        },
      };
    }

    // 6B. Queue Summary & High Priority Overview
    if (
      lower.includes("summary") ||
      lower.includes("queue") ||
      lower.includes("how many") ||
      lower.includes("overview") ||
      lower.includes("stats") ||
      lower === "status"
    ) {
      const total = complaints.length;
      const highPriority = complaints.filter(
        (c) => c.priority === "High" && c.status !== "Resolved",
      ).length;
      const inProgress = complaints.filter((c) => c.status === "In Progress").length;
      const resolved = complaints.filter((c) => c.status === "Resolved").length;
      const unassigned = complaints.filter((c) => c.status === "Submitted").length;

      const now = Date.now();
      const escalatedCount = complaints.filter((c) => {
        if (c.status === "Resolved") return false;
        const ms = new Date(c.date || Date.now()).getTime();
        return now - ms > 48 * 3600 * 1000;
      }).length;

      return {
        id,
        sender: "bot",
        text: `Here is the current operational overview for the campus facility queue:\n\n` +
          `• **Total Registered Complaints:** ${total}\n` +
          `• **High Priority (Active):** ${highPriority}\n` +
          `• **In Progress:** ${inProgress}\n` +
          `• **Awaiting Triage:** ${unassigned}\n` +
          `• **Resolved:** ${resolved}\n` +
          (escalatedCount > 0
            ? `\n⚠️ **SLA Escalation Alert:** ${escalatedCount} ticket(s) have been open for over 48 hours without resolution.`
            : `\n✅ All tickets are within standard SLA response windows.`),
        timestamp,
        actionCard: {
          type: "admin-summary",
          total,
          highPriority,
          inProgress,
          resolved,
          unassigned,
          escalatedCount,
        },
      };
    }

    // 6C. Escalations & Anomalies
    if (
      lower.includes("escalat") ||
      lower.includes("anomal") ||
      lower.includes("sla") ||
      lower.includes("delay") ||
      lower.includes("overdue")
    ) {
      const now = Date.now();
      const overdue = complaints.filter((c) => {
        if (c.status === "Resolved") return false;
        const ms = new Date(c.date || Date.now()).getTime();
        return now - ms > 48 * 3600 * 1000;
      });

      if (overdue.length === 0) {
        return {
          id,
          sender: "bot",
          text: `Great news! There are currently **no SLA escalations or overdue tickets** in the queue. All facility tickets are progressing within expected timelines.`,
          timestamp,
        };
      }

      const overdueList = overdue
        .slice(0, 3)
        .map(
          (c) =>
            `• **${c.id}** — *${c.title}* (${c.building}, Priority: ${c.priority}, Status: ${c.status})`,
        )
        .join("\n");

      return {
        id,
        sender: "bot",
        text: `⚠️ **Active SLA Escalation Alert**\nFound **${overdue.length} ticket(s)** that have exceeded the standard 48-hour resolution threshold:\n\n${overdueList}\n\nYou can review these in the **Admin Queue** or **Alerts** panel to reassign or expedite dispatch.`,
        timestamp,
      };
    }

    // 6D. Building Hotspots
    if (
      lower.includes("building") ||
      lower.includes("block") ||
      lower.includes("hotspot") ||
      lower.includes("location")
    ) {
      const counts: Record<string, number> = {};
      complaints.forEach((c) => {
        counts[c.building] = (counts[c.building] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const topStr = sorted
        .slice(0, 4)
        .map(([b, cnt]) => `• **${b}:** ${cnt} complaint(s)`)
        .join("\n");

      return {
        id,
        sender: "bot",
        text: `📍 **Complaint Distribution by Campus Facility:**\n\n${topStr}\n\n*Top hotspot:* **${sorted[0]?.[0] || "None"}** with ${sorted[0]?.[1] || 0} total reports.`,
        timestamp,
      };
    }
  }

  // ==========================================
  // 7. CAMPUS MAINTENANCE FAQS & POLICIES
  // ==========================================
  if (
    lower.includes("hostel") &&
    (lower.includes("time") || lower.includes("hour") || lower.includes("night") || lower.includes("repair"))
  ) {
    return {
      id,
      sender: "bot",
      text: `🏠 **Hostel Maintenance Policy:**\n\n` +
        `• **Routine Repairs:** 9:00 AM – 6:00 PM (Monday to Saturday).\n` +
        `• **Emergency Repairs (Water leak, Electrical spark, Power failure):** 24/7 on-call facility wardens.\n` +
        `• For immediate night-time electrical hazards, please alert your block warden or security gate immediately.`,
      timestamp,
    };
  }

  if (
    lower.includes("escalation") ||
    lower.includes("priority work") ||
    lower.includes("how does priority") ||
    lower.includes("sla")
  ) {
    return {
      id,
      sender: "bot",
      text: `⚡ **FixLens AI Priority & Escalation Rules:**\n\n` +
        `1. **Trained ML Model:** Every report is analyzed by a TF-IDF + Random Forest model that evaluates the description, safety keywords, category, and affected students.\n` +
        `2. **Priority Tiers:** \`High\` (SLA: 12-24h), \`Medium\` (SLA: 48h), and \`Low\` (SLA: 72h).\n` +
        `3. **Automatic Escalation:** Any unaddressed High or Medium issue older than 48 hours is flagged as an anomaly in the Admin Alert Center.`,
      timestamp,
    };
  }

  if (
    lower.includes("proposal") ||
    lower.includes("vote") ||
    lower.includes("improvement")
  ) {
    const activeProposals = proposals.filter((p) => p.status === "Open" || !p.status);
    const proposalList = activeProposals
      .slice(0, 3)
      .map((p) => `• **${p.title}** (${p.support || 0} votes) — *${p.category}*`)
      .join("\n");

    return {
      id,
      sender: "bot",
      text: `💡 **Campus Improvement Proposals:**\nStudents can upvote community proposals to improve campus infrastructure. Top-voted proposals are reviewed monthly by the administration.\n\n**Current Active Proposals:**\n${
        proposalList || "No open proposals at this time."
      }\n\n👉 Head to **Proposals** in the navigation menu to vote!`,
      timestamp,
    };
  }

  if (
    lower.includes("wifi") ||
    lower.includes("wi-fi") ||
    lower.includes("internet password")
  ) {
    return {
      id,
      sender: "bot",
      text: `📶 **Campus Wi-Fi Guidelines:**\n\n` +
        `• SSID: \`CAMPUS-STUDENT-5G\`\n` +
        `• Authentication: Use your student portal email and credentials.\n` +
        `• If a specific access point in your classroom or hostel is disconnected, you can file an **Internet/Wi-Fi** complaint here and IT support will reset the node.`,
      timestamp,
    };
  }

  // ==========================================
  // 8. NATURAL LANGUAGE COMPLAINT DRAFTING (Strictly when describing a problem)
  // ==========================================
  const extracted = extractComplaintParams(query);
  if (extracted.isComplaintIntent) {
    // If the student or admin didn't mention a building, ask for clarification via multi-turn memory!
    if (!extracted.hasExplicitBuilding && query.length < 50) {
      return {
        id,
        sender: "bot",
        text: `I've registered your **${extracted.category}** maintenance request: *" ${query} "*.\n\n📍 **Which campus building is this in?** Please type the building & room (or tap a quick option below):`,
        timestamp,
        pendingContext: {
          description: extracted.extractedDescription,
          category: extracted.category,
          urgency: extracted.urgency,
          affected: extracted.affected,
        },
        quickReplies: [
          "Main Library Ground Floor",
          "CS Block Lab 2",
          "Boys Hostel Floor 1",
          "Girls Hostel Floor 2",
          "Admin Block",
        ],
      };
    }

    // Call the trained ML priority model to predict priority
    let predictedPriority: Priority = extracted.urgency;
    let confidence: number | undefined;
    let signals: string[] | undefined;

    try {
      const mlRes: MLPredictionResult = await predictComplaintPriority({
        description: extracted.extractedDescription,
        category: extracted.category,
        urgency: extracted.urgency,
        affected: extracted.affected,
      });
      predictedPriority = mlRes.priority;
      confidence = mlRes.confidence;
      signals = mlRes.signals;
    } catch {
      predictedPriority = extracted.urgency;
    }

    const title =
      query.length > 50
        ? `${extracted.category} issue in ${extracted.building}`
        : query.charAt(0).toUpperCase() + query.slice(1);

    return {
      id,
      sender: "bot",
      text: `I've analyzed your issue and prepared a complaint draft using our **AI Priority Prediction Model**:\n\n` +
        `• **Category:** ${extracted.category}\n` +
        `• **Location:** ${extracted.building} (${extracted.room})\n` +
        `• **AI Predicted Priority:** **${predictedPriority}**${
          confidence ? ` (${(confidence * 100).toFixed(0)}% confidence)` : ""
        }\n` +
        `• **Estimated Affected:** ${extracted.affected} person(s)\n\n` +
        `Review the card below and click **"Confirm & Submit Complaint"** to register it directly into the dispatch queue:`,
      timestamp,
      actionCard: {
        type: "complaint-draft",
        title,
        description: query,
        category: extracted.category,
        building: extracted.building,
        room: extracted.room,
        urgency: extracted.urgency,
        affected: extracted.affected,
        predictedPriority,
        confidence,
        signals,
      },
    };
  }

  // ==========================================
  // 9. GENERAL ASSISTANCE FALLBACK
  // ==========================================
  if (portal === "Administrator") {
    return {
      id,
      sender: "bot",
      text: `I'm here to assist your facility administration. You can ask me to:\n` +
        `• *"Show all complaints"* to view the queue\n` +
        `• *"Show high priority complaints"* for urgent tickets\n` +
        `• *"Summarize active queue"* for metrics\n` +
        `• *"Check for SLA escalations"* to find overdue tickets\n` +
        `• *"Which building has the most complaints?"* for hotspot trends\n\n` +
        `Or describe an issue directly to file it. What would you like to check?`,
      timestamp,
      quickReplies: [
        "📊 Queue summary",
        "🚨 High priority tickets",
        "⚠️ Check SLA escalations",
        "📍 Building hotspots",
      ],
    };
  }

  return {
    id,
    sender: "bot",
    text: `I'm here to help with all campus facilities! Here are a few things I can do:\n\n` +
      `• **View Complaints:** Ask *"Show me all complaints I made"*\n` +
      `• **Check Status:** Provide a ticket number like \`FX-1042\`\n` +
      `• **Report an Issue:** Tell me what's broken (e.g. *"Drainage overflow near the main library"*)\n` +
      `• **Campus FAQs:** Ask about hostel repair hours or Wi-Fi connectivity\n\n` +
      `How can I help you today?`,
    timestamp,
    quickReplies: [
      "📋 Show all complaints I made",
      "⚡ Report an issue",
      "⚠️ How does priority work?",
      "💡 Active proposals",
    ],
  };
}
