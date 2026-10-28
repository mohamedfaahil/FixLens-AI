import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLayout, PasswordField, TextField } from "@/components/fixlens/AuthLayout";
import { AdminAside } from "@/components/fixlens/AuthAside";
import { DEMO_ADMIN } from "@/lib/demo-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin-login")({
  head: () =>
    pageHead(
      "Administrator Login",
      "Restricted sign-in for FixLens AI campus facilities administrators.",
    ),
  component: AdminLogin,
});

function AdminLogin() {
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

  const fillDemo = () => {
    setF({ email: DEMO_ADMIN.email, password: "adminPassword123" });
    setErr({});
    toast.info("Demo administrator credentials pre-filled.");
  };

  const submit = (e: React.FormEvent) => {
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
    else if (f.password.length < 6) er.password = "Password must be at least 6 characters.";
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);

    setTimeout(() => {
      toast.info("Demo mode: administrator access granted. Opening admin portal.");
      nav({ to: "/admin" });
    }, 300);
  };

  return (
    <AuthLayout
      title="Administrator login"
      subtitle="Facilities and maintenance staff only."
      aside={<AdminAside />}
    >
      <div className="mb-5 flex gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3.5 text-sm text-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p>
          <strong>Restricted access.</strong> This area is for authorised campus administrators.
          Students should use the student login.
        </p>
      </div>
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
