import { supabase } from "@/integrations/supabase/client";
import type {
  Category,
  Complaint,
  FollowUpNote,
  Priority,
  Proposal,
  ProposalStatus,
  Status,
  TimelineEvent,
} from "./demo-data";
import type { MaintenanceAnomaly, AnomalyStatus } from "./anomaly-engine";
import type { EscalationAuditRecord } from "./escalation-engine";

// In-memory cache for resolved signed URLs to avoid duplicate network fetches
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const isTestMode =
  typeof process !== "undefined" &&
  (process.env.NODE_ENV === "test" || process.env.VITEST === "true");

function logWarning(msg: string, ...args: unknown[]) {
  if (!isTestMode) console.warn(msg, ...args);
}

function logError(msg: string, ...args: unknown[]) {
  if (!isTestMode) console.error(msg, ...args);
}

/**
 * Uploads an image file to the private 'complaint-images' bucket under '${userId}/${timestamp}-${filename}'.
 * Returns the relative storage path to be saved in public.complaints.image_url.
 */
export async function uploadComplaintImage(userId: string, file: File): Promise<string> {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${userId}/${Date.now()}-${sanitizedName}`;

  const { error } = await supabase.storage
    .from("complaint-images")
    .upload(filePath, file, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (error) {
    logError("[Supabase Storage] Upload error:", error);
    throw new Error(`Failed to upload complaint image: ${error.message}`);
  }

  return filePath;
}

/**
 * Resolves a secure, time-limited signed URL (valid for 1 hour) for an image in 'complaint-images'.
 * If the path is already an external URL or blob URL, it is returned directly.
 */
export async function resolveSignedImageUrl(imagePath?: string | null): Promise<string | undefined> {
  if (!imagePath) return undefined;

  // If already an HTTP URL, data URL, or blob URL, return as-is
  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://") ||
    imagePath.startsWith("blob:") ||
    imagePath.startsWith("data:")
  ) {
    return imagePath;
  }

  // Normalize path if prefixed with bucket name
  const cleanPath = imagePath.replace(/^complaint-images\//, "");

  // Check in-memory cache
  const cached = signedUrlCache.get(cleanPath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const { data, error } = await supabase.storage
      .from("complaint-images")
      .createSignedUrl(cleanPath, 3600);

    if (error || !data?.signedUrl) {
      logWarning("[Supabase Storage] Failed to create signed URL:", error?.message);
      return undefined;
    }

    signedUrlCache.set(cleanPath, {
      url: data.signedUrl,
      expiresAt: Date.now() + 3500 * 1000,
    });

    return data.signedUrl;
  } catch (err) {
    logWarning("[Supabase Storage] Exception creating signed URL:", err);
    return undefined;
  }
}

// ====================================================================
// COMPLAINTS DATA OPERATIONS
// ====================================================================

/**
 * Fetches complaints from Supabase according to caller role:
 * - Admin: Fetches all complaints with timeline and follow-ups.
 * - Student: Fetches own complaints and campus-wide shared complaints via RPC.
 */
export async function fetchComplaintsFromSupabase(options: {
  userId?: string;
  userName?: string;
  isAdmin?: boolean;
}): Promise<Complaint[]> {
  try {
    if (options.isAdmin) {
      // 1. Admin context: Fetch all complaints from public.complaints
      const { data: rawComplaints, error: compErr } = await supabase
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false });

      if (compErr) throw compErr;
      if (!rawComplaints || rawComplaints.length === 0) return [];

      // Fetch timeline and follow-ups in parallel
      const [timelineRes, followUpsRes] = await Promise.all([
        supabase.from("complaint_timeline").select("*").order("created_at", { ascending: true }),
        supabase.from("complaint_follow_ups").select("*").order("created_at", { ascending: true }),
      ]);

      const timelineMap = new Map<string, TimelineEvent[]>();
      (timelineRes.data || []).forEach((t) => {
        const events = timelineMap.get(t.complaint_id) || [];
        events.push({
          status: t.status as Status,
          date: t.created_at.slice(0, 10),
          note: t.note || "",
          by: t.by,
        });
        timelineMap.set(t.complaint_id, events);
      });

      const followUpsMap = new Map<string, FollowUpNote[]>();
      (followUpsRes.data || []).forEach((f) => {
        const notes = followUpsMap.get(f.complaint_id) || [];
        const time = new Date(f.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        notes.push({
          id: f.id,
          date: f.created_at.slice(0, 10),
          timestamp: time,
          content: f.content,
          by: f.author,
        });
        followUpsMap.set(f.complaint_id, notes);
      });

      // Assemble full complaints with resolved image URLs
      return await Promise.all(
        rawComplaints.map(async (c) => {
          const resolvedImg = await resolveSignedImageUrl(c.image_url);
          return {
            id: c.id,
            title: c.title,
            description: c.description,
            category: c.category as Category,
            building: c.building,
            room: c.room || "",
            urgency: c.urgency as Priority,
            affected: c.affected,
            priority: c.priority as Priority,
            predictedPriority: (c.predicted_priority as Priority) || undefined,
            confidence: c.confidence !== null ? Number(c.confidence) : undefined,
            predictionSource: c.prediction_source || undefined,
            isTrainedModel: Boolean(c.prediction_source?.includes("Trained")),
            status: c.status as Status,
            date: c.created_at.slice(0, 10),
            reporter: c.reporter,
            reporterId: c.reporter_id || undefined,
            image: resolvedImg || c.image_url || undefined,
            resolutionNote: c.resolution_note || undefined,
            linkedComplaintId: c.linked_complaint_id || undefined,
            timeline: timelineMap.get(c.id) || [
              {
                status: c.status as Status,
                date: c.created_at.slice(0, 10),
                note: "Complaint recorded.",
                by: c.reporter,
              },
            ],
            followUps: followUpsMap.get(c.id) || [],
          };
        }),
      );
    }

    // 2. Student context:
    // A. Fetch student's own complaints
    let ownComplaints: Complaint[] = [];
    if (options.userId) {
      const { data: ownRows } = await supabase
        .from("complaints")
        .select("*")
        .eq("reporter_id", options.userId)
        .order("created_at", { ascending: false });

      if (ownRows && ownRows.length > 0) {
        const ownIds = ownRows.map((r) => r.id);
        const [tlRes, fuRes] = await Promise.all([
          supabase.from("complaint_timeline").select("*").in("complaint_id", ownIds).order("created_at", { ascending: true }),
          supabase.from("complaint_follow_ups").select("*").in("complaint_id", ownIds).order("created_at", { ascending: true }),
        ]);

        const tlMap = new Map<string, TimelineEvent[]>();
        (tlRes.data || []).forEach((t) => {
          const list = tlMap.get(t.complaint_id) || [];
          list.push({
            status: t.status as Status,
            date: t.created_at.slice(0, 10),
            note: t.note || "",
            by: t.by,
          });
          tlMap.set(t.complaint_id, list);
        });

        const fuMap = new Map<string, FollowUpNote[]>();
        (fuRes.data || []).forEach((f) => {
          const list = fuMap.get(f.complaint_id) || [];
          list.push({
            id: f.id,
            date: f.created_at.slice(0, 10),
            timestamp: new Date(f.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            content: f.content,
            by: f.author,
          });
          fuMap.set(f.complaint_id, list);
        });

        ownComplaints = await Promise.all(
          ownRows.map(async (c) => {
            const resolvedImg = await resolveSignedImageUrl(c.image_url);
            return {
              id: c.id,
              title: c.title,
              description: c.description,
              category: c.category as Category,
              building: c.building,
              room: c.room || "",
              urgency: c.urgency as Priority,
              affected: c.affected,
              priority: c.priority as Priority,
              predictedPriority: (c.predicted_priority as Priority) || undefined,
              confidence: c.confidence !== null ? Number(c.confidence) : undefined,
              predictionSource: c.prediction_source || undefined,
              isTrainedModel: Boolean(c.prediction_source?.includes("Trained")),
              status: c.status as Status,
              date: c.created_at.slice(0, 10),
              reporter: c.reporter,
              reporterId: c.reporter_id || undefined,
              image: resolvedImg || c.image_url || undefined,
              resolutionNote: c.resolution_note || undefined,
              linkedComplaintId: c.linked_complaint_id || undefined,
              timeline: tlMap.get(c.id) || [
                {
                  status: c.status as Status,
                  date: c.created_at.slice(0, 10),
                  note: "Complaint submitted.",
                  by: c.reporter,
                },
              ],
              followUps: fuMap.get(c.id) || [],
            };
          }),
        );
      }
    }

    // B. Fetch shared campus complaints via RPC for duplicate detection and community browsing
    let sharedComplaints: Complaint[] = [];
    try {
      const { data: sharedRows } = await supabase.rpc("get_shared_complaints");
      if (sharedRows && Array.isArray(sharedRows)) {
        const ownIdsSet = new Set(ownComplaints.map((c) => c.id));
        sharedComplaints = await Promise.all(
          sharedRows
            .filter((s) => !ownIdsSet.has(s.id))
            .map(async (s) => {
              const resolvedImg = await resolveSignedImageUrl(s.image_url);
              return {
                id: s.id,
                title: s.title,
                description: s.description,
                category: s.category as Category,
                building: s.building,
                room: s.room || "",
                urgency: s.urgency as Priority,
                affected: s.affected,
                priority: s.priority as Priority,
                predictedPriority: (s.predicted_priority as Priority) || undefined,
                confidence: s.confidence !== null ? Number(s.confidence) : undefined,
                status: s.status as Status,
                date: s.created_at.slice(0, 10),
                reporter: s.reporter || "Campus Resident",
                reporterId: s.reporter_id || undefined,
                image: resolvedImg || s.image_url || undefined,
                linkedComplaintId: s.linked_complaint_id || undefined,
                timeline: [
                  {
                    status: s.status as Status,
                    date: s.created_at.slice(0, 10),
                    note: `Status: ${s.status}`,
                    by: "Facilities Team",
                  },
                ],
                followUps: [],
              };
            }),
        );
      }
    } catch {
      // Shared RPC optional in unmigrated or offline state
    }

    return [...ownComplaints, ...sharedComplaints];
  } catch (err) {
    logWarning("[Supabase Data] Failed to fetch complaints:", err);
    return [];
  }
}

/**
 * Fetches a single complaint by its ID from Supabase.
 * Checks public.complaints directly first, with fallback to get_complaint_by_id RPC
 * to handle security definer access rules, timeline, and signed image URL.
 */
export async function fetchComplaintByIdFromSupabase(complaintId: string): Promise<Complaint | null> {
  if (!complaintId) return null;

  try {
    // 1. Attempt direct select from public.complaints
    const { data: c, error } = await supabase
      .from("complaints")
      .select("*")
      .eq("id", complaintId)
      .maybeSingle();

    if (!error && c) {
      // Fetch associated timeline and follow-ups in parallel
      const [tlRes, fuRes] = await Promise.all([
        supabase
          .from("complaint_timeline")
          .select("*")
          .eq("complaint_id", complaintId)
          .order("created_at", { ascending: true }),
        supabase
          .from("complaint_follow_ups")
          .select("*")
          .eq("complaint_id", complaintId)
          .order("created_at", { ascending: true }),
      ]);

      const resolvedImg = await resolveSignedImageUrl(c.image_url);

      const timeline: TimelineEvent[] =
        tlRes.data && tlRes.data.length > 0
          ? tlRes.data.map((t) => ({
              status: t.status as Status,
              date: t.created_at.slice(0, 10),
              note: t.note || "",
              by: t.by,
            }))
          : [
              {
                status: c.status as Status,
                date: c.created_at.slice(0, 10),
                note: "Complaint recorded.",
                by: c.reporter,
              },
            ];

      const followUps: FollowUpNote[] = (fuRes.data || []).map((f) => ({
        id: f.id,
        date: f.created_at.slice(0, 10),
        timestamp: new Date(f.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        content: f.content,
        by: f.author,
      }));

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category as Category,
        building: c.building,
        room: c.room || "",
        urgency: c.urgency as Priority,
        affected: c.affected,
        priority: c.priority as Priority,
        predictedPriority: (c.predicted_priority as Priority) || undefined,
        confidence: c.confidence !== null ? Number(c.confidence) : undefined,
        predictionSource: c.prediction_source || undefined,
        isTrainedModel: Boolean(c.prediction_source?.includes("Trained")),
        status: c.status as Status,
        date: c.created_at.slice(0, 10),
        reporter: c.reporter,
        reporterId: c.reporter_id || undefined,
        image: resolvedImg || c.image_url || undefined,
        resolutionNote: c.resolution_note || undefined,
        linkedComplaintId: c.linked_complaint_id || undefined,
        timeline,
        followUps,
      };
    }

    // 2. Fallback to RPC get_complaint_by_id (handles authenticated RLS & masking)
    const { data: rpcRows, error: rpcErr } = await supabase.rpc("get_complaint_by_id", {
      complaint_id_param: complaintId,
    });

    if (!rpcErr && rpcRows && rpcRows.length > 0) {
      const r = (rpcRows as any[])[0];
      const [tlRes, fuRes] = await Promise.all([
        supabase
          .from("complaint_timeline")
          .select("*")
          .eq("complaint_id", complaintId)
          .order("created_at", { ascending: true }),
        supabase
          .from("complaint_follow_ups")
          .select("*")
          .eq("complaint_id", complaintId)
          .order("created_at", { ascending: true }),
      ]);

      const resolvedImg = await resolveSignedImageUrl(r.image_url);

      const timeline: TimelineEvent[] =
        tlRes.data && tlRes.data.length > 0
          ? tlRes.data.map((t) => ({
              status: t.status as Status,
              date: t.created_at.slice(0, 10),
              note: t.note || "",
              by: t.by,
            }))
          : [
              {
                status: r.status as Status,
                date: r.created_at
                  ? r.created_at.slice(0, 10)
                  : new Date().toISOString().slice(0, 10),
                note: `Status: ${r.status}`,
                by: "Facilities Team",
              },
            ];

      const followUps: FollowUpNote[] = (fuRes.data || []).map((f) => ({
        id: f.id,
        date: f.created_at.slice(0, 10),
        timestamp: new Date(f.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        content: f.content,
        by: f.author,
      }));

      return {
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category as Category,
        building: r.building,
        room: r.room || "",
        urgency: r.urgency as Priority,
        affected: r.affected,
        priority: r.priority as Priority,
        predictedPriority: (r.predicted_priority as Priority) || undefined,
        confidence: r.confidence !== null ? Number(r.confidence) : undefined,
        predictionSource: r.prediction_source || undefined,
        isTrainedModel: Boolean(r.prediction_source?.includes("Trained")),
        status: r.status as Status,
        date: r.created_at
          ? r.created_at.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        reporter: r.reporter || "Campus Resident",
        reporterId: r.reporter_id || undefined,
        image: resolvedImg || r.image_url || undefined,
        resolutionNote: r.resolution_note || undefined,
        linkedComplaintId: r.linked_complaint_id || undefined,
        timeline,
        followUps,
      };
    }

    return null;
  } catch (err) {
    logWarning("[Supabase Data] Failed to fetch complaint by ID:", err);
    return null;
  }
}

/**
 * Inserts a new complaint into Supabase, saves attached image to private storage,
 * and records the initial timeline event.
 */
export async function createComplaintInSupabase(
  draft: Omit<Complaint, "id" | "status" | "date" | "reporter" | "timeline" | "followUps"> & { id?: string },
  user: { id?: string; name: string },
  imageFile?: File,
): Promise<Complaint> {
  let storedImagePath: string | undefined = undefined;

  // 1. Upload image to Supabase Storage if a File was provided
  if (imageFile && user.id) {
    try {
      storedImagePath = await uploadComplaintImage(user.id, imageFile);
    } catch (err) {
      logError("[Supabase Storage] Image upload failed:", err);
    }
  }

  // 2. Determine complaint ID (use existing ID if specified, or generate new reference ID)
  const complaintId = draft.id || `FX-${Math.floor(1000 + Math.random() * 9000)}`;
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.slice(0, 10);

  const initialNote = draft.linkedComplaintId
    ? `Complaint received. Reopened recurrence linked to ${draft.linkedComplaintId}.`
    : "Complaint received.";

  // 3. Insert into public.complaints
  const { error: insertErr } = await supabase.from("complaints").insert({
    id: complaintId,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    building: draft.building,
    room: draft.room || null,
    urgency: draft.urgency,
    affected: typeof draft.affected === "number" ? draft.affected : (Number(draft.affected) || 1),
    priority: draft.priority,
    predicted_priority: draft.predictedPriority || null,
    confidence: draft.confidence || null,
    prediction_source: draft.predictionSource || null,
    status: "Submitted",
    reporter: user.name,
    reporter_id: user.id || null,
    image_url: storedImagePath || draft.image || null,
    linked_complaint_id: draft.linkedComplaintId || null,
  });

  if (insertErr) {
    logError("[Supabase Data] Failed to insert complaint:", insertErr);
    throw new Error(`Failed to save complaint: ${insertErr.message}`);
  }

  // 4. Insert initial timeline entry
  try {
    await supabase.from("complaint_timeline").insert({
      complaint_id: complaintId,
      status: "Submitted",
      note: initialNote,
      by: user.name,
    });
  } catch (err) {
    logWarning("[Supabase Data] Notice: timeline insert failed:", err);
  }

  // Resolve signed URL for the newly created complaint preview
  const resolvedImg = storedImagePath
    ? await resolveSignedImageUrl(storedImagePath)
    : draft.image;

  return {
    ...draft,
    id: complaintId,
    status: "Submitted",
    date: todayStr,
    reporter: user.name,
    reporterId: user.id || undefined,
    image: resolvedImg || storedImagePath,
    timeline: [
      {
        status: "Submitted",
        date: todayStr,
        note: initialNote,
        by: user.name,
      },
    ],
    followUps: [],
  };
}

/**
 * Updates complaint status, priority, or resolution note in Supabase (Admin operation).
 */
export async function updateComplaintInSupabase(
  id: string,
  patch: {
    status?: Status;
    priority?: Priority;
    note?: string;
    escalatedPriority?: Priority;
    escalationReasons?: string[];
    isAdminOverride?: boolean;
  },
  adminName: string = "FixLens Administrator",
): Promise<void> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.status) updateData.status = patch.status;
  if (patch.priority) {
    updateData.priority = patch.priority;
    updateData.is_admin_override = true;
  }
  if (patch.escalatedPriority) updateData.escalated_priority = patch.escalatedPriority;
  if (patch.escalationReasons) updateData.escalation_reasons = patch.escalationReasons;
  if (patch.isAdminOverride !== undefined) updateData.is_admin_override = patch.isAdminOverride;
  if (patch.note && patch.note.trim()) {
    updateData.resolution_note = patch.note.trim();
  }

  const { error } = await supabase.from("complaints").update(updateData).eq("id", id);
  if (error) {
    logError("[Supabase Data] Failed to update complaint:", error);
    throw new Error(`Failed to update complaint: ${error.message}`);
  }

  // Append timeline event for status or resolution changes
  if (patch.status || (patch.note && patch.note.trim())) {
    try {
      await supabase.from("complaint_timeline").insert({
        complaint_id: id,
        status: patch.status || "In Progress",
        note: patch.note?.trim() || `Status updated to ${patch.status}`,
        by: adminName,
      });
    } catch (err) {
      logWarning("[Supabase Data] Timeline append notice:", err);
    }

    // Insert student notification if the complaint belongs to a registered student
    try {
      const { data: comp } = await supabase
        .from("complaints")
        .select("reporter_id, title")
        .eq("id", id)
        .maybeSingle();

      if (comp?.reporter_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", comp.reporter_id)
          .maybeSingle();

        if (prof?.email) {
          await supabase.from("notifications").insert({
            user_id: comp.reporter_id,
            recipient_email: prof.email,
            title: `Complaint ${id} Updated`,
            message: patch.status
              ? `Status changed to ${patch.status}.${patch.note ? ` Note: ${patch.note}` : ""}`
              : `Admin note added: ${patch.note}`,
            type: "status_update",
            reference_id: id,
            is_read: false,
          });
        }
      }
    } catch (err) {
      logWarning("[Supabase Data] Notification dispatch notice:", err);
    }
  }
}

/**
 * Adds a follow-up note to an existing complaint in Supabase.
 */
export async function addFollowUpInSupabase(
  complaintId: string,
  content: string,
  user: { id?: string; name: string },
): Promise<FollowUpNote> {
  const trimmed = content.trim();
  const now = new Date();
  const fuId = `FU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const todayStr = now.toISOString().slice(0, 10);
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const { error } = await supabase.from("complaint_follow_ups").insert({
    id: fuId,
    complaint_id: complaintId,
    content: trimmed,
    author: user.name,
    author_id: user.id || null,
  });

  if (error) {
    logError("[Supabase Data] Failed to add follow up:", error);
    throw new Error(`Failed to record follow-up: ${error.message}`);
  }

  // Also log to timeline
  try {
    await supabase.from("complaint_timeline").insert({
      complaint_id: complaintId,
      status: "Submitted",
      note: `Follow-up: "${trimmed.slice(0, 80)}${trimmed.length > 80 ? "..." : ""}"`,
      by: user.name,
    });
  } catch (err) {
    logWarning("[Supabase Data] Follow-up timeline log notice:", err);
  }

  return {
    id: fuId,
    date: todayStr,
    timestamp: timeStr,
    content: trimmed,
    by: user.name,
  };
}

