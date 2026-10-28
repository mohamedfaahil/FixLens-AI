import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/fixlens/ui-bits";
import { ProposalBoard } from "@/components/fixlens/ProposalBoard";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/student/improvements")({
  head: () =>
    pageHead("Campus Improvement Hub", "Browse, support and create campus improvement proposals."),
  component: () => (
    <>
      <PageHeader
        title="Campus Improvement Hub"
        description="Suggest upgrades and support ideas from other students."
      />
      <ProposalBoard />
    </>
  ),
});
