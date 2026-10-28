import { createFileRoute } from "@tanstack/react-router";
import { DemoNotice, PageHeader, Panel } from "@/components/fixlens/ui-bits";
import { useDemoStore } from "@/lib/demo-store";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/student/profile")({
  head: () => pageHead("Profile", "Your FixLens AI student profile."),
  component: Profile,
});

function Profile() {
  const { complaints, currentStudent } = useDemoStore();
  const mine = complaints.filter((c) => c.reporter === currentStudent.name);
  const rows = [
    ["Name", currentStudent.name],
    ["Email", currentStudent.email],
    ["Department", currentStudent.department],
    ["Phone", currentStudent.phone || "Not provided"],
    ["Complaints filed", String(mine.length)],
  ];
  return (
    <>
      <PageHeader title="Profile" description="Your account details." />
      <DemoNotice>This is a sample demo profile.</DemoNotice>
      <Panel className="mt-5">
        <dl className="divide-y">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-4 py-3 text-sm">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="col-span-2 font-medium text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </>
  );
}
