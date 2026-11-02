import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Eye,
  Check,
  Building2,
  MapPin,
  ExternalLink,
  Info,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge, Panel } from "./ui-bits";
import { useDemoStore } from "@/lib/demo-store";
import type { AdminAlert, AlertStatus, AdminAlertType } from "@/lib/admin-alert-engine";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "critical" | "anomalies" | "acknowledged" | "resolved";

export function AdminAlertsPanel() {
  const {
    adminAlerts,
    updateAlertStatus,
    acknowledgeAlert,
    resolveAlert,
    insufficientAnomalyData,
    insufficientAnomalyReason,
  } = useDemoStore();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedAlertForNote, setSelectedAlertForNote] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");

  const activeAlerts = adminAlerts.filter((a) => a.status !== "Resolved");
  const criticalCount = adminAlerts.filter(
    (a) => (a.severity === "High" || a.type === "SAFETY_HAZARD") && a.status !== "Resolved",
  ).length;
  const anomalyCount = adminAlerts.filter(
    (a) => (a.type === "MAINTENANCE_ANOMALY" || a.type === "ROOM_HOTSPOT") && a.status !== "Resolved",
  ).length;
  const acknowledgedCount = adminAlerts.filter((a) => a.status === "Acknowledged").length;
  const resolvedCount = adminAlerts.filter((a) => a.status === "Resolved").length;

  const filteredAlerts = adminAlerts.filter((a) => {
    if (activeTab === "all") return a.status !== "Resolved";
    if (activeTab === "critical")
      return (a.severity === "High" || a.type === "SAFETY_HAZARD") && a.status !== "Resolved";
    if (activeTab === "anomalies")
      return (a.type === "MAINTENANCE_ANOMALY" || a.type === "ROOM_HOTSPOT") && a.status !== "Resolved";
    if (activeTab === "acknowledged") return a.status === "Acknowledged";
    if (activeTab === "resolved") return a.status === "Resolved";
    return true;
  });

  const getAlertBadge = (type: AdminAlertType) => {
    switch (type) {
      case "SAFETY_HAZARD":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
            <ShieldAlert className="size-3" /> Safety Hazard
          </span>
        );
      case "PRIORITY_ESCALATION":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            <Zap className="size-3" /> Priority Escalation
          </span>
        );
      case "ROOM_HOTSPOT":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">
            <MapPin className="size-3" /> Room Hotspot
          </span>
        );
      case "UNRESOLVED_DURATION":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:text-orange-400">
            <Clock className="size-3" /> Prolonged Backlog
          </span>
        );
      case "MAINTENANCE_ANOMALY":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-purple-500/15 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-400">
            <AlertTriangle className="size-3" /> Maintenance Anomaly
          </span>
        );
    }
  };

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case "New":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
            NEW
          </span>
        );
      case "Investigating":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            <Eye className="size-3" />
            INVESTIGATING
          </span>
        );
      case "Acknowledged":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Clock className="size-3" />
            ACKNOWLEDGED
          </span>
        );
      case "Resolved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="size-3" />
            RESOLVED
          </span>
        );
    }
  };

  return (
    <Panel
      className="mt-5"
      title="Campus Maintenance Alerts & Anomaly Monitor"
      action={
        <Link
          to="/admin/complaints"
          className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
        >
          View all complaints &rarr;
        </Link>
      }
    >
      {/* Metrics Summary Strip */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border bg-muted/40 p-2.5">
          <p className="text-[11px] text-muted-foreground font-medium">Active Alerts</p>
          <p className="text-xl font-bold text-foreground">{activeAlerts.length}</p>
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5">
          <p className="text-[11px] text-destructive font-medium flex items-center gap-1">
            <Flame className="size-3" /> Critical & Hazards
          </p>
          <p className="text-xl font-bold text-destructive">{criticalCount}</p>
        </div>
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-2.5">
          <p className="text-[11px] text-purple-700 dark:text-purple-400 font-medium flex items-center gap-1">
            <AlertTriangle className="size-3" /> Facility Hotspots
          </p>
          <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{anomalyCount}</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
            <Check className="size-3" /> Acknowledged / Closed
          </p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
            {acknowledgedCount + resolvedCount}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b pb-3 mb-4 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition-colors",
            activeTab === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Active Alerts ({activeAlerts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("critical")}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition-colors",
            activeTab === "critical"
              ? "bg-destructive text-destructive-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Critical Hazards ({criticalCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("anomalies")}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition-colors",
            activeTab === "anomalies"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Anomalies & Hotspots ({anomalyCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("acknowledged")}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition-colors",
            activeTab === "acknowledged"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Acknowledged ({acknowledgedCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("resolved")}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition-colors",
            activeTab === "resolved"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Resolved ({resolvedCount})
        </button>
      </div>

      {/* Insufficient Data Notice if applicable */}
      {insufficientAnomalyData && (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
          <Info className="size-4 shrink-0 mt-0.5 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Statistical Anomaly Baseline</p>
            <p>{insufficientAnomalyReason || "At least 3 campus complaints are required to calculate spatial anomalies."}</p>
          </div>
        </div>
      )}

      {/* Alert List */}
      {filteredAlerts.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <CheckCircle2 className="mx-auto size-8 text-success/60 mb-2" />
          <p className="text-sm font-semibold text-foreground">All clear</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            No maintenance alerts or anomalies matching this filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "rounded-lg border p-4 transition-all space-y-3",
                alert.severity === "High"
                  ? "border-destructive/30 bg-destructive/[0.02]"
                  : "bg-card hover:border-border/80",
                alert.status === "Resolved" && "opacity-60 bg-muted/20",
              )}
            >
              {/* Header row: Title + Badges */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {getAlertBadge(alert.type)}
                    <PriorityBadge priority={alert.severity} />
                    {getStatusBadge(alert.status)}
                  </div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5 pt-0.5">
                    {alert.title}
                  </h4>
                </div>
                <div className="text-right text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {alert.detectedAt.slice(0, 10)}
                  </span>
                </div>
              </div>

              {/* Location & Description */}
              <div className="text-xs text-muted-foreground space-y-1.5">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <Building2 className="size-3.5 text-primary" />
                  {alert.building} {alert.room ? `· ${alert.room}` : ""}
                </p>
                <p className="leading-relaxed text-foreground/90">{alert.description}</p>
              </div>

              {/* Evidence Pills */}
              {alert.reasons && alert.reasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {alert.reasons.map((r, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}

              {/* Admin Note display if exists */}
              {alert.adminNotes && (
                <div className="rounded bg-muted/60 p-2 text-xs text-foreground">
                  <strong className="text-[11px] text-muted-foreground">Admin Note:</strong> {alert.adminNotes}
                </div>
              )}

              {/* Note input dialog inline */}
              {selectedAlertForNote === alert.id && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Enter administrative note..."
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      if (noteInput.trim()) {
                        updateAlertStatus(alert.id, alert.status, noteInput.trim());
                        toast.success("Admin note recorded.");
                      }
                      setSelectedAlertForNote(null);
                      setNoteInput("");
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setSelectedAlertForNote(null);
                      setNoteInput("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  {alert.complaintId && (
                    <Button variant="outline" size="sm" asChild className="h-7 px-2.5 text-xs">
                      <Link to="/admin/complaints/$id" params={{ id: alert.complaintId }}>
                        <ExternalLink className="size-3 mr-1" />
                        Ticket {alert.complaintId}
                      </Link>
                    </Button>
                  )}
                  {alert.status === "New" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => {
                        acknowledgeAlert(alert.id);
                        toast.success("Alert acknowledged.");
                      }}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {alert.status !== "Investigating" && alert.status !== "Resolved" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => {
                        updateAlertStatus(alert.id, "Investigating");
                        toast.info("Marked as under investigation.");
                      }}
                    >
                      Investigate
                    </Button>
                  )}
                  {alert.status !== "Resolved" && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => {
                        resolveAlert(alert.id);
                        toast.success("Alert marked as resolved.");
                      }}
                    >
                      <Check className="size-3 mr-1" />
                      Resolve
                    </Button>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAlertForNote(selectedAlertForNote === alert.id ? null : alert.id);
                      setNoteInput(alert.adminNotes || "");
                    }}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    {alert.adminNotes ? "Edit note" : "+ Add note"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
