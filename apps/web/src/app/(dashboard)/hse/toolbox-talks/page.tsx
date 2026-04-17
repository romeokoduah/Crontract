import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDate } from "@/lib/utils"
import { HardHat, Plus, Users, MapPin, Calendar } from "lucide-react"

export default async function ToolboxTalksPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId
  const talks = await prisma.toolboxTalk.findMany({
    where: { workspaceId },
    orderBy: { date: "desc" },
  })

  const userIds = [...new Set(talks.map((t) => t.conductedBy))]
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : []
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  const totalAttendees = talks.reduce((sum, t) => {
    const attendees = t.attendees as { name: string }[]
    return sum + (Array.isArray(attendees) ? attendees.length : 0)
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HardHat className="h-6 w-6 text-amber-500" />
            Toolbox Talks
          </h1>
          <p className="text-muted-foreground">{talks.length} talk{talks.length !== 1 ? "s" : ""} — {totalAttendees} total attendees</p>
        </div>
        <Button asChild>
          <Link href="/hse/toolbox-talks/new">
            <Plus className="h-4 w-4 mr-2" />
            Record Talk
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Talks</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{talks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Attendees</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{totalAttendees}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">This Month</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {talks.filter((t) => {
                const d = new Date(t.date)
                const now = new Date()
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
              }).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {talks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <HardHat className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No toolbox talks recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1">Record your daily safety briefings</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {talks.map((talk) => {
            const attendees = talk.attendees as { name: string; signed?: boolean }[]
            const signedCount = attendees.filter((a) => a.signed).length
            return (
              <Card key={talk.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base">{talk.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{talk.topic}</p>
                      <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(talk.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {talk.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {attendees.length} attendees
                          {signedCount > 0 && <span className="text-green-600 font-medium">({signedCount} signed)</span>}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground">Conducted by</p>
                      <p className="text-sm font-medium">{userMap[talk.conductedBy]?.name ?? "Unknown"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
