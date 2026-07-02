/**
 * Crontract Working-Capital Creditworthiness Engine — types.
 *
 * The novel bit: we underwrite an SME from its own OPERATIONAL ground truth
 * (real invoices, collection behaviour, payables discipline, concentration,
 * operational risk, and how reliably the business actually maintains its data) —
 * signals a bank or a generic accounting tool never sees. The score is
 * DETERMINISTIC and explainable (every point traces to a factor); AI is only ever
 * used to narrate the memo, never to compute a number.
 */

/** Normalised, primitive inputs to the scorer. Produced by `signals.ts`. No I/O here. */
export interface CreditSignals {
  currency: string
  monthsActive: number

  // Revenue (issued invoices = SENT/PAID/OVERDUE)
  trailingRevenue90d: number
  /** Issued revenue per calendar month, most-recent-first, up to 6 entries. */
  monthlyRevenue: number[]
  issuedInvoiceCount: number

  // Collections
  paidInvoiceRatio: number // paid ÷ issued, 0..1
  arOpenTotal: number // outstanding receivables (SENT/OVERDUE)
  arOverdue60Plus: number // amount >60 days past due

  // Concentration
  topCustomerShare: number // 0..1 (share of trailing revenue from the single biggest customer)
  distinctCustomers: number

  // Payables / liquidity
  apOpenTotal: number
  apOverdueRatio: number // overdue open bills ÷ open bills, by count, 0..1

  // Operational maturity
  purchaseOrderCount: number
  vendorCount: number
  glAccountCount: number
  headcount: number

  // Data reliability / engagement (underwriting only works if the data is real & fresh)
  auditEvents90d: number
  lastActivityDaysAgo: number

  // Operational risk (HSE)
  usesHse: boolean
  severeIncidents180d: number // MAJOR/FATAL in the last 180 days
}

export type FactorKey =
  | "revenue"
  | "collections"
  | "concentration"
  | "liquidity"
  | "maturity"
  | "reliability"
  | "risk"

export interface Factor {
  key: FactorKey
  label: string
  weight: number // 0..1, weights sum to 1
  score: number // 0..100 for this factor
  contribution: number // weight × score, points toward the overall score
  reason: string // human-readable explanation of the score
  polarity: "strength" | "watch" | "weakness"
}

export type Grade = "A" | "B" | "C" | "D" | "E"
export type Confidence = "low" | "medium" | "high"

export interface WorkingCapitalOffer {
  eligible: boolean
  /** Indicative advance limit in the workspace currency. */
  limit: number
  currency: string
  advanceRatePct: number // % of clean receivables advanced
  basis: string // one-line explanation of how the limit was derived
}

export interface CreditAssessment {
  score: number // 0..100
  grade: Grade
  confidence: Confidence
  factors: Factor[]
  offer: WorkingCapitalOffer
  /** Top reason codes (worst-scoring factors) driving the decision. */
  reasonCodes: string[]
  generatedAt: string // ISO; stamped by the caller
  currency: string
  disclaimer: string
}
