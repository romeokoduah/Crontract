"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Plus, Trash2, Loader2 } from "lucide-react"

interface CorrectiveAction {
  id: string
  description: string
  responsiblePerson: string
  dueDate: string
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED"
}

interface WorkspaceUser {
  id: string
  name: string
}

interface Props {
  incidentId: string
  currentStatus: string
  workspaceUsers: WorkspaceUser[]
  currentInvestigator: string | null
  correctiveActions: CorrectiveAction[]
}

export function IncidentActions({ incidentId, currentStatus, workspaceUsers, currentInvestigator, correctiveActions: initialActions }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [investigatorId, setInvestigatorId] = useState(currentInvestigator ?? "")
  const [rootCause, setRootCause] = useState("")
  const [showRootCause, setShowRootCause] = useState(false)
  const [actions, setActions] = useState<CorrectiveAction[]>(initialActions)
  const [newAction, setNewAction] = useState({ description: "", responsiblePerson: "", dueDate: "" })
  const [showNewAction, setShowNewAction] = useState(false)

  async function patch(body: object) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hse/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to update"); return false }
      router.refresh()
      return true
    } catch {
      setError("Network error")
      return false
    } finally {
      setLoading(false)
    }
  }

  async function startInvestigation() {
    await patch({ status: "UNDER_INVESTIGATION", investigator: investigatorId || null })
  }

  async function saveRootCause() {
    const ok = await patch({ rootCause })
    if (ok) setShowRootCause(false)
  }

  async function addCorrectiveAction() {
    if (!newAction.description.trim() || !newAction.responsiblePerson.trim() || !newAction.dueDate) return
    const updated = [
      ...actions,
      { ...newAction, id: crypto.randomUUID(), status: "OPEN" as const },
    ]
    const ok = await patch({ correctiveActions: updated, status: "CORRECTIVE_ACTIONS" })
    if (ok) {
      setActions(updated)
      setNewAction({ description: "", responsiblePerson: "", dueDate: "" })
      setShowNewAction(false)
    }
  }

  async function updateActionStatus(id: string, status: "OPEN" | "IN_PROGRESS" | "COMPLETED") {
    const updated = actions.map((a) => (a.id === id ? { ...a, status } : a))
    const ok = await patch({ correctiveActions: updated })
    if (ok) setActions(updated)
  }

  async function removeAction(id: string) {
    const updated = actions.filter((a) => a.id !== id)
    const ok = await patch({ correctiveActions: updated })
    if (ok) setActions(updated)
  }

  async function closeIncident() {
    await patch({ status: "CLOSED" })
  }

  async function reopenIncident() {
    await patch({ status: "REOPENED" })
  }

  const canStartInvestigation = currentStatus === "REPORTED"
  const canAddCorrectiveActions = currentStatus === "UNDER_INVESTIGATION" || currentStatus === "CORRECTIVE_ACTIONS" || currentStatus === "REOPENED"
  const canClose = currentStatus === "CORRECTIVE_ACTIONS" || currentStatus === "UNDER_INVESTIGATION"
  const canReopen = currentStatus === "CLOSED"

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
          {error}
        </div>
      )}

      {/* Status Transitions */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {canStartInvestigation && (
            <div className="space-y-2">
              <Label className="text-xs">Assign Investigator</Label>
              <select
                value={investigatorId}
                onChange={(e) => setInvestigatorId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select investigator…</option>
                {workspaceUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <Button
                onClick={startInvestigation}
                disabled={loading}
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Start Investigation
              </Button>
            </div>
          )}

          {canAddCorrectiveActions && (
            <>
              {!showRootCause ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowRootCause(true)}
                >
                  Edit Root Cause
                </Button>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">Root Cause Analysis</Label>
                  <textarea
                    rows={4}
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    placeholder="Describe the root cause…"
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowRootCause(false)}>Cancel</Button>
                    <Button size="sm" className="flex-1" onClick={saveRootCause} disabled={loading}>Save</Button>
                  </div>
                </div>
              )}

              {!showNewAction ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowNewAction(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Corrective Action
                </Button>
              ) : (
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                  <Label className="text-xs font-semibold">New Corrective Action</Label>
                  <input
                    value={newAction.description}
                    onChange={(e) => setNewAction((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Describe the action required"
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={newAction.responsiblePerson}
                    onChange={(e) => setNewAction((p) => ({ ...p, responsiblePerson: e.target.value }))}
                    placeholder="Responsible person"
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="date"
                    value={newAction.dueDate}
                    onChange={(e) => setNewAction((p) => ({ ...p, dueDate: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowNewAction(false)}>Cancel</Button>
                    <Button size="sm" className="flex-1" onClick={addCorrectiveAction} disabled={loading}>Add</Button>
                  </div>
                </div>
              )}
            </>
          )}

          {canClose && (
            <Button
              onClick={closeIncident}
              disabled={loading}
              size="sm"
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Close Incident
            </Button>
          )}

          {canReopen && (
            <Button
              onClick={reopenIncident}
              disabled={loading}
              size="sm"
              variant="outline"
              className="w-full border-red-200 text-red-600 hover:bg-red-50"
            >
              Reopen Incident
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Corrective action status updates */}
      {actions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Update Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {actions.map((a) => (
              <div key={a.id} className="p-2 bg-muted/30 rounded border">
                <p className="text-xs font-medium line-clamp-2 mb-2">{a.description}</p>
                <div className="flex gap-1 flex-wrap">
                  {(["OPEN", "IN_PROGRESS", "COMPLETED"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateActionStatus(a.id, s)}
                      disabled={loading}
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium transition-all",
                        a.status === s
                          ? s === "COMPLETED" ? "bg-green-500 text-white" : s === "IN_PROGRESS" ? "bg-blue-500 text-white" : "bg-gray-500 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                      )}
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                  <button
                    onClick={() => removeAction(a.id)}
                    disabled={loading}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
