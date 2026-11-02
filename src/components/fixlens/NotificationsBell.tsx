import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type AppNotification,
  fetchNotificationsFromSupabase,
  markNotificationReadInSupabase,
  markAllNotificationsReadInSupabase,
} from "@/lib/supabase-data";
import { useDemoStore } from "@/lib/demo-store";
import { cn } from "@/lib/utils";

export function NotificationsBell({ portal = "Student" }: { portal?: "Student" | "Administrator" }) {
  const {
    currentStudent,
    isSupabaseConnected,
    adminAlerts,
    acknowledgeAlert,
    notifications: storeNotifications,
    markStudentNotificationAsRead,
    markAllStudentNotificationsAsRead,
  } = useDemoStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const recentlyReadIdsRef = useRef<Set<string>>(new Set());

  const userId = currentStudent?.id || undefined;
  const isAdmin = portal === "Administrator";

  // Merge remote Supabase notifications with in-memory / local submission & demo notifications
  const mergeNotifications = useCallback(
    (remote: AppNotification[], local: AppNotification[]): AppNotification[] => {
      const map = new Map<string, AppNotification>();
      for (const item of local) {
        map.set(item.id, item);
      }
      for (const item of remote) {
        // If user recently marked as read in session, preserve read state
        const shouldBeRead = item.isRead || recentlyReadIdsRef.current.has(item.id);
        map.set(item.id, { ...item, isRead: shouldBeRead });
      }
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
    [],
  );

  const loadNotifications = useCallback(
    async (silent = false) => {
      if (isAdmin) return;
      if (!userId || !isSupabaseConnected) {
        // Demo / offline mode: use store notifications directly
        setNotifications(storeNotifications);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const remoteData = await fetchNotificationsFromSupabase(userId);
        setNotifications(mergeNotifications(remoteData, storeNotifications));
      } catch {
        setNotifications(storeNotifications);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isAdmin, userId, isSupabaseConnected, storeNotifications, mergeNotifications],
  );

  // Initial load and sync with store changes
  useEffect(() => {
    if (!isAdmin) {
      loadNotifications();
    }
  }, [isAdmin, userId, isSupabaseConnected, storeNotifications, loadNotifications]);

  // Phase 3: Automatic Notification Refresh on Window Focus and 30-Second Interval
  useEffect(() => {
    if (isAdmin) return;

    const handleFocus = () => {
      loadNotifications(true);
    };

    window.addEventListener("focus", handleFocus);

    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadNotifications(true);
      }
    }, 30000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(intervalId);
    };
  }, [isAdmin, loadNotifications]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !isAdmin) {
      loadNotifications();
    }
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isAdmin) {
      acknowledgeAlert(id);
      return;
    }
    recentlyReadIdsRef.current.add(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    markStudentNotificationAsRead(id);
    if (userId && isSupabaseConnected) {
      await markNotificationReadInSupabase(id);
    }
  };

  const handleMarkAllRead = async () => {
    if (isAdmin) {
      adminAlerts.forEach((a) => {
        if (a.status === "New") acknowledgeAlert(a.id);
      });
      return;
    }
    notifications.forEach((n) => recentlyReadIdsRef.current.add(n.id));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    markAllStudentNotificationsAsRead();
    if (userId && isSupabaseConnected) {
      await markAllNotificationsReadInSupabase(userId);
    }
  };

  const unreadCount = isAdmin
    ? adminAlerts.filter((a) => a.status === "New").length
    : notifications.filter((n) => !n.isRead).length;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm animate-in zoom-in-75">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0 shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y">
          {loading && !isAdmin && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" />
              Loading notifications…
            </div>
          ) : (isAdmin ? adminAlerts.length === 0 : notifications.length === 0) ? (
            <div className="py-8 px-4 text-center">
              <Bell className="size-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs font-medium text-foreground">
                {isAdmin ? "No active alerts" : "No notifications yet"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {isAdmin
                  ? "Campus maintenance alerts and escalations will appear here."
                  : "You will receive updates here when your complaints change status."}
              </p>
            </div>
          ) : (
            (isAdmin
              ? adminAlerts.map((a) => ({
                  id: a.id,
                  title: a.title,
                  message: a.description,
                  isRead: a.status !== "New",
                  createdAt: a.detectedAt,
                  complaintId: a.complaintId,
                }))
              : notifications.map((n) => ({
                  id: n.id,
                  title: n.title,
                  message: n.message,
                  isRead: n.isRead,
                  createdAt: n.createdAt,
                  complaintId: n.referenceId,
                }))
            ).map((item) => (
              <div
                key={item.id}
                className={cn(
                  "p-3.5 text-xs transition-colors hover:bg-muted/50 flex items-start gap-3",
                  !item.isRead && "bg-primary/5",
                )}
              >
                <div
                  className={cn(
                    "size-2 rounded-full mt-1.5 shrink-0",
                    item.isRead ? "bg-transparent" : "bg-primary",
                  )}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <span className="text-[10px] text-muted-foreground">
                      {item.createdAt.slice(0, 10)}
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{item.message}</p>
                  <div className="flex items-center justify-between pt-1">
                    {item.complaintId ? (
                      <Link
                        to={isAdmin ? "/admin/complaints/$id" : "/student/complaints/$id"}
                        params={{ id: item.complaintId }}
                        onClick={() => {
                          if (!item.isRead) handleMarkAsRead(item.id);
                          setOpen(false);
                        }}
                        className="text-[11px] font-semibold text-primary hover:underline"
                      >
                        View ticket &rarr;
                      </Link>
                    ) : (
                      <span />
                    )}
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(item.id, e)}
                        className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        <Check className="size-3" />
                        {isAdmin ? "Acknowledge" : "Mark read"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
