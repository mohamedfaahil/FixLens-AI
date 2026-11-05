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
  Camera,
  UploadCloud,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { CameraCaptureModal } from "@/components/fixlens/CameraCaptureModal";
import { compressImage, formatFileSize } from "@/lib/image-utils";
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
import { BuildingCombobox } from "@/components/fixlens/BuildingCombobox";
import { useDemoStore } from "@/lib/demo-store";
import { findPotentialDuplicates } from "@/lib/triage-engine";
import { getAdminAuthState } from "@/lib/supabase-auth";
import {
  BUILDINGS,
  CATEGORIES,
  PRIORITIES,
  demoPredictPriority,
  type Category,
  type Complaint,
  type Priority,
} from "@/lib/demo-data";
import { predictComplaintPriority, warmupMLService, type MLPredictionResult } from "@/lib/ml-api";
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
  const { addComplaint, addFollowUp, complaints, currentStudent, reportDraft, setReportDraft, isSupabaseConnected } =
    useDemoStore();
  const [f, setF] = useState(() => reportDraft || empty);
  const [img, setImg] = useState<string | undefined>(() => reportDraft?.image);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(() => reportDraft?.imageFile);
  const [fileMetadata, setFileMetadata] = useState<{ name: string; size: number } | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSeparateIncidentConfirmed, setIsSeparateIncidentConfirmed] = useState(false);

  // Sync draft if updated by Copilot action
  useEffect(() => {
    if (reportDraft) {
      setF(reportDraft);
      if (reportDraft.image) setImg(reportDraft.image);
      if (reportDraft.imageFile) setSelectedFile(reportDraft.imageFile);
    }
  }, [reportDraft]);
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
  const [submissionError, setSubmissionError] = useState<string | null>(null);
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

  // Warm up Render backend ML service early in the background while student fills out form
  useEffect(() => {
    warmupMLService();
  }, []);

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

  const isSameStudent = (complaintReporter: string, reporterId?: string) => {
    if (reporterId && currentStudent.id) return reporterId === currentStudent.id;
    return complaintReporter.toLowerCase().trim() === currentStudent.name.toLowerCase().trim();
  };

  // Same student repeat detection: active complaint previously reported by this student
  const sameStudentActiveRepeat = useMemo(() => {
    return duplicates.find((d) => isSameStudent(d.complaint.reporter, d.complaint.reporterId));
  }, [duplicates, currentStudent.name, currentStudent.id]);

  // Other students' duplicate reports
  const otherStudentDuplicates = useMemo(() => {
    return duplicates.filter((d) => !isSameStudent(d.complaint.reporter, d.complaint.reporterId));
  }, [duplicates, currentStudent.name, currentStudent.id]);

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
        isSameStudent(d.complaint.reporter, d.complaint.reporterId),
    );
  }, [
    f.title,
    f.description,
    f.category,
    f.building,
    f.room,
    complaints,
    currentStudent.name,
    currentStudent.id,
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return setErr({ ...err, image: "Please choose an image file (PNG, JPG, or WEBP)." });
    }
    if (file.size > 15 * 1024 * 1024) {
      return setErr({ ...err, image: "Image must be under 15 MB." });
    }
    setErr({ ...err, image: "" });
    setIsCompressing(true);
    try {
      const result = await compressImage(file, 1280, 0.78);
      setImg(result.dataUrl);
      setSelectedFile(result.file);
      setFileMetadata({ name: file.name, size: result.sizeBytes });
      setReportDraft({ ...f, image: result.dataUrl, imageFile: result.file });
      toast.success("Photo selected and optimized.");
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setImg(dataUrl);
        setSelectedFile(file);
        setFileMetadata({ name: file.name, size: file.size });
        setReportDraft({ ...f, image: dataUrl, imageFile: file });
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
      e.target.value = "";
    }
  };

  const handleCameraCapture = (file: File, dataUrl: string) => {
    setErr({ ...err, image: "" });
    setImg(dataUrl);
    setSelectedFile(file);
    setFileMetadata({ name: file.name || "camera_capture.jpg", size: file.size });
    setReportDraft({ ...f, image: dataUrl, imageFile: file });
    setIsCameraOpen(false);
    toast.success("Photo captured and attached.");
  };

  const handleRemoveImage = () => {
    setImg(undefined);
    setSelectedFile(undefined);
    setFileMetadata(null);
    setErr({ ...err, image: "" });
    setReportDraft({ ...f, image: undefined, imageFile: undefined });
    toast.info("Photo removed.");
  };

  const onFile = handleFileUpload;

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
    setSubmissionError(null);
    try {
      // Reject administrator accounts from submitting student complaints
      const adminAuth = await getAdminAuthState();
      if (adminAuth.isAuthenticated) {
        throw new Error(
          "Access denied: Administrator accounts cannot submit student complaints. Please sign in with a student account.",
        );
      }

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

      // Await persistence confirmation before advancing to success screen
      const c = await addComplaint(
        {
          title: f.title.trim(),
          description: f.description.trim(),
          category: f.category as Category,
          building: f.building,
          room: f.room.trim(),
          urgency: f.urgency, // Student reported urgency preserved separately
          affected: n,
          priority: finalPred.priority, // Suggested by trained ML model
          image: img || undefined,
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
        },
        img ? selectedFile : undefined,
      );

      // Only clear draft and display success once database insert has succeeded
      setReportDraft(null);
      setImg(undefined);
      setSelectedFile(undefined);
      setFileMetadata(null);
      setIsSeparateIncidentConfirmed(false);
      setDone(c);
      toast.success("Complaint submitted successfully.");
    } catch (submissionErr: unknown) {
      // Database or persistence failure: do not clear form or draft; keep student data intact for retry
      const errorMsg =
        submissionErr instanceof Error
          ? submissionErr.message
          : "Failed to submit complaint to the server. Please try again.";
      setSubmissionError(errorMsg);
      toast.error(errorMsg);
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
            {isSupabaseConnected ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-50/50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
                Complaint persisted to Supabase database. You can track its status and follow-ups in your complaints list.
              </div>
            ) : (
              <DemoNotice>
                Complaint saved in active session memory. You can track its status in your dashboard.
              </DemoNotice>
            )}
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
                setSubmissionError(null);
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
                <BuildingCombobox
                  id="b"
                  value={f.building}
                  onChange={(bldg) => {
                    const next = { ...f, building: bldg };
                    setF(next);
                    setReportDraft(next);
                    if (err.building) {
                      setErr((prev) => ({ ...prev, building: undefined }));
                    }
                  }}
                  hasError={!!err.building}
                />
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
              <legend className="mb-2 text-sm font-semibold text-foreground">Urgency (Student Reported)</legend>
              <div className="grid grid-cols-3 gap-2.5">
                {PRIORITIES.map((p) => (
                  <label
                    key={p}
                    className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-semibold transition-all duration-150 active:scale-95 ${
                      f.urgency === p
                        ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/20 font-bold"
                        : "text-muted-foreground bg-card/60 hover:border-primary/40 hover:text-foreground"
                    }`}
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
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Photo Evidence (Optional)</p>
                {img && (
                  <span className="text-xs text-muted-foreground">
                    1 photo attached &bull; Only posted if attached
                  </span>
                )}
              </div>

              {img ? (
                /* Attached Photo Preview Card */
                <div
                  data-testid="attached-photo-preview"
                  className="relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/[0.03] p-4 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="relative shrink-0 overflow-hidden rounded-xl border border-border bg-black/10">
                      <img
                        src={img}
                        alt="Issue attachment"
                        className="h-28 w-36 object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                        <p className="text-sm font-semibold text-foreground truncate">
                          {fileMetadata?.name || "campus_photo.jpg"}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">
                          {fileMetadata?.size ? formatFileSize(fileMetadata.size) : "Optimized"}
                        </span>
                        <span>Client-compressed JPEG &bull; Ready to submit</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This photo will be attached to your complaint and visible to campus administrators.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCameraOpen(true)}
                        className="gap-1.5 text-xs"
                      >
                        <RefreshCw className="size-3.5" />
                        Retake
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleRemoveImage}
                        aria-label="Remove photo"
                        className="gap-1.5 text-xs"
                      >
                        <Trash2 className="size-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Dual Option Grid: Direct Camera & File Upload */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Direct Camera */}
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-card/50 p-6 text-center transition-all duration-200 hover:border-primary hover:bg-primary/[0.03] hover:shadow-sm"
                  >
                    <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                      <Camera className="size-6" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Take Photo (Camera)</span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      Capture live photo using device webcam or phone camera
                    </span>
                    <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                      Open Camera &rarr;
                    </span>
                  </button>

                  {/* Option 2: Upload from Device */}
                  <label className="group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-card/50 p-6 text-center transition-all duration-200 hover:border-primary hover:bg-primary/[0.03] hover:shadow-sm">
                    <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground transition-transform duration-200 group-hover:scale-110 group-hover:text-primary group-hover:bg-primary/10">
                      <UploadCloud className="size-6" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Upload from Device</span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      Browse gallery or files (PNG, JPG, WEBP up to 15 MB)
                    </span>
                    <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                      Browse Files &rarr;
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={isCompressing}
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              )}

              {isCompressing && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  <span>Optimizing photo resolution and compressing size...</span>
                </div>
              )}

              <FieldError msg={err.image} />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Photo will only be posted if attached above. Photos are optimized client-side for rapid administrative triage.
              </p>

              {/* Direct Camera Modal */}
              <CameraCaptureModal
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onCapture={handleCameraCapture}
              />
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

            {/* Failure state notice preserving user form data */}
            {submissionError && (
              <div
                role="alert"
                data-testid="submission-error-alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-destructive">Submission Failed</h4>
                    <p className="mt-1 text-xs text-destructive/90">{submissionError}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Your entered complaint details have been preserved. Please verify your connection and try submitting again.
                    </p>
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
                  setSubmissionError(null);
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
            urgency={f.urgency}
            isEmpty={f.description.trim().length === 0}
          />
          <Panel title="How priority is predicted">
            <MethodExplainer />
          </Panel>
        </div>
      </div>
    </>
  );
}
