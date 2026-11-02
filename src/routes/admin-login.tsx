import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldAlert, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLayout, PasswordField, TextField } from "@/components/fixlens/AuthLayout";
import { AdminAside } from "@/components/fixlens/AuthAside";
import {
  signInAdmin,
  ADMIN_ACCOUNT,
  getAdminAuthState,
  getStudentAuthState,
  signOutStudent,
  signOutAdmin,
} from "@/lib/supabase-auth";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin-login")({
  head: () =>
    pageHead(
      "Administrator Login",
      "Restricted sign-in for FixLens AI campus facilities administrators.",
    ),
  component: AdminLogin,
});

export function AdminLogin() {
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState<
    Partial<
      Record<
        | "name"
        | "email"
        | "password"
        | "confirm"
        | "title"
        | "description"
        | "category"
        | "location"
        | "room"
        | "affected"
        | "image"
        | "block"
        | "floor"
        | "id"
        | "studentId"
        | "department"
        | "priority"
        | "phone"
        | "building",
        string
      >
    >
  >({});
  const [busy, setBusy] = useState(false);
  const [activeStudentEmail, setActiveStudentEmail] = useState<string | null>(null);
  const [activeAdminEmail, setActiveAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const checkAuth = async () => {
      try {
        const [studentAuth, adminAuth] = await Promise.all([
          getStudentAuthState(),
          getAdminAuthState(),
        ]);
        if (!active) return;
        if (studentAuth.isAuthenticated && studentAuth.user) {
          setActiveStudentEmail(studentAuth.user.email);
        } else if (adminAuth.isAuthenticated && adminAuth.email) {
          setActiveAdminEmail(adminAuth.email);
        }
      } catch {
        // Ignored
      }
    };
    checkAuth();
    return () => {
      active = false;
    };
  }, []);

  const fillDemo = () => {
    setF((prev) => ({ ...prev, email: ADMIN_ACCOUNT.email }));
    setErr({});
    toast.info("Administrator email filled. Please enter your password.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Partial<
      Record<
        | "name"
        | "email"
        | "password"
        | "confirm"
        | "title"
        | "description"
        | "category"
        | "location"
        | "room"
        | "affected"
        | "image"
        | "block"
        | "floor"
        | "id"
        | "studentId"
        | "department"
        | "priority"
        | "phone"
        | "building",
        string
      >
    > = {};
    if (!f.email.trim()) er.email = "Please enter administrator email.";
    else if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = "Enter a valid administrator email.";
    if (!f.password) er.password = "Please enter administrator password.";
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);

    try {
      const res = await signInAdmin(f.email, f.password);
      if (!res.success) {
        setErr({ password: res.error || "Invalid administrator credentials." });
        toast.error(res.error || "Authentication failed.");
        return;
      }
      toast.success("Administrator authenticated with Supabase. Access granted.");
      nav({ to: "/admin" });
    } catch {
      toast.error("Failed to authenticate administrator.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Administrator login"
      subtitle="Facilities and maintenance staff only."
      aside={<AdminAside />}
    >
      {activeStudentEmail && (
        <div
          role="status"
          data-testid="student-session-active-banner"
          className="mb-4 rounded-xl border border-blue-300/80 bg-blue-50/90 p-4 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200 space-y-2"
        >
          <div className="font-semibold flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
            <UserRound className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
            Student Session Active ({activeStudentEmail})
          </div>
          <p className="leading-relaxed text-blue-900/80 dark:text-blue-200/80">
            You are currently signed in as a student. Administrator functions require verified administrator credentials. Sign in with the administrator account below, or return to the Student Portal.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                await signOutStudent();
                setActiveStudentEmail(null);
                toast.info("Student signed out.");
              }}
              className="text-xs h-7 bg-white dark:bg-zinc-900"
            >
              Sign out Student
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => nav({ to: "/student" })}
              className="text-xs h-7 text-primary hover:underline"
            >
              Go to Student Portal &rarr;
            </Button>
          </div>
        </div>
      )}

      {activeAdminEmail && (
        <div
          role="status"
          data-testid="admin-session-active-banner"
          className="mb-4 rounded-xl border border-emerald-300/80 bg-emerald-50/90 p-4 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 space-y-2"
        >
          <div className="font-semibold flex items-center gap-2 text-sm text-emerald-900 dark:text-emerald-100">
            <ShieldAlert className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Signed in as Administrator ({activeAdminEmail})
          </div>
          <p className="leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
            You already have an active administrator session.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => nav({ to: "/admin" })}
              className="text-xs h-7 bg-white dark:bg-zinc-900 text-primary font-medium"
            >
              Go to Admin Dashboard &rarr;
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={async () => {
                await signOutAdmin();
                setActiveAdminEmail(null);
                toast.info("Administrator signed out.");
              }}
              className="text-xs h-7 text-muted-foreground hover:text-foreground"
            >
              Sign out
            </Button>
          </div>
        </div>
      )}
      <div className="mb-5 flex gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3.5 text-sm text-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p>
          <strong>Restricted access.</strong> This area is restricted to authorized FixLens AI
          administrators (<code>{ADMIN_ACCOUNT.email}</code>).
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={fillDemo}
            className="text-xs font-semibold text-primary underline hover:text-primary/80"
          >
            Fill admin email
          </button>
        </div>
        <TextField
          id="email"
          label="Administrator email"
          type="email"
          value={f.email}
          error={err.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <PasswordField
          id="password"
          label="Password"
          value={f.password}
          error={err.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
        />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in as administrator"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Not an administrator?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Student login
        </Link>
      </p>
    </AuthLayout>
  );
}
