import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, FilePlus2, LayoutDashboard, Lightbulb, UserRound, Loader2 } from "lucide-react";
import { PortalShell, type NavItem } from "@/components/fixlens/PortalShell";
import { useDemoStore } from "@/lib/demo-store";
import { getStudentAuthState } from "@/lib/supabase-auth";
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

function StudentLayout() {
  const { currentStudent } = useDemoStore();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getStudentAuthState().then((authState) => {
      if (!isMounted) return;
      // If user has no active Supabase session and no local student user, prompt to sign in
      if (!authState.isAuthenticated && !currentStudent?.name) {
        toast.info("Please sign in to access the student portal.");
        navigate({ to: "/login" });
      } else {
        setChecking(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [navigate, currentStudent]);

  if (checking && !currentStudent?.name) {
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

  return (
    <PortalShell
      nav={nav}
      portal="Student"
      user={{ name: currentStudent?.name || "Student", sub: currentStudent?.department || "Campus" }}
    >
      <Outlet />
    </PortalShell>
  );
}
