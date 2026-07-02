/**
 * Deterministic scoring model for the Working-Capital Creditworthiness Engine.
 *
 * Pure function, no I/O — fully unit-testable and auditable. Every factor maps a
 * real operational signal onto a 0..100 subscore with documented thresholds; the
 * overall score is a fixed weighted sum. Nothing here is a black box: given the
 * same signals you always get the same score, and each point is attributable.
 */
import {
  type CreditSignals,
  type CreditAssessment,
  type Factor,
  type Grade,
  type Confidence,
  type WorkingCapitalOffer,
} from "./types"

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const round2 = (n: number) => Math.round(n * 100) / 100

/** Linear ramp: value ≤ lo → 0, value ≥ hi → 100, linear in between. */
function ramp(value: number, lo: number, hi: number): number {
  if (hi === lo) return value >= hi ? 100 : 0
  return clamp(((value - lo) / (hi - lo)) * 100)
}

/** Coefficient of variation → steadiness score (lower variability = higher). */
function steadinessScore(series: number[]): number {
  const xs = series.filter((x) => x > 0)
  if (xs.length < 2) return 40 // not enough history to prove consistency
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  if (mean === 0) return 0
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length
  const cv = Math.sqrt(variance) / mean
  // cv 0 → 100, cv ≥ 1.0 → ~0
  return clamp(100 - cv * 100)
}

const WEIGHTS: Record<Factor["key"], number> = {
  revenue: 0.2,
  collections: 0.22,
  concentration: 0.1,
  liquidity: 0.15,
  maturity: 0.1,
  reliability: 0.13,
  risk: 0.1,
}

function polarity(score: number): Factor["polarity"] {
  if (score >= 70) return "strength"
  if (score >= 45) return "watch"
  return "weakness"
}

export function scoreAssessment(signals: CreditSignals): Omit<CreditAssessment, "generatedAt"> {
  const factors: Factor[] = []

  // 1) Revenue scale × consistency
  const scaleScore = ramp(signals.trailingRevenue90d, 0, 300_000) // tune per market
  const consistency = steadinessScore(signals.monthlyRevenue)
  const revenueScore = clamp(0.6 * scaleScore + 0.4 * consistency)
  factors.push({
    key: "revenue",
    label: "Revenue scale & consistency",
    weight: WEIGHTS.revenue,
    score: revenueScore,
    contribution: round2(WEIGHTS.revenue * revenueScore),
    reason:
      `${signals.currency} ${Math.round(signals.trailingRevenue90d).toLocaleString()} invoiced in the last 90 days` +
      ` across ${signals.issuedInvoiceCount} invoices; ` +
      (consistency >= 60 ? "revenue is steady month to month." : "month-to-month revenue is uneven."),
    polarity: polarity(revenueScore),
  })

  // 2) Collections quality (paid ratio + how much is badly overdue)
  const paidScore = clamp(signals.paidInvoiceRatio * 100)
  const overdueShare = signals.arOpenTotal > 0 ? signals.arOverdue60Plus / signals.arOpenTotal : 0
  const agingScore = clamp(100 - overdueShare * 140) // 70%+ badly overdue → 0
  const collectionsScore = clamp(0.5 * paidScore + 0.5 * agingScore)
  factors.push({
    key: "collections",
    label: "Collections & receivables quality",
    weight: WEIGHTS.collections,
    score: collectionsScore,
    contribution: round2(WEIGHTS.collections * collectionsScore),
    reason:
      `${Math.round(signals.paidInvoiceRatio * 100)}% of issued invoices are paid; ` +
      `${Math.round(overdueShare * 100)}% of open receivables are 60+ days overdue.`,
    polarity: polarity(collectionsScore),
  })

  // 3) Customer concentration (single-buyer dependence is a real credit risk)
  const concScore =
    signals.distinctCustomers === 0
      ? 30
      : clamp(100 - Math.max(0, signals.topCustomerShare - 0.25) * 160)
  factors.push({
    key: "concentration",
    label: "Customer diversification",
    weight: WEIGHTS.concentration,
    score: concScore,
    contribution: round2(WEIGHTS.concentration * concScore),
    reason:
      `${signals.distinctCustomers} distinct customers; largest is ` +
      `${Math.round(signals.topCustomerShare * 100)}% of recent revenue.`,
    polarity: polarity(concScore),
  })

  // 4) Liquidity / payables discipline (paying suppliers late signals cash stress)
  const liquidityScore = clamp(100 - signals.apOverdueRatio * 120)
  factors.push({
    key: "liquidity",
    label: "Liquidity & payables discipline",
    weight: WEIGHTS.liquidity,
    score: liquidityScore,
    contribution: round2(WEIGHTS.liquidity * liquidityScore),
    reason:
      `${Math.round(signals.apOverdueRatio * 100)}% of open supplier bills are overdue ` +
      `(${signals.currency} ${Math.round(signals.apOpenTotal).toLocaleString()} outstanding).`,
    polarity: polarity(liquidityScore),
  })

  // 5) Operational maturity (a structured business is a safer borrower)
  const maturityScore = clamp(
    ramp(signals.purchaseOrderCount, 0, 20) * 0.3 +
      ramp(signals.vendorCount, 0, 15) * 0.2 +
      ramp(signals.glAccountCount, 0, 25) * 0.25 +
      ramp(signals.headcount, 0, 25) * 0.25
  )
  factors.push({
    key: "maturity",
    label: "Operational maturity",
    weight: WEIGHTS.maturity,
    score: maturityScore,
    contribution: round2(WEIGHTS.maturity * maturityScore),
    reason:
      `${signals.headcount} staff, ${signals.vendorCount} vendors, ${signals.purchaseOrderCount} POs, ` +
      `${signals.glAccountCount} GL accounts configured.`,
    polarity: polarity(maturityScore),
  })

  // 6) Data reliability (underwriting is only as good as the data's freshness/depth)
  const freshnessScore = clamp(100 - signals.lastActivityDaysAgo * 4) // idle 25d → 0
  const depthScore = ramp(signals.auditEvents90d, 0, 400)
  const reliabilityScore = clamp(0.5 * freshnessScore + 0.5 * depthScore)
  factors.push({
    key: "reliability",
    label: "Data reliability & engagement",
    weight: WEIGHTS.reliability,
    score: reliabilityScore,
    contribution: round2(WEIGHTS.reliability * reliabilityScore),
    reason:
      `${signals.auditEvents90d} recorded actions in 90 days; last activity ` +
      `${signals.lastActivityDaysAgo} day(s) ago.`,
    polarity: polarity(reliabilityScore),
  })

  // 7) Operational risk (HSE). Neutral-positive if the business doesn't use HSE.
  const riskScore = !signals.usesHse
    ? 65
    : clamp(100 - signals.severeIncidents180d * 30)
  factors.push({
    key: "risk",
    label: "Operational (HSE) risk",
    weight: WEIGHTS.risk,
    score: riskScore,
    contribution: round2(WEIGHTS.risk * riskScore),
    reason: !signals.usesHse
      ? "No HSE exposure tracked; neutral."
      : `${signals.severeIncidents180d} major/fatal incident(s) in the last 180 days.`,
    polarity: polarity(riskScore),
  })

  const score = round2(factors.reduce((a, f) => a + f.contribution, 0))
  const grade = toGrade(score)
  const confidence = toConfidence(signals)
  const offer = buildOffer(signals, score, grade)

  const reasonCodes = [...factors]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((f) => `${f.label}: ${f.reason}`)

  return {
    score,
    grade,
    confidence,
    factors,
    offer,
    reasonCodes,
    currency: signals.currency,
    disclaimer:
      "Indicative only. Derived from workspace operational data; not a credit decision, " +
      "guarantee, or regulated financial promotion. Any facility is subject to KYC/KYB, " +
      "affordability checks and a licensed lending partner.",
  }
}

