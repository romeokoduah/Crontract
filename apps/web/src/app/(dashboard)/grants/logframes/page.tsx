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
import { formatDate } from "@/lib/utils"
import { ClipboardList } from "lucide-react"

export default async function LogframesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const logframes = await prisma.logframe.findMany({
    where: { workspaceId },
    include: {
      grant: { select: { title: true, grantNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Logframes</h1>
          <p className="text-muted-foreground">Results frameworks for your grants</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {logframes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No logframes yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Create your first results framework</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grant #</TableHead>
                  <TableHead>Grant Title</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead className="text-center">Outputs</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logframes.map((lf) => {
                  const outputs = Array.isArray(lf.outputs) ? lf.outputs : []
                  const goalTruncated = lf.goal.length > 80 ? lf.goal.substring(0, 80) + "..." : lf.goal
                  return (
                    <TableRow key={lf.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm font-semibold">{lf.grant.grantNumber}</TableCell>
                      <TableCell className="font-medium">{lf.grant.title}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs">{goalTruncated}</TableCell>
                      <TableCell className="text-center font-semibold">{outputs.length}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(lf.createdAt)}</TableCell>
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
