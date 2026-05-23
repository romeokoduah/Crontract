import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { cn, formatDate, formatCurrency, getInitials } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ArrowLeft, Mail, Phone, Calendar, Building2, User, Briefcase, Edit } from "lucide-react"

const statusColorClass: Record<string, string> = {
  ACTIVE: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
  ON_LEAVE: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  SUSPENDED: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
  TERMINATED: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
  RESIGNED: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
}

const statusLabel: Record<string, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On Leave",
  SUSPENDED: "Suspended",
  TERMINATED: "Terminated",
  RESIGNED: "Resigned",
}

const employmentTypeLabel: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERN: "Intern",
  VOLUNTEER: "Volunteer",
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) return notFound()

  const employee = await prisma.employee.findFirst({
    where: {
      id: params.id,
      workspaceId: session.user.workspaceId,
      deletedAt: null,
    },
    include: {
      department: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
      reports: {
        where: { deletedAt: null },
        select: { id: true, firstName: true, lastName: true, jobTitle: true },
      },
    },
  })

  if (!employee) return notFound()

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "employee",
      entityId: params.id,
      workspaceId: session.user.workspaceId,
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  const fullName = `${employee.firstName} ${employee.lastName}`

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/people">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to People
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
              {getInitials(fullName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {employee.jobTitle && (
                <span className="text-sm text-muted-foreground">{employee.jobTitle}</span>
              )}
              {employee.department && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-sm text-muted-foreground">{employee.department.name}</span>
                </>
              )}
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-medium border",
                  statusColorClass[employee.status]
                )}
              >
                {statusLabel[employee.status]}
              </Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/people/${params.id}/edit`}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Personal Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={employee.email} />
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="Phone"
                  value={employee.phone ?? "—"}
                />
                <InfoRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="Department"
                  value={employee.department?.name ?? "—"}
                />
                <InfoRow
                  icon={<User className="h-4 w-4" />}
                  label="Manager"
                  value={
                    employee.manager
                      ? `${employee.manager.firstName} ${employee.manager.lastName}`
                      : "—"
                  }
                />
              </CardContent>
            </Card>

            {/* Employment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Employment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow label="Employee #" value={employee.employeeNumber} />
                <InfoRow label="Job Title" value={employee.jobTitle ?? "—"} />
                <InfoRow label="Type" value={employmentTypeLabel[employee.employmentType]} />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Start Date"
                  value={formatDate(employee.startDate)}
                />
                {employee.endDate && (
                  <InfoRow label="End Date" value={formatDate(employee.endDate)} />
                )}
                {employee.basicSalary && (
                  <InfoRow label="Basic Salary" value={formatCurrency(Number(employee.basicSalary))} />
                )}
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            {(employee.emergencyName || employee.emergencyPhone) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoRow label="Name" value={employee.emergencyName ?? "—"} />
                  <InfoRow label="Phone" value={employee.emergencyPhone ?? "—"} />
                </CardContent>
              </Card>
            )}

            {/* Direct Reports */}
            {employee.reports.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Direct Reports ({employee.reports.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {employee.reports.map((r) => (
                    <Link
                      key={r.id}
                      href={`/people/${r.id}`}
                      className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(`${r.firstName} ${r.lastName}`)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{r.firstName} {r.lastName}</p>
                        {r.jobTitle && <p className="text-xs text-muted-foreground">{r.jobTitle}</p>}
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">
                Document management coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 text-sm">
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-primary/40 shrink-0" />
                      <div>
                        <span className="font-medium">{log.user.name}</span>
                        {" "}
                        {log.action.toLowerCase()}d this employee record
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Intl.DateTimeFormat("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
      <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
      <Separator orientation="vertical" className="h-4" />
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
