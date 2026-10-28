import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Menu, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DemoBadge, Logo } from "./ui-bits";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface Props {
  nav: NavItem[];
  portal: "Student" | "Administrator";
  user: { name: string; sub: string };
  children: ReactNode;
}

export function PortalShell({ nav, portal, user, children }: Props) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (i: NavItem) =>
    i.exact ? path === i.to || path === i.to + "/" : path.startsWith(i.to);

  const navList = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {nav.map((i) => (
        <Link
          key={i.to}
          to={i.to}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(i)
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/80 hover:bg-muted hover:text-foreground",
          )}
        >
          <i.icon className="size-4" />
          {i.label}
        </Link>
      ))}
      <button
        onClick={() => setConfirm(true)}
        className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="size-4" />
        Sign Out
      </button>
    </nav>
  );

  const side = (
    <div className="flex h-full flex-col gap-6 py-5">
      <div className="px-5">
        <Logo to="/" />
        <p className="mt-1 pl-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {portal} Portal
        </p>
      </div>
      {navList}
      <div className="mx-3 rounded-lg border bg-muted/50 p-3">
        <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.sub}</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-sidebar lg:block">
        {side}
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {side}
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <span className="lg:hidden">
            <Logo to="/" />
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Changes stay in this browser tab only
            </span>
            <DemoBadge />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of the demo?</AlertDialogTitle>
            <AlertDialogDescription>
              You will return to the homepage. Demo changes are kept until you refresh the page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate({ to: "/" })}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
