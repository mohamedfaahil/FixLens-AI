import { createContext, useContext, useState, type ReactNode } from "react";
import {
  initialComplaints,
  initialProposals,
  DEMO_STUDENT,
  type Complaint,
  type FollowUpNote,
  type TimelineEvent,
  type Proposal,
  type ProposalStatus,
  type Status,
  type Priority,
} from "./demo-data";

export interface StudentUser {
  name: string;
  email: string;
  department: string;
  phone?: string;
}

export interface ReportDraft {
  title: string;
  description: string;
  category: string;
  building: string;
  room: string;
  urgency: Priority;
  affected: string;
  image?: string | undefined;
}

// All state lives in browser memory for this tab only. Nothing is sent to a server.
interface Store {
  complaints: Complaint[];
  proposals: Proposal[];
  votedIds: string[];
  currentStudent: StudentUser;
  setCurrentStudent: (student: StudentUser) => void;
  reportDraft: ReportDraft | null;
  setReportDraft: (draft: ReportDraft | null) => void;
  addFollowUp: (complaintId: string, content: string) => Complaint | undefined;
  addComplaint: (
    c: Omit<Complaint, "id" | "status" | "date" | "reporter" | "timeline">,
  ) => Complaint;
  updateComplaint: (
    id: string,
    patch: { status?: Status; priority?: Priority; note?: string },
  ) => void;
  addProposal: (p: Pick<Proposal, "title" | "description" | "category" | "location">) => Proposal;
  vote: (id: string) => boolean;
  reviewProposal: (id: string, status: ProposalStatus, note: string) => void;
  resetDemoData: () => void;
}

const Ctx = createContext<Store | null>(null);
const today = () => new Date().toISOString().slice(0, 10);

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);
  const [proposals, setProposals] = useState<Proposal[]>(initialProposals);
  const [votedIds, setVoted] = useState<string[]>([]);
  const [currentStudent, setCurrentStudent] = useState<StudentUser>(DEMO_STUDENT);
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);

  const store: Store = {
    complaints,
    proposals,
    votedIds,
    currentStudent,
    setCurrentStudent,
    reportDraft,
    setReportDraft,
    addFollowUp: (complaintId, content) => {
      const trimmed = content.trim();
      if (!trimmed) return undefined;
      const target = complaints.find((c) => c.id === complaintId);
      if (!target) return undefined;

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const fuId = `FU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const newFollowUp: FollowUpNote = {
        id: fuId,
        date: today(),
        timestamp: timeStr,
        content: trimmed,
        by: currentStudent.name,
      };
      const newTimelineEvent: TimelineEvent = {
        status: target.status,
        date: today(),
        note: `Follow-up: "${trimmed.slice(0, 80)}${trimmed.length > 80 ? "..." : ""}"`,
        by: currentStudent.name,
      };
      const updated: Complaint = {
        ...target,
        followUps: [...(target.followUps || []), newFollowUp],
        timeline: [...target.timeline, newTimelineEvent],
      };

      setComplaints((xs) => xs.map((c) => (c.id === complaintId ? updated : c)));
      return updated;
    },
    addComplaint: (c) => {
      const numIds = complaints
        .map((x) => Number(x.id.replace(/[^\d]/g, "")))
        .filter((n) => !isNaN(n));
      const n = (numIds.length > 0 ? Math.max(...numIds) : 1000) + 1;
      const initialNote = c.linkedComplaintId
        ? `Complaint received (demo). Reopened recurrence linked to ${c.linkedComplaintId}.`
        : "Complaint received (demo).";
      const item: Complaint = {
        ...c,
        id: `FX-${n}`,
        status: "Submitted",
        date: today(),
        reporter: currentStudent.name,
        timeline: [
          {
            status: "Submitted",
            date: today(),
            note: initialNote,
            by: currentStudent.name,
          },
        ],
      };
      setComplaints((xs) => [item, ...xs]);
      return item;
    },
    updateComplaint: (id, patch) =>
      setComplaints((xs) =>
        xs.map((c) => {
          if (c.id !== id) return c;
          const next = { ...c };
          if (patch.priority) next.priority = patch.priority;
          const trimmedNote = patch.note?.trim();
          if (trimmedNote) {
            next.resolutionNote = trimmedNote;
          }

          const statusChanged = Boolean(patch.status && patch.status !== c.status);
          if (statusChanged) {
            next.status = patch.status!;
            next.timeline = [
              ...c.timeline,
              {
                status: patch.status!,
                date: today(),
                note: trimmedNote || `Status changed to ${patch.status}.`,
                by: "Admin (demo)",
              },
            ];
          } else if (trimmedNote) {
            next.timeline = [
              ...c.timeline,
              {
                status: c.status,
                date: today(),
                note: trimmedNote,
                by: "Admin (demo)",
              },
            ];
          }
          return next;
        }),
      ),
    addProposal: (p) => {
      const numIds = proposals
        .map((x) => Number(x.id.replace(/[^\d]/g, "")))
        .filter((n) => !isNaN(n));
      const n = (numIds.length > 0 ? Math.max(...numIds) : 200) + 1;
      const item: Proposal = {
        ...p,
        id: `IP-${n}`,
        support: 1,
        status: "Under Review",
        author: currentStudent.name,
        date: today(),
      };
      setProposals((xs) => [item, ...xs]);
      setVoted((v) => [...v, item.id]);
      return item;
    },
    vote: (id) => {
      if (votedIds.includes(id)) return false;
      setVoted((v) => [...v, id]);
      setProposals((xs) => xs.map((p) => (p.id === id ? { ...p, support: p.support + 1 } : p)));
      return true;
    },
    reviewProposal: (id, status, note) =>
      setProposals((xs) =>
        xs.map((p) => {
          if (p.id !== id) return p;
          const trimmedNote = note.trim();
          return {
            ...p,
            status,
            adminNote: trimmedNote || p.adminNote,
          };
        }),
      ),
    resetDemoData: () => {
      setComplaints(initialComplaints);
      setProposals(initialProposals);
      setVoted([]);
      setCurrentStudent(DEMO_STUDENT);
      setReportDraft(null);
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useDemoStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useDemoStore must be used inside DemoStoreProvider");
  return s;
}
