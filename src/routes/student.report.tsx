import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  ImagePlus,
  X,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  AlertCircle,
  MessageSquarePlus,
  CheckSquare,
  Square,
  CornerDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DemoNotice,
  FieldError,
  PageHeader,
  Panel,
  StatusBadge,
  selectCls,
} from "@/components/fixlens/ui-bits";
import { MethodExplainer, PredictionCard } from "@/components/fixlens/PriorityPanel";
import { useDemoStore } from "@/lib/demo-store";
import { findPotentialDuplicates } from "@/lib/triage-engine";
import {
  BUILDINGS,
  CATEGORIES,
  PRIORITIES,
  demoPredictPriority,
  type Category,
  type Complaint,
  type Priority,
} from "@/lib/demo-data";
import { predictComplaintPriority, type MLPredictionResult } from "@/lib/ml-api";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/student/report")({
  head: () =>
    pageHead(
      "Report a Complaint",
      "Submit a campus maintenance complaint with category, location, urgency and photo.",
    ),
  component: Report,
});

const empty = {
  title: "",
  description: "",
  category: "",
  building: "",
  room: "",
  urgency: "Medium" as Priority,
  affected: "1",
};

function Report() {
  const navigate = useNavigate();
  const { addComplaint, addFollowUp, complaints, currentStudent, reportDraft, setReportDraft } =
    useDemoStore();
  const [f, setF] = useState(() => reportDraft || empty);
  const [img, setImg] = useState<string | undefined>(() => reportDraft?.image);
  const [isSeparateIncidentConfirmed, setIsSeparateIncidentConfirmed] = useState(false);
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
  const [done, setDone] = useState<Complaint | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  const [prediction, setPrediction] = useState<MLPredictionResult>(() => {
    const init = demoPredictPriority({
      description: "",
      category: "",
      urgency: "Medium",
      affected: 1,
    });
    return {
      priority: init.priority,
      signals: ["Provide issue description to view predicted priority"],
      source: "Demo Heuristic (Form incomplete)",
      isTrainedModel: false,
    };
  });

  const set =
    (k: keyof typeof empty) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const next = { ...f, [k]: e.target.value };
      setF(next);
      setReportDraft(next);
    };

  // Debounced real-time priority prediction from Python ML API or fallback
  useEffect(() => {
    const desc = f.description.trim();
    if (desc.length < 5) {
      const fallback = demoPredictPriority({
        description: f.description,
        category: f.category,
        urgency: f.urgency,
        affected: Number(f.affected) || 1,
      });
      setPrediction({
        priority: fallback.priority,
        signals: desc.length > 0 ? fallback.signals : ["Provide issue description to view predicted priority"],
        source: "Demo Heuristic (Form incomplete)",
        isTrainedModel: false,
      });
      return;
    }

    setIsLoadingPrediction(true);
    const timer = setTimeout(async () => {
      try {
        const res = await predictComplaintPriority({
          description: f.description,
          category: f.category,
          urgency: f.urgency,
          affected: Number(f.affected) || 1,
        });
        setPrediction(res);
      } catch {
        const fallback = demoPredictPriority({
          description: f.description,
          category: f.category,
          urgency: f.urgency,
          affected: Number(f.affected) || 1,
        });
        setPrediction({
          priority: fallback.priority,
          signals: fallback.signals,
          source: "Demo Heuristic (API Offline)",
          isTrainedModel: false,
        });
      } finally {
        setIsLoadingPrediction(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [f.description, f.category, f.urgency, f.affected]);

  // Real-time duplicate detection matching category, building, room and description
  const duplicates = useMemo(() => {
    return findPotentialDuplicates(
      {
        title: f.title,
        description: f.description,
        category: f.category,
        building: f.building,
        room: f.room,
      },
      complaints,
      { threshold: 0.5, activeOnly: true, maxResults: 3 },
    );
  }, [f.title, f.description, f.category, f.building, f.room, complaints]);

  // Same student repeat detection: active complaint previously reported by this student
  const sameStudentActiveRepeat = useMemo(() => {
    return duplicates.find(
      (d) =>
        d.complaint.reporter.toLowerCase().trim() ===
        currentStudent.name.toLowerCase().trim(),
    );
  }, [duplicates, currentStudent.name]);

  // Other students' duplicate reports
  const otherStudentDuplicates = useMemo(() => {
    return duplicates.filter(
      (d) =>
        d.complaint.reporter.toLowerCase().trim() !==
        currentStudent.name.toLowerCase().trim(),
    );
  }, [duplicates, currentStudent.name]);

  // Check if an earlier complaint by the same student was resolved
  const resolvedSameStudentRepeat = useMemo(() => {
    if (sameStudentActiveRepeat) return undefined;
    const resolvedMatches = findPotentialDuplicates(
      {
        title: f.title,
        description: f.description,
        category: f.category,
        building: f.building,
        room: f.room,
      },
      complaints,
      { threshold: 0.5, activeOnly: false, maxResults: 3 },
    );
    return resolvedMatches.find(
      (d) =>
        d.complaint.status === "Resolved" &&
        d.complaint.reporter.toLowerCase().trim() ===
          currentStudent.name.toLowerCase().trim(),
    );
  }, [
    f.title,
    f.description,
    f.category,
    f.building,
    f.room,
    complaints,
    currentStudent.name,
    sameStudentActiveRepeat,
  ]);

  const handleAddFollowUp = () => {
    if (!sameStudentActiveRepeat) return;
    const note = f.description.trim() || f.title.trim();
    if (note.length < 5) {
      setErr({ description: "Please enter your follow-up message (at least 5 characters)." });
      return;
    }
    const updated = addFollowUp(sameStudentActiveRepeat.complaint.id, note);
    if (updated) {
      toast.success(
        `Follow-up added to your existing complaint ${sameStudentActiveRepeat.complaint.id}.`,
      );
      setReportDraft(null);
      setF(empty);
      setImg(undefined);
      navigate({
        to: "/student/complaints/$id",
        params: { id: sameStudentActiveRepeat.complaint.id },
        search: { from: "report" },
      });
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return setErr({ ...err, image: "Please choose an image file." });
    if (file.size > 5 * 1024 * 1024) return setErr({ ...err, image: "Image must be under 5 MB." });
    setErr({ ...err, image: "" });
    const url = URL.createObjectURL(file);
    setImg(url);
    setReportDraft({ ...f, image: url });
  };

  const submit = async (e: React.FormEvent) => {
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
    if (f.title.trim().length < 5) er.title = "Title should be at least 5 characters.";
    if (f.description.trim().length < 20)
      er.description = "Please describe the issue in at least 20 characters.";
    if (!f.category) er.category = "Choose a category.";
    if (!f.building) er.building = "Choose a building.";
    if (!f.room.trim()) er.room = "Enter the room or exact location.";
    const n = Number(f.affected);
    if (!Number.isInteger(n) || n < 1 || n > 5000)
      er.affected = "Enter a number between 1 and 5000.";
    setErr(er);
    if (Object.keys(er).length) return;

    if (sameStudentActiveRepeat && !isSeparateIncidentConfirmed) {
      setErr({
        description:
          "You've already reported this issue. Please add a follow-up above, or check 'This is a separate incident' to proceed with a new complaint.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Obtain latest prediction from API (or fallback)
      let finalPred = prediction;
      if (!finalPred.isTrainedModel || isLoadingPrediction) {
        finalPred = await predictComplaintPriority({
          description: f.description.trim(),
          category: f.category,
          urgency: f.urgency,
          affected: n,
        });
        setPrediction(finalPred);
      }

      const c = addComplaint({
        title: f.title.trim(),
        description: f.description.trim(),
        category: f.category as Category,
        building: f.building,
        room: f.room.trim(),
        urgency: f.urgency, // Student reported urgency preserved separately
        affected: n,
        priority: finalPred.priority, // Suggested by trained ML model
        image: img,
        linkedComplaintId: resolvedSameStudentRepeat
          ? resolvedSameStudentRepeat.complaint.id
          : undefined,
        // Persist ML prediction metadata in the complaint record
        predictedPriority: finalPred.priority,
        confidence: finalPred.confidence,
        classProbabilities: finalPred.classProbabilities,
        predictionSource: finalPred.source,
        isTrainedModel: finalPred.isTrainedModel,
        signals: finalPred.signals,
      });
      setReportDraft(null);
      setIsSeparateIncidentConfirmed(false);
      setDone(c);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done)
    return (
      <div className="mx-auto max-w-xl">
        <Panel>
          <div className="text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <h1 className="mt-3 text-2xl font-extrabold text-foreground">Complaint submitted</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reference <span className="font-mono font-semibold text-primary">{done.id}</span> has
              been recorded.
            </p>
          </div>
          <div className="mt-5">
            <DemoNotice>
              Complaint saved in active session memory. You can track its status in your dashboard.
            </DemoNotice>
          </div>
          <div className="mt-5">
            <PredictionCard
              priority={done.predictedPriority ?? done.priority}
              signals={done.signals ?? []}
              source={done.predictionSource}
              confidence={done.confidence}
              classProbabilities={done.classProbabilities}
              isTrainedModel={done.isTrainedModel}
              error={done.isTrainedModel ? null : prediction.error}
            />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/student/complaints/$id" params={{ id: done.id }}>
                View complaint
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDone(null);
                setF(empty);
                setImg(undefined);
                setReportDraft(null);
              }}
            >
              Report another
            </Button>
          </div>
        </Panel>
      </div>
    );

  return (
    <>
      <PageHeader
        title="Report a complaint"
        description="Give clear details so the maintenance team can act quickly."
      />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel>
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div>
              <Label htmlFor="t" className="mb-1.5 block">
                Title
              </Label>
              <Input
                id="t"
                value={f.title}
                onChange={set("title")}
                placeholder="e.g. Weak Wi-Fi in Lab 3"
                aria-invalid={!!err.title}
              />
              <FieldError msg={err.title} />
            </div>
            <div>
              <Label htmlFor="d" className="mb-1.5 block">
                Detailed description
              </Label>
              <Textarea
                id="d"
                rows={5}
                value={f.description}
                onChange={set("description")}
                placeholder="What is wrong, since when, and how it affects you."
                aria-invalid={!!err.description}
              />
              <div className="flex justify-between">
                <FieldError msg={err.description} />
                <span className="ml-auto mt-1 text-xs text-muted-foreground">
                  {f.description.length} characters
                </span>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="c" className="mb-1.5 block">
                  Category
                </Label>
                <select id="c" className={selectCls} value={f.category} onChange={set("category")}>
                  <option value="">Select…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <FieldError msg={err.category} />
              </div>
              <div>
                <Label htmlFor="b" className="mb-1.5 block">
                  Building
                </Label>
                <select id="b" className={selectCls} value={f.building} onChange={set("building")}>
                  <option value="">Select…</option>
                  {BUILDINGS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <FieldError msg={err.building} />
              </div>
              <div>
                <Label htmlFor="r" className="mb-1.5 block">
                  Room / location
                </Label>
                <Input
                  id="r"
                  value={f.room}
                  onChange={set("room")}
                  placeholder="e.g. Room 204, 2nd floor"
                  aria-invalid={!!err.room}
                />
                <FieldError msg={err.room} />
              </div>
              <div>
                <Label htmlFor="a" className="mb-1.5 block">
                  People affected
                </Label>
                <Input
                  id="a"
                  type="number"
                  min={1}
                  value={f.affected}
                  onChange={set("affected")}
                  aria-invalid={!!err.affected}
                />
                <FieldError msg={err.affected} />
              </div>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-foreground">Urgency (Student Reported)</legend>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITIES.map((p) => (
                  <label
                    key={p}
                    className={`cursor-pointer rounded-lg border p-2.5 text-center text-sm font-semibold transition-colors ${f.urgency === p ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-primary/50"}`}
                  >
                    <input
                      type="radio"
                      name="urgency"
                      value={p}
                      checked={f.urgency === p}
                      onChange={set("urgency")}
                      className="sr-only"
                    />
                    {p}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">Photo (optional)</p>
              {img ? (
                <div className="relative inline-block">
                  <img
                    src={img}
                    alt="Attachment preview"
                    className="h-40 rounded-lg border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImg(undefined)}
                    aria-label="Remove image"
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-card shadow-card"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed bg-muted/30 py-6 text-sm text-muted-foreground hover:border-primary">
                  <ImagePlus className="size-6" />
                  <span className="mt-1">Click to attach an image (max 5 MB)</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={onFile} />
                </label>
              )}
              <FieldError msg={err.image} />
              <p className="mt-1 text-xs text-muted-foreground">
                Preview only — the image is stored in memory for this session.
              </p>
            </div>

            {/* Same student active repeat submission warning */}
            {sameStudentActiveRepeat && (
              <div
                data-testid="same-student-repeat-warning"
                className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <h4 className="font-semibold text-foreground">
                        You've already reported this issue
                      </h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        You already have an active complaint for this issue at this location. Rather than
                        submitting duplicate tickets, you can add your update as a follow-up note to the existing complaint.
                      </p>
                    </div>

                    <div className="rounded-md border bg-card p-3 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {sameStudentActiveRepeat.complaint.id}
                          </span>
                          <StatusBadge status={sameStudentActiveRepeat.complaint.status} />
                          <span className="text-xs text-muted-foreground">
                            {Math.round(sameStudentActiveRepeat.similarity * 100)}% match
                          </span>
                        </div>
                        <Link
                          to="/student/complaints/$id"
                          params={{ id: sameStudentActiveRepeat.complaint.id }}
                          search={{ from: "report" }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          View existing complaint &rarr;
                        </Link>
                      </div>
                      <p className="mt-1 text-xs font-medium text-foreground line-clamp-1">
                        {sameStudentActiveRepeat.complaint.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {sameStudentActiveRepeat.complaint.description}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {sameStudentActiveRepeat.complaint.building}
                        </span>
                        {sameStudentActiveRepeat.complaint.room
                          ? `, ${sameStudentActiveRepeat.complaint.room}`
                          : ""}{" "}
                        &middot; Reported {sameStudentActiveRepeat.complaint.date}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={handleAddFollowUp}
                        className="inline-flex items-center gap-1.5"
                      >
                        <MessageSquarePlus className="size-4" />
                        Add as Follow-up to Complaint
                      </Button>
                      <span className="text-[11px] text-muted-foreground">
                        Appends your current details to #{sameStudentActiveRepeat.complaint.id}
                      </span>
                    </div>

                    <div className="border-t border-amber-500/20 pt-2">
                      <label className="flex items-start gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        <input
                          type="checkbox"
                          id="separate-incident-toggle"
                          checked={isSeparateIncidentConfirmed}
                          onChange={(e) => setIsSeparateIncidentConfirmed(e.target.checked)}
                          className="mt-0.5 rounded border-muted-foreground"
                        />
                        <span>
                          <strong>Report a Separate Incident:</strong> Check this box if this is genuinely a
                          different occurrence or new incident at this location.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Resolved issue recurrence notice */}
            {resolvedSameStudentRepeat && (
              <div
                data-testid="resolved-repeat-notice"
                className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-4 text-sm"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <h4 className="font-semibold text-foreground">
                        Previous issue was resolved
                      </h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        You previously reported a similar issue ({resolvedSameStudentRepeat.complaint.id}) which was
                        marked as <strong>Resolved</strong>. Submitting this form will create a new complaint
                        linked to your earlier ticket for recurrence tracking.
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Earlier report: #{resolvedSameStudentRepeat.complaint.id} &middot; {resolvedSameStudentRepeat.complaint.date}
                      </span>
                      <Link
                        to="/student/complaints/$id"
                        params={{ id: resolvedSameStudentRepeat.complaint.id }}
                        search={{ from: "report" }}
                        className="font-medium text-primary hover:underline"
                      >
                        View resolved complaint &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other student duplicates warning */}
            {otherStudentDuplicates.length > 0 && (
              <div
                data-testid="duplicate-warning"
                className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <h4 className="font-semibold text-foreground">
                        Similar active complaint already reported by another student
                      </h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        A similar issue was found for this location reported by another campus student.
                        You can view it below, or continue submitting your own report. Independent reports
                        from multiple students help confirm scope and severity.
                      </p>
                    </div>
                    <ul className="space-y-2 pt-1">
                      {otherStudentDuplicates.map(({ complaint, similarity }) => (
                        <li
                          key={complaint.id}
                          className="rounded-md border bg-card p-3 shadow-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-primary">
                                {complaint.id}
                              </span>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                {complaint.status}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {Math.round(similarity * 100)}% match
                              </span>
                            </div>
                            <Link
                              to="/student/complaints/$id"
                              params={{ id: complaint.id }}
                              search={{ from: "report" }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              View existing complaint &rarr;
                            </Link>
                          </div>
                          <p className="mt-1 font-medium text-xs text-foreground line-clamp-1">
                            {complaint.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {complaint.description}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">{complaint.building}</span>
                            {complaint.room ? `, ${complaint.room}` : ""} &middot; Reported{" "}
                            {complaint.date}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => {
                  setF(empty);
                  setImg(undefined);
                  setErr({});
                  setReportDraft(null);
                }}
              >
                Clear
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isSubmitting ? "Predicting & Submitting…" : "Submit complaint"}
              </Button>
            </div>
          </form>
        </Panel>
        <div className="space-y-5">
          <PredictionCard
            priority={prediction.priority}
            signals={f.description.length >= 3 || f.category ? prediction.signals : []}
            source={prediction.source}
            confidence={prediction.confidence}
            classProbabilities={prediction.classProbabilities}
            isLoading={isLoadingPrediction}
            isTrainedModel={prediction.isTrainedModel}
            error={prediction.error}
          />
          <Panel title="How priority is predicted">
            <MethodExplainer />
          </Panel>
        </div>
      </div>
    </>
  );
}
