# The Novel Bit — Working-Capital Creditworthiness Engine

The product critique was fair: ERP-for-SMEs and AI copilots already exist. This is
the piece that is genuinely novel and, more importantly, **strategically defensible** —
it converts Crontract from an operations tool into the front end of an underwriting and
embedded-finance business.

## The idea in one line

**Underwrite an SME from its own operational ground truth** — real invoices, collection
behaviour, customer concentration, payables discipline, operational (HSE) risk, and how
reliably the business actually maintains its data — signals a bank or a generic
accounting package never sees.

## Why it's novel / defensible

- **A bank** sees a bank statement and a tax return. It cannot see your receivables
  ageing, your 3-way-matched POs, your safety-incident trend, or whether you actually
  run your operations in the system. Crontract can.
- **A generic ERP / accounting tool** stores the data but doesn't turn it into a
  financing signal in-workflow.
- The signal compounds: the more a business runs on Crontract, the better the
  underwriting — a data moat that a new entrant cannot replicate without the operational
  footprint. This is exactly the Shopify Capital / Toast Capital pattern, applied to
  emerging-market SMEs.

## The governance stance (why lenders/regulators can trust it)

**The score is deterministic; AI never touches a number.**

- `scoring.ts` is a pure, weighted, documented function. Same inputs → same score, and
  every point is attributable to a factor. It is fully auditable and unit-testable.
- The AI is used *only* to write the human-readable underwriting memo, and it is
  explicitly instructed never to change or invent a figure. If no model key is
  configured, the memo falls back to a deterministic template — the score still works.
- Confidence is separated from score: thin or stale data yields **low confidence**
  regardless of how high the score is. The engine is honest about what it doesn't know.

## How it's built (`apps/web/src/lib/credit/`)

| File | Role |
|---|---|
| `types.ts` | `CreditSignals` (inputs), `Factor`, `CreditAssessment`, `WorkingCapitalOffer`. |
| `scoring.ts` | **Pure** deterministic model: 7 weighted factors → 0–100 score, grade A–E, confidence, reason codes, and an indicative facility limit. No I/O. |
| `signals.ts` | Workspace-scoped Prisma aggregation → `CreditSignals`. The only file that touches the DB. |
| `engine.ts` | `assessWorkspaceCredit` (gather + score) and `generateUnderwritingMemo` (AI narrates, with template fallback + usage metering). |

## The factor model

| Factor | Weight | Signal |
|---|---|---|
| Revenue scale & consistency | 0.20 | Trailing-90d invoiced revenue + month-to-month steadiness. |
| Collections & receivables quality | 0.22 | Paid-invoice ratio + share of receivables 60+ days overdue. |
| Customer diversification | 0.10 | Single-buyer concentration (dependence risk). |
| Liquidity & payables discipline | 0.15 | Share of open supplier bills overdue. |
| Operational maturity | 0.10 | POs, vendors, GL accounts, headcount configured. |
| Data reliability & engagement | 0.13 | Activity volume + recency (is the data real and fresh?). |
| Operational (HSE) risk | 0.10 | Major/fatal incidents in the last 180 days. |

Output: overall score → grade → confidence → an **indicative working-capital facility**
(an advance against clean receivables, rate scaled by grade, capped at ~1.5× average
monthly revenue). Deliberately conservative — a starting point for a human underwriter,
not an automated credit decision.

## Surfaces

- **Page:** `/finance/capital` — score, grade, indicative facility, factor breakdown with
  bars and reasons, and a one-click AI underwriting memo.
- **API:** `GET /api/finance/credit`, `POST /api/finance/credit/memo` (admin-gated).
- **Copilot:** the `assess_financing_readiness` tool, so users can just ask
  *"are we ready for financing?"* and get the exact deterministic result narrated.

## Why this is the $100M seam, not just a feature

This is the top of the embedded-finance flywheel from `docs/VISION_SCALE.md`:
operations data → underwriting → an actual financing product → better loss rates than
incumbents → more usage → better data. The score is the wedge; the next build is turning
the indicative facility into a real invoice-financing product with a lending partner and
instrumenting realised loss rates. **That** is what moves the company from "SaaS" to
"fintech multiples."
