import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  Lightbulb,
  UserRound,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { PortalShell, type NavItem } from "@/components/fixlens/PortalShell";
import { useDemoStore } from "@/lib/demo-store";
import { getStudentAuthState, getAdminAuthState } from "@/lib/supabase-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/student")({
  component: StudentLayout,
});

const nav: NavItem[] = [
  { to: "/student", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/student/report", label: "Report Complaint", icon: FilePlus2 },
  { to: "/student/complaints", label: "My Complaints", icon: ClipboardList },
  { to: "/student/improvements", label: "Campus Improvement Hub", icon: Lightbulb },
  { to: "/student/profile", label: "Profile", icon: UserRound },
];

export function StudentLayout() {
  const { currentStudent, setCurrentStudent } = useDemoStore();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const isTestMode =
      typeof process !== "undefined" &&
      (process.env.NODE_ENV === "test" || process.env.VITEST === "true");

    const verifyAccess = async () => {
      // 1. Strictly check if caller is an administrator account
      const adminAuth = await getAdminAuthState();
      if (adminAuth.isAuthenticated) {
        if (!isMounted) return;
        setAuthorized(false);
        setChecking(false);
        toast.error(
          "Access restricted: Administrator accounts cannot access the Student Portal. Please sign in with student credentials.",
        );
        navigate({ to: "/login" });
        return;
      }

      // 2. Verify Student authorization
      const authState = await getStudentAuthState();
      if (!isMounted) return;

      if (!authState.isAuthenticated && !isTestMode) {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("fixlens_demo_session");
        }
        setAuthorized(false);
        setChecking(false);
        toast.info("Please sign in to access the student portal.");
        navigate({ to: "/login" });
      } else {
        if (authState.user) {
          setCurrentStudent(authState.user);
        }
        setAuthorized(true);
        setChecking(false);
      }
    };

    verifyAccess();

    return () => {
      isMounted = false;
    };
  }, [navigate, setCurrentStudent]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            Verifying student session…
          </p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md w-full rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-4">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground">
            The Student Portal is restricted to verified student accounts. Administrator accounts are not permitted to access student functions.
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => navigate({ to: "/login" })}>
              Sign in as Student
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/admin" })}>
              Go to Admin Portal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PortalShell
      nav={nav}
      portal="Student"
      user={{
        name: currentStudent?.name || "Student",
        sub: currentStudent?.department || "Campus",
      }}
    >
      <Outlet />
    </PortalShell>
  );
}
