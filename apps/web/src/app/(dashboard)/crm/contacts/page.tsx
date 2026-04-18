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
import { Plus, Briefcase } from "lucide-react"

const stageConfig: Record<string, { label: string; className: string }> = {
  LEAD: { label: "Lead", className: "bg-blue-100 text-blue-700 border-blue-200" },
  PROSPECT: { label: "Prospect", className: "bg-purple-100 text-purple-700 border-purple-200" },
  OPPORTUNITY: { label: "Opportunity", className: "bg-amber-100 text-amber-700 border-amber-200" },
  CUSTOMER: { label: "Customer", className: "bg-green-100 text-green-700 border-green-200" },
  CHURNED: { label: "Churned", className: "bg-red-100 text-red-700 border-red-200" },
}

const sourceConfig: Record<string, { label: string; className: string }> = {
  WEB: { label: "Web", className: "bg-blue-50 text-blue-600" },
  REFERRAL: { label: "Referral", className: "bg-green-50 text-green-600" },
  EVENT: { label: "Event", className: "bg-purple-50 text-purple-600" },
  COLD_CALL: { label: "Cold Call", className: "bg-amber-50 text-amber-600" },
  SOCIAL: { label: "Social", className: "bg-pink-50 text-pink-600" },
  OTHER: { label: "Other", className: "bg-gray-50 text-gray-600" },
}

export default async function ContactsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const contacts = await prisma.crmContact.findMany({
    where: { workspaceId, deletedAt: null },
    include: { company: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })

  const stageTotals = {
    LEAD: contacts.filter((c) => c.lifecycleStage === "LEAD").length,
    PROSPECT: contacts.filter((c) => c.lifecycleStage === "PROSPECT").length,
    OPPORTUNITY: contacts.filter((c) => c.lifecycleStage === "OPPORTUNITY").length,
    CUSTOMER: contacts.filter((c) => c.lifecycleStage === "CUSTOMER").length,
    CHURNED: contacts.filter((c) => c.lifecycleStage === "CHURNED").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">Manage your CRM contacts</p>
        </div>
        <Button asChild>
          <Link href="/crm/contacts/new">
            <Plus className="h-4 w-4 mr-2" />
            New Contact
          </Link>
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(["LEAD", "PROSPECT", "OPPORTUNITY", "CUSTOMER", "CHURNED"] as const).map((stage) => {
          const cfg = stageConfig[stage]
          return (
            <Card key={stage} className="p-4">
              <p className="text-xs text-muted-foreground">{cfg.label}</p>
              <p className={cn("text-lg font-bold mt-1", cfg.className.split(" ").pop())}>{stageTotals[stage]}</p>
              <p className="text-xs text-muted-foreground">{stageTotals[stage] === 1 ? "contact" : "contacts"}</p>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No contacts yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Add your first contact to get started</p>
              <Button asChild>
                <Link href="/crm/contacts/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Contact
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Last Contacted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => {
                  const sCfg = stageConfig[contact.lifecycleStage] ?? stageConfig.LEAD
                  const srcCfg = contact.source ? sourceConfig[contact.source] : null
                  return (
                    <TableRow key={contact.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{contact.firstName} {contact.lastName}</TableCell>
                      <TableCell className="text-muted-foreground">{contact.company?.name ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{contact.email ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{contact.phone ?? "-"}</TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", sCfg.className)}>
                          {sCfg.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {srcCfg ? (
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", srcCfg.className)}>
                            {srcCfg.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contact.lastContactedAt ? formatDate(contact.lastContactedAt) : "-"}
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
