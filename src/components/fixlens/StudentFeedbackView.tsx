import { useState, useMemo } from "react";
import {
  Star,
  MessageSquarePlus,
  ThumbsUp,
  Building2,
  Tag,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  User,
  ShieldCheck,
  Sparkles,
  HeartHandshake,
  MessageCircle,
} from "lucide-react";
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
import { BUILDINGS } from "@/lib/demo-data";
import {
  useStudentFeedback,
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  type StudentFeedback,
} from "@/lib/feedback-store";
import { selectCls, EmptyState } from "./ui-bits";
import { cn } from "@/lib/utils";

const RATING_LABELS: Record<number, string> = {
  1: "Poor — Needs urgent improvement",
  2: "Fair — Below expectations",
  3: "Good — Acceptable quality",
  4: "Very Good — Prompt and helpful",
  5: "Excellent — Outstanding campus experience",
};

export function StudentFeedbackView() {
  const { currentStudent } = useDemoStore();
  const { feedbacks, votedIds, addFeedback, voteHelpful, stats } = useStudentFeedback();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedRating, setSelectedRating] = useState<number>(0);

  // Form State
  const [formRating, setFormRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [formCategory, setFormCategory] = useState<FeedbackCategory>(FEEDBACK_CATEGORIES[0]);
  const [formBuilding, setFormBuilding] = useState<string>(BUILDINGS[0]);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<{ title?: string; content?: string }>({});

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((item) => {
      const matchSearch =
        search.trim() === "" ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.content.toLowerCase().includes(search.toLowerCase()) ||
        item.building.toLowerCase().includes(search.toLowerCase()) ||
        item.authorName.toLowerCase().includes(search.toLowerCase());

      const matchCategory =
        selectedCategory === "ALL" || item.category === selectedCategory;

      const matchRating =
        selectedRating === 0 || item.rating === selectedRating;

      return matchSearch && matchCategory && matchRating;
    });
  }, [feedbacks, search, selectedCategory, selectedRating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { title?: string; content?: string } = {};

    if (!formTitle.trim()) {
      errors.title = "Please enter a short subject or title.";
    }
    if (!formContent.trim()) {
      errors.content = "Please describe your feedback or suggestion in detail.";
    } else if (formContent.trim().length < 15) {
      errors.content = "Please write at least 15 characters to provide helpful detail.";
    }

    if (Object.keys(errors).length > 0) {
      setFormError(errors);
      return;
    }

    setSubmitting(true);
    try {
      addFeedback({
        title: formTitle,
        content: formContent,
        category: formCategory,
        rating: formRating,
        building: formBuilding,
        authorName: currentStudent?.name || "Student",
        authorDepartment: currentStudent?.department || "Campus",
        isAnonymous,
      });

      toast.success("Thank you! Your feedback has been posted and submitted for review.");
      setDialogOpen(false);
      // Reset form
      setFormTitle("");
      setFormContent("");
      setFormRating(5);
      setIsAnonymous(false);
      setFormError({});
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = (id: string) => {
    if (voteHelpful(id)) {
      toast.success("Marked as helpful.");
    } else {
      toast.info("You have already voted on this feedback.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Hero / Experience Metrics Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Average Satisfaction */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Campus Satisfaction
            </span>
            <div className="grid size-8 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
              <Star className="size-4 fill-amber-500" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">{stats.averageRating}</span>
            <span className="text-sm font-semibold text-muted-foreground">/ 5.0</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-amber-500">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={cn(
                  "size-3.5",
                  s <= Math.round(stats.averageRating)
                    ? "fill-amber-500 text-amber-500"
                    : "text-muted-foreground/30",
                )}
              />
            ))}
            <span className="ml-1 font-medium text-muted-foreground">
              ({stats.totalCount} ratings)
            </span>
          </div>
        </div>

        {/* Metric 2: Positive Sentiment */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Positive Sentiment
            </span>
            <div className="grid size-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <HeartHandshake className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-500">{stats.positivePercent}%</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Rated 4 or 5 stars by campus residents
          </p>
        </div>

        {/* Metric 3: Total Reviews */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Feedback
            </span>
            <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <MessageCircle className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">{stats.totalCount}</span>
            <span className="text-xs font-medium text-muted-foreground">submissions</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {stats.fiveStarCount} perfect 5-star experiences
          </p>
        </div>

        {/* Action Card: Give Feedback Button */}
        <div className="flex flex-col justify-between rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-card p-5 shadow-xs">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" />
              Voice Your Experience
            </span>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Help facilities administration prioritize campus upgrades and maintenance speed.
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="mt-4 gap-2 font-semibold shadow-sm"
          >
            <MessageSquarePlus className="size-4" />
            Give Feedback
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search feedback by building, subject, or student..."
            className="pl-9.5 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={cn(selectCls, "h-9 w-auto text-xs font-medium py-1 px-3")}
          >
            <option value="ALL">All Categories</option>
            {FEEDBACK_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Rating Filter */}
          <select
            value={selectedRating}
            onChange={(e) => setSelectedRating(Number(e.target.value))}
            className={cn(selectCls, "h-9 w-auto text-xs font-medium py-1 px-3")}
          >
            <option value={0}>All Ratings</option>
            <option value={5}>⭐ 5 Stars Only</option>
            <option value={4}>⭐ 4 Stars Only</option>
            <option value={3}>⭐ 3 Stars Only</option>
            <option value={2}>⭐ 2 Stars Only</option>
            <option value={1}>⭐ 1 Star Only</option>
          </select>
        </div>
      </div>

      {/* Feedback Feed List */}
      {filteredFeedbacks.length === 0 ? (
        <EmptyState
          title="No feedback matching your filters"
          description="Try broadening your search term or selecting 'All Categories'."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredFeedbacks.map((item) => {
            const hasVoted = votedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  {/* Card Header: Author, Date, Rating */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground font-bold text-xs">
                        {item.isAnonymous ? (
                          <ShieldCheck className="size-4.5 text-primary" />
                        ) : (
                          item.authorName
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {item.authorName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.authorDepartment} &bull; {item.createdAt}
                        </p>
                      </div>
                    </div>

                    {/* Star Rating Badge */}
                    <div className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-500">
                      <Star className="size-3.5 fill-amber-500" />
                      <span>{item.rating}.0</span>
                    </div>
                  </div>

                  {/* Badges: Category & Building */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                      <Building2 className="size-3 text-muted-foreground" />
                      {item.building}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <Tag className="size-3" />
                      {item.category}
                    </span>
                  </div>

                  {/* Title & Content */}
                  <div className="mt-3 space-y-1.5">
                    <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.content}
                    </p>
                  </div>

                  {/* Admin Response Note (if available) */}
                  {item.adminResponse && (
                    <div className="mt-3.5 rounded-xl border border-primary/20 bg-primary/[0.03] p-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-primary mb-1">
                        <CheckCircle2 className="size-3.5" />
                        <span>Facilities Administration Response</span>
                      </div>
                      <p className="text-muted-foreground">{item.adminResponse}</p>
                    </div>
                  )}
                </div>

                {/* Card Footer: Status & Helpful Vote */}
                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      item.adminStatus === "Action Taken" &&
                        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      item.adminStatus === "Acknowledged" &&
                        "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                      item.adminStatus === "Under Review" &&
                        "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    <Clock className="size-3" />
                    {item.adminStatus}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleVote(item.id)}
                    disabled={hasVoted}
                    aria-label="Vote feedback as helpful"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all active:scale-95",
                      hasVoted
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    )}
                  >
                    <ThumbsUp className="size-3.5" />
                    <span>{hasVoted ? "Helpful (" + item.helpfulVotes + ")" : "Helpful (" + item.helpfulVotes + ")"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Feedback Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <MessageSquarePlus className="size-5 text-primary" />
              Submit Campus Feedback
            </DialogTitle>
            <DialogDescription className="text-xs">
              Rate your maintenance experience and share constructive feedback with facilities administration.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Interactive Star Rating */}
            <div>
              <Label className="text-xs font-semibold text-foreground">
                Overall Experience Rating *
              </Label>
              <div className="mt-2 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setFormRating(star)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={cn(
                        "size-7 transition-colors",
                        star <= (hoverRating || formRating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30",
                      )}
                    />
                  </button>
                ))}
                <span className="ml-2 text-xs font-bold text-foreground">
                  {RATING_LABELS[hoverRating || formRating]}
                </span>
              </div>
            </div>

            {/* Category Dropdown */}
            <div>
              <Label htmlFor="category" className="text-xs font-semibold text-foreground">
                Feedback Category *
              </Label>
              <select
                id="category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as FeedbackCategory)}
                className={cn(selectCls, "mt-1.5 w-full text-xs font-medium")}
              >
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Building Location */}
            <div>
              <Label htmlFor="building" className="text-xs font-semibold text-foreground">
                Campus Block / Facility *
              </Label>
              <select
                id="building"
                value={formBuilding}
                onChange={(e) => setFormBuilding(e.target.value)}
                className={cn(selectCls, "mt-1.5 w-full text-xs font-medium")}
              >
                {BUILDINGS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value="General Campus">General Campus (All Blocks)</option>
              </select>
            </div>

            {/* Subject / Title */}
            <div>
              <Label htmlFor="title" className="text-xs font-semibold text-foreground">
                Feedback Title / Subject *
              </Label>
              <Input
                id="title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Prompt AC repair in CS Lab or Water cooler filter update"
                className="mt-1.5 text-sm"
              />
              {formError.title && (
                <p className="mt-1 text-xs text-destructive">{formError.title}</p>
              )}
            </div>

            {/* Detailed Description */}
            <div>
              <Label htmlFor="content" className="text-xs font-semibold text-foreground">
                Feedback Details & Suggestions *
              </Label>
              <Textarea
                id="content"
                rows={4}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Share your specific thoughts, what went well, or what could be improved..."
                className="mt-1.5 text-sm"
              />
              {formError.content && (
                <p className="mt-1 text-xs text-destructive">{formError.content}</p>
              )}
            </div>

            {/* Anonymous Toggle */}
            <div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-muted/30 p-3">
              <input
                id="anonymous"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary"
              />
              <Label htmlFor="anonymous" className="cursor-pointer text-xs font-medium leading-normal">
                Submit as Anonymous Campus Resident (hides your name & register details from public feed)
              </Label>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="font-semibold gap-1.5">
                <CheckCircle2 className="size-4" />
                {submitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