// ====================================================================
// PROPOSALS & VOTES DATA OPERATIONS
// ====================================================================

/**
 * Fetches campus improvement proposals from Supabase.
 */
export async function fetchProposalsFromSupabase(): Promise<Proposal[]> {
  try {
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!data) return [];

    return data.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category as Category,
      location: p.location,
      support: p.support_count,
      status: p.status as ProposalStatus,
      author: p.author,
      date: p.created_at.slice(0, 10),
      adminNote: p.admin_note || undefined,
    }));
  } catch (err) {
    logWarning("[Supabase Data] Failed to fetch proposals:", err);
    return [];
  }
}

/**
 * Fetches the IDs of proposals voted for by the user.
 */
export async function fetchUserVotesFromSupabase(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("proposal_votes")
      .select("proposal_id")
      .eq("user_id", userId);

    if (error) throw error;
    return (data || []).map((v) => v.proposal_id);
  } catch (err) {
    logWarning("[Supabase Data] Failed to fetch votes:", err);
    return [];
  }
}

/**
 * Inserts a new campus proposal into Supabase and records the author's initial vote.
 */
export async function createProposalInSupabase(
  p: Pick<Proposal, "title" | "description" | "category" | "location"> & { id?: string },
  user: { id?: string; name: string },
): Promise<Proposal> {
  const proposalId = p.id || `IP-${Math.floor(200 + Math.random() * 800)}`;
  const todayStr = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("proposals").insert({
    id: proposalId,
    title: p.title.trim(),
    description: p.description.trim(),
    category: p.category,
    location: p.location.trim(),
    status: "Under Review",
    author: user.name,
    author_id: user.id || null,
    support_count: 1,
  });

  if (error) {
    logError("[Supabase Data] Failed to create proposal:", error);
    throw new Error(`Failed to create proposal: ${error.message}`);
  }

  // Record author vote in proposal_votes if authenticated
  if (user.id) {
    try {
      await supabase.from("proposal_votes").insert({
        proposal_id: proposalId,
        user_id: user.id,
      });
    } catch {
      // Ignored if author vote already counted
    }
  }

  return {
    id: proposalId,
    title: p.title,
    description: p.description,
    category: p.category,
    location: p.location,
    support: 1,
    status: "Under Review",
    author: user.name,
    date: todayStr,
  };
}

