import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  signInAdmin,
  signOutAdmin,
  getAdminAuthState,
  ADMIN_ACCOUNT,
} from "../lib/supabase-auth";
import { supabase } from "../integrations/supabase/client";

describe("FixLens AI — Supabase Admin Authentication & Route Protection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports the designated administrator account identity without hardcoded secrets", () => {
    expect(ADMIN_ACCOUNT.email).toBe("adminfix@gmail.com");
    // Ensure no password property exists on the exported object
    expect((ADMIN_ACCOUNT as Record<string, unknown>).password).toBeUndefined();
  });

  it("strictly rejects non-admin accounts before contacting auth provider", async () => {
    const signInSpy = vi.spyOn(supabase.auth, "signInWithPassword");

    const res = await signInAdmin("student@campus.edu", "samplePassword123");
    expect(res.success).toBe(false);
    expect(res.error).toContain("Access denied");
    // Supabase auth is not even invoked for unauthorized emails
    expect(signInSpy).not.toHaveBeenCalled();
  });

  it("rejects empty email or password inputs", async () => {
    const resEmptyEmail = await signInAdmin("", "somePassword");
    expect(resEmptyEmail.success).toBe(false);

    const resEmptyPass = await signInAdmin("adminfix@gmail.com", "");
    expect(resEmptyPass.success).toBe(false);
  });

  it("handles Supabase authentication failure gracefully", async () => {
    vi.spyOn(supabase.auth, "signInWithPassword").mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: "AuthApiError", message: "Invalid login credentials", status: 400 },
    });

    const res = await signInAdmin("adminfix@gmail.com", "incorrectPassword");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Invalid login credentials");
  });

  it("authenticates administrator successfully when Supabase Auth returns a valid session", async () => {
    const mockUser = {
      id: "admin-uuid-1234",
      email: "adminfix@gmail.com",
      app_metadata: { role: "admin" },
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    const mockSession = {
      access_token: "mock-jwt-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: mockUser,
    };

    vi.spyOn(supabase.auth, "signInWithPassword").mockResolvedValueOnce({
      data: { user: mockUser as any, session: mockSession as any },
      error: null,
    });

    const res = await signInAdmin("adminfix@gmail.com", "ValidAdminPass");
    expect(res.success).toBe(true);
    expect(res.user).toBeDefined();
  });

  it("verifies live Supabase Auth session in getAdminAuthState", async () => {
    const mockUser = {
      id: "admin-uuid-1234",
      email: "adminfix@gmail.com",
      app_metadata: { role: "admin" },
    };

    vi.spyOn(supabase.auth, "getSession").mockResolvedValueOnce({
      data: {
        session: {
          access_token: "valid-token",
          user: mockUser as any,
        } as any,
      },
      error: null,
    });

    const state = await getAdminAuthState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.email).toBe("adminfix@gmail.com");
  });

  it("returns unauthenticated when no Supabase Auth session exists", async () => {
    vi.spyOn(supabase.auth, "getSession").mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const state = await getAdminAuthState();
    expect(state.isAuthenticated).toBe(false);
  });

  it("invokes supabase.auth.signOut on administrator logout", async () => {
    const signOutSpy = vi.spyOn(supabase.auth, "signOut").mockResolvedValueOnce({
      error: null,
    });

    await signOutAdmin();
    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });
});
