import { createContext, useContext, useState, type ReactNode } from "react";
import {
  initialComplaints,
  initialProposals,
  DEMO_STUDENT,
  type Complaint,
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

// All state lives in browser memory for this tab only. Nothing is sent to a server.
interface Store {
  complaints: Complaint[];
  proposals: Proposal[];
  votedIds: string[];
  currentStudent: StudentUser;
  setCurrentStudent: (student: StudentUser) => void;
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

  const store: Store = {
    complaints,
    proposals,
    votedIds,
    currentStudent,
    setCurrentStudent,
    addComplaint: (c) => {
      const numIds = complaints
        .map((x) => Number(x.id.replace(/[^\d]/g, "")))
        .filter((n) => !isNaN(n));
      const n = (numIds.length > 0 ? Math.max(...numIds) : 1000) + 1;
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
            note: "Complaint received (demo).",
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
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useDemoStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useDemoStore must be used inside DemoStoreProvider");
  return s;
}
