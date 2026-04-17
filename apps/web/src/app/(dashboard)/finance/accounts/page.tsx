import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Plus, BarChart3, ChevronRight } from "lucide-react"

type Account = {
  id: string
  code: string
  name: string
  type: string
  isActive: boolean
  parentId: string | null
  children?: Account[]
}

const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
  ASSET: { label: "Assets", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  LIABILITY: { label: "Liabilities", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  EQUITY: { label: "Equity", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  REVENUE: { label: "Revenue", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  EXPENSE: { label: "Expenses", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
}

function buildTree(accounts: Account[]): Account[] {
  const map = new Map<string, Account>()
  accounts.forEach((a) => map.set(a.id, { ...a, children: [] }))
  const roots: Account[] = []
  map.forEach((account) => {
    if (account.parentId && map.has(account.parentId)) {
      map.get(account.parentId)!.children!.push(account)
    } else {
      roots.push(account)
    }
  })
  return roots
}

function AccountRow({ account, depth = 0 }: { account: Account; depth?: number }) {
  return (
    <>
      <div className={cn(
        "flex items-center gap-3 py-2.5 px-4 border-b last:border-0 hover:bg-muted/30 transition-colors",
        depth > 0 && "bg-muted/10"
      )}>
        <div style={{ paddingLeft: `${depth * 20}px` }} className="flex items-center gap-2 flex-1 min-w-0">
          {depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
          <span className="font-mono text-xs text-muted-foreground w-16 flex-shrink-0">{account.code}</span>
          <span className={cn("text-sm font-medium truncate", depth === 0 && "font-semibold")}>{account.name}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full border font-medium",
            account.isActive
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-gray-100 text-gray-500 border-gray-200"
          )}>
            {account.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
      {account.children?.map((child) => (
        <AccountRow key={child.id} account={child} depth={depth + 1} />
      ))}
    </>
  )
}

export default async function AccountsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const rawAccounts = await prisma.account_GL.findMany({
    where: { workspaceId },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  })

  const tree = buildTree(rawAccounts as Account[])

  const byType = (type: string) => tree.filter((a) => a.type === type)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your general ledger accounts</p>
        </div>
        <Button asChild>
          <Link href="/finance/accounts/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Link>
        </Button>
      </div>

      {rawAccounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">No accounts yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6">Set up your chart of accounts to get started</p>
            <Button asChild>
              <Link href="/finance/accounts/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(typeConfig).map(([type, cfg]) => {
            const accounts = byType(type)
            if (accounts.length === 0) return null
            return (
              <Card key={type} className={cn("border-l-4", cfg.bg.split(" ")[1])}>
                <CardHeader className={cn("py-3 px-4 border-b", cfg.bg)}>
                  <CardTitle className={cn("text-sm font-semibold uppercase tracking-wider", cfg.color)}>
                    {cfg.label}
                    <span className="ml-2 font-normal text-xs opacity-60">({rawAccounts.filter((a) => a.type === type).length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {accounts.map((account) => (
                    <AccountRow key={account.id} account={account} />
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
