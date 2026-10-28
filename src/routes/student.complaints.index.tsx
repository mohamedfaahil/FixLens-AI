import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/fixlens/ui-bits";
import { ComplaintList } from "@/components/fixlens/ComplaintList";
import { useDemoStore } from "@/lib/demo-store";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/student/complaints/")({
  head: () =>
    pageHead(
      "My Complaints",
      "Track the status and priority of your campus maintenance complaints.",
    ),
  component: MyComplaints,
});

function MyComplaints() {
  const { complaints, currentStudent } = useDemoStore();
  const nav = useNavigate();
  return (
    <>
      <PageHeader
        title="My complaints"
        description="Search, filter and open any complaint to see its timeline."
        actions={
          <Button asChild>
            <Link to="/student/report">
              <FilePlus2 /> New complaint
            </Link>
          </Button>
        }
      />
      <ComplaintList
        complaints={complaints.filter((c) => c.reporter === currentStudent.name)}
        onOpen={(c) => nav({ to: "/student/complaints/$id", params: { id: c.id } })}
      />
    </>
  );
}
