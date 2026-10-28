import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PageHeader,
  Panel,
  StatusBadge,
  formatDate,
  selectCls,
} from "@/components/fixlens/ui-bits";
import { useDemoStore } from "@/lib/demo-store";
import { PROPOSAL_STATUSES, type Proposal, type ProposalStatus } from "@/lib/demo-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/improvements")({
  head: () =>
    pageHead(
      "Proposal Review",
      "Review student campus improvement proposals and set their status.",
    ),
  component: Review,
});

function Review() {
  const { proposals } = useDemoStore();
  return (
    <>
      <PageHeader
        title="Proposal review"
        description="Sorted by student support. Support shows interest; you decide the outcome."
      />
      <div className="space-y-4">
        {[...proposals]
          .sort((a, b) => b.support - a.support)
          .map((p) => (
            <ReviewCard key={p.id} p={p} />
          ))}
      </div>
    </>
  );
}

function ReviewCard({ p }: { p: Proposal }) {
  const { reviewProposal } = useDemoStore();
  const [status, setStatus] = useState<ProposalStatus>(p.status);
  const [note, setNote] = useState("");
  return (
    <Panel
      title={
        <span className="flex flex-wrap items-center gap-2">
          {p.title} <StatusBadge status={p.status} />
        </span>
      }
    >
      <p className="text-sm text-muted-foreground">{p.description}</p>
      <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <ThumbsUp className="size-3.5" /> {p.support} supporters · {p.category} · {p.location} ·{" "}
        {p.author} · {formatDate(p.date)}
      </p>
      {p.adminNote && (
        <p className="mt-2 text-sm text-foreground">
          <strong>Admin note:</strong> {p.adminNote}
        </p>
      )}
      <form
        className="mt-4 grid gap-2 sm:grid-cols-[160px_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          reviewProposal(p.id, status, note);
          setNote("");
          toast.success("Proposal updated (demo).");
        }}
      >
        <select
          aria-label="Status"
          className={selectCls}
          value={status}
          onChange={(e) => setStatus(e.target.value as ProposalStatus)}
        >
          {PROPOSAL_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Input
          aria-label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note for students"
        />
        <Button type="submit">Update</Button>
      </form>
    </Panel>
  );
}