/**
 * Records a student vote for a proposal in Supabase.
 * The database trigger `on_proposal_vote_changed` automatically increments support_count.
 */
export async function voteProposalInSupabase(proposalId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("proposal_votes").insert({
      proposal_id: proposalId,
      user_id: userId,
    });

    if (error) {
      // If unique constraint violation, already voted
      if (error.code === "23505") return false;
      throw error;
    }

    return true;
  } catch (err) {
    logWarning("[Supabase Data] Vote record error:", err);
    return false;
  }
}

/**
 * Reviews and updates a proposal's status and administrative note in Supabase (Admin operation).
 */
export async function reviewProposalInSupabase(
  id: string,
  status: ProposalStatus,
  note: string,
): Promise<void> {
  const { error } = await supabase
    .from("proposals")
    .update({
      status,
      admin_note: note.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    logError("[Supabase Data] Failed to review proposal:", error);
    throw new Error(`Failed to review proposal: ${error.message}`);
  }
}

// ====================================================================
// NOTIFICATIONS DATA OPERATIONS
// ====================================================================

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  referenceId?: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * Fetches user notifications from public.notifications in Supabase.
 */
export async function fetchNotificationsFromSupabase(userId: string): Promise<AppNotification[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map((n) => ({
      id: n.id,
      userId: n.user_id,
      title: n.title,
      message: n.message,
      type: n.type,
      referenceId: n.reference_id || undefined,
      isRead: n.is_read,
      createdAt: n.created_at,
    }));
  } catch (err) {
    logWarning("[Supabase Data] Failed to fetch notifications:", err);
    return [];
  }
}

