import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Brain,
  ClipboardList,
  FileBarChart,
  Flame,
  LayoutDashboard,
  Lightbulb,
  UserRound,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { PortalShell, type NavItem } from "@/components/fixlens/PortalShell";
import { DEMO_ADMIN } from "@/lib/demo-data";
import { getAdminAuthState, ADMIN_ACCOUNT } from "@/lib/supabase-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const nav: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/queue", label: "Priority Queue", icon: Flame },
  { to: "/admin/complaints", label: "All Complaints", icon: ClipboardList },
  { to: "/admin/improvements", label: "Proposal Review", icon: Lightbulb },
  { to: "/admin/analytics", label: "Analytics & Insights", icon: BarChart3 },
  { to: "/admin/model", label: "AI Priority Model", icon: Brain },
  { to: "/admin/reports", label: "Planning Reports", icon: FileBarChart },
  { to: "/admin/profile", label: "Profile", icon: UserRound },
];

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getAdminAuthState().then(({ isAuthenticated }) => {
      if (!isMounted) return;
      if (!isAuthenticated) {
        setAuthorized(false);
        setChecking(false);
        toast.error("Administrator access restricted. Please sign in with administrator credentials.");
        navigate({
          to: "/admin-login",
        });
      } else {
        setAuthorized(true);
        setChecking(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [navigate, location.pathname]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            Verifying administrator authorization…
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
            The administrator portal requires verified authentication. Access is restricted to{" "}
            <strong>{ADMIN_ACCOUNT.email}</strong>.
          </p>
          <Button onClick={() => navigate({ to: "/admin-login" })}>
            Sign in as Administrator
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PortalShell
      nav={nav}
      portal="Administrator"
      user={{ name: DEMO_ADMIN.name, sub: DEMO_ADMIN.email }}
    >
      <Outlet />
    </PortalShell>
  );
}
