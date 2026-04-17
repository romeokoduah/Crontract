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
import { Plus, Building2, Star } from "lucide-react"

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-3.5 w-3.5",
            star <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"
          )}
        />
      ))}
    </div>
  )
}

export default async function VendorsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const vendors = await prisma.vendor.findMany({
    where: { workspaceId, deletedAt: null },
    include: {
      _count: { select: { purchaseOrders: true } },
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground">Manage your vendor master list</p>
        </div>
        <Button asChild>
          <Link href="/procurement/vendors/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {vendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No vendors yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Add your first vendor to start creating purchase orders</p>
              <Button asChild>
                <Link href="/procurement/vendors/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vendor
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>POs</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow key={vendor.id} className="hover:bg-muted/30">
                    <TableCell className="font-semibold">{vendor.name}</TableCell>
                    <TableCell className="text-muted-foreground">{vendor.contactName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{vendor.email ?? "—"}</TableCell>
                    <TableCell>
                      {vendor.category ? (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{vendor.category}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{vendor._count.purchaseOrders}</span>
                    </TableCell>
                    <TableCell>
                      <StarRating rating={vendor.rating} />
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full border font-medium",
                        vendor.isActive
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-gray-100 text-gray-500 border-gray-200"
                      )}>
                        {vendor.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
