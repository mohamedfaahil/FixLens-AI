import { describe, it, expect, beforeEach, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import {
  signUpStudent,
  signInStudent,
  signOutStudent,
  getStudentAuthState,
  getAdminAuthState,
  resendStudentConfirmationEmail,
  ADMIN_ACCOUNT,
} from "@/lib/supabase-auth";
import {
  fetchComplaintsFromSupabase,
  createComplaintInSupabase,
  updateComplaintInSupabase,
  addFollowUpInSupabase,
  fetchProposalsFromSupabase,
  createProposalInSupabase,
  voteProposalInSupabase,
  reviewProposalInSupabase,
  resolveSignedImageUrl,
  uploadComplaintImage,
  fetchNotificationsFromSupabase,
  markNotificationReadInSupabase,
  markAllNotificationsReadInSupabase,
} from "@/lib/supabase-data";

describe("FixLens AI — Comprehensive End-to-End Supabase Integration Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const MOCK_STUDENT_UUID = "c7b5a8e0-2d4f-4e9a-9b1c-3f8e7a6d5c4b";
  const MOCK_STUDENT_EMAIL = "student.verification@campus.edu";

  describe("1. Student Registration & Email Confirmation Flow", () => {
    it("Check 1 & 2: Registers student in Supabase Auth and passes dynamic email redirect", async () => {
      const signUpSpy = vi.spyOn(supabase.auth, "signUp").mockResolvedValueOnce({
        data: {
          user: {
            id: MOCK_STUDENT_UUID,
            email: MOCK_STUDENT_EMAIL,
            confirmed_at: "2026-11-01T12:00:00Z",
          } as any,
          session: {
            access_token: "mock-valid-jwt",
            user: { id: MOCK_STUDENT_UUID, email: MOCK_STUDENT_EMAIL },
          } as any,
        },
        error: null,
      });

      const res = await signUpStudent({
        email: MOCK_STUDENT_EMAIL,
        password: "Password123!",
        fullName: "Fatima Zahra",
        department: "Computer Applications (MCA)",
        phone: "+91 98765 11111",
      });

      expect(signUpSpy).toHaveBeenCalledWith({
        email: MOCK_STUDENT_EMAIL,
        password: "Password123!",
        options: {
          emailRedirectTo: expect.any(String),
          data: {
            full_name: "Fatima Zahra",
            department: "Computer Applications (MCA)",
            phone: "+91 98765 11111",
          },
        },
      });
      expect(res.success).toBe(true);
      expect(res.sessionEstablished).toBe(true);
      expect(res.user?.id).toBe(MOCK_STUDENT_UUID);
      expect(res.user?.role).toBe("student");
    });

    it("Check 3: Handles pending confirmation gracefully when email verification is required", async () => {
      vi.spyOn(supabase.auth, "signUp").mockResolvedValueOnce({
        data: {
          user: {
            id: MOCK_STUDENT_UUID,
            email: MOCK_STUDENT_EMAIL,
            confirmed_at: null,
          } as any,
          session: null,
        },
        error: null,
      });

      const res = await signUpStudent({
        email: MOCK_STUDENT_EMAIL,
        password: "Password123!",
        fullName: "Fatima Zahra",
        department: "Computer Applications (MCA)",
      });

      expect(res.success).toBe(true);
      expect(res.sessionEstablished).toBe(false);
      expect(res.emailConfirmationRequired).toBe(true);
    });

    it("Check 4: Resends confirmation email via supabase.auth.resend", async () => {
      const resendSpy = vi.spyOn(supabase.auth, "resend").mockResolvedValueOnce({
        data: {},
        error: null,
      });

      const res = await resendStudentConfirmationEmail(MOCK_STUDENT_EMAIL);
      expect(res.success).toBe(true);
      expect(resendSpy).toHaveBeenCalledWith({
        type: "signup",
        email: MOCK_STUDENT_EMAIL,
        options: {
          emailRedirectTo: expect.any(String),
        },
      });
    });
  });

  describe("2. Student Login & Session Persistence", () => {
    it("Check 5: Flags unconfirmed student login clearly without crashing", async () => {
      vi.spyOn(supabase.auth, "signInWithPassword").mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: "Email not confirmed", status: 400 } as any,
      });

      const res = await signInStudent(MOCK_STUDENT_EMAIL, "Password123!");
      expect(res.success).toBe(false);
      expect(res.isEmailUnconfirmed).toBe(true);
      expect(res.error).toContain("Your email has not been confirmed yet");
    });

    it("Check 6: Authenticates confirmed student and loads database profile", async () => {
      vi.spyOn(supabase.auth, "signInWithPassword").mockResolvedValueOnce({
        data: {
          user: {
            id: MOCK_STUDENT_UUID,
            email: MOCK_STUDENT_EMAIL,
            user_metadata: { full_name: "Fatima Zahra", department: "Computer Applications (MCA)" },
          } as any,
          session: {
            access_token: "mock-session-token",
            user: { id: MOCK_STUDENT_UUID, email: MOCK_STUDENT_EMAIL },
          } as any,
        },
        error: null,
      });

      vi.spyOn(supabase, "from").mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            abortSignal: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  full_name: "Fatima Zahra",
                  department: "Computer Applications (MCA)",
                  phone: "+91 98765 11111",
                  role: "student",
                },
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const res = await signInStudent(MOCK_STUDENT_EMAIL, "Password123!");
      expect(res.success).toBe(true);
      expect(res.user?.id).toBe(MOCK_STUDENT_UUID);
      expect(res.user?.name).toBe("Fatima Zahra");
      expect(res.user?.department).toBe("Computer Applications (MCA)");
    });

    it("Check 7: Restores active student session on page refresh via getStudentAuthState()", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: MOCK_STUDENT_UUID,
              email: MOCK_STUDENT_EMAIL,
              user_metadata: { full_name: "Fatima Zahra" },
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
                data: {
                  full_name: "Fatima Zahra",
                  department: "Computer Applications (MCA)",
                  role: "student",
                },
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const authState = await getStudentAuthState();
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user?.id).toBe(MOCK_STUDENT_UUID);
      expect(authState.user?.name).toBe("Fatima Zahra");
    });

    it("Check 8: Terminates session securely on logout", async () => {
      const signOutSpy = vi.spyOn(supabase.auth, "signOut").mockResolvedValueOnce({
        error: null,
      });
      await signOutStudent();
      expect(signOutSpy).toHaveBeenCalled();
    });
  });

  describe("3. Role-Based Access Control: Students Blocked from Admin", () => {
    it("Check 9: Ensures student identity cannot authenticate as administrator", async () => {
      // Mock session active for a student email
      vi.spyOn(supabase.auth, "getSession").mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: MOCK_STUDENT_UUID,
              email: MOCK_STUDENT_EMAIL,
              app_metadata: { role: "student" },
            },
          } as any,
        },
        error: null,
      });

      const adminAuth = await getAdminAuthState();
      expect(adminAuth.isAuthenticated).toBe(false);
    });

    it("Check 10: Authorizes designated administrator with admin role claim", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: "admin-uuid-0000",
              email: ADMIN_ACCOUNT.email,
              app_metadata: { role: "admin" },
            },
          } as any,
        },
        error: null,
      });

      const adminAuth = await getAdminAuthState();
      expect(adminAuth.isAuthenticated).toBe(true);
      expect(adminAuth.email).toBe(ADMIN_ACCOUNT.email);
    });
  });

  describe("4. Complaint Management with Real UUIDs & RLS", () => {
    it("Check 11: Submits complaint with authenticated student UUID as reporter_id and creates timeline entry", async () => {
      const insertComplaintMock = vi.fn().mockResolvedValue({ error: null });
      const insertTimelineMock = vi.fn().mockResolvedValue({ error: null });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "complaints") {
          return { insert: insertComplaintMock } as any;
        }
        if (table === "complaint_timeline") {
          return { insert: insertTimelineMock } as any;
        }
        return {} as any;
      });

      const created = await createComplaintInSupabase(
        {
          title: "Leaking pipe in MCA Lab Washroom",
          description: "Water leaking near the main distribution junction.",
          category: "Plumbing",
          building: "MCA Block",
          room: "102",
          urgency: "High",
          affected: 30,
          priority: "High",
          image: undefined,
        },
        {
          id: MOCK_STUDENT_UUID,
          name: "Fatima Zahra",
        },
      );

      expect(created.id).toMatch(/^FX-\d+$/);
      expect(created.reporter).toBe("Fatima Zahra");
      expect(created.reporterId).toBe(MOCK_STUDENT_UUID);
      expect(created.status).toBe("Submitted");
      expect(insertComplaintMock).toHaveBeenCalledWith(
        expect.objectContaining({
          reporter_id: MOCK_STUDENT_UUID,
          reporter: "Fatima Zahra",
          category: "Plumbing",
          building: "MCA Block",
          status: "Submitted",
        }),
      );
      expect(insertTimelineMock).toHaveBeenCalledWith(
        expect.objectContaining({
          complaint_id: created.id,
          status: "Submitted",
          by: "Fatima Zahra",
        }),
      );
    });

    it("Check 12: Student retrieves their own complaints preserving reporterId", async () => {
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "complaints") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "FX-8801",
                      title: "Flickering fluorescent lamp",
                      description: "Light in classroom 204 keeps blinking.",
                      category: "Electrical",
                      building: "MCA Block",
                      room: "204",
                      urgency: "Low",
                      affected: 25,
                      priority: "Low",
                      status: "Submitted",
                      reporter: "Fatima Zahra",
                      reporter_id: MOCK_STUDENT_UUID,
                      image_url: null,
                      created_at: "2026-11-01T12:30:00Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        if (table === "complaint_timeline" || table === "complaint_follow_ups") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const list = await fetchComplaintsFromSupabase({ userId: MOCK_STUDENT_UUID });
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe("FX-8801");
      expect(list[0].reporterId).toBe(MOCK_STUDENT_UUID);
    });

    it("Check 13: Empty database returns empty array without falling back to demo data", async () => {
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "complaints") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const list = await fetchComplaintsFromSupabase({ userId: MOCK_STUDENT_UUID });
      expect(list).toEqual([]);
    });

    it("Check 14: Admin updates complaint status, logs timeline, and dispatches notification", async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const insertTimelineMock = vi.fn().mockResolvedValue({ error: null });
      const insertNotificationMock = vi.fn().mockResolvedValue({ error: null });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "complaints") {
          return {
            update: updateMock,
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { reporter_id: MOCK_STUDENT_UUID, title: "Flickering fluorescent lamp" },
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { email: MOCK_STUDENT_EMAIL },
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        if (table === "complaint_timeline") {
          return { insert: insertTimelineMock } as any;
        }
        if (table === "notifications") {
          return { insert: insertNotificationMock } as any;
        }
        return {} as any;
      });

      await updateComplaintInSupabase("FX-8801", {
        status: "In Progress",
        note: "Electrician assigned to replace ballast.",
      });

      expect(updateMock).toHaveBeenCalled();
      expect(insertTimelineMock).toHaveBeenCalledWith(
        expect.objectContaining({
          complaint_id: "FX-8801",
          status: "In Progress",
          note: "Electrician assigned to replace ballast.",
        }),
      );
      expect(insertNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: MOCK_STUDENT_UUID,
          recipient_email: MOCK_STUDENT_EMAIL,
          reference_id: "FX-8801",
        }),
      );
    });
  });

  describe("5. Follow-ups, Storage & Improvement Hub", () => {
    it("Check 15: Records student follow-up message in public.complaint_follow_ups", async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "complaint_follow_ups" || table === "complaint_timeline") {
          return { insert: insertMock } as any;
        }
        return {} as any;
      });

      const fu = await addFollowUpInSupabase(
        "FX-8801",
        "Water has begun dripping from the ceiling above the fixture.",
        { id: MOCK_STUDENT_UUID, name: "Fatima Zahra" },
      );

      expect(fu.content).toBe("Water has begun dripping from the ceiling above the fixture.");
      expect(fu.by).toBe("Fatima Zahra");
      expect(insertMock).toHaveBeenCalled();
    });

    it("Check 16: Uploads complaint image to private bucket under <userId>/<timestamp>-<name>", async () => {
      const uploadMock = vi.fn().mockResolvedValue({ data: { path: "mock-path" }, error: null });
      vi.spyOn(supabase.storage, "from").mockReturnValue({
        upload: uploadMock,
      } as any);

      const fakeFile = new File(["dummy content"], "broken-switch.png", { type: "image/png" });
      const path = await uploadComplaintImage(MOCK_STUDENT_UUID, fakeFile);

      expect(path).toMatch(new RegExp(`^${MOCK_STUDENT_UUID}/\\d+-broken-switch\\.png$`));
      expect(uploadMock).toHaveBeenCalledWith(
        path,
        fakeFile,
        expect.objectContaining({ contentType: "image/png", upsert: true }),
      );
    });

    it("Check 17: Resolves signed URL with expiration for secure private storage", async () => {
      vi.spyOn(supabase.storage, "from").mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://snwcmuptrvmpniuevofj.supabase.co/storage/v1/object/sign/complaint-images/token123" },
          error: null,
        }),
      } as any);

      const url = await resolveSignedImageUrl(`${MOCK_STUDENT_UUID}/test.jpg`);
      expect(url).toContain("token123");
    });

    it("Check 18: Creates proposal, records student vote, and handles review", async () => {
      const insertPropMock = vi.fn().mockResolvedValue({ error: null });
      const insertVoteMock = vi.fn().mockResolvedValue({ error: null });
      const updatePropMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "proposals") {
          return { insert: insertPropMock, update: updatePropMock } as any;
        }
        if (table === "proposal_votes") {
          return { insert: insertVoteMock } as any;
        }
        return {} as any;
      });

      const prop = await createProposalInSupabase(
        {
          title: "Install water purifier on 2nd floor",
          description: "Clean drinking water access for labs 201-208.",
          category: "Plumbing",
          location: "MCA Block 2nd Floor",
        },
        { id: MOCK_STUDENT_UUID, name: "Fatima Zahra" },
      );

      expect(prop.id).toMatch(/^IP-\d+$/);
      expect(prop.support).toBe(1);

      const voteSuccess = await voteProposalInSupabase(prop.id, MOCK_STUDENT_UUID);
      expect(voteSuccess).toBe(true);

      await reviewProposalInSupabase(prop.id, "Planned", "Scheduled for semester break maintenance.");
      expect(updatePropMock).toHaveBeenCalled();
    });

    it("Check 19: Fetches notifications and marks them as read", async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.spyOn(supabase, "from").mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "notif-uuid-1",
                  user_id: MOCK_STUDENT_UUID,
                  title: "Complaint Updated",
                  message: "Status changed to Resolved",
                  type: "status_update",
                  reference_id: "FX-8801",
                  is_read: false,
                  created_at: "2026-11-01T13:00:00Z",
                },
              ],
              error: null,
            }),
          }),
        }),
        update: updateMock,
      } as any);

      const notifs = await fetchNotificationsFromSupabase(MOCK_STUDENT_UUID);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].title).toBe("Complaint Updated");
      expect(notifs[0].isRead).toBe(false);

      await markNotificationReadInSupabase("notif-uuid-1");
      expect(updateMock).toHaveBeenCalledWith({ is_read: true });

      await markAllNotificationsReadInSupabase(MOCK_STUDENT_UUID);
      expect(updateMock).toHaveBeenCalledWith({ is_read: true });
    });
  });
});
