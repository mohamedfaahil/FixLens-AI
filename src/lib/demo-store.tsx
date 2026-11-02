import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { generateUniqueComplaintId } from "./id-generator";
import {
  initialComplaints,
  initialProposals,
  EMPTY_STUDENT,
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
  fetchAnomaliesFromSupabase,
  updateAnomalyStatusInSupabase,
  recordEscalationInSupabase,
  type AppNotification,
} from "./supabase-data";
import { getStudentAuthState, getAdminAuthState } from "./supabase-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  generateAdminAlerts,
  type AdminAlert,
  type AlertStatus,
} from "./admin-alert-engine";
import {
  evaluateComplaintEscalation,
  type ComplaintEscalationResult,
} from "./escalation-engine";
import {
  type MaintenanceAnomaly,
  type AnomalyStatus,
} from "./anomaly-engine";

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
  ) => Complaint & PromiseLike<Complaint>;
  updateComplaint: (
    id: string,
    patch: {
      status?: Status;
      priority?: Priority;
      note?: string;
      escalatedPriority?: Priority;
      escalationReasons?: string[];
      isAdminOverride?: boolean;
    },
  ) => void;
  addProposal: (p: Pick<Proposal, "title" | "description" | "category" | "location">) => Proposal;
  vote: (id: string) => boolean;
  reviewProposal: (id: string, status: ProposalStatus, note: string) => void;
  resetDemoData: () => void;
  // Phase 2: Priority Escalation, Anomalies & Dynamic Admin Alerts
  anomalies: MaintenanceAnomaly[];
  adminAlerts: AdminAlert[];
  escalatedComplaints: ComplaintEscalationResult[];
  insufficientAnomalyData: boolean;
  insufficientAnomalyReason?: string;
  updateAlertStatus: (id: string, status: AlertStatus, notes?: string) => void;
  updateAnomalyStatus: (id: string, status: AnomalyStatus, notes?: string) => void;
  acknowledgeAlert: (id: string) => void;
  resolveAlert: (id: string) => void;
  // Phase 3: Smart Notifications
  notifications: AppNotification[];
  addStudentNotification: (n: Omit<AppNotification, "id" | "createdAt" | "isRead">) => void;
  markStudentNotificationAsRead: (id: string) => void;
  markAllStudentNotificationsAsRead: () => void;
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

// ====================================================================
// PHASE 3: SMART NOTIFICATIONS & ADMIN ALERT PERSISTENCE HELPERS
// ====================================================================

const ADMIN_ALERTS_KEY_PREFIX = "fixlens_admin_alerts_";
const STUDENT_NOTIFS_KEY_PREFIX = "fixlens_student_notifs_";

export function getAdminAlertsStorageKey(adminEmail?: string): string {
  const cleanEmail = (adminEmail || "demo").toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return `${ADMIN_ALERTS_KEY_PREFIX}${cleanEmail}`;
}

export function loadPersistedAdminAlerts(adminEmail?: string): AdminAlert[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(getAdminAlertsStorageKey(adminEmail));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePersistedAdminAlerts(alerts: AdminAlert[], adminEmail?: string) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(getAdminAlertsStorageKey(adminEmail), JSON.stringify(alerts));
  } catch {
    // Ignore storage quota or access errors
  }
}

export const DEFAULT_STUDENT_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif-welcome-1",
    title: "Welcome to FixLens AI",
    message: "Report campus maintenance issues and receive intelligent priority recommendations.",
    type: "info",
    isRead: false,
    createdAt: new Date().toISOString(),
  },
];

export function getStudentNotifsStorageKey(userId?: string): string {
  const cleanId = (userId || "demo").toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return `${STUDENT_NOTIFS_KEY_PREFIX}${cleanId}`;
}

export function loadPersistedStudentNotifs(userId?: string): AppNotification[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return DEFAULT_STUDENT_NOTIFICATIONS;
  }
  try {
    const raw = localStorage.getItem(getStudentNotifsStorageKey(userId));
    return raw ? JSON.parse(raw) : DEFAULT_STUDENT_NOTIFICATIONS;
  } catch {
    return DEFAULT_STUDENT_NOTIFICATIONS;
  }
}

