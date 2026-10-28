import { CheckCircle2, ShieldAlert } from "lucide-react";

export function AsideCopy() {
  const pts = [
    "Report issues with photos and exact locations",
    "Follow a clear status timeline",
    "Support campus improvement proposals",
  ];
  return (
    <div className="max-w-md">
      <h2 className="text-3xl font-extrabold text-foreground">Your campus, maintained better.</h2>
      <ul className="mt-6 space-y-3">
        {pts.map((p) => (
          <li key={p} className="flex items-center gap-3 text-foreground">
            <CheckCircle2 className="size-5 text-primary" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminAside() {
  return (
    <div className="max-w-md">
      <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-elegant">
        <ShieldAlert className="size-6" />
      </span>
      <h2 className="mt-6 text-3xl font-extrabold text-foreground">Facilities administration</h2>
      <p className="mt-3 text-muted-foreground">
        Manage the complaint queue, review AI-suggested priorities, analyse recurring issues and
        decide on improvement proposals.
      </p>
    </div>
  );
}
