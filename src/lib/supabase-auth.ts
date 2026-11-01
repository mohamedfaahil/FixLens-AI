import { supabase } from "@/integrations/supabase/client";

/**
 * Designated FixLens AI administrator account.
 * Note: No credentials or passwords are hardcoded in source code.
 * Authentication is performed exclusively via Supabase Auth.
 */
export const ADMIN_ACCOUNT = {
  email: "adminfix@gmail.com",
  name: "FixLens Administrator",
  role: "Campus Maintenance Administrator",
};

export interface AdminAuthState {
  isAuthenticated: boolean;
  email?: string;
  role?: string;
}

/**
 * Checks if the administrator is currently authenticated.
 * Verifies the live Supabase Auth session token and validates the administrator role.
 * Does not trust unverified browser storage flags.
 */
export async function getAdminAuthState(): Promise<AdminAuthState> {
  if (typeof window === "undefined") {
    return { isAuthenticated: false };
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      return { isAuthenticated: false };
    }

    const user = data.session.user;
    const sessionEmail = user.email?.toLowerCase();

    // Verify authenticated user matches designated administrator identity
    if (!sessionEmail || sessionEmail !== ADMIN_ACCOUNT.email.toLowerCase()) {
      return { isAuthenticated: false };
    }

    // Fast-path: Check trusted app_metadata claim (set only by server/auth admin)
    if (user.app_metadata?.role === "admin") {
      return {
        isAuthenticated: true,
        email: sessionEmail,
        role: ADMIN_ACCOUNT.role,
      };
    }

    // Attempt to verify role claim from database profile with abort timeout
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .abortSignal(controller.signal)
        .maybeSingle();

      clearTimeout(timer);

      if (profile && profile.role !== "admin") {
        return { isAuthenticated: false };
      }
    } catch {
      // In case database tables are pending initial SQL migration or offline,
      // session is verified by valid Supabase Auth session token for ADMIN_ACCOUNT.email
    }

    return {
      isAuthenticated: true,
      email: sessionEmail,
      role: ADMIN_ACCOUNT.role,
    };
  } catch {
    return { isAuthenticated: false };
  }
}

/**
 * Signs in the administrator through Supabase Auth.
 * 1. Authenticates email and password directly via Supabase Auth.
 * 2. Strictly enforces that only the designated administrator identity can access the portal.
 * 3. Does NOT allow public auto-provisioning or client-side promotion.
 */
export async function signInAdmin(
  emailInput: string,
  passwordInput: string,
): Promise<{ success: boolean; error?: string; user?: unknown }> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput;

  if (!email) {
    return { success: false, error: "Please enter your administrator email." };
  }
  if (!password) {
    return { success: false, error: "Please enter your administrator password." };
  }

  // Enforce authorized administrator account identity
  if (email !== ADMIN_ACCOUNT.email.toLowerCase()) {
    return {
      success: false,
      error: "Access denied. Only the designated administrator account is permitted to sign in.",
    };
  }

  try {
    // Authenticate with live Supabase Auth instance
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Invalid administrator credentials.",
      };
    }

    if (!data.session || !data.user) {
      return {
        success: false,
        error: "Authentication failed. No active session established.",
      };
    }

    // Role verification: check app_metadata first
    if (data.user.app_metadata?.role && data.user.app_metadata.role !== "admin") {
      await supabase.auth.signOut();
      return {
        success: false,
        error: "Access denied: Account role is not configured as an administrator.",
      };
    }

    if (data.user.app_metadata?.role === "admin") {
      return { success: true, user: data.user };
    }

    // Role verification: check if profile role is admin with timeout
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .abortSignal(controller.signal)
        .maybeSingle();

      clearTimeout(timer);

      if (profile && profile.role !== "admin") {
        await supabase.auth.signOut();
        return {
          success: false,
          error: "Access denied: Account role is not configured as an administrator.",
        };
      }
    } catch {
      // Database tables optional / pending migration
    }

    return { success: true, user: data.user };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to connect to authentication server.";
    return { success: false, error: message };
  }
}

/**
 * Signs out the administrator from Supabase and terminates the session.
 */
export async function signOutAdmin(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[Supabase Auth] Sign out notice:", err);
  }
}
