"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { cn, formatDate, getInitials } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"

type Employee = {
  id: string
  firstName: string
  lastName: string
  email: string
  employeeNumber: string
  jobTitle: string | null
  status: "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "TERMINATED" | "RESIGNED"
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN" | "VOLUNTEER"
  startDate: string
  department: { id: string; name: string } | null
  manager: { id: string; firstName: string; lastName: string } | null
}

type Department = { id: string; name: string }

interface PeopleTableProps {
  employees: Employee[]
  departments: Department[]
}

const statusConfig: Record<
  Employee["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ACTIVE: { label: "Active", variant: "default" },
  ON_LEAVE: { label: "On Leave", variant: "secondary" },
  SUSPENDED: { label: "Suspended", variant: "outline" },
  TERMINATED: { label: "Terminated", variant: "destructive" },
  RESIGNED: { label: "Resigned", variant: "destructive" },
}

const statusColorClass: Record<Employee["status"], string> = {
  ACTIVE: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
  ON_LEAVE: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  SUSPENDED: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
  TERMINATED: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
  RESIGNED: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
}

const employmentTypeLabel: Record<Employee["employmentType"], string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERN: "Intern",
  VOLUNTEER: "Volunteer",
}

type SortField = "name" | "department" | "status" | "startDate"
type SortDir = "asc" | "desc"

export function PeopleTable({ employees, departments }: PeopleTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [deptFilter, setDeptFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const filtered = useMemo(() => {
    let list = [...employees]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.employeeNumber.toLowerCase().includes(q) ||
          (e.jobTitle?.toLowerCase().includes(q) ?? false)
      )
    }

    if (deptFilter !== "all") {
      list = list.filter((e) => e.department?.id === deptFilter)
    }

    if (statusFilter !== "all") {
      list = list.filter((e) => e.status === statusFilter)
    }

    list.sort((a, b) => {
      let cmp = 0
      if (sortField === "name") {
        cmp = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
      } else if (sortField === "department") {
        cmp = (a.department?.name ?? "").localeCompare(b.department?.name ?? "")
      } else if (sortField === "status") {
        cmp = a.status.localeCompare(b.status)
      } else if (sortField === "startDate") {
        cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return list
  }, [employees, search, deptFilter, statusFilter, sortField, sortDir])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or employee #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ON_LEAVE">On Leave</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="TERMINATED">Terminated</SelectItem>
            <SelectItem value="RESIGNED">Resigned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 font-medium"
                  onClick={() => toggleSort("name")}
                >
                  Name
                  <ArrowUpDown className="ml-1 h-3 w-3 opacity-60" />
                </Button>
              </TableHead>
              <TableHead>Employee #</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 font-medium"
                  onClick={() => toggleSort("department")}
                >
                  Department
                  <ArrowUpDown className="ml-1 h-3 w-3 opacity-60" />
                </Button>
              </TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 font-medium"
                  onClick={() => toggleSort("status")}
                >
                  Status
                  <ArrowUpDown className="ml-1 h-3 w-3 opacity-60" />
                </Button>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 font-medium"
                  onClick={() => toggleSort("startDate")}
                >
                  Start Date
                  <ArrowUpDown className="ml-1 h-3 w-3 opacity-60" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No employees match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((emp) => (
                <TableRow
                  key={emp.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/people/${emp.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                          {getInitials(`${emp.firstName} ${emp.lastName}`)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{emp.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {emp.employeeNumber}
                  </TableCell>
                  <TableCell className="text-sm">
                    {emp.department?.name ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {emp.jobTitle ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-medium border",
                        statusColorClass[emp.status]
                      )}
                    >
                      {statusConfig[emp.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {employmentTypeLabel[emp.employmentType]}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(emp.startDate)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-right">
        Showing {filtered.length} of {employees.length} employee{employees.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
