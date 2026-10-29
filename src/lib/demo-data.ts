// ILLUSTRATIVE DEMO DATA — not real campus records. Frontend prototype only.

export const CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Cleaning",
  "Internet/Wi-Fi",
  "Furniture",
  "Safety",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const BUILDINGS = [
  "CS Block",
  "MCA Block",
  "Main Library",
  "Admin Block",
  "Boys Hostel",
  "Girls Hostel",
  "Cafeteria",
  "Sports Complex",
] as const;

export const DEPARTMENTS = [
  "Computer Applications (MCA)",
  "Computer Science",
  "Electronics",
  "Mechanical",
  "Civil",
  "Management (MBA)",
  "Commerce",
];

export const STATUSES = [
  "Submitted",
  "Under Review",
  "In Progress",
  "Resolved",
  "Rejected",
] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["Low", "Medium", "High"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PROPOSAL_STATUSES = [
  "Under Review",
  "Approved",
  "Planned",
  "Completed",
  "Rejected",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export interface TimelineEvent {
  status: Status;
  date: string;
  note: string;
  by: string;
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: Category;
  building: string;
  room: string;
  urgency: Priority;
  affected: number;
  priority: Priority;
  status: Status;
  date: string;
  reporter: string;
  image?: string | undefined;
  resolutionNote?: string | undefined;
  timeline: TimelineEvent[];

  // ML Prediction Persistence (saved from inference service)
  predictedPriority?: Priority | undefined;
  confidence?: number | undefined;
  classProbabilities?: Record<string, number> | undefined;
  predictionSource?: string | undefined;
  isTrainedModel?: boolean | undefined;
  signals?: string[] | undefined;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  category: Category;
  location: string;
  support: number;
  status: ProposalStatus;
  author: string;
  date: string;
  adminNote?: string | undefined;
}

const ev = (
  status: Status,
  date: string,
  note: string,
  by = "Maintenance Office",
): TimelineEvent => ({
  status,
  date,
  note,
  by,
});

export const DEMO_STUDENT = {
  name: "Aisha Rahman",
  email: "aisha.rahman@campus.edu",
  department: "Computer Applications (MCA)",
  phone: "+91 98765 43210",
};

export const DEMO_ADMIN = {
  name: "Dr. R. Menon",
  email: "facilities.admin@campus.edu",
  role: "Facilities Administrator",
};

export const initialComplaints: Complaint[] = [
  {
    id: "FX-1042",
    title: "Weak Wi-Fi signal in Lab 3",
    description:
      "Wi-Fi drops repeatedly during practical sessions in Lab 3. Around 40 students cannot access the online compiler.",
    category: "Internet/Wi-Fi",
    building: "CS Block",
    room: "Lab 3, 2nd floor",
    urgency: "High",
    affected: 40,
    priority: "High",
    status: "In Progress",
    date: "2026-10-21",
    reporter: DEMO_STUDENT.name,
    timeline: [
      ev("Submitted", "2026-10-21", "Complaint received.", DEMO_STUDENT.name),
      ev("Under Review", "2026-10-22", "Assigned to IT network team."),
      ev("In Progress", "2026-10-23", "Access point replacement scheduled."),
    ],
  },
  {
    id: "FX-1038",
    title: "Leaking tap in 1st floor washroom",
    description: "The tap near the entrance keeps running and water is pooling on the floor.",
    category: "Plumbing",
    building: "MCA Block",
    room: "Washroom, 1st floor",
    urgency: "Medium",
    affected: 15,
    priority: "Medium",
    status: "Resolved",
    date: "2026-10-14",
    reporter: DEMO_STUDENT.name,
    resolutionNote: "Tap washer replaced and floor cleaned.",
    timeline: [
      ev("Submitted", "2026-10-14", "Complaint received.", DEMO_STUDENT.name),
      ev("Under Review", "2026-10-14", "Plumber notified."),
      ev("In Progress", "2026-10-15", "Repair in progress."),
      ev("Resolved", "2026-10-16", "Tap washer replaced and floor cleaned."),
    ],
  },
  {
    id: "FX-1035",
    title: "Broken chairs in Seminar Hall",
    description: "Six chairs in the last two rows have broken backrests.",
    category: "Furniture",
    building: "Admin Block",
    room: "Seminar Hall",
    urgency: "Low",
    affected: 6,
    priority: "Low",
    status: "Under Review",
    date: "2026-10-18",
    reporter: DEMO_STUDENT.name,
    timeline: [
      ev("Submitted", "2026-10-18", "Complaint received.", DEMO_STUDENT.name),
      ev("Under Review", "2026-10-19", "Awaiting furniture inventory check."),
    ],
  },
  {
    id: "FX-1047",
    title: "Exposed wiring near staircase",
    description:
      "Loose wires hanging from the switchboard beside the main staircase. Risk of shock.",
    category: "Safety",
    building: "Main Library",
    room: "Ground floor staircase",
    urgency: "High",
    affected: 120,
    priority: "High",
    status: "Submitted",
    date: "2026-10-26",
    reporter: "Rahul Nair",
    timeline: [ev("Submitted", "2026-10-26", "Complaint received.", "Rahul Nair")],
  },
  {
    id: "FX-1045",
    title: "Tube lights not working in Room 204",
    description: "Three of the four tube lights are off, making the board hard to read.",
    category: "Electrical",
    building: "CS Block",
    room: "Room 204",
    urgency: "Medium",
    affected: 60,
    priority: "Medium",
    status: "Under Review",
    date: "2026-10-24",
    reporter: "Sneha Iyer",
    timeline: [
      ev("Submitted", "2026-10-24", "Complaint received.", "Sneha Iyer"),
      ev("Under Review", "2026-10-25", "Electrician to inspect."),
    ],
  },
  {
    id: "FX-1040",
    title: "Overflowing bins near cafeteria",
    description: "Bins are not cleared in the evening, attracting stray animals.",
    category: "Cleaning",
    building: "Cafeteria",
    room: "Outdoor seating",
    urgency: "Medium",
    affected: 200,
    priority: "Medium",
    status: "In Progress",
    date: "2026-10-20",
    reporter: "Arjun Das",
    timeline: [
      ev("Submitted", "2026-10-20", "Complaint received.", "Arjun Das"),
      ev("Under Review", "2026-10-20", "Housekeeping informed."),
      ev("In Progress", "2026-10-21", "Extra evening collection added."),
    ],
  },
  {
    id: "FX-1031",
    title: "Request for extra power sockets",
    description: "Students want more charging points in the reading area.",
    category: "Other",
    building: "Main Library",
    room: "Reading area",
    urgency: "Low",
    affected: 30,
    priority: "Low",
    status: "Rejected",
    date: "2026-10-09",
    reporter: "Meera K",
    resolutionNote: "Moved to Campus Improvement Hub as a proposal.",
    timeline: [
      ev("Submitted", "2026-10-09", "Complaint received.", "Meera K"),
      ev("Rejected", "2026-10-10", "Not a maintenance fault; submit as an improvement proposal."),
    ],
  },
  {
    id: "FX-1044",
    title: "Hostel Wi-Fi unavailable after 10 PM",
    description: "Internet stops working in Block B rooms every night after 10 PM.",
    category: "Internet/Wi-Fi",
    building: "Boys Hostel",
    room: "Block B",
    urgency: "Medium",
    affected: 80,
    priority: "Medium",
    status: "Submitted",
    date: "2026-10-23",
    reporter: "Vikram S",
    timeline: [ev("Submitted", "2026-10-23", "Complaint received.", "Vikram S")],
  },
];

export const initialProposals: Proposal[] = [
  {
    id: "IP-210",
    title: "Improve Wi-Fi coverage in CS Block classrooms",
    description:
      "Add access points on the 2nd and 3rd floors so that practical sessions are not interrupted by weak signals.",
    category: "Internet/Wi-Fi",
    location: "CS Block",
    support: 86,
    status: "Under Review",
    author: DEMO_STUDENT.name,
    date: "2026-10-12",
  },
  {
    id: "IP-204",
    title: "Charging stations in the library reading area",
    description: "Install secure charging points at each reading table.",
    category: "Electrical",
    location: "Main Library",
    support: 64,
    status: "Planned",
    author: "Meera K",
    date: "2026-10-02",
    adminNote: "Included in next quarter's electrical work plan.",
  },
  {
    id: "IP-199",
    title: "Water purifier on every hostel floor",
    description: "Currently one purifier serves three floors, causing long queues.",
    category: "Plumbing",
    location: "Girls Hostel",
    support: 112,
    status: "Approved",
    author: "Divya P",
    date: "2026-09-25",
    adminNote: "Approved; procurement initiated.",
  },
  {
    id: "IP-188",
    title: "Covered walkway between MCA Block and Cafeteria",
    description: "A shaded walkway would help during monsoon.",
    category: "Other",
    location: "MCA Block",
    support: 41,
    status: "Under Review",
    author: "Arjun Das",
    date: "2026-09-18",
  },
  {
    id: "IP-176",
    title: "Replace old benches in Sports Complex",
    description: "Spectator benches are rusted and unsafe.",
    category: "Furniture",
    location: "Sports Complex",
    support: 37,
    status: "Completed",
    author: "Karthik R",
    date: "2026-08-30",
    adminNote: "New benches installed.",
  },
  {
    id: "IP-170",
    title: "Vending machine in Admin Block",
    description: "Snack vending machine near the waiting area.",
    category: "Other",
    location: "Admin Block",
    support: 12,
    status: "Rejected",
    author: "Nikhil T",
    date: "2026-08-21",
    adminNote: "Not feasible due to space constraints near fire exit.",
  },
];

// Illustrative monthly counts for charts.
export const monthlyTrend = [
  { month: "May", complaints: 34, resolved: 28 },
  { month: "Jun", complaints: 41, resolved: 33 },
  { month: "Jul", complaints: 52, resolved: 40 },
  { month: "Aug", complaints: 47, resolved: 42 },
  { month: "Sep", complaints: 58, resolved: 45 },
  { month: "Oct", complaints: 63, resolved: 49 },
];

export const recurringIssues = [
  {
    issue: "Wi-Fi drops",
    location: "CS Block",
    category: "Internet/Wi-Fi",
    count: 14,
    lastSeen: "2026-10-21",
  },
  {
    issue: "Water leakage",
    location: "Boys Hostel",
    category: "Plumbing",
    count: 9,
    lastSeen: "2026-10-17",
  },
  {
    issue: "Lights not working",
    location: "MCA Block",
    category: "Electrical",
    count: 8,
    lastSeen: "2026-10-24",
  },
  {
    issue: "Overflowing bins",
    location: "Cafeteria",
    category: "Cleaning",
    count: 7,
    lastSeen: "2026-10-20",
  },
  {
    issue: "Broken chairs",
    location: "Admin Block",
    category: "Furniture",
    count: 5,
    lastSeen: "2026-10-18",
  },
];

export const anomalyAlerts = [
  {
    title: "Spike in Wi-Fi complaints — CS Block",
    detail: "Illustrative: 3× the usual weekly count in the last 7 days.",
    level: "High" as Priority,
  },
  {
    title: "Repeated plumbing reports — Boys Hostel",
    detail: "Illustrative: same location reported 4 times this month.",
    level: "Medium" as Priority,
  },
  {
    title: "Cleaning complaints rising — Cafeteria",
    detail: "Illustrative: gradual increase over 3 weeks.",
    level: "Low" as Priority,
  },
];

/**
 * DEMO heuristic only — a simple keyword/urgency rule used to illustrate how
 * a prediction would be displayed. It is NOT a trained model.
 */
export function demoPredictPriority(input: {
  description: string;
  category: string;
  urgency: Priority;
  affected: number;
}): { priority: Priority; signals: string[] } {
  const text = input.description.toLowerCase();
  const signals: string[] = [];
  let score = input.urgency === "High" ? 3 : input.urgency === "Medium" ? 2 : 1;
  const hot = ["shock", "fire", "spark", "danger", "leak", "flood", "exposed", "smoke", "injur"];
  const hits = hot.filter((w) => text.includes(w));
  if (hits.length) {
    score += 2;
    signals.push(`Keywords: ${hits.join(", ")}`);
  }
  if (input.category === "Safety") {
    score += 2;
    signals.push("Category: Safety");
  }
  if (input.affected >= 50) {
    score += 1;
    signals.push(`${input.affected} people affected`);
  }
  signals.push(`Reported urgency: ${input.urgency}`);
  const priority: Priority = score >= 5 ? "High" : score >= 3 ? "Medium" : "Low";
  return { priority, signals };
}
