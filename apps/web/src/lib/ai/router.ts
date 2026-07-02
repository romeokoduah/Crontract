/**
 * Model router: the single choke-point where a task tier becomes a concrete
 * model + provider call. Feature code selects a *tier*, never a model id, so we
 * can retune cost/quality centrally and swap providers without touching features.
 */
import { callAnthropic, anthropicConfigured } from "./providers/anthropic"
import {
  type ModelCallOptions,
  type ModelResponse,
  type TaskTier,
  type TokenUsage,
} from "./types"

export function modelForTier(tier: TaskTier): string {
  if (tier === "fast") {
    return process.env.AI_DEFAULT_FAST_MODEL || "claude-haiku-4-5-20251001"
  }
  return process.env.AI_DEFAULT_REASON_MODEL || "claude-opus-4-8"
}

export function aiConfigured(): boolean {
  return anthropicConfigured()
}

/**
 * Approximate USD cost of a call. Prices are per-million tokens and intentionally
 * conservative/overridable — used for budget guardrails and cost dashboards, not
 * billing of record. Update as provider pricing changes.
 */
const PRICE_PER_MTOK: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 15, out: 75 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-haiku-4-5-20251001": { in: 1, out: 5 },
}

export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const price =
    PRICE_PER_MTOK[model] ??
    // Fall back to a mid-tier estimate for unknown models.
    { in: 5, out: 15 }
  const cost =
    (usage.inputTokens / 1_000_000) * price.in +
    (usage.outputTokens / 1_000_000) * price.out
  return Number(cost.toFixed(6))
}

/** Dispatch a single model call to the configured provider. */
export async function callModel(opts: ModelCallOptions): Promise<ModelResponse> {
  // Only Anthropic is wired today; add providers here and branch on tier/env.
  return callAnthropic(opts)
}

export const PROVIDER = "anthropic"
