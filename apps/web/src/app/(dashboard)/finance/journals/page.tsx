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
import { Plus, BookOpen } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  POSTED: { label: "Posted", className: "bg-green-100 text-green-700 border-green-200" },
  REVERSED: { label: "Reversed", className: "bg-red-100 text-red-700 border-red-200" },
}

export default async function JournalsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const journals = await prisma.journal.findMany({
    where: { workspaceId },
    include: {
      lines: {
        include: { account: { select: { name: true, code: true } } },
      },
    },
    orderBy: { date: "desc" },
  })

  const enriched = journals.map((j) => {
    const totalDebit = j.lines.reduce((s, l) => s + Number(l.debit), 0)
    const totalCredit = j.lines.reduce((s, l) => s + Number(l.credit), 0)
    return { ...j, totalDebit, totalCredit }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journal Entries</h1>
          <p className="text-muted-foreground">General ledger journal entries</p>
        </div>
        <Button asChild>
          <Link href="/finance/journals/new">
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {enriched.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No journal entries yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Create manual journal entries to record transactions</p>
              <Button asChild>
                <Link href="/finance/journals/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Entry
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map((journal) => {
                  const cfg = statusConfig[journal.status] ?? statusConfig.DRAFT
                  const balanced = Math.abs(journal.totalDebit - journal.totalCredit) < 0.01
                  return (
                    <TableRow key={journal.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm font-semibold">{journal.number}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(journal.date)}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{journal.description}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{journal.reference ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {journal.totalDebit.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {journal.totalCredit.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", cfg.className)}>
                            {cfg.label}
                          </span>
                          {!balanced && (
                            <span className="text-xs text-red-600 font-medium">Unbalanced</span>
                          )}
                        </div>
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
