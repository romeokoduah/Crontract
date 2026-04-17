import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatDateTime } from "@/lib/utils"
import { Calendar, Plus, MapPin, Users, Clock } from "lucide-react"

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
}

export default async function MeetingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId
  const now = new Date()

  const meetings = await prisma.meeting.findMany({
    where: { workspaceId },
    orderBy: { startTime: "asc" },
  })

  // Enrich with project names
  const projectIds = [...new Set(meetings.map((m) => m.projectId).filter(Boolean))] as string[]
  const projects = projectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true },
      })
    : []
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]))

  const upcoming = meetings.filter(
    (m) => m.status !== "CANCELLED" && m.status !== "COMPLETED" && new Date(m.startTime) >= now
  )
  const past = meetings.filter(
    (m) => m.status === "COMPLETED" || m.status === "CANCELLED" || new Date(m.startTime) < now
  )

  function MeetingRow({ m }: { m: (typeof meetings)[0] }) {
    const project = m.projectId ? projectMap[m.projectId] : null
    const agendaItems = Array.isArray(m.agenda) ? (m.agenda as { topic: string; duration?: number }[]) : []
    return (
      <div className="flex items-start gap-4 p-4 hover:bg-muted/40 transition-colors border-b last:border-0">
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link href={`/meetings/${m.id}`} className="font-semibold hover:underline line-clamp-1">
                {m.title}
              </Link>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDateTime(m.startTime)}
                </span>
                {m.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {m.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {m.attendees.length} attendee{m.attendees.length !== 1 ? "s" : ""}
                </span>
                {agendaItems.length > 0 && (
                  <span className="text-xs">{agendaItems.length} agenda item{agendaItems.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {project && (
                <Link
                  href={`/projects/${project.id}`}
                  className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded hidden sm:block"
                >
                  {project.name}
                </Link>
              )}
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap",
                  statusColors[m.status]
                )}
              >
                {m.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Meetings
          </h1>
          <p className="text-muted-foreground">
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        <Button asChild>
          <Link href="/meetings/new">
            <Plus className="h-4 w-4 mr-2" />
            Schedule Meeting
          </Link>
        </Button>
      </div>

      {/* Upcoming */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Upcoming ({upcoming.length})
        </h2>
        <Card>
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No upcoming meetings scheduled</p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link href="/meetings/new">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Schedule one
                  </Link>
                </Button>
              </div>
            ) : (
              upcoming.map((m) => <MeetingRow key={m.id} m={m} />)
            )}
          </CardContent>
        </Card>
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Past ({past.length})
          </h2>
          <Card>
            <CardContent className="p-0">
              {past.map((m) => (
                <MeetingRow key={m.id} m={m} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
