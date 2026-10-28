import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLayout, PasswordField, TextField } from "@/components/fixlens/AuthLayout";
import { AsideCopy } from "@/components/fixlens/AuthAside";
import { DEMO_STUDENT } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";
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

  const fillDemo = () => {
    setF({ email: DEMO_STUDENT.email, password: "password123" });
    setErr({});
    toast.info("Demo student credentials pre-filled.");
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
    if (!f.email.trim()) er.email = "Please enter your campus email.";
    else if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = "Enter a valid campus email address.";
    if (!f.password) er.password = "Please enter your password.";
    else if (f.password.length < 6) er.password = "Password must be at least 6 characters.";
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);

    if (f.email.toLowerCase() === DEMO_STUDENT.email.toLowerCase()) {
      setCurrentStudent(DEMO_STUDENT);
    } else {
      const derivedName = f.email
        .split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setCurrentStudent({
        name: derivedName,
        email: f.email,
        department: "Computer Applications (MCA)",
      });
    }

    setTimeout(() => {
      toast.info("Demo mode: signed in successfully. Opening student portal.");
      nav({ to: "/student" });
    }, 300);
  };

  return (
    <AuthLayout
      title="Student login"
      subtitle="Report issues and follow their progress."
      aside={<AsideCopy />}
    >
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