function toGrade(score: number): Grade {
  if (score >= 80) return "A"
  if (score >= 65) return "B"
  if (score >= 50) return "C"
  if (score >= 35) return "D"
  return "E"
}

function toConfidence(s: CreditSignals): Confidence {
  // Thin or stale data → low confidence, regardless of score.
  const dataPoints =
    (s.issuedInvoiceCount >= 12 ? 1 : 0) +
    (s.monthsActive >= 3 ? 1 : 0) +
    (s.auditEvents90d >= 100 ? 1 : 0) +
    (s.lastActivityDaysAgo <= 14 ? 1 : 0)
  if (dataPoints >= 3) return "high"
  if (dataPoints === 2) return "medium"
  return "low"
}

/**
 * Indicative working-capital limit: an advance against clean (not badly overdue)
 * receivables, rate scaled by grade, capped at ~1.5× average monthly revenue.
 * Deliberately conservative — this is a starting point for a human underwriter,
 * not an automated offer.
 */
function buildOffer(s: CreditSignals, score: number, grade: Grade): WorkingCapitalOffer {
  const cleanReceivables = Math.max(0, s.arOpenTotal - s.arOverdue60Plus)
  const advanceRatePct = grade === "A" ? 85 : grade === "B" ? 75 : grade === "C" ? 60 : 0
  const avgMonthlyRevenue =
    s.monthlyRevenue.length > 0
      ? s.monthlyRevenue.reduce((a, b) => a + b, 0) / s.monthlyRevenue.length
      : s.trailingRevenue90d / 3
  const revenueCap = avgMonthlyRevenue * 1.5

  const eligible = advanceRatePct > 0 && cleanReceivables > 0
  const rawLimit = Math.min(cleanReceivables * (advanceRatePct / 100), revenueCap)
  // Round down to a tidy figure.
  const limit = eligible ? Math.floor(rawLimit / 100) * 100 : 0

  return {
    eligible,
    limit,
    currency: s.currency,
    advanceRatePct,
    basis: eligible
      ? `Up to ${advanceRatePct}% of ${s.currency} ${Math.round(cleanReceivables).toLocaleString()} ` +
        `in clean receivables, capped at 1.5× average monthly revenue.`
      : grade === "D" || grade === "E"
        ? "Not eligible at current score — build collections history and reduce overdue balances."
        : "No clean receivables available to advance against.",
  }
}

export { WEIGHTS as FACTOR_WEIGHTS }
