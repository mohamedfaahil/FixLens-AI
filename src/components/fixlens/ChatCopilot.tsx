import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Bot,
  User,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Building2,
  Tag,
  ArrowRight,
  Shield,
  HelpCircle,
  Clock,
  Mic,
  MicOff,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDemoStore } from "@/lib/demo-store";
import {
  processUserMessage,
  type ChatMessage,
  type PendingComplaintContext,
} from "@/lib/chatbot-engine";
import { toast } from "sonner";
import { StatusBadge } from "./ui-bits";

interface Props {
  portal: "Student" | "Administrator";
  user: { name: string; sub: string };
}

export function ChatCopilot({ portal, user }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeContext, setActiveContext] = useState<PendingComplaintContext | null>(null);
  const [submittingDraftId, setSubmittingDraftId] = useState<string | null>(null);
  const [submittedTickets, setSubmittedTickets] = useState<Record<string, string>>({});

  const { complaints, proposals, addComplaint, currentStudent } = useDemoStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initial welcome message
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome-1",
      sender: "bot",
      text:
        portal === "Administrator"
          ? `Hello ${user.name || "Administrator"}! 👋 I am your **FixLens Ops Copilot**.\n\nI can provide live queue summaries, detect overdue SLA escalations, or look up ticket metrics. How can I help today?`
          : `Hello ${user.name || "Student"}! 👋 I am your **FixLens Campus Copilot**.\n\nI can help you view your complaints, report maintenance issues with AI priority scoring, check ticket status, or answer campus facility questions. You can also use the **Mic 🎙️** button to dictate!`,
      timestamp: new Date(),
    },
  ]);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore cleanup errors
        }
        setIsListening(false);
      }
    }
  }, [isOpen, messages, isTyping]);

  // Speech Recognition / Voice Dictation Setup
  const toggleListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.info("Voice dictation is not supported on this browser. Try Google Chrome or Microsoft Edge.");
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        toast.info("🎙️ Listening... Speak your issue or question.");
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((res: any) => res[0].transcript)
          .join("");
        setInput(transcript);
      };

      recognition.onerror = (err: any) => {
        console.warn("Speech recognition error:", err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("Speech recognition error:", err);
      setIsListening(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isTyping) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    setInput("");
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const botReply = await processUserMessage({
        text,
        portal,
        userName: user.name,
        userEmail: user.sub,
        currentStudent,
        complaints,
        proposals,
        pendingContext: activeContext,
      });

      setActiveContext(botReply.pendingContext ?? null);
      setMessages((prev) => [...prev, botReply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "bot",
          text: "I experienced a brief connection hiccup. Please try again or rephrase your request.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleReset = () => {
    setActiveContext(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: "bot",
        text:
          portal === "Administrator"
            ? `Conversation reset. I am ready to summarize the review queue or check facility anomalies.`
            : `Conversation reset. How can I help you with campus maintenance today?`,
        timestamp: new Date(),
      },
    ]);
  };

  const handleSubmitDraft = async (
    msgId: string,
    card: NonNullable<ChatMessage["actionCard"]> & { type: "complaint-draft" },
  ) => {
    setSubmittingDraftId(msgId);
    try {
      const created = await addComplaint({
        title: card.title,
        description: card.description,
        category: card.category,
        building: card.building,
        room: card.room,
        urgency: card.urgency,
        affected: card.affected,
        priority: card.predictedPriority,
        predictedPriority: card.predictedPriority,
        confidence: card.confidence,
        signals: card.signals,
        isTrainedModel: true,
      });

      setSubmittedTickets((prev) => ({
        ...prev,
        [msgId]: created.id,
      }));

      toast.success(`Complaint registered: ${created.id}`);

      // Append confirmation from bot
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-conf-${Date.now()}`,
          sender: "bot",
          text: `🎉 **Success!** Your complaint **${created.id}** has been registered in the system.\n\n• **Priority:** ${created.priority}\n• **Status:** ${created.status}\n\nOur facility team will review and assign a technician shortly. You can track updates anytime in your dashboard.`,
          timestamp: new Date(),
          actionCard: {
            type: "complaint-status",
            complaint: created,
          },
        },
      ]);
    } catch {
      toast.error("Failed to submit complaint. Please try using the regular report form.");
    } finally {
      setSubmittingDraftId(null);
    }
  };

  const studentChips = [
    "📋 Show all complaints I made",
    "⚡ Sparking socket in CS Lab",
    "💧 Water leak in Main Library",
    "⚠️ How does priority work?",
    "💡 Active proposals",
  ];

  const adminChips = [
    "📊 Queue summary",
    "📋 Show all complaints",
    "⚠️ Check SLA escalations",
    "📍 Building hotspots",
  ];

  const chips = portal === "Administrator" ? adminChips : studentChips;

  return (
    <>
      {/* Floating Action Button */}
      <div className="no-print fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setIsOpen((prev) => !prev)}
          size="icon"
          aria-label="Open FixLens AI Copilot"
          className={cn(
            "relative size-14 rounded-full shadow-float transition-all duration-300 hover:scale-105 active:scale-95",
            isOpen
              ? "bg-muted text-foreground hover:bg-muted/80"
              : "bg-gradient-to-tr from-primary to-indigo-600 text-primary-foreground hover:shadow-primary/30",
          )}
        >
          {isOpen ? (
            <X className="size-6 transition-transform duration-200" />
          ) : (
            <>
              <Sparkles className="size-6 animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 flex size-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-3.5 rounded-full border-2 border-card bg-emerald-500" />
              </span>
            </>
          )}
        </Button>
      </div>

      {/* Floating Chat Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="FixLens AI Copilot Chat"
          className="no-print fixed bottom-24 right-4 sm:right-6 z-50 flex h-[580px] max-h-[82vh] w-[calc(100vw-2rem)] sm:w-[420px] flex-col rounded-2xl border border-border bg-card shadow-float overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bot className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-foreground">FixLens Copilot</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                    AI
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{portal === "Administrator" ? "Admin Ops Mode" : "Student Assistant"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                title="Reset conversation"
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4.5" />
              </Button>
            </div>
          </div>

          {/* Quick Action Chips */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-border/50 bg-muted/30 px-3 py-2 text-xs no-scrollbar">
            {chips.map((chip) => (
              <button
                key={chip}
                onClick={() => handleSend(chip)}
                className="shrink-0 rounded-full border border-border/80 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-95"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-sm">
            {messages.map((m) => {
              const isUser = m.sender === "user";
              return (
                <div
                  key={m.id}
                  className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}
                >
                  <div className="flex items-end gap-2 max-w-[88%]">
                    {!isUser && (
                      <div className="shrink-0 size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs mb-1">
                        <Bot className="size-3.5" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-line",
                        isUser
                          ? "bg-primary text-primary-foreground rounded-br-xs shadow-xs"
                          : "bg-muted/70 text-foreground border border-border/70 rounded-bl-xs",
                      )}
                    >
                      {m.text}
                    </div>
                  </div>

                  {/* Render Quick Replies */}
                  {m.quickReplies && !isUser && (
                    <div className="flex flex-wrap gap-1.5 pl-8 pt-1 max-w-[90%]">
                      {m.quickReplies.map((qr) => (
                        <button
                          key={qr}
                          onClick={() => handleSend(qr)}
                          className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 active:scale-95 transition-all"
                        >
                          {qr}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Render Action Cards */}
                  {m.actionCard && !isUser && (
                    <div className="w-full pl-8 pr-2">
                      {/* Complaint Draft Card */}
                      {m.actionCard.type === "complaint-draft" && (
                        <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2.5 text-xs">
                          <div className="flex items-center justify-between border-b border-border/60 pb-2">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <Tag className="size-3.5 text-primary" />
                              Complaint Preview
                            </span>
                            <Badge
                              variant={
                                m.actionCard.predictedPriority === "High"
                                  ? "danger"
                                  : m.actionCard.predictedPriority === "Medium"
                                    ? "warning"
                                    : "info"
                              }
                            >
                              {m.actionCard.predictedPriority} Priority
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                            <div>
                              <span className="font-medium text-foreground">Category:</span>{" "}
                              {m.actionCard.category}
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Location:</span>{" "}
                              {m.actionCard.building}
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Area:</span>{" "}
                              {m.actionCard.room}
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Impact:</span>{" "}
                              {m.actionCard.affected} person(s)
                            </div>
                          </div>

                          {m.actionCard.confidence && (
                            <div className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground flex items-center justify-between">
                              <span>ML Model Confidence:</span>
                              <span className="font-semibold text-foreground">
                                {(m.actionCard.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}

                          {submittedTickets[m.id] ? (
                            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                              <CheckCircle2 className="size-4 shrink-0" />
                              <span>Registered: {submittedTickets[m.id]}</span>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              className="w-full gap-1.5 text-xs h-8"
                              disabled={submittingDraftId === m.id}
                              onClick={() =>
                                handleSubmitDraft(
                                  m.id,
                                  m.actionCard as NonNullable<ChatMessage["actionCard"]> & {
                                    type: "complaint-draft";
                                  },
                                )
                              }
                            >
                              {submittingDraftId === m.id ? (
                                <>
                                  <Loader2 className="size-3.5 animate-spin" />
                                  <span>Submitting to Queue...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="size-3.5" />
                                  <span>Confirm & Submit Complaint</span>
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Single Complaint Status Card */}
                      {m.actionCard.type === "complaint-status" && (
                        <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">
                              {m.actionCard.complaint.id}
                            </span>
                            <StatusBadge status={m.actionCard.complaint.status} />
                          </div>
                          <p className="font-medium text-foreground line-clamp-1">
                            {m.actionCard.complaint.title}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                            <span>{m.actionCard.complaint.building}</span>
                            <span>Priority: {m.actionCard.complaint.priority}</span>
                          </div>
                          <Link
                            to={portal === "Administrator" ? "/admin/complaints/$id" : "/student/complaints/$id"}
                            params={{ id: m.actionCard.complaint.id }}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline pt-1"
                          >
                            <span>Open ticket view</span>
                            <ArrowRight className="size-3" />
                          </Link>
                        </div>
                      )}

                      {/* Multiple Complaints List Card */}
                      {m.actionCard.type === "complaint-list" && (
                        <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2.5 text-xs">
                          <div className="flex items-center justify-between border-b border-border/60 pb-2">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <ClipboardList className="size-3.5 text-primary" />
                              {m.actionCard.filterLabel || "Complaints List"}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {m.actionCard.complaints.length} tickets
                            </Badge>
                          </div>

                          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                            {m.actionCard.complaints.map((c) => (
                              <div
                                key={c.id}
                                className="rounded-lg border border-border/70 bg-muted/40 p-2 space-y-1 hover:border-primary/40 transition-colors"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-semibold text-foreground">{c.id}</span>
                                  <div className="flex items-center gap-1.5">
                                    <Badge
                                      variant={
                                        c.priority === "High"
                                          ? "danger"
                                          : c.priority === "Medium"
                                            ? "warning"
                                            : "info"
                                      }
                                      className="text-[9px] px-1.5 py-0"
                                    >
                                      {c.priority}
                                    </Badge>
                                    <StatusBadge status={c.status} />
                                  </div>
                                </div>
                                <p className="font-medium text-foreground text-[11px] line-clamp-1">
                                  {c.title}
                                </p>
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                                  <span>
                                    {c.building} ({c.room})
                                  </span>
                                  <Link
                                    to={
                                      portal === "Administrator"
                                        ? "/admin/complaints/$id"
                                        : "/student/complaints/$id"
                                    }
                                    params={{ id: c.id }}
                                    onClick={() => setIsOpen(false)}
                                    className="font-medium text-primary hover:underline flex items-center gap-0.5"
                                  >
                                    <span>View</span>
                                    <ArrowRight className="size-2.5" />
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>

                          <Link
                            to={portal === "Administrator" ? "/admin/queue" : "/student/complaints"}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center justify-center gap-1 rounded-lg bg-primary/10 py-1.5 text-center text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                          >
                            <span>Open full complaints dashboard</span>
                            <ArrowRight className="size-3" />
                          </Link>
                        </div>
                      )}

                      {/* Admin Summary Card */}
                      {m.actionCard.type === "admin-summary" && (
                        <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2.5 text-xs">
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-lg bg-muted/60 p-2 text-center">
                              <div className="text-lg font-bold text-foreground">
                                {m.actionCard.total}
                              </div>
                              <div className="text-muted-foreground text-[10px]">Total Tickets</div>
                            </div>
                            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-center">
                              <div className="text-lg font-bold text-rose-600 dark:text-rose-400">
                                {m.actionCard.highPriority}
                              </div>
                              <div className="text-rose-600/80 dark:text-rose-400/80 text-[10px]">
                                High Priority
                              </div>
                            </div>
                            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-center">
                              <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                {m.actionCard.inProgress}
                              </div>
                              <div className="text-amber-600/80 dark:text-amber-400/80 text-[10px]">
                                In Progress
                              </div>
                            </div>
                            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
                              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                {m.actionCard.resolved}
                              </div>
                              <div className="text-emerald-600/80 dark:text-emerald-400/80 text-[10px]">
                                Resolved
                              </div>
                            </div>
                          </div>
                          <Link
                            to="/admin/queue"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 py-1.5 text-center text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                          >
                            <span>Open Admin Review Queue</span>
                            <ArrowRight className="size-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-end gap-2 text-xs text-muted-foreground pl-1">
                <div className="shrink-0 size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Bot className="size-3.5" />
                </div>
                <div className="rounded-2xl rounded-bl-xs bg-muted/60 border border-border/60 px-3 py-2 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="size-1.5 rounded-full bg-primary animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="border-t border-border bg-card/95 p-3 flex items-center gap-2 backdrop-blur-xs"
          >
            {/* Voice Dictation Button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleListening}
              title={isListening ? "Listening... click to stop" : "Speak to dictate issue"}
              className={cn(
                "size-9 shrink-0 rounded-xl transition-all",
                isListening
                  ? "border-rose-500 bg-rose-500/15 text-rose-500 animate-pulse hover:bg-rose-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              {isListening ? <MicOff className="size-4 text-rose-500" /> : <Mic className="size-4" />}
            </Button>

            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening
                  ? "Listening to your voice..."
                  : portal === "Administrator"
                    ? "Ask about queue, escalations, or ticket IDs..."
                    : "Ask about your complaints, campus FAQs, or report..."
              }
              className={cn(
                "flex-1 rounded-xl text-xs sm:text-sm h-9 bg-background/80 transition-colors",
                isListening && "border-rose-500/50 ring-1 ring-rose-500/20",
              )}
              disabled={isTyping}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isTyping}
              className="size-9 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
              aria-label="Send message"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
