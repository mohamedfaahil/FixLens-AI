import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLayout, PasswordField, TextField } from "@/components/fixlens/AuthLayout";
import { AsideCopy } from "@/components/fixlens/AuthAside";
import { DEMO_STUDENT } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";
import { signInStudent, resendStudentConfirmationEmail, getStudentAuthState } from "@/lib/supabase-auth";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/login")({
  head: () =>
    pageHead(
      "Student Login",
      "Sign in to the FixLens AI student portal to report and track campus maintenance issues.",
    ),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const { setCurrentStudent } = useDemoStore();
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
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  // Check if student arrived from clicking an email confirmation verification link
  useEffect(() => {
    let active = true;
    const checkVerification = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (active && data.session?.user) {
          const studentAuth = await getStudentAuthState();
          if (active && studentAuth.isAuthenticated && studentAuth.user) {
            setCurrentStudent(studentAuth.user);
            toast.success(`Email verified! Welcome, ${studentAuth.user.name}.`);
            nav({ to: "/student" });
          }
        }
      } catch {
        // Ignored
      }
    };
    checkVerification();
    return () => {
      active = false;
    };
  }, [nav, setCurrentStudent]);

  const handleResend = async () => {
    if (!unconfirmedEmail) return;
    setResending(true);
    try {
      const res = await resendStudentConfirmationEmail(unconfirmedEmail);
      if (res.success) {
        toast.success(`Verification email sent to ${unconfirmedEmail}. Please check your inbox.`);
      } else {
        toast.error(res.error || "Failed to resend confirmation email.");
      }
    } finally {
      setResending(false);
    }
  };

  const fillDemo = () => {
    setF({ email: DEMO_STUDENT.email, password: "password123" });
    setErr({});
    toast.info("Demo student credentials pre-filled.");
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
    if (!f.email.trim()) er.email = "Please enter your campus email.";
    else if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = "Enter a valid campus email address.";
    if (!f.password) er.password = "Please enter your password.";
    else if (f.password.length < 6) er.password = "Password must be at least 6 characters.";
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);

    try {
      // 1. Attempt Supabase Auth student sign-in
      const res = await signInStudent(f.email, f.password);

      if (res.success && res.user) {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("fixlens_demo_session");
        }
        setCurrentStudent(res.user);
        toast.success(`Welcome back, ${res.user.name}!`);
        nav({ to: "/student" });
        return;
      }

      // 2. Demo fallback if using sample demo student in offline/test environment
      if (
        f.email.toLowerCase() === DEMO_STUDENT.email.toLowerCase() &&
        (res.error?.includes("Failed to connect") || res.error?.includes("Invalid login credentials") || res.error?.includes("fetch"))
      ) {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("fixlens_demo_session", "true");
        }
        setCurrentStudent(DEMO_STUDENT);
        toast.info("Demo mode: signed in successfully. Opening student portal.");
        nav({ to: "/student" });
        return;
      }

      if (res.isEmailUnconfirmed) {
        setUnconfirmedEmail(f.email.trim());
        setErr({ email: "Email confirmation required." });
        toast.error("Your email has not been confirmed yet. Please verify your email before logging in.");
        return;
      }

      setErr({ password: res.error || "Invalid campus credentials." });
      toast.error(res.error || "Authentication failed.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Sign in failed.";
      setErr({ password: message });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Student login"
      subtitle="Report issues and follow their progress."
      aside={<AsideCopy />}
    >
      {unconfirmedEmail && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/40">
          <div className="font-semibold text-amber-950 dark:text-amber-100 mb-1">
            Email Confirmation Required
          </div>
          <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mb-3 leading-relaxed">
            Your Supabase account exists for <strong>{unconfirmedEmail}</strong>, but its email address has not been confirmed yet.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={resending}
              onClick={handleResend}
              className="text-xs bg-white dark:bg-zinc-900"
            >
              {resending ? "Sending link…" : "Resend confirmation email"}
            </Button>
          </div>
          <div className="mt-3 border-t border-amber-200/60 pt-2 text-[11px] text-amber-800/80 dark:text-amber-300/80">
            <strong>Administrator Tip:</strong> You can confirm this user directly in Supabase Dashboard &rarr; <em>Authentication</em> &rarr; <em>Users</em> &rarr; <em>&hellip; (User menu)</em> &rarr; <em>Confirm email</em>, or disable <em>Confirm email</em> under Providers for automatic confirmation.
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={fillDemo}
            className="text-xs font-semibold text-primary underline hover:text-primary/80"
          >
            Auto-fill demo credentials
          </button>
        </div>
        <TextField
          id="email"
          label="Campus email"
          type="email"
          placeholder="name@campus.edu"
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
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
        <span className="mx-2">·</span>
        <Link to="/admin-login" className="font-semibold text-primary hover:underline">
          Admin login
        </Link>
      </p>
    </AuthLayout>
  );
}
