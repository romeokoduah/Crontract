/**
 * Signal gathering for the creditworthiness engine.
 *
 * All queries are workspace-scoped. This is the only file in the engine that
 * touches the database; it reduces raw records to the primitive `CreditSignals`
 * the pure scorer consumes. Kept intentionally cheap (aggregates + a bounded
 * window of invoices) so it can run inline on a page load.
 */
import { prisma } from "@/lib/db"
import { type CreditSignals } from "./types"

const DAY = 86_400_000
const dec = (v: unknown): number =>
  typeof v === "object" && v !== null && "toString" in v
    ? Number((v as { toString(): string }).toString())
    : Number(v ?? 0)

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export async function gatherSignals(workspaceId: string): Promise<CreditSignals> {
  const now = Date.now()
  const since90 = new Date(now - 90 * DAY)
  const since180 = new Date(now - 180 * DAY)
  const since180Months = new Date(now - 190 * DAY)

  const [
    workspace,
    invoicesWindow,
    openInvoices,
    invoiceCounts,
    openBills,
    poCount,
    vendorCount,
    glCount,
    headcount,
    auditAgg,
    lastAudit,
    severeIncidents,
    hseIncidentAny,
  ] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { currency: true, createdAt: true, modules: true } }),
    // Issued invoices over the last ~6 months for revenue scale/consistency + concentration.
    prisma.invoice.findMany({
      where: { workspaceId, status: { in: ["SENT", "PAID", "OVERDUE"] }, issueDate: { gte: since180Months } },
      select: { total: true, issueDate: true, customerName: true },
      take: 3000,
    }),
    // Currently open receivables for aging.
    prisma.invoice.findMany({
      where: { workspaceId, status: { in: ["SENT", "OVERDUE"] } },
      select: { total: true, dueDate: true },
      take: 3000,
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: { _all: true },
    }),
    prisma.bill.findMany({
      where: { workspaceId, status: { in: ["RECEIVED", "APPROVED"] } },
      select: { total: true, dueDate: true },
      take: 3000,
    }),
    prisma.purchaseOrder.count({ where: { workspaceId } }),
    prisma.vendor.count({ where: { workspaceId, isActive: true } }),
    prisma.account_GL.count({ where: { workspaceId } }),
    prisma.employee.count({ where: { workspaceId, status: "ACTIVE" } }),
    prisma.auditLog.count({ where: { workspaceId, createdAt: { gte: since90 } } }),
    prisma.auditLog.findFirst({ where: { workspaceId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.incident.count({ where: { workspaceId, incidentDate: { gte: since180 }, severity: { in: ["MAJOR", "FATAL"] } } }),
    prisma.incident.count({ where: { workspaceId } }),
  ])

  const currency = workspace?.currency ?? "GHS"
  const monthsActive = workspace?.createdAt
    ? Math.max(0, Math.floor((now - workspace.createdAt.getTime()) / (30 * DAY)))
    : 0

  // Revenue windows + monthly series + concentration from the 6-month window.
  const byMonth = new Map<string, number>()
  const byCustomer = new Map<string, number>()
  let trailingRevenue90d = 0
  for (const inv of invoicesWindow) {
    const amt = dec(inv.total)
    const mk = monthKey(inv.issueDate)
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + amt)
    const cust = inv.customerName || "—"
    byCustomer.set(cust, (byCustomer.get(cust) ?? 0) + amt)
    if (inv.issueDate >= since90) trailingRevenue90d += amt
  }
  const monthlyRevenue = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 6)
    .map(([, v]) => v)

  const revenueTotalWindow = [...byCustomer.values()].reduce((a, b) => a + b, 0)
  const topCustomer = [...byCustomer.values()].sort((a, b) => b - a)[0] ?? 0
  const topCustomerShare = revenueTotalWindow > 0 ? topCustomer / revenueTotalWindow : 0

  // Receivables aging.
  let arOpenTotal = 0
  let arOverdue60Plus = 0
  for (const inv of openInvoices) {
    const amt = dec(inv.total)
    arOpenTotal += amt
    const overdueDays = Math.floor((now - inv.dueDate.getTime()) / DAY)
    if (overdueDays > 60) arOverdue60Plus += amt
  }

  // Payables discipline.
  let apOpenTotal = 0
  let apOverdueCount = 0
  for (const bill of openBills) {
    apOpenTotal += dec(bill.total)
    if (Math.floor((now - bill.dueDate.getTime()) / DAY) > 0) apOverdueCount += 1
  }
  const apOverdueRatio = openBills.length > 0 ? apOverdueCount / openBills.length : 0

  // Paid ratio from status counts.
  const counts = Object.fromEntries(invoiceCounts.map((c) => [c.status, c._count._all]))
  const issuedCount =
    (counts.SENT ?? 0) + (counts.PAID ?? 0) + (counts.OVERDUE ?? 0)
  const paidInvoiceRatio = issuedCount > 0 ? (counts.PAID ?? 0) / issuedCount : 0

  const lastActivityDaysAgo = lastAudit?.createdAt
    ? Math.floor((now - lastAudit.createdAt.getTime()) / DAY)
    : 999

  const usesHse = (workspace?.modules?.includes("hse") ?? false) || hseIncidentAny > 0

  return {
    currency,
    monthsActive,
    trailingRevenue90d,
    monthlyRevenue,
    issuedInvoiceCount: issuedCount,
    paidInvoiceRatio,
    arOpenTotal,
    arOverdue60Plus,
    topCustomerShare,
    distinctCustomers: byCustomer.size,
    apOpenTotal,
    apOverdueRatio,
    purchaseOrderCount: poCount,
    vendorCount,
    glAccountCount: glCount,
    headcount,
    auditEvents90d: auditAgg,
    lastActivityDaysAgo,
    usesHse,
    severeIncidents180d: severeIncidents,
  }
}
