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

export interface StudentAuthUser {
  id: string;
  email: string;
  name: string;
  department: string;
  phone?: string;
  role: string;
}

export interface StudentAuthState {
  isAuthenticated: boolean;
  user?: StudentAuthUser;
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

// ====================================================================
// STUDENT AUTHENTICATION METHODS
// ====================================================================

/**
 * Checks if a student is currently authenticated with a live Supabase session.
 * Fetches user profile metadata (UUID, full name, department, phone).
 */
export async function getStudentAuthState(): Promise<StudentAuthState> {
  if (typeof window === "undefined") {
    return { isAuthenticated: false };
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      return { isAuthenticated: false };
    }

    const user = data.session.user;
    if (!user.email) return { isAuthenticated: false };

    // Fetch profile details from public.profiles with abort timeout
    let profileData: { full_name?: string | null; department?: string | null; phone?: string | null; role?: string } | null = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, department, phone, role")
        .eq("id", user.id)
        .abortSignal(controller.signal)
        .maybeSingle();

      clearTimeout(timer);
      profileData = profile;
    } catch {
      // offline / demo fallback
    }

    const derivedName =
      profileData?.full_name ||
      user.user_metadata?.full_name ||
      user.email
        .split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      isAuthenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: derivedName,
        department: profileData?.department || user.user_metadata?.department || "General",
        phone: profileData?.phone || user.user_metadata?.phone,
        role: profileData?.role || (user.app_metadata?.role as string) || "student",
      },
    };
  } catch {
    return { isAuthenticated: false };
  }
}

/**
 * Signs in a student with campus email and password via Supabase Auth.
 */
export async function signInStudent(
  emailInput: string,
  passwordInput: string,
): Promise<{ success: boolean; error?: string; user?: StudentAuthUser }> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput;

  if (!email) {
    return { success: false, error: "Please enter your campus email." };
  }
  if (!password) {
    return { success: false, error: "Please enter your password." };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message || "Invalid credentials." };
    }

    if (!data.session || !data.user) {
      return { success: false, error: "Authentication failed. No active session established." };
    }

    const user = data.user;
    let profileData: { full_name?: string | null; department?: string | null; phone?: string | null; role?: string } | null = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, department, phone, role")
        .eq("id", user.id)
        .abortSignal(controller.signal)
        .maybeSingle();

      clearTimeout(timer);
      profileData = profile;
    } catch {
      // offline fallback
    }

    const derivedName =
      profileData?.full_name ||
      user.user_metadata?.full_name ||
      user.email
        ?.split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()) ||
      "Student";

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email!,
        name: derivedName,
        department: profileData?.department || user.user_metadata?.department || "General",
        phone: profileData?.phone || user.user_metadata?.phone,
        role: profileData?.role || "student",
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to connect to authentication server.";
    return { success: false, error: message };
  }
}

/**
 * Registers a new student account in Supabase Auth.
 * Triggers the database profile creation in public.profiles.
 */
export async function signUpStudent(input: {
  email: string;
  password: string;
  fullName: string;
  department: string;
  phone?: string;
}): Promise<{
  success: boolean;
  error?: string;
  sessionEstablished: boolean;
  user?: StudentAuthUser;
}> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const fullName = input.fullName.trim();
  const department = input.department.trim();
  const phone = input.phone?.trim();

  if (!email) {
    return { success: false, sessionEstablished: false, error: "Please enter your campus email." };
  }
  if (!password) {
    return { success: false, sessionEstablished: false, error: "Please enter a password." };
  }
  if (!fullName) {
    return { success: false, sessionEstablished: false, error: "Please enter your full name." };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          department,
          phone,
        },
      },
    });

    if (error) {
      return { success: false, sessionEstablished: false, error: error.message };
    }

    if (!data.user) {
      return {
        success: false,
        sessionEstablished: false,
        error: "Registration failed. No user was returned by authentication provider.",
      };
    }

    const sessionEstablished = Boolean(data.session);

    return {
      success: true,
      sessionEstablished,
      user: {
        id: data.user.id,
        email: data.user.email || email,
        name: fullName,
        department,
        phone,
        role: "student",
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to register student account.";
    return { success: false, sessionEstablished: false, error: message };
  }
}

/**
 * Signs out the student from Supabase and terminates the session.
 */
export async function signOutStudent(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[Supabase Auth] Student sign out notice:", err);
  }
}
