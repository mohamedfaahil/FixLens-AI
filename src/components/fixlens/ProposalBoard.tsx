import { useMemo, useState } from "react";
import { ChevronUp, MapPin, Plus, Search, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDemoStore } from "@/lib/demo-store";
import {
  BUILDINGS,
  CATEGORIES,
  PROPOSAL_STATUSES,
  type Category,
  type Proposal,
} from "@/lib/demo-data";
import { DemoNotice, EmptyState, FieldError, StatusBadge, formatDate, selectCls } from "./ui-bits";
import { cn } from "@/lib/utils";

export function VoteButton({ p }: { p: Proposal }) {
  const { vote, votedIds } = useDemoStore();
  const voted = votedIds.includes(p.id);
  const closed = p.status === "Rejected" || p.status === "Completed";
  return (
    <button
      disabled={voted || closed}
      onClick={(e) => {
        e.stopPropagation();
        if (vote(p.id)) toast.success("Support recorded locally for this demo session.");
      }}
      aria-label={voted ? "You supported this proposal" : "Support this proposal"}
      className={cn(
        "flex w-14 shrink-0 flex-col items-center rounded-lg border py-1.5 text-sm font-bold transition-colors",
        voted
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-foreground hover:border-primary hover:text-primary",
        closed && !voted && "cursor-not-allowed opacity-50",
      )}
    >
      {voted ? <Check className="size-4" /> : <ChevronUp className="size-4" />}
      {p.support}
    </button>
  );
}

export function ProposalBoard() {
  const { proposals, addProposal } = useDemoStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [loc, setLoc] = useState("");
  const [st, setSt] = useState("");
  const [open, setOpen] = useState<Proposal | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useMemo(
    () =>
      proposals
        .filter(
          (p) =>
            (!q || `${p.title} ${p.description}`.toLowerCase().includes(q.toLowerCase())) &&
            (!cat || p.category === cat) &&
            (!loc || p.location === loc) &&
            (!st || p.status === st),
        )
        .sort((a, b) => b.support - a.support),
    [proposals, q, cat, loc, st],
  );
  const live = open ? (proposals.find((p) => p.id === open.id) ?? open) : null;

  return (
    <div className="space-y-5">
      <DemoNotice>
        Votes are stored only in this browser tab. Support shows interest — it does not
        automatically approve a proposal.
      </DemoNotice>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_160px_160px_150px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search proposals"
            className="bg-card pl-9"
            aria-label="Search proposals"
          />
        </div>
        <select
          className={selectCls}
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          aria-label="Category"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          className={selectCls}
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          aria-label="Location"
        >
          <option value="">All locations</option>
          {BUILDINGS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          className={selectCls}
          value={st}
          onChange={(e) => setSt(e.target.value)}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {PROPOSAL_STATUSES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Button onClick={() => setCreating(true)}>
          <Plus /> Create Proposal
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No proposals found"
          description="Adjust filters or create the first proposal."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((p) => (
            <article
              key={p.id}
              onClick={() => setOpen(p)}
              className="surface flex cursor-pointer gap-4 p-5 transition-shadow hover:shadow-float"
            >
              <VoteButton p={p} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={p.status} />
                  <span className="text-xs text-muted-foreground">{p.category}</span>
                </div>
                <h3 className="mt-2 font-bold text-foreground">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {p.location} · {formatDate(p.date)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={!!live} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          {live && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-primary">{live.id}</span>
                  <StatusBadge status={live.status} />
                </div>
                <DialogTitle className="text-xl">{live.title}</DialogTitle>
                <DialogDescription>
                  {live.category} · {live.location} · proposed by {live.author} on{" "}
                  {formatDate(live.date)}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-foreground">{live.description}</p>
              {live.adminNote && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">Administrator note</p>
                  <p className="text-foreground">{live.adminNote}</p>
                </div>
              )}
              <div className="flex items-center gap-3">
                <VoteButton p={live} />
                <p className="text-xs text-muted-foreground">
                  One vote per proposal in this demo session.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CreateProposal
        open={creating}
        onOpenChange={setCreating}
        onCreate={(v) => {
          const p = addProposal(v);
          toast.success(`Demo proposal ${p.id} added locally — not saved to a server.`);
          setCreating(false);
        }}
      />
    </div>
  );
}

function CreateProposal({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (v: {
    title: string;
    description: string;
    category: Category;
    location: string;
  }) => void;
}) {
  const [f, setF] = useState({
    title: "",
    description: "",
    category: "" as Category | "",
    location: "",
  });
  const [err, setErr] = useState<
    Partial<
      Record<
        | "name"
        | "email"
        | "password"
        | "confirm"
        | "title"
        | "description"
        | "category"
        | "location"
        | "room"
        | "affected"
        | "image"
        | "block"
        | "floor"
        | "id"
        | "studentId"
        | "department"
        | "priority"
        | "phone"
        | "building",
        string
      >
    >
  >({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Partial<
      Record<
        | "name"
        | "email"
        | "password"
        | "confirm"
        | "title"
        | "description"
        | "category"
        | "location"
        | "room"
        | "affected"
        | "image"
        | "block"
        | "floor"
        | "id"
        | "studentId"
        | "department"
        | "priority"
        | "phone"
        | "building",
        string
      >
    > = {};
    if (f.title.trim().length < 8) er.title = "Title should be at least 8 characters.";
    if (f.description.trim().length < 20)
      er.description = "Describe the proposal in at least 20 characters.";
    if (!f.category) er.category = "Choose a category.";
    if (!f.location) er.location = "Choose a location.";
    setErr(er);
    if (Object.keys(er).length) return;
    onCreate({ ...f, category: f.category as Category });
    setF({ title: "", description: "", category: "", location: "" });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create improvement proposal</DialogTitle>
          <DialogDescription>
            Suggest an upgrade for campus facilities. Demo only — stored in this tab.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="pt" className="mb-1.5 block">
              Title
            </Label>
            <Input
              id="pt"
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              aria-invalid={!!err.title}
            />
            <FieldError msg={err.title} />
          </div>
          <div>
            <Label htmlFor="pd" className="mb-1.5 block">
              Description
            </Label>
            <Textarea
              id="pd"
              rows={4}
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              aria-invalid={!!err.description}
            />
            <FieldError msg={err.description} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pc" className="mb-1.5 block">
                Category
              </Label>
              <select
                id="pc"
                className={selectCls}
                value={f.category}
                onChange={(e) => setF({ ...f, category: e.target.value as Category })}
              >
                <option value="">Select…</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <FieldError msg={err.category} />
            </div>
            <div>
              <Label htmlFor="pl" className="mb-1.5 block">
                Location
              </Label>
              <select
                id="pl"
                className={selectCls}
                value={f.location}
                onChange={(e) => setF({ ...f, location: e.target.value })}
              >
                <option value="">Select…</option>
                {BUILDINGS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <FieldError msg={err.location} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit proposal</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
