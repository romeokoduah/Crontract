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
import { cn } from "@/lib/utils"
import { Plus, Heart } from "lucide-react"

const typeConfig: Record<string, { label: string; className: string }> = {
  BILATERAL: { label: "Bilateral", className: "bg-blue-100 text-blue-700 border-blue-200" },
  MULTILATERAL: { label: "Multilateral", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  FOUNDATION: { label: "Foundation", className: "bg-purple-100 text-purple-700 border-purple-200" },
  CORPORATE: { label: "Corporate", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  GOVERNMENT: { label: "Government", className: "bg-amber-100 text-amber-700 border-amber-200" },
  INDIVIDUAL: { label: "Individual", className: "bg-gray-100 text-gray-700 border-gray-200" },
}

export default async function DonorsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const donors = await prisma.donor.findMany({
    where: { workspaceId, deletedAt: null },
    include: {
      _count: { select: { grants: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const totalDonors = donors.length
  const activeDonors = donors.filter((d) => d.isActive).length

  // Count by type
  const typeCounts: Record<string, number> = {}
  donors.forEach((d) => {
    typeCounts[d.type] = (typeCounts[d.type] || 0) + 1
  })

  // Top 2 types for summary
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Donors</h1>
          <p className="text-muted-foreground">Manage your grant donors and funding partners</p>
        </div>
        <Button asChild className="bg-pink-600 hover:bg-pink-700">
          <Link href="/grants/donors/new">
            <Plus className="h-4 w-4 mr-2" />
            New Donor
          </Link>
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Donors</p>
          <p className="text-lg font-bold mt-1 text-pink-600">{totalDonors}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-lg font-bold mt-1 text-green-600">{activeDonors}</p>
        </Card>
        {topTypes.map(([type, count]) => (
          <Card key={type} className="p-4">
            <p className="text-xs text-muted-foreground">{typeConfig[type]?.label ?? type}</p>
            <p className="text-lg font-bold mt-1 text-blue-600">{count}</p>
          </Card>
        ))}
        {topTypes.length === 0 && (
          <>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">-</p>
              <p className="text-lg font-bold mt-1 text-gray-400">0</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">-</p>
              <p className="text-lg font-bold mt-1 text-gray-400">0</p>
            </Card>
          </>
        )}
        {topTypes.length === 1 && (
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">-</p>
            <p className="text-lg font-bold mt-1 text-gray-400">0</p>
          </Card>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {donors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Heart className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No donors yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Add your first donor to get started</p>
              <Button asChild className="bg-pink-600 hover:bg-pink-700">
                <Link href="/grants/donors/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Donor
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-center">Grants</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donors.map((donor) => {
                  const cfg = typeConfig[donor.type] ?? typeConfig.INDIVIDUAL
                  return (
                    <TableRow key={donor.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{donor.name}</TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", cfg.className)}>
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{donor.country ?? "-"}</TableCell>
                      <TableCell className="text-center font-semibold">{donor._count.grants}</TableCell>
                      <TableCell className="text-muted-foreground">{donor.email ?? "-"}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-full font-medium",
                          donor.isActive
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : "bg-gray-100 text-gray-500 border border-gray-200"
                        )}>
                          {donor.isActive ? "Active" : "Inactive"}
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
