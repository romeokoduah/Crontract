import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Users, UserCheck, UserMinus, Building2, Plus } from "lucide-react"
import { PeopleTable } from "./people-table"

export default async function PeoplePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.department.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    }),
  ])

  const activeCount = employees.filter((e) => e.status === "ACTIVE").length
  const onLeaveCount = employees.filter((e) => e.status === "ON_LEAVE").length
  const departmentCount = departments.length

  const serialisedEmployees = employees.map((e) => ({
    ...e,
    salary: e.salary ? Number(e.salary) : null,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    deletedAt: e.deletedAt?.toISOString() ?? null,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">People</h1>
          <p className="text-muted-foreground">Manage your team and employee records</p>
        </div>
        <Button asChild>
          <Link href="/people/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Link>
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-green-500/10 p-3">
                <UserCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-amber-500/10 p-3">
                <UserMinus className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">On Leave</p>
                <p className="text-2xl font-bold">{onLeaveCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-500/10 p-3">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Departments</p>
                <p className="text-2xl font-bold">{departmentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {employees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">No employees yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Add your first employee to get started
            </p>
            <Button asChild>
              <Link href="/people/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PeopleTable
          employees={serialisedEmployees}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        />
      )}
    </div>
  )
}
