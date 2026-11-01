import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
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
import {
  fetchComplaintsFromSupabase,
  createComplaintInSupabase,
  updateComplaintInSupabase,
  addFollowUpInSupabase,
  fetchProposalsFromSupabase,
  createProposalInSupabase,
  voteProposalInSupabase,
  reviewProposalInSupabase,
  fetchUserVotesFromSupabase,
} from "./supabase-data";
import { getStudentAuthState, getAdminAuthState } from "./supabase-auth";
import { supabase } from "@/integrations/supabase/client";

export interface StudentUser {
  id?: string;
  name: string;
  email: string;
  department: string;
  phone?: string;
  role?: string;
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
  imageFile?: File | undefined;
}

export interface Store {
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
    imageFile?: File,
  ) => Complaint;
  updateComplaint: (
    id: string,
    patch: { status?: Status; priority?: Priority; note?: string },
  ) => void;
  addProposal: (p: Pick<Proposal, "title" | "description" | "category" | "location">) => Proposal;
  vote: (id: string) => boolean;
  reviewProposal: (id: string, status: ProposalStatus, note: string) => void;
  resetDemoData: () => void;
  // Supabase synchronization
  isSupabaseConnected: boolean;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
const today = () => new Date().toISOString().slice(0, 10);

const isTestMode =
  typeof process !== "undefined" &&
  (process.env.NODE_ENV === "test" || process.env.VITEST === "true");