/**
 * Marks a notification as read in Supabase.
 */
export async function markNotificationReadInSupabase(id: string): Promise<void> {
  try {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  } catch (err) {
    logWarning("[Supabase Data] Mark notification error:", err);
  }
}

/**
 * Marks all notifications for a student as read in Supabase.
 */
export async function markAllNotificationsReadInSupabase(userId: string): Promise<void> {
  try {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId);
  } catch (err) {
    logWarning("[Supabase Data] Mark all notifications error:", err);
  }
}

// ====================================================================
// PHASE 2: ESCALATIONS & ANOMALIES DATA OPERATIONS
// ====================================================================

/**
 * Records a complaint priority escalation audit record in Supabase.
 */
export async function recordEscalationInSupabase(audit: EscalationAuditRecord): Promise<void> {
  try {
    await supabase.from("complaint_escalations").insert({
      id: audit.id,
      complaint_id: audit.complaintId,
      previous_priority: audit.previousPriority,
      escalated_priority: audit.escalatedPriority,
      reasons: audit.reasons,
      trigger_types: audit.triggerTypes,
      factors: audit.factors,
      admin_reviewed: audit.adminReviewed,
      created_at: audit.timestamp,
    });
  } catch (err) {
    logWarning("[Supabase Data] Escalation record notice:", err);
  }
}

