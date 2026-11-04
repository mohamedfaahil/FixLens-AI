import { describe, it, expect, beforeEach, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import {
  signInAdmin,
  signInStudent,
  signUpStudent,
  signOutAdmin,
  signOutStudent,
  getAdminAuthState,
  getStudentAuthState,
  ADMIN_ACCOUNT,
} from "@/lib/supabase-auth";
import {
  createComplaintInSupabase,
  updateComplaintInSupabase,
  updateAnomalyStatusInSupabase,
  reviewProposalInSupabase,
} from "@/lib/supabase-data";

describe("FixLens AI — Admin & Student Authentication Session Separation", () => {
  const MOCK_ADMIN_USER = {
    id: "admin-uuid-0001",
    email: ADMIN_ACCOUNT.email,
    app_metadata: { role: "admin" },
    user_metadata: { full_name: "FixLens Administrator" },
  };

  const MOCK_ADMINFIXES_USER = {
    id: "admin-uuid-0002",
    email: "adminfixes@gmail.com",
    app_metadata: { role: "admin" },
    user_metadata: { full_name: "FixLens Administrator" },
  };

  const MOCK_STUDENT_USER = {
    id: "student-uuid-5001",
    email: "rohit.sharma@campus.edu",
    app_metadata: { role: "student" },
    user_metadata: { full_name: "Rohit Sharma", department: "Computer Applications (MCA)" },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Role Separation in getStudentAuthState & getAdminAuthState", () => {
    it("Admin session is verified by getAdminAuthState and strictly rejected by getStudentAuthState", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: {
          session: {
            access_token: "admin-token",
            user: MOCK_ADMIN_USER as any,
          } as any,
        },
        error: null,
      });

      // 1. Admin auth state must be authenticated
      const adminAuth = await getAdminAuthState();
      expect(adminAuth.isAuthenticated).toBe(true);
      expect(adminAuth.email).toBe(ADMIN_ACCOUNT.email);

      // 2. Student auth state MUST NOT treat an Admin session as a student
      const studentAuth = await getStudentAuthState();
      expect(studentAuth.isAuthenticated).toBe(false);
      expect(studentAuth.user).toBeUndefined();
    });

    it("Secondary admin session (adminfixes@gmail.com) is verified by getAdminAuthState and strictly rejected by getStudentAuthState", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: {
          session: {
            access_token: "adminfixes-token",
            user: MOCK_ADMINFIXES_USER as any,
          } as any,
        },
        error: null,
      });

      // 1. Admin auth state must be authenticated
      const adminAuth = await getAdminAuthState();
      expect(adminAuth.isAuthenticated).toBe(true);
      expect(adminAuth.email).toBe("adminfixes@gmail.com");

      // 2. Student auth state MUST NOT treat an Admin session as a student
      const studentAuth = await getStudentAuthState();
      expect(studentAuth.isAuthenticated).toBe(false);
      expect(studentAuth.user).toBeUndefined();
    });

    it("Student session is verified by getStudentAuthState and strictly rejected by getAdminAuthState", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: {
          session: {
            access_token: "student-token",
            user: MOCK_STUDENT_USER as any,
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
                  full_name: "Rohit Sharma",
                  department: "Computer Applications (MCA)",
                  role: "student",
                },
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      // 1. Student auth state must be authenticated
      const studentAuth = await getStudentAuthState();
      expect(studentAuth.isAuthenticated).toBe(true);
      expect(studentAuth.user?.id).toBe(MOCK_STUDENT_USER.id);
      expect(studentAuth.user?.name).toBe("Rohit Sharma");

      // 2. Admin auth state MUST NOT grant administrator privileges to a student
      const adminAuth = await getAdminAuthState();
      expect(adminAuth.isAuthenticated).toBe(false);
    });

    it("Rejects admin even if app_metadata role is missing when email or profile matches administrator", async () => {
      const userWithoutRole = {
        id: "admin-uuid-0002",
        email: ADMIN_ACCOUNT.email,
        app_metadata: {},
        user_metadata: {},
      };

      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: {
          session: {
            access_token: "admin-token-2",
            user: userWithoutRole as any,
          } as any,
        },
        error: null,
      });

      const studentAuth = await getStudentAuthState();
      expect(studentAuth.isAuthenticated).toBe(false);
    });
  });

  describe("2. Login Guarding & Credentials Cross-Authentication Blocking", () => {
    it("signInStudent rejects administrator email before contacting auth provider", async () => {
      const signInSpy = vi.spyOn(supabase.auth, "signInWithPassword");

      const res = await signInStudent(ADMIN_ACCOUNT.email, "anyPassword123");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Access denied");
      expect(res.error).toContain("Administrator Login");
      expect(signInSpy).not.toHaveBeenCalled();

      // Also verify adminfixes@gmail.com is strictly rejected
      const resFixes = await signInStudent("adminfixes@gmail.com", "anyPassword123");
      expect(resFixes.success).toBe(false);
      expect(resFixes.error).toContain("Access denied");
      expect(resFixes.error).toContain("Administrator Login");

      // Verify signUpStudent rejects adminfixes@gmail.com
      const resSignUp = await signUpStudent({
        email: "adminfixes@gmail.com",
        password: "Password123!",
        fullName: "Admin Fixes",
        department: "Administration",
      });
      expect(resSignUp.success).toBe(false);
      expect(resSignUp.error).toContain("reserved for system administration");
    });

    it("signInStudent signs out and rejects if authenticated user has admin role in app_metadata", async () => {
      const signOutSpy = vi.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });

      vi.spyOn(supabase.auth, "signInWithPassword").mockResolvedValueOnce({
        data: {
          user: {
            id: "sneaky-admin-uuid",
            email: "sneaky.admin@campus.edu",
            app_metadata: { role: "admin" },
          } as any,
          session: { access_token: "sneaky-token" } as any,
        },
        error: null,
      });

      const res = await signInStudent("sneaky.admin@campus.edu", "secretPass");
      expect(res.success).toBe(false);
      expect(res.error).toContain("administrator privileges");
      expect(signOutSpy).toHaveBeenCalled();
    });

    it("signInAdmin strictly rejects student email before contacting auth provider", async () => {
      const signInSpy = vi.spyOn(supabase.auth, "signInWithPassword");

      const res = await signInAdmin("student@campus.edu", "secretPass");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Access denied");
      expect(signInSpy).not.toHaveBeenCalled();
    });
  });

  describe("3. Operational Action-Level Authorization Guards", () => {
    it("Admin cannot submit student complaints using createComplaintInSupabase", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: {
          session: {
            user: MOCK_ADMIN_USER as any,
          } as any,
        },
        error: null,
      });

      await expect(
        createComplaintInSupabase(
          {
            title: "Admin attempting to file student ticket",
            description: "This should be rejected because admin cannot file student complaints.",
            category: "Electrical",
            building: "CS Block",
            room: "101",
            urgency: "Medium",
            affected: 1,
            priority: "Medium",
          },
          { id: MOCK_ADMIN_USER.id, name: "FixLens Administrator" },
        ),
      ).rejects.toThrow("Access denied: Administrators cannot submit student complaints.");
    });

    it("Student cannot update admin priority or operational status in updateComplaintInSupabase", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: {
          session: {
            user: MOCK_STUDENT_USER as any,
          } as any,
        },
        error: null,
      });

      vi.spyOn(supabase, "from").mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            abortSignal: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: "student" },
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      await expect(
        updateComplaintInSupabase("FX-1001", {
          status: "Resolved",
          priority: "High",
          note: "Student trying to resolve ticket.",
        }),
      ).rejects.toThrow("Access denied: Students are not permitted to update operational complaint details.");
    });

    it("Student cannot update maintenance anomalies in updateAnomalyStatusInSupabase", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: {
          session: {
            user: MOCK_STUDENT_USER as any,
          } as any,
        },
        error: null,
      });

      await expect(
        updateAnomalyStatusInSupabase("anom-1", "Resolved", "Student resolving anomaly"),
      ).rejects.toThrow("Access denied: Students cannot update maintenance anomaly statuses.");
    });

    it("Student cannot review improvement proposals in reviewProposalInSupabase", async () => {
      vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
        data: {
          session: {
            user: MOCK_STUDENT_USER as any,
          } as any,
        },
        error: null,
      });

      await expect(
        reviewProposalInSupabase("IP-201", "Approved", "Student trying to approve proposal"),
      ).rejects.toThrow("Access denied: Students cannot review improvement proposals.");
    });
  });

  describe("4. Session Termination & Account Switching", () => {
    it("signOutAdmin clears administrator session via supabase.auth.signOut", async () => {
      const signOutSpy = vi.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });
      await signOutAdmin();
      expect(signOutSpy).toHaveBeenCalledTimes(1);
    });

    it("signOutStudent clears student session via supabase.auth.signOut", async () => {
      const signOutSpy = vi.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });
      await signOutStudent();
      expect(signOutSpy).toHaveBeenCalledTimes(1);
    });
  });
});
