/**
 * Finance read-tools for the Copilot.
 *
 * Every tool is workspace-scoped and READ-ONLY — this is the safe first slice of
 * the action registry (docs/AI_INTEGRATION_SPEC.md §3). Write/action tools get
 * added later behind confirmation + the approvals engine. Handlers live here (not
 * in @/lib/ai) so tenant isolation stays with the data access.
 */
import type { InvoiceStatus, BillStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { assessWorkspaceCredit } from "@/lib/credit"
import { type AgentTool } from "./types"

function num(v: unknown): number {
  // Prisma Decimal → number for JSON serialisation.
  return typeof v === "object" && v !== null && "toString" in v
    ? Number((v as { toString(): string }).toString())
    : Number(v ?? 0)
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

/** Statuses that represent money still owed (AR/AP). */
const OPEN_INVOICE: InvoiceStatus[] = ["SENT", "OVERDUE"]
const OPEN_BILL: BillStatus[] = ["RECEIVED", "APPROVED"]

export function buildFinanceTools(workspaceId: string): AgentTool[] {
  return [
    {
      name: "list_invoices",
      description:
        "List customer invoices (accounts receivable) for the workspace, newest first. " +
        "Optionally filter by status. Use for questions about what customers owe.",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"],
            description: "Filter to a single status.",
          },
          limit: { type: "number", description: "Max rows (default 25, max 100)." },
        },
      },
      execute: async (input) => {
        const limit = Math.min(Number(input.limit) || 25, 100)
        const status = typeof input.status === "string" ? input.status : undefined
        const rows = await prisma.invoice.findMany({
          where: { workspaceId, ...(status ? { status: status as never } : {}) },
          orderBy: { issueDate: "desc" },
          take: limit,
          select: {
            number: true, customerName: true, status: true, currency: true,
            total: true, issueDate: true, dueDate: true,
          },
        })
        return rows.map((r) => ({
          number: r.number,
          customer: r.customerName,
          status: r.status,
          currency: r.currency,
          total: num(r.total),
          issueDate: r.issueDate.toISOString().slice(0, 10),
          dueDate: r.dueDate.toISOString().slice(0, 10),
        }))
      },
    },
    {
      name: "list_bills",
      description:
        "List supplier bills (accounts payable) for the workspace, newest first. " +
        "Optionally filter by status. Use for questions about what the company owes suppliers.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter to a single bill status." },
          limit: { type: "number", description: "Max rows (default 25, max 100)." },
        },
      },
      execute: async (input) => {
        const limit = Math.min(Number(input.limit) || 25, 100)
        const status = typeof input.status === "string" ? input.status : undefined
        const rows = await prisma.bill.findMany({
          where: { workspaceId, ...(status ? { status: status as never } : {}) },
          orderBy: { issueDate: "desc" },
          take: limit,
          select: {
            number: true, status: true, currency: true, total: true,
            issueDate: true, dueDate: true, vendor: { select: { name: true } },
          },
        })
        return rows.map((r) => ({
          number: r.number,
          vendor: r.vendor?.name ?? "Unknown",
          status: r.status,
          currency: r.currency,
          total: num(r.total),
          issueDate: r.issueDate.toISOString().slice(0, 10),
          dueDate: r.dueDate.toISOString().slice(0, 10),
        }))
      },
    },
    {
      name: "list_expenses",
      description:
        "List expense claims for the workspace, newest first. Optionally filter by status or category.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter to a single expense status." },
          category: { type: "string", description: "Filter to a single category." },
          limit: { type: "number", description: "Max rows (default 25, max 100)." },
        },
      },
      execute: async (input) => {
        const limit = Math.min(Number(input.limit) || 25, 100)
        const status = typeof input.status === "string" ? input.status : undefined
        const category = typeof input.category === "string" ? input.category : undefined
        const rows = await prisma.expense.findMany({
          where: {
            workspaceId,
            ...(status ? { status: status as never } : {}),
            ...(category ? { category } : {}),
          },
          orderBy: { date: "desc" },
          take: limit,
          select: { description: true, amount: true, currency: true, category: true, status: true, date: true },
        })
        return rows.map((r) => ({
          description: r.description,
          amount: num(r.amount),
          currency: r.currency,
          category: r.category,
          status: r.status,
          date: r.date.toISOString().slice(0, 10),
        }))
      },
    },
    {
      name: "accounts_receivable_aging",
      description:
        "Compute an accounts-receivable ageing summary from open (SENT/OVERDUE) invoices: " +
        "totals bucketed by how overdue they are. Use for cash-position and collections questions.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const today = new Date()
        const invoices = await prisma.invoice.findMany({
          where: { workspaceId, status: { in: OPEN_INVOICE } },
          select: { total: true, dueDate: true, currency: true },
        })
        const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 }
        let totalOutstanding = 0
        for (const inv of invoices) {
          const amt = num(inv.total)
          totalOutstanding += amt
          const overdueDays = daysBetween(inv.dueDate, today)
          if (overdueDays <= 0) buckets.current += amt
          else if (overdueDays <= 30) buckets.d1_30 += amt
          else if (overdueDays <= 60) buckets.d31_60 += amt
          else if (overdueDays <= 90) buckets.d61_90 += amt
          else buckets.d90_plus += amt
        }
        return {
          openInvoiceCount: invoices.length,
          totalOutstanding: Number(totalOutstanding.toFixed(2)),
          buckets: Object.fromEntries(
            Object.entries(buckets).map(([k, v]) => [k, Number(v.toFixed(2))])
          ),
          note: "Amounts assume a single workspace currency; mixed currencies are summed nominally.",
        }
      },
    },
    {
      name: "cash_position_summary",
      description:
        "High-level cash position: total outstanding receivables (money in), total outstanding " +
        "payables (money out), overdue counts, and net position. Use for 'how are we doing' questions.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const today = new Date()
        const [openInvoices, openBills] = await Promise.all([
          prisma.invoice.findMany({
            where: { workspaceId, status: { in: OPEN_INVOICE } },
            select: { total: true, dueDate: true },
          }),
          prisma.bill.findMany({
            where: { workspaceId, status: { in: OPEN_BILL } },
            select: { total: true, dueDate: true },
          }),
        ])
        const sum = (rows: { total: unknown }[]) => rows.reduce((a, r) => a + num(r.total), 0)
        const overdue = (rows: { dueDate: Date }[]) =>
          rows.filter((r) => daysBetween(r.dueDate, today) > 0).length
        const receivables = sum(openInvoices)
        const payables = sum(openBills)
        return {
          outstandingReceivables: Number(receivables.toFixed(2)),
          outstandingPayables: Number(payables.toFixed(2)),
          netPosition: Number((receivables - payables).toFixed(2)),
          overdueInvoiceCount: overdue(openInvoices),
          overdueBillCount: overdue(openBills),
          note: "Nominal sums across the workspace's records; not a substitute for a posted cash-flow statement.",
        }
      },
    },
    {
      name: "list_gl_accounts",
      description: "List the chart of accounts (general ledger accounts) for the workspace.",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"],
            description: "Filter to one account type.",
          },
        },
      },
      execute: async (input) => {
        const type = typeof input.type === "string" ? input.type : undefined
        const rows = await prisma.account_GL.findMany({
          where: { workspaceId, ...(type ? { type: type as never } : {}) },
          orderBy: { code: "asc" },
          select: { code: true, name: true, type: true, isActive: true },
        })
        return rows.map((r) => ({ code: r.code, name: r.name, type: r.type, active: r.isActive }))
      },
    },
    {
      name: "assess_financing_readiness",
      description:
        "Compute the workspace's working-capital creditworthiness (the Crontract Score) from its " +
        "operational data: overall score, grade, confidence, an indicative facility limit, and the " +
        "factors driving it. Use for questions about financing, loans, working capital, or 'how " +
        "creditworthy are we'. The score is deterministic — report it exactly, do not re-estimate.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const a = await assessWorkspaceCredit(workspaceId)
        return {
          score: a.score,
          grade: a.grade,
          confidence: a.confidence,
          currency: a.currency,
          indicativeFacility: a.offer.eligible ? a.offer.limit : 0,
          eligible: a.offer.eligible,
          advanceRatePct: a.offer.advanceRatePct,
          offerBasis: a.offer.basis,
          factors: a.factors.map((f) => ({ factor: f.label, score: Math.round(f.score), status: f.polarity })),
          topReasonCodes: a.reasonCodes,
          disclaimer: a.disclaimer,
        }
      },
    },
  ]
}
