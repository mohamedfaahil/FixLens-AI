import { describe, it, expect, beforeEach, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import {
  signUpStudent,
  signInStudent,
  signOutStudent,
  getStudentAuthState,
  resendStudentConfirmationEmail,
} from "@/lib/supabase-auth";
import {
  fetchComplaintsFromSupabase,
  fetchComplaintByIdFromSupabase,
  createComplaintInSupabase,
  updateComplaintInSupabase,
  addFollowUpInSupabase,
  createProposalInSupabase,
  voteProposalInSupabase,
  reviewProposalInSupabase,
  resolveSignedImageUrl,
  uploadComplaintImage,
  fetchNotificationsFromSupabase,
  markNotificationReadInSupabase,
} from "@/lib/supabase-data";

describe("FixLens AI — Supabase Data & Storage Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Student Authentication", () => {
    it("handles student registration via supabase.auth.signUp", async () => {
      const signUpSpy = vi.spyOn(supabase.auth, "signUp").mockResolvedValueOnce({
        data: {
          user: {
            id: "student-uuid-1234",
            email: "student.test@campus.edu",
          } as any,
          session: {
            access_token: "mock-token",
            user: { id: "student-uuid-1234" },
          } as any,
        },
        error: null,
      });

      const res = await signUpStudent({
        email: "student.test@campus.edu",
        password: "SecurePassword123!",
        fullName: "Test Student",
        department: "Computer Science",
        phone: "+91 99999 88888",
      });

      expect(signUpSpy).toHaveBeenCalledWith({
        email: "student.test@campus.edu",
        password: "SecurePassword123!",
        options: {
          emailRedirectTo: expect.any(String),
          data: {
            full_name: "Test Student",
            department: "Computer Science",
            phone: "+91 99999 88888",
          },
        },
      });
      expect(res.success).toBe(true);
      expect(res.sessionEstablished).toBe(true);
      expect(res.user?.id).toBe("student-uuid-1234");
      expect(res.user?.name).toBe("Test Student");
    });

    it("handles student registration when email confirmation is pending (session null)", async () => {
      vi.spyOn(supabase.auth, "signUp").mockResolvedValueOnce({
        data: {
          user: {
            id: "student-uuid-pending",
            email: "pending@campus.edu",
            confirmed_at: null,
          } as any,
          session: null,
        },
        error: null,
      });

      const res = await signUpStudent({
        email: "pending@campus.edu",
        password: "SecurePassword123!",
        fullName: "Pending Student",
        department: "Computer Science",
      });

      expect(res.success).toBe(true);
      expect(res.sessionEstablished).toBe(false);
      expect(res.emailConfirmationRequired).toBe(true);
      expect(res.user?.id).toBe("student-uuid-pending");
    });

    it("resends confirmation email via supabase.auth.resend", async () => {
      const resendSpy = vi.spyOn(supabase.auth, "resend").mockResolvedValueOnce({
        data: {},
        error: null,
      });

      const res = await resendStudentConfirmationEmail("pending@campus.edu");
      expect(res.success).toBe(true);
      expect(resendSpy).toHaveBeenCalledWith({
        type: "signup",
        email: "pending@campus.edu",
        options: {
          emailRedirectTo: expect.any(String),
        },
      });
    });

    it("handles student sign-in with unconfirmed email returning isEmailUnconfirmed: true", async () => {
      vi.spyOn(supabase.auth, "signInWithPassword").mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: "Email not confirmed", status: 400 } as any,
      });

      const res = await signInStudent("unconfirmed@campus.edu", "Password123!");
      expect(res.success).toBe(false);
      expect(res.isEmailUnconfirmed).toBe(true);
      expect(res.error).toContain("Your email has not been confirmed yet");
    });

    it("handles student sign-in via supabase.auth.signInWithPassword", async () => {
      const signInSpy = vi.spyOn(supabase.auth, "signInWithPassword").mockResolvedValueOnce({
        data: {
          user: {
            id: "student-uuid-1234",
            email: "student.test@campus.edu",
            user_metadata: { full_name: "Test Student", department: "Computer Science" },
          } as any,
          session: {
            access_token: "mock-token",
            user: { id: "student-uuid-1234" },
          } as any,
        },
        error: null,
      });

      // Mock profiles lookup
      vi.spyOn(supabase, "from").mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            abortSignal: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { full_name: "Test Student", department: "Computer Science", phone: null, role: "student" },
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const res = await signInStudent("student.test@campus.edu", "SecurePassword123!");
      expect(signInSpy).toHaveBeenCalledWith({
        email: "student.test@campus.edu",
        password: "SecurePassword123!",
      });
      expect(res.success).toBe(true);
      expect(res.user?.id).toBe("student-uuid-1234");
    });

    it("signs out student via supabase.auth.signOut", async () => {
      const signOutSpy = vi.spyOn(supabase.auth, "signOut").mockResolvedValueOnce({
        error: null,
      });

      await signOutStudent();
      expect(signOutSpy).toHaveBeenCalled();
    });

    it("resolves student auth state when authenticated", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: "student-uuid-1234",
              email: "student.test@campus.edu",
              user_metadata: { full_name: "Test Student", department: "Computer Science" },
            },
          } as any,
        },
        error: null,
      });

      vi.spyOn(supabase, "from").mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            abortSignal: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { full_name: "Test Student", department: "Computer Science", phone: null, role: "student" },
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const authState = await getStudentAuthState();
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user?.id).toBe("student-uuid-1234");
      expect(authState.user?.name).toBe("Test Student");
    });
  });

  describe("Complaints Operations", () => {
    it("creates complaint record with correct columns and reporter UUID", async () => {
      const insertSpy = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase, "from").mockReturnValue({
        insert: insertSpy,
      } as any);

      const created = await createComplaintInSupabase(
        {
          title: "Broken window in CS Lab 2",
          description: "Glass crack on the south window.",
          category: "Other",
          building: "CS Block",
          room: "Lab 2",
          urgency: "Medium",
          affected: 15,
          priority: "Medium",
          image: "https://example.com/test.jpg",
        },
        {
          id: "student-uuid-1234",
          name: "Test Student",
        },
      );

      expect(created.id).toMatch(/^FX-\d+$/);
      expect(created.reporter).toBe("Test Student");
      expect(created.reporterId).toBe("student-uuid-1234");
      expect(created.status).toBe("Submitted");
      expect(insertSpy).toHaveBeenCalled();
    });

    it("fetches complaints from Supabase and preserves reporterId", async () => {
      vi.spyOn(supabase, "from").mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "FX-5001",
                title: "Live Database Complaint",
                description: "Real complaint from Supabase.",
                category: "Electrical",
                building: "CS Block",
                room: "101",
                urgency: "High",
                affected: 20,
                priority: "High",
                predicted_priority: "High",
                confidence: 0.94,
                prediction_source: "Trained Random Forest",
                status: "Submitted",
                reporter: "Real Student",
                reporter_id: "student-uuid-5555",
                image_url: null,
                resolution_note: null,
                linked_complaint_id: null,
                created_at: "2026-11-01T10:00:00Z",
              },
            ],
            error: null,
          }),
        }),
      } as any);

      const complaints = await fetchComplaintsFromSupabase({ isAdmin: true });
      expect(complaints).toHaveLength(1);
      expect(complaints[0].id).toBe("FX-5001");
      expect(complaints[0].reporterId).toBe("student-uuid-5555");
      expect(complaints[0].reporter).toBe("Real Student");
    });

    it("fetches single complaint by ID via fetchComplaintByIdFromSupabase", async () => {
      vi.spyOn(supabase, "from").mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "FX-9940",
                title: "Specific Complaint by ID",
                description: "Direct lookup verification.",
                category: "Electrical",
                building: "Library",
                room: "L204",
                urgency: "Medium",
                affected: 10,
                priority: "Medium",
                predicted_priority: "Medium",
                confidence: 0.88,
                prediction_source: "Trained TF-IDF + Random Forest Model",
                status: "Submitted",
                reporter: "Alice Smith",
                reporter_id: "alice-uuid",
                image_url: null,
                created_at: "2026-11-01T12:00:00Z",
              },
              error: null,
            }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as any);

      const found = await fetchComplaintByIdFromSupabase("FX-9940");
      expect(found).not.toBeNull();
      expect(found?.id).toBe("FX-9940");
      expect(found?.title).toBe("Specific Complaint by ID");
      expect(found?.reporter).toBe("Alice Smith");
      expect(found?.isTrainedModel).toBe(true);
    });

    it("updates complaint status and priority for administrative review", async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      vi.spyOn(supabase, "from").mockReturnValue({
        update: updateMock,
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      await expect(
        updateComplaintInSupabase("FX-1001", {
          status: "In Progress",
          priority: "High",
          note: "Work order dispatched to electrical team.",
        }),
      ).resolves.not.toThrow();
      expect(updateMock).toHaveBeenCalled();
    });

    it("adds student follow-up message to public.complaint_follow_ups", async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase, "from").mockReturnValue({
        insert: insertMock,
      } as any);

      const followUp = await addFollowUpInSupabase(
        "FX-1001",
        "Water has begun pooling near power outlets.",
        { id: "student-uuid-1234", name: "Test Student" },
      );

      expect(followUp.content).toBe("Water has begun pooling near power outlets.");
      expect(followUp.by).toBe("Test Student");
      expect(followUp.id).toMatch(/^FU-\d+-\d+$/);
      expect(insertMock).toHaveBeenCalled();
    });
  });

  describe("Proposals and Voting", () => {
    it("creates a new campus proposal with initial vote", async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase, "from").mockReturnValue({
        insert: insertMock,
      } as any);

      const proposal = await createProposalInSupabase(
        {
          title: "Install water purifier in MCA block",
          description: "Filtered drinking water station on 2nd floor.",
          category: "Plumbing",
          location: "MCA Block, 2nd floor",
        },
        { id: "student-uuid-1234", name: "Test Student" },
      );

      expect(proposal.id).toMatch(/^IP-\d+$/);
      expect(proposal.support).toBe(1);
      expect(proposal.status).toBe("Under Review");
      expect(insertMock).toHaveBeenCalled();
    });

    it("records a proposal vote in public.proposal_votes", async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase, "from").mockReturnValue({
        insert: insertMock,
      } as any);

      const success = await voteProposalInSupabase("IP-201", "student-uuid-1234");
      expect(success).toBe(true);
      expect(insertMock).toHaveBeenCalled();
    });

    it("reviews proposal status and admin note", async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      vi.spyOn(supabase, "from").mockReturnValue({
        update: updateMock,
      } as any);

      await expect(
        reviewProposalInSupabase("IP-201", "Approved", "Approved for next semester capital plan."),
      ).resolves.not.toThrow();
      expect(updateMock).toHaveBeenCalled();
    });
  });

  describe("Private Storage & Signed URLs", () => {
    it("returns direct HTTP and blob URLs without storage call", async () => {
      const httpUrl = "https://example.com/photo.jpg";
      const blobUrl = "blob:http://localhost:5173/mock-uuid";

      expect(await resolveSignedImageUrl(httpUrl)).toBe(httpUrl);
      expect(await resolveSignedImageUrl(blobUrl)).toBe(blobUrl);
      expect(await resolveSignedImageUrl(null)).toBeUndefined();
    });

    it("resolves storage object path to signed URL from complaint-images bucket", async () => {
      vi.spyOn(supabase.storage, "from").mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://snwcmuptrvmpniuevofj.supabase.co/storage/v1/object/sign/complaint-images/test.jpg?token=abc" },
          error: null,
        }),
      } as any);

      const signed = await resolveSignedImageUrl("user-123/1234567-broken_door.jpg");
      expect(signed).toContain("snwcmuptrvmpniuevofj.supabase.co");
      expect(signed).toContain("token=abc");
    });

    it("uploads complaint image to private complaint-images bucket", async () => {
      const uploadMock = vi.fn().mockResolvedValue({ data: { path: "user-123/mock.jpg" }, error: null });
      vi.spyOn(supabase.storage, "from").mockReturnValue({
        upload: uploadMock,
      } as any);

      const mockFile = new File(["test image bytes"], "broken_chair.jpg", { type: "image/jpeg" });
      const path = await uploadComplaintImage("user-123", mockFile);

      expect(path).toMatch(/^user-123\/\d+-broken_chair\.jpg$/);
      expect(uploadMock).toHaveBeenCalled();
    });
  });

  describe("Notifications", () => {
    it("fetches user notifications from public.notifications", async () => {
      vi.spyOn(supabase, "from").mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "notif-1",
                  user_id: "student-uuid-1234",
                  recipient_email: "student@campus.edu",
                  title: "Complaint resolved",
                  message: "Your complaint FX-1001 has been resolved.",
                  type: "status_update",
                  reference_id: "FX-1001",
                  is_read: false,
                  created_at: new Date().toISOString(),
                },
              ],
              error: null,
            }),
          }),
        }),
      } as any);

      const notifs = await fetchNotificationsFromSupabase("student-uuid-1234");
      expect(notifs.length).toBe(1);
      expect(notifs[0].title).toBe("Complaint resolved");
      expect(notifs[0].isRead).toBe(false);
    });

    it("marks notification as read", async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      vi.spyOn(supabase, "from").mockReturnValue({
        update: updateMock,
      } as any);

      await expect(markNotificationReadInSupabase("notif-1")).resolves.not.toThrow();
      expect(updateMock).toHaveBeenCalled();
    });
  });
});
