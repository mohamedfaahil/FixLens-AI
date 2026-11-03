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
import { signOutAdmin, signOutStudent } from "@/lib/supabase-auth";
import { useDemoStore } from "@/lib/demo-store";
import { NotificationsBell } from "./NotificationsBell";
import { ThemeToggle } from "./ThemeToggle";
import { ChatCopilot } from "./ChatCopilot";
import { toast } from "sonner";

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
  const { isSupabaseConnected } = useDemoStore();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (i: NavItem) =>
    i.exact ? path === i.to || path === i.to + "/" : path.startsWith(i.to);

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "FX";

  const navList = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {nav.map((i) => {
        const active = isActive(i);
        return (
          <Link
            key={i.to}
            to={i.to}
            onClick={() => setOpen(false)}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150",
              active
                ? "bg-primary/10 text-primary font-semibold shadow-xs"
                : "text-sidebar-foreground/75 hover:bg-muted/70 hover:text-foreground",
            )}
          >
            {active && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" />
            )}
            <i.icon
              className={cn(
                "size-4.5 transition-colors",
                active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            <span>{i.label}</span>
          </Link>
        );
      })}
      <div className="mt-auto pt-3 border-t border-sidebar-border">
        <button
          onClick={() => setConfirm(true)}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
  );

  const side = (
    <div className="flex h-full flex-col gap-5 py-5">
      <div className="px-5">
        <Logo to="/" />
        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          {portal} Portal
        </div>
      </div>
      {navList}
      <div className="mx-3 rounded-xl border border-sidebar-border bg-card/60 p-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user.sub}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        {side}
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 border-sidebar-border">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {side}
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-md sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
          <span className="lg:hidden">
            <Logo to="/" />
          </span>

          <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-primary" />
            <span className="font-semibold text-foreground">{portal} Workspace</span>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <NotificationsBell portal={portal} />
            <div className="h-4 w-px bg-border hidden sm:block" />
            {isSupabaseConnected ? (
              <>
                <span className="hidden text-xs text-muted-foreground md:inline">
                  Supabase Database
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </>
            ) : (
              <>
                <span className="hidden text-xs text-muted-foreground md:inline">
                  In-Memory Session
                </span>
                <DemoBadge />
              </>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="animate-in fade-in-50 duration-200">
            {children}
          </div>
        </main>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {portal === "Administrator" ? "Sign out of Administrator Portal?" : "Sign out of Student Portal?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {portal === "Administrator"
                ? "You will be signed out from your Supabase administrator session and returned to the admin login."
                : "You will be signed out from your Supabase student session and returned to the login screen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (portal === "Administrator") {
                  await signOutAdmin();
                  toast.success("Administrator session closed.");
                  navigate({ to: "/admin-login" });
                } else {
                  if (typeof sessionStorage !== "undefined") {
                    sessionStorage.removeItem("fixlens_demo_session");
                  }
                  await signOutStudent();
                  toast.success("Student session signed out.");
                  navigate({ to: "/login" });
                }
              }}
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ChatCopilot portal={portal} user={user} />
    </div>
  );
}
