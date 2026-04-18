import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, cn } from "@/lib/utils"
import { FileText } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-100 text-blue-700 border-blue-200" },
  ACCEPTED: { label: "Accepted", className: "bg-green-100 text-green-700 border-green-200" },
  REVISION_REQUESTED: { label: "Revision Requested", className: "bg-amber-100 text-amber-700 border-amber-200" },
}

const typeConfig: Record<string, { label: string; className: string }> = {
  NARRATIVE: { label: "Narrative", className: "bg-purple-100 text-purple-700 border-purple-200" },
  FINANCIAL: { label: "Financial", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  COMBINED: { label: "Combined", className: "bg-blue-100 text-blue-700 border-blue-200" },
}

export default async function ReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const reports = await prisma.grantReport.findMany({
    where: { workspaceId },
    include: {
      grant: { select: { title: true, grantNumber: true } },
    },
    orderBy: { dueDate: "desc" },
  })

  const totalReports = reports.length
  const draftCount = reports.filter((r) => r.status === "DRAFT").length
  const submittedCount = reports.filter((r) => r.status === "SUBMITTED").length
  const acceptedCount = reports.filter((r) => r.status === "ACCEPTED").length

  const now = new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Grant reporting and compliance tracking</p>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold mt-1 text-pink-600">{totalReports}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Draft</p>
          <p className="text-lg font-bold mt-1 text-gray-600">{draftCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Submitted</p>
          <p className="text-lg font-bold mt-1 text-blue-600">{submittedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Accepted</p>
          <p className="text-lg font-bold mt-1 text-green-600">{acceptedCount}</p>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No reports yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Reports will appear here once created</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report #</TableHead>
                  <TableHead>Grant</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => {
                  const sCfg = statusConfig[report.status] ?? statusConfig.DRAFT
                  const tCfg = typeConfig[report.type] ?? typeConfig.NARRATIVE
                  const isOverdue = report.status === "DRAFT" && new Date(report.dueDate) < now

                  return (
                    <TableRow key={report.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm font-semibold">{report.reportNumber}</TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <p>{report.grant.title}</p>
                          <p className="text-xs text-muted-foreground">{report.grant.grantNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{report.period}</TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", tCfg.className)}>
                          {tCfg.label}
                        </span>
                      </TableCell>
                      <TableCell className={cn(
                        "text-muted-foreground",
                        isOverdue && "text-red-600 font-medium"
                      )}>
                        {formatDate(report.dueDate)}
                        {isOverdue && (
                          <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                            Overdue
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", sCfg.className)}>
                          {sCfg.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
