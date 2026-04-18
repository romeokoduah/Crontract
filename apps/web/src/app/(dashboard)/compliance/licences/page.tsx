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
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { Plus, Shield } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-green-100 text-green-700 border-green-200" },
  EXPIRING_SOON: { label: "Expiring Soon", className: "bg-amber-100 text-amber-700 border-amber-200" },
  EXPIRED: { label: "Expired", className: "bg-red-100 text-red-700 border-red-200" },
  SUSPENDED: { label: "Suspended", className: "bg-gray-100 text-gray-500 border-gray-200" },
  REVOKED: { label: "Revoked", className: "bg-red-100 text-red-700 border-red-200" },
}

export default async function LicencesPage() {
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

  // Auto-update expired licences
  await prisma.licence.updateMany({
    where: {
      workspaceId,
      deletedAt: null,
      status: { in: ["ACTIVE", "EXPIRING_SOON"] },
      expiryDate: { lt: now },
    },
    data: { status: "EXPIRED" },
  })

  const licences = await prisma.licence.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { expiryDate: "asc" },
  })

  const totals = {
    total: licences.length,
    active: licences.filter((l) => l.status === "ACTIVE").length,
    expiringSoon: licences.filter((l) => l.status === "EXPIRING_SOON").length,
    expired: licences.filter((l) => l.status === "EXPIRED").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Licences</h1>
          <p className="text-muted-foreground">Manage your regulatory licences and permits</p>
        </div>
        <Button asChild>
          <Link href="/compliance/licences/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Licence
          </Link>
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: totals.total, color: "text-blue-600" },
          { label: "Active", value: totals.active, color: "text-green-600" },
          { label: "Expiring Soon", value: totals.expiringSoon, color: "text-amber-600" },
          { label: "Expired", value: totals.expired, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-lg font-bold mt-1", color)}>{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {licences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No licences yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Add your first licence to start tracking</p>
              <Button asChild>
                <Link href="/compliance/licences/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Licence
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Licence #</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Renewal Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licences.map((licence) => {
                  const sc = statusConfig[licence.status] ?? statusConfig.ACTIVE
                  const isExpired = licence.status === "EXPIRED"
                  return (
                    <TableRow key={licence.id} className={cn("hover:bg-muted/30", isExpired && "bg-red-50/50")}>
                      <TableCell className="font-medium">{licence.name}</TableCell>
                      <TableCell className="text-muted-foreground">{licence.issuingAuthority}</TableCell>
                      <TableCell className="font-mono text-sm">{licence.licenceNumber}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(licence.issueDate)}</TableCell>
                      <TableCell className={cn("text-muted-foreground", isExpired && "text-red-600 font-medium")}>
                        {formatDate(licence.expiryDate)}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", sc.className)}>
                          {sc.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {licence.renewalCost ? formatCurrency(Number(licence.renewalCost), licence.currency) : "-"}
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