/**
 * Fetches campus maintenance anomalies from Supabase.
 */
export async function fetchAnomaliesFromSupabase(): Promise<MaintenanceAnomaly[]> {
  try {
    const { data, error } = await supabase
      .from("maintenance_anomalies")
      .select("*")
      .order("detected_at", { ascending: false });

    if (error) throw error;
    return (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      anomalyType: row.anomaly_type as any,
      severity: row.severity as Priority,
      building: row.building,
      room: row.room || undefined,
      category: row.category as any,
      description: row.description,
      evidence: row.evidence || [],
      contributingComplaintIds: row.contributing_complaint_ids || [],
      distinctReporters: row.distinct_reporters,
      incidentCount: row.incident_count,
      status: row.status as any,
      adminNotes: row.admin_notes || undefined,
      detectedAt: row.detected_at,
      resolvedAt: row.resolved_at || undefined,
    }));
  } catch (err) {
    logWarning("[Supabase Data] Failed to fetch anomalies notice:", err);
    return [];
  }
}

/**
 * Updates an anomaly's lifecycle status or admin note in Supabase.
 */
export async function updateAnomalyStatusInSupabase(
  id: string,
  status: AnomalyStatus,
  adminNotes?: string,
): Promise<void> {
  try {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "Resolved") {
      updateData.resolved_at = new Date().toISOString();
    }
    if (adminNotes !== undefined) {
      updateData.admin_notes = adminNotes;
    }
    await supabase.from("maintenance_anomalies").update(updateData).eq("id", id);
  } catch (err) {
    logWarning("[Supabase Data] Update anomaly notice:", err);
  }
}
