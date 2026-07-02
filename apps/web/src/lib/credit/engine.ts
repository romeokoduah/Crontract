/**
 * Creditworthiness engine orchestration.
 *
 * `assessWorkspaceCredit` = gather signals → deterministic score.
 * `generateUnderwritingMemo` = turn the ALREADY-COMPUTED numbers into a narrative
 * credit memo. The model is explicitly forbidden from changing any figure — it
 * explains the deterministic result, it does not underwrite. Degrades gracefully
 * to a templated memo when no AI key is configured.
 */
import { callModel, modelForTier, aiConfigured, PROVIDER, estimateCostUsd } from "@/lib/ai/router"
import { gatherSignals } from "./signals"
import { scoreAssessment } from "./scoring"
import { type CreditAssessment } from "./types"

export async function assessWorkspaceCredit(workspaceId: string): Promise<CreditAssessment> {
  const signals = await gatherSignals(workspaceId)
  const assessment = scoreAssessment(signals)
  return { ...assessment, generatedAt: new Date().toISOString() }
}

export interface MemoResult {
  memo: string
  source: "ai" | "template"
  model?: string
  provider?: string
  usage?: { inputTokens: number; outputTokens: number }
  costUsd?: number
}

export interface MemoContext {
  workspaceName: string
  businessType: string
}

function factorTable(a: CreditAssessment): string {
  return a.factors
    .map((f) => `- ${f.label}: ${Math.round(f.score)}/100 (${f.polarity}) — ${f.reason}`)
    .join("\n")
}

/** Deterministic fallback memo — used when AI is not configured. */
function templateMemo(a: CreditAssessment, ctx: MemoContext): string {
  const strengths = a.factors.filter((f) => f.polarity === "strength")
  const weaknesses = a.factors.filter((f) => f.polarity === "weakness")
  return [
    `WORKING-CAPITAL CREDIT MEMO — ${ctx.workspaceName}`,
    `Score: ${a.score}/100 (Grade ${a.grade}, ${a.confidence} confidence)`,
    ``,
    `Indicative facility: ${a.offer.eligible ? `${a.currency} ${a.offer.limit.toLocaleString()} (${a.offer.advanceRatePct}% advance rate)` : "Not eligible at current score"}`,
    `Basis: ${a.offer.basis}`,
    ``,
    `Strengths:`,
    ...(strengths.length ? strengths.map((f) => `  • ${f.label} — ${f.reason}`) : ["  • None material at this time."]),
    ``,
    `Risks / watch items:`,
    ...(weaknesses.length ? weaknesses.map((f) => `  • ${f.label} — ${f.reason}`) : ["  • None material at this time."]),
    ``,
    `Disclaimer: ${a.disclaimer}`,
  ].join("\n")
}

export async function generateUnderwritingMemo(
  assessment: CreditAssessment,
  ctx: MemoContext
): Promise<MemoResult> {
  if (!aiConfigured()) {
    return { memo: templateMemo(assessment, ctx), source: "template" }
  }

  const model = modelForTier("reason")
  const system = [
    "You are a credit analyst writing a concise working-capital underwriting memo for an",
    "SME lending partner. You are given a DETERMINISTIC score and factor breakdown computed",
    "from the business's own operational data. Your job is to explain it, not to re-underwrite.",
    "",
    "Hard rules:",
    "- Never change, recompute, or invent any number. Use only the figures provided.",
    "- Be balanced: state strengths and risks plainly. Do not oversell.",
    "- End with a clear recommendation consistent with the grade and eligibility given.",
    "- Keep it under ~250 words. Professional, neutral tone.",
  ].join("\n")

  const user = [
    `Business: ${ctx.workspaceName} (${ctx.businessType})`,
    `Overall score: ${assessment.score}/100 — Grade ${assessment.grade} — ${assessment.confidence} confidence`,
    `Indicative facility: ${assessment.offer.eligible ? `${assessment.currency} ${assessment.offer.limit.toLocaleString()} at ${assessment.offer.advanceRatePct}% advance` : "Not eligible"}`,
    `Basis: ${assessment.offer.basis}`,
    ``,
    `Factor breakdown:`,
    factorTable(assessment),
    ``,
    `Write the memo now.`,
  ].join("\n")

  try {
    const res = await callModel({
      model,
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 700,
    })
    return {
      memo: res.text || templateMemo(assessment, ctx),
      source: "ai",
      model,
      provider: PROVIDER,
      usage: res.usage,
      costUsd: estimateCostUsd(model, res.usage),
    }
  } catch {
    // Never fail the request over a narrative — fall back to the deterministic memo.
    return { memo: templateMemo(assessment, ctx), source: "template" }
  }
}
