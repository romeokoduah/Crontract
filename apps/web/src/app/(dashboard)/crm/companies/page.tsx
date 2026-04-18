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
import { formatCurrency, cn } from "@/lib/utils"
import { Plus, Briefcase } from "lucide-react"

const sizeConfig: Record<string, { label: string; className: string }> = {
  SMALL: { label: "Small", className: "bg-gray-100 text-gray-700" },
  MEDIUM: { label: "Medium", className: "bg-blue-100 text-blue-700" },
  LARGE: { label: "Large", className: "bg-purple-100 text-purple-700" },
  ENTERPRISE: { label: "Enterprise", className: "bg-violet-100 text-violet-700" },
}

export default async function CompaniesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const companies = await prisma.crmCompany.findMany({
    where: { workspaceId, deletedAt: null },
    include: {
      _count: { select: { contacts: true, deals: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">Manage your CRM companies</p>
        </div>
        <Button asChild>
          <Link href="/crm/companies/new">
            <Plus className="h-4 w-4 mr-2" />
            New Company
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No companies yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Add your first company to get started</p>
              <Button asChild>
                <Link href="/crm/companies/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Company
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-center">Contacts</TableHead>
                  <TableHead className="text-center">Deals</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => {
                  const sCfg = company.size ? sizeConfig[company.size] : null
                  return (
                    <TableRow key={company.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell className="text-muted-foreground">{company.industry ?? "-"}</TableCell>
                      <TableCell>
                        {sCfg ? (
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sCfg.className)}>
                            {sCfg.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{company._count.contacts}</TableCell>
                      <TableCell className="text-center">{company._count.deals}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {company.annualRevenue ? formatCurrency(Number(company.annualRevenue)) : "-"}
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
