import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { Package, Plus, Activity, Wrench, DollarSign } from "lucide-react"

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  MAINTENANCE: "bg-amber-100 text-amber-700",
  CHECKED_OUT: "bg-blue-100 text-blue-700",
  RETIRED: "bg-gray-100 text-gray-500",
  DISPOSED: "bg-red-100 text-red-500",
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: { status?: string; categoryId?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId
  const { status, categoryId } = searchParams

  const [assets, categories] = await Promise.all([
    prisma.asset.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(status ? { status: status as "ACTIVE" | "MAINTENANCE" | "CHECKED_OUT" | "RETIRED" | "DISPOSED" } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { assetNumber: "asc" },
    }),
    prisma.assetCategory.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    }),
  ])

  // Enrich with assignee names
  const assigneeIds = Array.from(new Set(assets.map((a) => a.assignedTo).filter(Boolean))) as string[]
  const assignees = assigneeIds.length
    ? await prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true, name: true },
      })
    : []
  const assigneeMap = Object.fromEntries(assignees.map((u) => [u.id, u]))

  // Stats
  const totalAssets = assets.length
  const activeCount = assets.filter((a) => a.status === "ACTIVE").length
  const maintenanceCount = assets.filter((a) => a.status === "MAINTENANCE").length
  const totalValue = assets.reduce((s, a) => s + Number(a.currentValue), 0)

  function buildFilterUrl(key: string, value: string) {
    const params = new URLSearchParams({
      ...(status ? { status } : {}),
      ...(categoryId ? { categoryId } : {}),
    })
    if (params.get(key) === value) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    const q = params.toString()
    return `/assets${q ? `?${q}` : ""}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Asset Register
          </h1>
          <p className="text-muted-foreground">
            {totalAssets} asset{totalAssets !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button asChild>
          <Link href="/assets/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Assets</p>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mt-1">{totalAssets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Active</p>
              <Activity className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Under Maintenance</p>
              <Wrench className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-600">{maintenanceCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Value</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold mt-1">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground">Status:</span>
        {["ACTIVE", "MAINTENANCE", "CHECKED_OUT", "RETIRED", "DISPOSED"].map((s) => (
          <Link
            key={s}
            href={buildFilterUrl("status", s)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full font-medium transition-all",
              status === s
                ? statusColors[s] + " ring-2 ring-offset-1 ring-current"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {s.replace(/_/g, " ")}
          </Link>
        ))}
        {categories.length > 0 && (
          <>
            <span className="text-sm text-muted-foreground ml-3">Category:</span>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={buildFilterUrl("categoryId", c.id)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full font-medium transition-all",
                  categoryId === c.id
                    ? "bg-primary text-primary-foreground ring-2 ring-offset-1 ring-primary"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {c.name}
              </Link>
            ))}
          </>
        )}
        {(status || categoryId) && (
          <Link href="/assets" className="text-xs text-blue-600 hover:underline ml-2">
            Clear filters
          </Link>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No assets found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {status || categoryId ? "Try adjusting your filters" : "Add an asset using the button above"}
              </p>
              {!status && !categoryId && (
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link href="/assets/new">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Asset
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Asset #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Location</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell whitespace-nowrap">Purchase Cost</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell whitespace-nowrap">Current Value</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Assigned To</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell whitespace-nowrap">Purchase Date</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-primary">{asset.assetNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium line-clamp-1">{asset.name}</p>
                          {asset.serialNumber && (
                            <p className="text-xs text-muted-foreground font-mono">S/N: {asset.serialNumber}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                        {asset.category.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[150px] truncate">
                        {asset.location ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", statusColors[asset.status])}>
                          {asset.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono hidden lg:table-cell">
                        {formatCurrency(Number(asset.purchaseCost))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono hidden lg:table-cell">
                        {formatCurrency(Number(asset.currentValue))}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell whitespace-nowrap">
                        {asset.assignedTo ? (assigneeMap[asset.assignedTo]?.name ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell whitespace-nowrap">
                        {formatDate(asset.purchaseDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