export function savePersistedStudentNotifs(notifs: AppNotification[], userId?: string) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(getStudentNotifsStorageKey(userId), JSON.stringify(notifs));
  } catch {
    // Ignore storage quota or access errors
  }
}

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);
  const [proposals, setProposals] = useState<Proposal[]>(initialProposals);
  const [votedIds, setVoted] = useState<string[]>([]);
  const [currentStudent, setCurrentStudent] = useState<StudentUser>(EMPTY_STUDENT);
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeAdminEmail, setActiveAdminEmail] = useState<string | null>(null);

  // Phase 2: Lifecycle overrides for anomalies and alerts (persisted per admin account across refresh)
  const [persistedAnomalies, setPersistedAnomalies] = useState<MaintenanceAnomaly[]>([]);
  const [persistedAlerts, setPersistedAlerts] = useState<AdminAlert[]>(() =>
    loadPersistedAdminAlerts(),
  );

  // Phase 3: In-memory & demo student notifications
  const [studentNotifications, setStudentNotifications] = useState<AppNotification[]>(() =>
    loadPersistedStudentNotifs(),
  );

  // Synthesize dynamic alerts, anomalies and escalations from live complaints
  const alertsSnapshot = useMemo(() => {
    return generateAdminAlerts(complaints, persistedAlerts, persistedAnomalies);
  }, [complaints, persistedAlerts, persistedAnomalies]);

  const updateAlertStatus = (id: string, status: AlertStatus, notes?: string) => {
    const nowStr = new Date().toISOString();
    setPersistedAlerts((prev) => {
      let next: AdminAlert[];
      const existing = prev.find((a) => a.id === id);
      if (existing) {
        next = prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status,
                adminNotes: notes !== undefined ? notes : a.adminNotes,
                resolvedAt: status === "Resolved" ? nowStr : a.resolvedAt,
              }
            : a,
        );
      } else {
        const match = alertsSnapshot.alerts.find((a) => a.id === id);
        if (match) {
          next = [
            ...prev,
            {
              ...match,
              status,
              adminNotes: notes,
              resolvedAt: status === "Resolved" ? nowStr : undefined,
            },
          ];
        } else {
          next = prev;
        }
      }
      savePersistedAdminAlerts(next, activeAdminEmail || undefined);
      return next;
    });

    if (id.startsWith("alert-anom-")) {
      const anomId = id.replace("alert-anom-", "");
      updateAnomalyStatus(anomId, status as AnomalyStatus, notes);
    }
  };

  const addStudentNotification = (
    n: Omit<AppNotification, "id" | "createdAt" | "isRead">,
  ) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      createdAt: new Date().toISOString(),
      isRead: false,
      userId: currentStudent.id,
      ...n,
    };
    setStudentNotifications((prev) => {
      const isDuplicate = prev.some(
        (existing) =>
          existing.referenceId === newNotif.referenceId &&
          existing.title === newNotif.title,
      );
      if (isDuplicate) return prev;
      const next = [newNotif, ...prev];
      savePersistedStudentNotifs(next, currentStudent.id);
      return next;
    });
  };

  const markStudentNotificationAsRead = (id: string) => {
    setStudentNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      savePersistedStudentNotifs(next, currentStudent.id);
      return next;
    });
  };

  const markAllStudentNotificationsAsRead = () => {
    setStudentNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, isRead: true }));
      savePersistedStudentNotifs(next, currentStudent.id);
      return next;
    });
  };

  const updateAnomalyStatus = (id: string, status: AnomalyStatus, notes?: string) => {
    const nowStr = new Date().toISOString();
    setPersistedAnomalies((prev) => {
      const existing = prev.find((a) => a.id === id);
      if (existing) {
        return prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status,
                adminNotes: notes !== undefined ? notes : a.adminNotes,
                resolvedAt: status === "Resolved" ? nowStr : a.resolvedAt,
              }
            : a,
        );
      }
      const match = alertsSnapshot.anomalies.find((a) => a.id === id);
      if (match) {
        return [
          ...prev,
          {
            ...match,
            status,
            adminNotes: notes,
            resolvedAt: status === "Resolved" ? nowStr : undefined,
          },
        ];
      }
      return prev;
    });

    if (isSupabaseConnected) {
      updateAnomalyStatusInSupabase(id, status, notes).catch((err) => {
        logStoreNotice("[Demo Store] Update anomaly Supabase notice:", err);
      });
    }
  };

  const acknowledgeAlert = (id: string) => {
    updateAlertStatus(id, "Acknowledged");
  };

  const resolveAlert = (id: string) => {
    updateAlertStatus(id, "Resolved");
  };

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
      } else {
        setCurrentStudent(EMPTY_STUDENT);
      }

      const activeUserId = studentAuth.isAuthenticated ? studentAuth.user?.id : undefined;
      const isAdmin = adminAuth.isAuthenticated;

      if (adminAuth.isAuthenticated && adminAuth.email) {
        setActiveAdminEmail(adminAuth.email);
        const storedAlerts = loadPersistedAdminAlerts(adminAuth.email);
        if (storedAlerts && storedAlerts.length > 0) {
          setPersistedAlerts(storedAlerts);
        }
        try {
          const remoteAnomalies = await fetchAnomaliesFromSupabase();
          if (remoteAnomalies && remoteAnomalies.length > 0) {
            setPersistedAnomalies(remoteAnomalies);
          }
        } catch (err) {
          logStoreNotice("[Demo Store] Failed to sync anomalies:", err);
        }
      }

      if (studentAuth.isAuthenticated && studentAuth.user) {
        setCurrentStudent(studentAuth.user);
        const storedNotifs = loadPersistedStudentNotifs(studentAuth.user.id);
        if (storedNotifs && storedNotifs.length > 0) {
          setStudentNotifications(storedNotifs);
        }
      }

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
        } else {
          setCurrentStudent(EMPTY_STUDENT);
        }
      } else {
        setCurrentStudent(EMPTY_STUDENT);
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
    // Phase 2: Priority Escalation, Anomalies & Dynamic Admin Alerts
    anomalies: alertsSnapshot.anomalies,
    adminAlerts: alertsSnapshot.alerts,
    escalatedComplaints: alertsSnapshot.escalations,
    insufficientAnomalyData: alertsSnapshot.insufficientData,
    insufficientAnomalyReason: alertsSnapshot.insufficientDataReason,
    updateAlertStatus,
    updateAnomalyStatus,
    acknowledgeAlert,
    resolveAlert,
    // Phase 3: Smart Notifications
    notifications: studentNotifications,
    addStudentNotification,
    markStudentNotificationAsRead,
    markAllStudentNotificationsAsRead,

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
      if (currentStudent.id) {
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
      const uniqueId = generateUniqueComplaintId();
      const initialNote = c.linkedComplaintId
        ? `Complaint received (demo). Reopened recurrence linked to ${c.linkedComplaintId}.`
        : "Complaint received (demo).";

      const item: Complaint = {
        ...c,
        id: uniqueId,
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

      // Supabase persistence promise
      const persistPromise: Promise<Complaint> = (async () => {
        if (currentStudent.id) {
          try {
            const persisted = await createComplaintInSupabase(
              { ...c, id: uniqueId },
              currentStudent,
              imageFile,
            );
            setComplaints((xs) => xs.map((comp) => (comp.id === uniqueId ? persisted : comp)));
            // Dispatch student submission & recurrence notifications ONLY after persistence succeeds
            addStudentNotification({
              title: `Complaint Submitted: ${persisted.title}`,
              message: `Your complaint (${persisted.id}) has been recorded and submitted for campus maintenance review.`,
              type: "info",
              referenceId: persisted.id,
            });
            if (persisted.linkedComplaintId) {
              addStudentNotification({
                title: `Recurring Issue Linked`,
                message: `Your report has been linked to recurring incident ${persisted.linkedComplaintId}. It will be tracked as part of the existing maintenance ticket.`,
                type: "duplicate_alert",
                referenceId: persisted.id,
              });
            }
            return persisted;
          } catch (err) {
            // Revert optimistic complaint upon failure
            setComplaints((xs) => xs.filter((comp) => comp.id !== uniqueId));
            logStoreNotice("[Demo Store] Complaint Supabase persist error:", err);
            if (!isTestMode) {
              toast.error(
                "Could not save to Supabase: " + (err instanceof Error ? err.message : String(err)),
              );
            }
            throw err;
          }
        }
        // In-memory demo mode: dispatch submission and recurrence notifications
        addStudentNotification({
          title: `Complaint Submitted: ${item.title}`,
          message: `Your complaint (${item.id}) has been recorded.`,
          type: "info",
          referenceId: item.id,
        });
        if (item.linkedComplaintId) {
          addStudentNotification({
            title: `Recurring Issue Linked`,
            message: `Your report has been linked to recurring incident ${item.linkedComplaintId}. It will be tracked as part of the existing maintenance ticket.`,
            type: "duplicate_alert",
            referenceId: item.id,
          });
        }
        return item;
      })();

      // Return item as Thenable so it can be either used synchronously or awaited
      const thenable = Object.assign(item, {
        then: persistPromise.then.bind(persistPromise),
        catch: persistPromise.catch.bind(persistPromise),
        finally: persistPromise.finally.bind(persistPromise),
      });

      return thenable;
    },

    updateComplaint: (id, patch) => {
      const target = complaints.find((c) => c.id === id);
      const trimmedNote = patch.note?.trim();
      const statusChanged = Boolean(patch.status && target && patch.status !== target.status);

      // Detect genuine operational priority escalation vs status change for student notifications
      if (target) {
        const PRIORITY_RANK: Record<string, number> = { Low: 1, Medium: 2, High: 3 };
        const newPriority = patch.priority || patch.escalatedPriority;
        const oldPriority = target.priority || "Low";
        const isGenuineEscalation = Boolean(
          newPriority && (PRIORITY_RANK[newPriority] ?? 0) > (PRIORITY_RANK[oldPriority] ?? 0),
        );

        if (isGenuineEscalation) {
          const reasons = patch.escalationReasons?.length
            ? ` Reasons: ${patch.escalationReasons.join(", ")}.`
            : "";
          const noteText = trimmedNote ? ` Note: ${trimmedNote}` : "";
          addStudentNotification({
            title: `Priority Escalated: ${target.title || id}`,
            message: `Operational priority has been escalated to ${newPriority}.${reasons}${noteText}`,
            type: "status_update",
            referenceId: id,
          });
        } else if (statusChanged) {
          addStudentNotification({
            title: `Complaint ${id} Updated`,
            message: `Status changed to ${patch.status}.${trimmedNote ? ` Note: ${trimmedNote}` : ""}`,
            type: "status_update",
            referenceId: id,
          });
        }
      }

      setComplaints((xs) =>
        xs.map((c) => {
          if (c.id !== id) return c;
          const next = { ...c };
          if (patch.priority) {
            next.priority = patch.priority;
            next.isAdminOverride = true;
          }
          if (patch.escalatedPriority) next.escalatedPriority = patch.escalatedPriority;
          if (patch.escalationReasons) next.escalationReasons = patch.escalationReasons;
          if (patch.isAdminOverride !== undefined) next.isAdminOverride = patch.isAdminOverride;
          if (trimmedNote) {
            next.resolutionNote = trimmedNote;
          }

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
      if (currentStudent.id) {
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
      if (currentStudent.id) {
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
      const target = proposals.find((p) => p.id === id);
      const statusChanged = target && target.status !== status;
      const trimmedNote = note.trim();

      setProposals((xs) =>
        xs.map((p) => {
          if (p.id !== id) return p;
          return {
            ...p,
            status,
            adminNote: trimmedNote || p.adminNote,
          };
        }),
      );

      // Dispatch proposal decision notification to relevant student
      if (target && (statusChanged || trimmedNote)) {
        addStudentNotification({
          title: `Proposal Decision: ${target.title}`,
          message: `Your campus improvement proposal status has been updated to "${status}"${trimmedNote ? `: "${trimmedNote}"` : "."}`,
          type: "proposal",
          referenceId: target.id,
        });
      }

      // Asynchronously update in Supabase
      reviewProposalInSupabase(id, status, note).catch((err) => {
        logStoreNotice("[Demo Store] Proposal review Supabase sync notice:", err);
      });
    },

    resetDemoData: () => {
      setComplaints(initialComplaints);
      setProposals(initialProposals);
      setVoted([]);
      setPersistedAnomalies([]);
      setPersistedAlerts([]);
      setStudentNotifications(DEFAULT_STUDENT_NOTIFICATIONS);
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.removeItem(getAdminAlertsStorageKey());
          localStorage.removeItem(getStudentNotifsStorageKey());
        } catch {
          // Ignore
        }
      }
      setCurrentStudent(EMPTY_STUDENT);
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
      currentStudent: EMPTY_STUDENT,
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
      anomalies: [],
      adminAlerts: [],
      escalatedComplaints: [],
      insufficientAnomalyData: false,
      insufficientAnomalyReason: undefined,
      updateAlertStatus: () => {},
      updateAnomalyStatus: () => {},
      acknowledgeAlert: () => {},
      resolveAlert: () => {},
      notifications: DEFAULT_STUDENT_NOTIFICATIONS,
      addStudentNotification: () => {},
      markStudentNotificationAsRead: () => {},
      markAllStudentNotificationsAsRead: () => {},
      isSupabaseConnected: false,
      isLoading: false,
      refreshData: async () => {},
    };
  }
  return s;
}
