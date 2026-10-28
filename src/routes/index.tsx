import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  ClipboardList,
  Lightbulb,
  Menu,
  Repeat,
  ShieldCheck,
  Wifi,
  Zap,
  Droplets,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo, PriorityBadge, StatusBadge, DemoBadge } from "@/components/fixlens/ui-bits";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Smarter Campus Maintenance",
      "Report campus maintenance issues, track progress, and propose improvements with AI-assisted prioritisation.",
    ),
  component: Home,
});

const features = [
  {
    icon: ClipboardList,
    title: "Complaint management",
    text: "Students report issues with category, location, urgency and photos, then follow every status change.",
  },
  {
    icon: BrainCircuit,
    title: "AI-assisted priority",
    text: "A planned TF-IDF + Random Forest classifier suggests Low, Medium or High priority for faster triage.",
  },
  {
    icon: Repeat,
    title: "Recurring issue analysis",
    text: "Spot repeated problems by building, category and month, and surface unusual spikes for review.",
  },
  {
    icon: Lightbulb,
    title: "Improvement proposals",
    text: "Students suggest campus upgrades, gather support, and administrators record transparent decisions.",
  },
];

const steps = [
  {
    n: "01",
    title: "Report",
    text: "Describe the problem, choose a category and location, and attach a photo.",
  },
  {
    n: "02",
    title: "Prioritise",
    text: "The system suggests a priority; administrators review and assign it.",
  },
  {
    n: "03",
    title: "Resolve",
    text: "Track progress through a clear timeline until the issue is resolved.",
  },
  {
    n: "04",
    title: "Improve",
    text: "Recurring patterns and proposals inform long-term campus improvements.",
  },
];

function Home() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <Button variant="ghost" asChild>
              <Link to="/admin-login">Admin Login</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/login">Student Login</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Register</Link>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto md:hidden"
            onClick={() => setMenu((m) => !m)}
            aria-label="Toggle menu"
          >
            <Menu />
          </Button>
        </div>
        {menu && (
          <div className="flex flex-col gap-2 border-t px-4 py-3 md:hidden">
            <Button variant="outline" asChild>
              <Link to="/login">Student Login</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Register</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/admin-login">Admin Login</Link>
            </Button>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-primary shadow-card">
              <ShieldCheck className="size-3.5" /> Campus Maintenance Analysis & Improvement
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] text-foreground sm:text-5xl lg:text-[58px]">
              A Smarter Campus Starts With <span className="text-primary">Better Maintenance.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              FixLens AI brings complaint reporting, AI-assisted prioritisation, recurring issue
              analysis and student improvement proposals into one place for students and campus
              administrators.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="hero" asChild>
                <Link to="/login">
                  Report a Maintenance Issue <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">Explore Features</a>
              </Button>
            </div>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section id="features" className="border-t bg-card py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-wider text-primary">Features</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-extrabold text-foreground sm:text-4xl">
            Everything needed to keep campus facilities running well
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="surface p-6 transition-shadow hover:shadow-float">
                <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-wider text-primary">How it works</p>
          <h2 className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">
            From report to resolution in four steps
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="border-t-2 border-primary pt-5">
                <span className="font-display text-sm font-extrabold text-primary">{s.n}</span>
                <h3 className="mt-2 text-xl font-bold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="surface mt-14 flex flex-col items-start justify-between gap-5 bg-primary p-8 text-primary-foreground sm:flex-row sm:items-center">
            <div>
              <h3 className="text-2xl font-extrabold">Noticed something that needs fixing?</h3>
              <p className="mt-1 text-primary-foreground/80">
                Create a student account and file your first report.
              </p>
            </div>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/register">
                Get started <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo />
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              AI-Based Campus Maintenance Analysis and Improvement Management System — MCA Capstone
              Project.
            </p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
            <Link to="/login" className="hover:text-foreground">
              Student Login
            </Link>
            <Link to="/register" className="hover:text-foreground">
              Register
            </Link>
            <Link to="/admin-login" className="hover:text-foreground">
              Admin Login
            </Link>
          </div>
        </div>
        <p className="border-t py-4 text-center text-xs text-muted-foreground">
          © 2026 FixLens AI. Frontend prototype.
        </p>
      </footer>
    </div>
  );
}

function DashboardPreview() {
  const rows = [
    {
      icon: Wifi,
      t: "Weak Wi-Fi in Lab 3",
      l: "CS Block",
      p: "High" as const,
      s: "In Progress" as const,
    },
    {
      icon: Zap,
      t: "Lights out in Room 204",
      l: "CS Block",
      p: "Medium" as const,
      s: "Under Review" as const,
    },
    {
      icon: Droplets,
      t: "Leaking tap, 1st floor",
      l: "MCA Block",
      p: "Medium" as const,
      s: "Resolved" as const,
    },
  ];
  const bars = [40, 55, 48, 70, 62, 85];
  return (
    <div className="relative" aria-label="Dashboard preview">
      <div className="surface relative overflow-hidden shadow-float">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive/50" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-success/60" />
          </div>
          <DemoBadge label="Preview" />
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_170px]">
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Complaint queue
            </p>
            {rows.map((r) => (
              <div
                key={r.t}
                className="flex items-center gap-3 rounded-lg border bg-background p-3"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-primary">
                  <r.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{r.t}</p>
                  <p className="text-xs text-muted-foreground">{r.l}</p>
                </div>
                <div className="hidden flex-col items-end gap-1 sm:flex">
                  <PriorityBadge priority={r.p} />
                  <StatusBadge status={r.s} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border bg-background p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <BarChart3 className="size-3.5" /> Monthly trend
              </p>
              <div className="mt-3 flex h-20 items-end gap-1.5">
                {bars.map((b, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-primary/80"
                    style={{ height: `${b}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <BrainCircuit className="size-3.5" /> Suggested priority
              </p>
              <div className="mt-2">
                <PriorityBadge priority="High" />
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <CheckCircle2 className="size-3 text-success" /> Admin review required
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
