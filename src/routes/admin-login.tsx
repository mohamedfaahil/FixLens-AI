import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLayout, PasswordField, TextField } from "@/components/fixlens/AuthLayout";
import { AdminAside } from "@/components/fixlens/AuthAside";
import { signInAdmin } from "@/lib/supabase-auth";
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
      <form onSubmit={submit} className="space-y-4" noValidate>
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
