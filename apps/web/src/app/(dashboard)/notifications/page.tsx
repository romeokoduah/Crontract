"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatDateTime } from "@/lib/utils"
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  FileText,
  Users,
  DollarSign,
  CheckSquare,
  Package,
  Calendar,
} from "lucide-react"

interface Notification {
  id: string
  type: string
  title: string
  body?: string
  entityType?: string
  entityId?: string
  read: boolean
  createdAt: string
}

function NotificationIcon({ type }: { type: string }) {
  const cls = "h-4 w-4"
  const lc = type.toLowerCase()
  if (lc.includes("approval") || lc.includes("approved") || lc.includes("rejected")) {
    return <CheckSquare className={cls} />
  }
  if (lc.includes("invoice") || lc.includes("bill") || lc.includes("expense") || lc.includes("finance")) {
    return <DollarSign className={cls} />
  }
  if (lc.includes("document") || lc.includes("doc")) {
    return <FileText className={cls} />
  }
  if (lc.includes("meeting")) {
    return <Calendar className={cls} />
  }
  if (lc.includes("asset")) {
    return <Package className={cls} />
  }
  if (lc.includes("user") || lc.includes("member") || lc.includes("people")) {
    return <Users className={cls} />
  }
  if (lc.includes("alert") || lc.includes("warning") || lc.includes("hse") || lc.includes("incident")) {
    return <AlertTriangle className={cls} />
  }
  if (lc.includes("success") || lc.includes("complete")) {
    return <CheckCircle2 className={cls} />
  }
  return <Info className={cls} />
}

function notificationIconBg(type: string): string {
  const lc = type.toLowerCase()
  if (lc.includes("approval")) return "bg-amber-100 text-amber-600"
  if (lc.includes("alert") || lc.includes("warning") || lc.includes("incident")) return "bg-red-100 text-red-600"
  if (lc.includes("success") || lc.includes("complete") || lc.includes("approved")) return "bg-green-100 text-green-600"
  if (lc.includes("invoice") || lc.includes("finance")) return "bg-emerald-100 text-emerald-600"
  if (lc.includes("meeting")) return "bg-purple-100 text-purple-600"
  return "bg-blue-100 text-blue-600"
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to load notifications")
        return
      }
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  async function markRead(id: string) {
    // Optimistic
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      })
    } catch {
      /* silently re-fetch */
      fetchNotifications()
    }
  }

  async function markAllRead() {
    setMarkingAll(true)
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      setError("Failed to mark all as read")
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notifications
          </h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={markingAll}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            {markingAll ? "Marking…" : "Mark all as read"}
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              You will see activity from across the platform here
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {notifications.map((n, idx) => (
              <button
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className={cn(
                  "w-full text-left flex items-start gap-4 p-4 hover:bg-muted/40 transition-colors",
                  idx < notifications.length - 1 && "border-b",
                  !n.read && "bg-primary/5"
                )}
              >
                <div
                  className={cn(
                    "shrink-0 h-9 w-9 rounded-full flex items-center justify-center mt-0.5",
                    notificationIconBg(n.type)
                  )}
                >
                  <NotificationIcon type={n.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(n.createdAt)}
                      </span>
                      {!n.read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                  </div>
                  {n.body && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  )}
                  {n.entityType && (
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">
                      {n.entityType}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
