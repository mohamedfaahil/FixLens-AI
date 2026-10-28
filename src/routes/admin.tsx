import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  BarChart3,
  Brain,
  ClipboardList,
  FileBarChart,
  Flame,
  LayoutDashboard,
  Lightbulb,
  UserRound,
} from "lucide-react";
import { PortalShell, type NavItem } from "@/components/fixlens/PortalShell";
import { DEMO_ADMIN } from "@/lib/demo-data";

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
  return (
    <PortalShell
      nav={nav}
      portal="Administrator"
      user={{ name: DEMO_ADMIN.name, sub: DEMO_ADMIN.role }}
    >
      <Outlet />
    </PortalShell>
  );
}
