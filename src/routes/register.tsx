import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthLayout, PasswordField, TextField } from "@/components/fixlens/AuthLayout";
import { AsideCopy } from "@/components/fixlens/AuthAside";
import { FieldError, selectCls } from "@/components/fixlens/ui-bits";
import { DEPARTMENTS, DEMO_STUDENT } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";
import { signUpStudent, resendStudentConfirmationEmail } from "@/lib/supabase-auth";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/register")({
  head: () =>
    pageHead(
      "Student Registration",
      "Create a FixLens AI student account to report campus maintenance issues.",
    ),
  component: Register,
});

function Register() {
  const nav = useNavigate();
  const { setCurrentStudent } = useDemoStore();
  const [f, setF] = useState({
    name: "",
    email: "",
    department: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
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
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const fillSample = () => {
    setF({
      name: DEMO_STUDENT.name,
      email: DEMO_STUDENT.email,
      department: DEMO_STUDENT.department,
      phone: DEMO_STUDENT.phone,
      password: "Password123",
      confirm: "Password123",
    });
    setErr({});
    toast.info("Sample student credentials pre-filled.");
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
    if (f.name.trim().length < 2) er.name = "Enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = "Enter a valid campus email address.";
    if (!f.department) er.department = "Select your department.";
    if (f.phone && !/^[+\d\s-]{7,15}$/.test(f.phone)) er.phone = "Enter a valid phone number.";
    if (f.password.length < 8) er.password = "Use at least 8 characters.";
    else if (!/\d/.test(f.password) || !/[A-Za-z]/.test(f.password))
      er.password = "Include letters and numbers.";
    if (f.confirm !== f.password) er.confirm = "Passwords do not match.";
    setErr(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      const res = await signUpStudent({
        email: f.email.trim(),
        password: f.password,
        fullName: f.name.trim(),
        department: f.department,
        phone: f.phone.trim() || undefined,
      });

      if (res.success && res.user) {
        if (res.sessionEstablished) {
          setCurrentStudent(res.user);
          toast.success(`Welcome, ${res.user.name}! Student account created.`);
          nav({ to: "/student" });
        } else {
          setPendingEmail(f.email.trim());
          toast.success("Account registered! Email confirmation is required before login.");
        }
        return;
      }

      // Offline / fallback if needed
      if (res.error?.includes("Failed to connect") || res.error?.includes("fetch")) {
        setCurrentStudent({
          name: f.name.trim(),
          email: f.email.trim(),
          department: f.department,
          phone: f.phone.trim() || undefined,
        });
        toast.success(`Welcome, ${f.name.trim()}! Demo student account created for this session.`);
        nav({ to: "/student" });
        return;
      }

      setErr({ email: res.error || "Failed to create account." });
      toast.error(res.error || "Registration failed.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setResending(true);
    try {
      const res = await resendStudentConfirmationEmail(pendingEmail);
      if (res.success) {
        toast.success(`Verification email sent to ${pendingEmail}. Please check your inbox.`);
      } else {
        toast.error(res.error || "Failed to resend confirmation email.");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title="Create student account"
      subtitle="Register with your campus email."
      aside={<AsideCopy />}
    >
      {pendingEmail ? (
        <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/70 p-5 text-sm dark:border-blue-900/50 dark:bg-blue-950/30">
          <div className="flex items-start gap-3">
            <div className="size-2 mt-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
            <div className="space-y-1">
              <h3 className="font-semibold text-blue-950 dark:text-blue-100">
                Confirm your campus email
              </h3>
              <p className="text-xs text-blue-900/80 dark:text-blue-200/80 leading-relaxed">
                Your account was created for <strong>{pendingEmail}</strong>. Supabase requires email verification before you can sign in.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => nav({ to: "/login" })}
            >
              Go to Login
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resending}
              onClick={handleResend}
              className="w-full sm:w-auto bg-white dark:bg-zinc-900"
            >
              {resending ? "Sending link…" : "Resend confirmation email"}
            </Button>
          </div>

          <div className="border-t border-blue-200/60 pt-3 dark:border-blue-900/40 text-[11px] text-blue-800/80 dark:text-blue-300/80">
            <strong>Administrator Tip:</strong> To enable instant sign-up without email verification, open Supabase Dashboard &rarr; <em>Authentication</em> &rarr; <em>Providers</em> &rarr; <em>Email</em> &rarr; toggle <strong>Confirm email</strong> off.
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={fillSample}
            className="text-xs font-semibold text-primary underline hover:text-primary/80"
          >
            Auto-fill demo student details
          </button>
        </div>
        <TextField
          id="name"
          label="Full name"
          value={f.name}
          error={err.name}
          onChange={set("name")}
        />
        <TextField
          id="email"
          label="Campus email"
          type="email"
          placeholder="name@campus.edu"
          value={f.email}
          error={err.email}
          onChange={set("email")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="dept" className="mb-1.5 block">
              Department
            </Label>
            <select
              id="dept"
              className={selectCls + " h-10"}
              value={f.department}
              onChange={set("department")}
              aria-invalid={!!err.department}
            >
              <option value="">Select…</option>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <FieldError msg={err.department} />
          </div>
          <TextField
            id="phone"
            label="Phone (optional)"
            type="tel"
            value={f.phone}
            error={err.phone}
            onChange={set("phone")}
          />
        </div>
        <PasswordField
          id="password"
          label="Password"
          value={f.password}
          error={err.password}
          onChange={set("password")}
        />
        <PasswordField
          id="confirm"
          label="Confirm password"
          value={f.confirm}
          error={err.confirm}
          onChange={set("confirm")}
        />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
