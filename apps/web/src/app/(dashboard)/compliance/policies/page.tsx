import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
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
import { Plus, Shield } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  IN_REVIEW: { label: "In Review", className: "bg-blue-100 text-blue-700 border-blue-200" },
  ACTIVE: { label: "Active", className: "bg-green-100 text-green-700 border-green-200" },
  ARCHIVED: { label: "Archived", className: "bg-gray-100 text-gray-500 border-gray-200" },
  SUPERSEDED: { label: "Superseded", className: "bg-amber-100 text-amber-700 border-amber-200" },
}

export default async function PoliciesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const policies = await prisma.policy.findMany({
    where: { workspaceId: session.user.workspaceId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  })

  const totals = {
    total: policies.length,
    active: policies.filter((p) => p.status === "ACTIVE").length,
    draft: policies.filter((p) => p.status === "DRAFT").length,
    inReview: policies.filter((p) => p.status === "IN_REVIEW").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policies</h1>
          <p className="text-muted-foreground">Manage your organisational policies</p>
        </div>
        <Button asChild>
          <Link href="/compliance/policies/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Policy
          </Link>
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: totals.total, color: "text-blue-600" },
          { label: "Active", value: totals.active, color: "text-green-600" },
          { label: "Draft", value: totals.draft, color: "text-gray-600" },
          { label: "In Review", value: totals.inReview, color: "text-blue-600" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-lg font-bold mt-1", color)}>{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {policies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No policies yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Create your first policy to get started</p>
              <Button asChild>
                <Link href="/compliance/policies/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Policy
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Review Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => {
                  const sc = statusConfig[policy.status] ?? statusConfig.DRAFT
                  return (
                    <TableRow key={policy.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm font-semibold">{policy.policyNumber}</TableCell>
                      <TableCell className="font-medium">{policy.title}</TableCell>
                      <TableCell className="text-muted-foreground">{policy.category}</TableCell>
                      <TableCell className="text-muted-foreground">v{policy.version}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(policy.effectiveDate)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {policy.reviewDate ? formatDate(policy.reviewDate) : "-"}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", sc.className)}>
                          {sc.label}
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