function logStoreNotice(msg: string, ...args: unknown[]) {
  if (!isTestMode) console.warn(msg, ...args);
}

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);
  const [proposals, setProposals] = useState<Proposal[]>(initialProposals);
  const [votedIds, setVoted] = useState<string[]>([]);
  const [currentStudent, setCurrentStudent] = useState<StudentUser>(DEMO_STUDENT);
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Synchronize with Supabase database
  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [studentAuth, adminAuth] = await Promise.all([
        getStudentAuthState(),
        getAdminAuthState(),
      ]);

      const isAuthenticated = studentAuth.isAuthenticated || adminAuth.isAuthenticated;

      if (studentAuth.isAuthenticated && studentAuth.user) {
        setCurrentStudent(studentAuth.user);
      }

      const activeUserId =
        studentAuth.user?.id ||
        (adminAuth.isAuthenticated ? undefined : (currentStudent.id !== DEMO_STUDENT.id ? currentStudent.id : undefined));
      const isAdmin = adminAuth.isAuthenticated;

      const [remoteComplaints, remoteProposals, remoteVotes] = await Promise.all([
        fetchComplaintsFromSupabase({
          userId: activeUserId,
          isAdmin,
        }),
        fetchProposalsFromSupabase(),
        activeUserId ? fetchUserVotesFromSupabase(activeUserId) : Promise.resolve([]),
      ]);

      if (isAuthenticated) {
        // Authenticated user (student or admin): directly populate state from real Supabase database records
        setComplaints(remoteComplaints);
        setProposals(remoteProposals);
        setVoted(remoteVotes);
        setIsSupabaseConnected(true);
      } else {
        // Unauthenticated demo / offline fallback: clear stale user session data and restore demo baseline
        setComplaints(remoteComplaints && remoteComplaints.length > 0 ? remoteComplaints : initialComplaints);
        setProposals(remoteProposals && remoteProposals.length > 0 ? remoteProposals : initialProposals);
        setVoted(remoteVotes && remoteVotes.length > 0 ? remoteVotes : []);
        setIsSupabaseConnected(false);
      }
    } catch (err) {
      logStoreNotice("[Demo Store] Supabase sync notice:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const studentAuth = await getStudentAuthState();
        if (studentAuth.isAuthenticated && studentAuth.user) {
          setCurrentStudent(studentAuth.user);
        }
      } else {
        setCurrentStudent(DEMO_STUDENT);
      }
      refreshData();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const store: Store = {
    complaints,
    proposals,
    votedIds,
    currentStudent,
    setCurrentStudent,
    reportDraft,
    setReportDraft,
    isSupabaseConnected,
    isLoading,
    refreshData,

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

      // Asynchronously persist to Supabase
      if (currentStudent.id && currentStudent.id !== DEMO_STUDENT.id) {
        addFollowUpInSupabase(complaintId, trimmed, currentStudent).catch((err) => {
          logStoreNotice("[Demo Store] Follow-up Supabase sync notice:", err);
          if (!isTestMode) {
            toast.error("Could not save follow-up to Supabase: " + (err instanceof Error ? err.message : String(err)));
          }
        });
      }

      return updated;
    },

    addComplaint: (c, imageFile) => {
      const numIds = complaints
        .map((x) => Number(x.id.replace(/[^\d]/g, "")))
        .filter((n) => !isNaN(n));
      const n = (numIds.length > 0 ? Math.max(...numIds) : 1000) + 1;
      const localId = `FX-${n}`;
      const initialNote = c.linkedComplaintId
        ? `Complaint received (demo). Reopened recurrence linked to ${c.linkedComplaintId}.`
        : "Complaint received (demo).";

      const item: Complaint = {
        ...c,
        id: localId,
        status: "Submitted",
        date: today(),
        reporter: currentStudent.name,
        reporterId: currentStudent.id,
        timeline: [
          {
            status: "Submitted",
            date: today(),
            note: initialNote,
            by: currentStudent.name,
          },
        ],
      };

      // Optimistic state update
      setComplaints((xs) => [item, ...xs]);

      // Asynchronously persist to Supabase if authenticated
      if (currentStudent.id && currentStudent.id !== DEMO_STUDENT.id) {
        createComplaintInSupabase({ ...c, id: localId }, currentStudent, imageFile)
          .then((persisted) => {
            setComplaints((xs) => xs.map((comp) => (comp.id === localId ? persisted : comp)));
          })
          .catch((err) => {
            logStoreNotice("[Demo Store] Complaint Supabase persist notice:", err);
            if (!isTestMode) {
              toast.error("Could not save to Supabase: " + (err instanceof Error ? err.message : String(err)));
            }
          });
      }

      return item;
    },

    updateComplaint: (id, patch) => {
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
                by: "Facilities Team",
              },
            ];
          } else if (trimmedNote) {
            next.timeline = [
              ...c.timeline,
              {
                status: c.status,
                date: today(),
                note: trimmedNote,
                by: "Facilities Team",
              },
            ];
          }
          return next;
        }),
      );

      // Asynchronously update in Supabase
      updateComplaintInSupabase(id, patch).catch((err) => {
        logStoreNotice("[Demo Store] Complaint update Supabase sync notice:", err);
      });
    },

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

      // Asynchronously persist to Supabase
      if (currentStudent.id && currentStudent.id !== DEMO_STUDENT.id) {
        createProposalInSupabase({ ...p, id: item.id }, currentStudent)
          .then((persisted) => {
            setProposals((xs) => xs.map((prop) => (prop.id === item.id ? persisted : prop)));
            if (persisted.id !== item.id) {
              setVoted((v) => v.map((vid) => (vid === item.id ? persisted.id : vid)));
            }
          })
          .catch((err) => {
            logStoreNotice("[Demo Store] Proposal create Supabase sync notice:", err);
            if (!isTestMode) {
              toast.error("Could not save proposal to Supabase: " + (err instanceof Error ? err.message : String(err)));
            }
          });
      }

      return item;
    },

    vote: (id) => {
      if (votedIds.includes(id)) return false;
      setVoted((v) => [...v, id]);
      setProposals((xs) => xs.map((p) => (p.id === id ? { ...p, support: p.support + 1 } : p)));

      // Asynchronously persist to Supabase
      if (currentStudent.id && currentStudent.id !== DEMO_STUDENT.id) {
        voteProposalInSupabase(id, currentStudent.id).catch((err) => {
          logStoreNotice("[Demo Store] Vote Supabase sync notice:", err);
          if (!isTestMode) {
            toast.error("Could not save vote to Supabase: " + (err instanceof Error ? err.message : String(err)));
          }
        });
      }

      return true;
    },

    reviewProposal: (id, status, note) => {
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
      );

      // Asynchronously update in Supabase
      reviewProposalInSupabase(id, status, note).catch((err) => {
        logStoreNotice("[Demo Store] Proposal review Supabase sync notice:", err);
      });
    },

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
  if (!s) {
    // Safe fallback store when rendered in isolated unit tests without DemoStoreProvider
    return {
      complaints: initialComplaints,
      proposals: initialProposals,
      votedIds: [],
      currentStudent: DEMO_STUDENT,
      setCurrentStudent: () => {},
      reportDraft: null,
      setReportDraft: () => {},
      addFollowUp: () => undefined,
      addComplaint: () => ({} as Complaint),
      updateComplaint: () => {},
      addProposal: () => ({} as Proposal),
      vote: () => false,
      reviewProposal: () => {},
      resetDemoData: () => {},
      isSupabaseConnected: false,
      isLoading: false,
      refreshData: async () => {},
    };
  }
  return s;
}
