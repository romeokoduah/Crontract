"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatDateTime } from "@/lib/utils"
import { CheckSquare, CheckCircle2, XCircle, Clock, User, MessageSquare } from "lucide-react"

interface ApprovalDecision {
  id: string
  step: number
  decidedBy: string
  decision: string
  comment?: string
  createdAt: string
}

interface Approval {
  id: string
  entityType: string
  entityId: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  currentStep: number
  requestedBy: string
  createdAt: string
  updatedAt: string
  flow: {
    id: string
    name: string
    entityType: string
    steps: { approverIds?: string[] }[]
  }
  decisions: ApprovalDecision[]
  requestedByUser?: { id: string; name: string; email: string } | null
}

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
}

const TAB_OPTIONS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
]

export default function ApprovalsPage() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending")
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [showCommentFor, setShowCommentFor] = useState<string | null>(null)

  const fetchApprovals = useCallback(async () => {
    setLoading(true)
    try {
      const statusParam =
        tab === "all"
          ? ""
          : tab === "pending"
          ? "&status=PENDING&view=mine"
          : tab === "approved"
          ? "&status=APPROVED"
          : "&status=REJECTED"

      const res = await fetch(`/api/approvals?${statusParam}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to load approvals")
        return
      }
      setApprovals(data.approvals ?? [])
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    fetchApprovals()
  }, [fetchApprovals])

  async function handleDecision(approvalId: string, decision: "APPROVED" | "REJECTED") {
    setActing(approvalId)
    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          comment: commentMap[approvalId] ?? "",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to process decision")
        return
      }
      setShowCommentFor(null)
      await fetchApprovals()
    } catch {
      setError("Network error")
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-primary" />
            Approvals
          </h1>
          <p className="text-muted-foreground">Review and action approval requests</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TAB_OPTIONS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : approvals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No approvals found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tab === "pending" ? "You have no pending approvals" : "Nothing to show here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <Card key={approval.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {approval.entityType}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            statusColors[approval.status]
                          )}
                        >
                          {approval.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Step {approval.currentStep + 1} of {approval.flow.steps.length}
                        </span>
                      </div>

                      <p className="font-semibold">{approval.flow.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Entity ID: <span className="font-mono text-xs">{approval.entityId.slice(0, 8)}…</span>
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {approval.requestedByUser?.name ?? "Unknown"} requested
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(approval.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    {approval.status === "PENDING" && (
                      <div className="flex items-center gap-2 shrink-0">
                        {showCommentFor === approval.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              rows={2}
                              value={commentMap[approval.id] ?? ""}
                              onChange={(e) =>
                                setCommentMap((prev) => ({ ...prev, [approval.id]: e.target.value }))
                              }
                              placeholder="Add comment (optional)"
                              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none w-64"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleDecision(approval.id, "APPROVED")}
                                disabled={acting === approval.id}
                                className="bg-green-600 hover:bg-green-700 text-white flex-1"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDecision(approval.id, "REJECTED")}
                                disabled={acting === approval.id}
                                className="flex-1"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowCommentFor(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowCommentFor(approval.id)}
                          >
                            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                            Review
                          </Button>
                        )}
                      </div>
                    )}

                    {approval.status === "APPROVED" && (
                      <div className="flex items-center gap-1.5 text-green-600 text-sm shrink-0">
                        <CheckCircle2 className="h-4 w-4" />
                        Approved
                      </div>
                    )}
                    {approval.status === "REJECTED" && (
                      <div className="flex items-center gap-1.5 text-red-600 text-sm shrink-0">
                        <XCircle className="h-4 w-4" />
                        Rejected
                      </div>
                    )}
                  </div>

                  {/* Decision history */}
                  {approval.decisions.length > 0 && (
                    <div className="mt-3 pt-3 border-t space-y-1.5">
                      {approval.decisions.map((d) => (
                        <div key={d.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                          {d.decision === "APPROVED" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                          )}
                          <span>
                            Step {d.step + 1}: {d.decision}{" "}
                            {d.comment && <span className="italic">— &ldquo;{d.comment}&rdquo;</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
