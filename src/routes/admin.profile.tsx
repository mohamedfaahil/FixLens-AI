import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { DemoNotice, PageHeader, Panel } from "@/components/fixlens/ui-bits";
import { DEMO_ADMIN } from "@/lib/demo-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/profile")({
  head: () =>
    pageHead("Administrator Profile", "Your FixLens AI administrator account and permissions."),
  component: Profile,
});

const perms = [
  "View and filter all complaints",
  "Update status, priority and resolution notes",
  "Review and decide on improvement proposals",
  "View analytics and planning reports",
];

function Profile() {
  return (
    <>
      <PageHeader title="Profile" description="Your administrator account." />
      <DemoNotice>This is a sample demo profile.</DemoNotice>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Account">
          <dl className="divide-y text-sm">
            {[
              ["Name", DEMO_ADMIN.name],
              ["Email", DEMO_ADMIN.email],
              ["Role", DEMO_ADMIN.role],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-4 py-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="col-span-2 font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Permissions">
          <ul className="space-y-2 text-sm">
            {perms.map((p) => (
              <li key={p} className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                {p}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
