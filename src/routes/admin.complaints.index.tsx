import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/fixlens/ui-bits";
import { ComplaintList } from "@/components/fixlens/ComplaintList";
import { useDemoStore } from "@/lib/demo-store";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/complaints/")({
  head: () =>
    pageHead("All Complaints", "Search, filter and manage every campus maintenance complaint."),
  component: AllComplaints,
});

function AllComplaints() {
  const { complaints } = useDemoStore();
  const nav = useNavigate();
  return (
    <>
      <PageHeader
        title="All complaints"
        description="Open any complaint to update its status or priority."
      />
      <ComplaintList
        showReporter
        complaints={complaints}
        onOpen={(c) => nav({ to: "/admin/complaints/$id", params: { id: c.id } })}
      />
    </>
  );
}
