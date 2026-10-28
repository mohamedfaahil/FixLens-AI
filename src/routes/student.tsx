import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ClipboardList, FilePlus2, LayoutDashboard, Lightbulb, UserRound } from "lucide-react";
import { PortalShell, type NavItem } from "@/components/fixlens/PortalShell";
import { useDemoStore } from "@/lib/demo-store";

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
  return (
    <PortalShell
      nav={nav}
      portal="Student"
      user={{ name: currentStudent.name, sub: currentStudent.department }}
    >
      <Outlet />
    </PortalShell>
  );
}
