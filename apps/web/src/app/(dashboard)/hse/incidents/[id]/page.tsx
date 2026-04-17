import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatDate, formatDateTime } from "@/lib/utils"
import { ArrowLeft, User, MapPin, Calendar, ClipboardList, UserCheck } from "lucide-react"
import { IncidentActions } from "./incident-actions"

const severityColors: Record<string, string> = {
  NEAR_MISS: "bg-blue-100 text-blue-700 border-blue-200",
  MINOR: "bg-amber-100 text-amber-700 border-amber-200",
  MODERATE: "bg-orange-100 text-orange-700 border-orange-200",
  MAJOR: "bg-red-100 text-red-700 border-red-200",
  FATAL: "bg-gray-900 text-white border-gray-700",
}

const statusColors: Record<string, string> = {
  REPORTED: "bg-gray-100 text-gray-700",
  UNDER_INVESTIGATION: "bg-blue-100 text-blue-700",
  CORRECTIVE_ACTIONS: "bg-amber-100 text-amber-700",
  CLOSED: "bg-green-100 text-green-700",
  REOPENED: "bg-red-100 text-red-700",
}

const timelineSteps = [
  { status: "REPORTED", label: "Reported" },
  { status: "UNDER_INVESTIGATION", label: "Under Investigation" },
  { status: "CORRECTIVE_ACTIONS", label: "Corrective Actions" },
  { status: "CLOSED", label: "Closed" },
]

const statusOrder: Record<string, number> = {
  REPORTED: 0,
  UNDER_INVESTIGATION: 1,
  CORRECTIVE_ACTIONS: 2,
  CLOSED: 3,
  REOPENED: 1, // treat as investigation stage
}

export default async function IncidentDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) notFound()

  const incident = await prisma.incident.findFirst({
    where: { id: params.id, workspaceId: session.user.workspaceId },
  })
  if (!incident) notFound()

  const userIds = [incident.reportedBy, incident.investigator].filter((id): id is string => !!id)
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : []
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  const workspaceUsers = await prisma.membership.findMany({
    where: { workspaceId: session.user.workspaceId },
    include: { user: { select: { id: true, name: true } } },
  })

  const injuredPersons = (incident.injuredPersons as { name: string; injuryType: string; severity: string }[] | null) ?? []
  const correctiveActions = (incident.correctiveActions as {
    id: string; description: string; responsiblePerson: string; dueDate: string; status: "OPEN" | "IN_PROGRESS" | "COMPLETED"
  }[] | null) ?? []

  const currentStep = statusOrder[incident.status] ?? 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="mt-1">
          <Link href="/hse/incidents"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{incident.number}</span>
            <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold border", severityColors[incident.severity])}>
              {incident.severity.replace(/_/g, " ")}
            </span>
            <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", statusColors[incident.status])}>
              {incident.status.replace(/_/g, " ")}
            </span>
          </div>
          <h1 className="text-2xl font-bold mt-1">{incident.title}</h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{incident.location}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDateTime(incident.incidentDate)}</span>
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />Reported by {userMap[incident.reportedBy]?.name ?? "Unknown"}</span>
          </p>
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader><CardTitle className="text-base">Incident Lifecycle</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-0">
            {timelineSteps.map((step, idx) => {
              const stepOrder = statusOrder[step.status]
              const isComplete = currentStep > stepOrder
              const isCurrent = currentStep === stepOrder
              const isLast = idx === timelineSteps.length - 1
              return (
                <div key={step.status} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                      isComplete ? "bg-green-500 border-green-500 text-white" :
                      isCurrent ? "bg-blue-500 border-blue-500 text-white" :
                      "bg-background border-muted-foreground/30 text-muted-foreground"
                    )}>
                      {isComplete ? "✓" : idx + 1}
                    </div>
                    <span className={cn(
                      "text-xs mt-1 text-center whitespace-nowrap",
                      isCurrent ? "font-semibold text-blue-700" :
                      isComplete ? "text-green-700" :
                      "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div className={cn(
                      "h-0.5 flex-1 mx-1 mb-5 transition-all",
                      currentStep > stepOrder ? "bg-green-400" : "bg-muted"
                    )} />
                  )}
                </div>
              )
            })}
          </div>
          {incident.status === "REOPENED" && (
            <p className="text-xs text-red-600 font-medium mt-3 text-center">This incident has been reopened for reinvestigation.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{incident.description}</p>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t text-sm">
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium mt-0.5">{incident.type.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Reported At</span>
                  <p className="font-medium mt-0.5">{formatDateTime(incident.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Injured Persons */}
          {injuredPersons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-red-500" />
                  Injured Persons ({injuredPersons.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {injuredPersons.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.injuryType}</p>
                      </div>
                      <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {p.severity?.replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Investigation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-500" />
                Investigation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-sm text-muted-foreground">Investigator</span>
                <p className="text-sm font-medium mt-0.5">
                  {incident.investigator ? (userMap[incident.investigator]?.name ?? "Assigned") : "Not assigned"}
                </p>
              </div>
              {incident.rootCause && (
                <div>
                  <span className="text-sm text-muted-foreground">Root Cause Analysis</span>
                  <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md whitespace-pre-wrap">{incident.rootCause}</p>
                </div>
              )}
              {!incident.rootCause && incident.status === "UNDER_INVESTIGATION" && (
                <p className="text-xs text-muted-foreground italic">Root cause analysis pending…</p>
              )}
            </CardContent>
          </Card>

          {/* Corrective Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-500" />
                Corrective Actions ({correctiveActions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {correctiveActions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No corrective actions defined yet</p>
              ) : (
                <div className="space-y-3">
                  {correctiveActions.map((ca) => (
                    <div key={ca.id} className="p-3 bg-muted/30 rounded-lg border">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium flex-1">{ca.description}</p>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap",
                          ca.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                          ca.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        )}>
                          {ca.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Responsible: <span className="font-medium text-foreground">{ca.responsiblePerson}</span></span>
                        <span>Due: <span className="font-medium text-foreground">{formatDate(ca.dueDate)}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Witnesses */}
          {incident.witnesses.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Witnesses</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {incident.witnesses.map((w, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {w}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <IncidentActions
            incidentId={incident.id}
            currentStatus={incident.status}
            workspaceUsers={workspaceUsers.map((m) => ({ id: m.user.id, name: m.user.name }))}
            currentInvestigator={incident.investigator}
            correctiveActions={correctiveActions}
          />
        </div>
      </div>
    </div>
  )
}
