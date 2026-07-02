# Crontract — AI Integration Technical Spec

Concrete, buildable architecture for the AI layer described in `VISION_SCALE.md`.
Grounded in the current stack: **Next.js 14 (App Router) + Prisma 5 + PostgreSQL 16 +
NextAuth (JWT) + pnpm monorepo**, multi-tenant with `workspace_id` on every row and an
audit log on every mutation.

Guiding principles:
1. **Tenant isolation is sacred.** No AI feature may ever cross `workspace_id`. Every
   retrieval, embedding, and tool call is scoped and re-checked against the session's
   workspace + RBAC.
2. **AI drafts; humans approve anything that touches money or law.** Every AI action
   writes to the existing audit log and is reversible.
3. **Provider-agnostic.** Route by task/cost/latency; never hardcode one vendor.
4. **Everything async that can be.** OCR, embeddings, batch analysis → job queue, never
   in the request path.

---

## 1. New monorepo packages

```
packages/
├── ai/              # @crontract/ai — model router, prompt templates, eval harness, guardrails
│   ├── src/
│   │   ├── router.ts          # provider selection by task tier
│   │   ├── providers/         # anthropic.ts, openai.ts, voyage.ts, deepgram.ts ...
│   │   ├── actions/           # the typed action registry (the moat)
│   │   ├── rag/               # chunking, embedding, retrieval (tenant-scoped)
│   │   ├── guardrails/        # PII redaction, prompt-injection defense, output validation
│   │   ├── evals/             # golden datasets + regression tests per feature
│   │   └── prompts/           # versioned, testable prompt templates
├── ledger/          # @crontract/ledger — immutable double-entry core (finance + fintech)
└── jobs/            # @crontract/jobs — BullMQ workers (OCR, embeddings, reports, AI batch)
```

Keep the Next.js app as the API/UI surface; put AI orchestration in `@crontract/ai` so it
is testable and reusable by both request handlers and background workers.

---

## 2. Model router (provider abstraction)

Do not call a vendor SDK directly from feature code. Route by a **task tier** so cost and
quality are tuned centrally and providers are swappable.

```ts
// packages/ai/src/router.ts  (illustrative)
type TaskTier =
  | 'reason'      // agents, financial analysis, compliance mapping  → Claude Opus/Sonnet
  | 'fast'        // classify, route, extract, cheap high-volume      → Claude Haiku / small
  | 'embed'       // semantic search, RAG, dedup                      → Voyage / OpenAI / Cohere
  | 'vision'      // receipts, invoices, IDs                          → Claude vision / Textract
  | 'speech'      // meeting + field-voice transcription              → Whisper / Deepgram

interface CompletionRequest {
  tier: TaskTier;
  workspaceId: string;        // for tenant-scoped logging, quotas, opt-out
  userId: string;
  feature: string;            // e.g. 'finance.invoice_ocr' — for evals, metering, audit
  messages: Message[];
  tools?: ActionTool[];       // from the action registry
  maxCostUsd?: number;        // budget guardrail
}
```

Router responsibilities: provider selection + fallback, **per-workspace usage metering
and quotas** (this is how the "AI Intelligence" paid tier is enforced and billed),
ret/timeout/circuit-breaking, cost logging per `feature`, and honoring a workspace's
**train-on-my-data opt-out** flag.

> Since we run on Claude, default `reason`/`fast` tiers to Anthropic. The `claude-api`
> skill in this repo documents current model IDs, pricing, tool-use, and prompt caching —
> **use prompt caching aggressively** for the large, stable system prompts + schema
> context the Copilot sends on every call; it is a major cost lever at scale.

---

## 3. The action registry (the single most important AI investment)

The Copilot's value = breadth of typed actions × permission enforcement × data quality.
Model every meaningful mutation as a **tool** the LLM can call, with its args validated by
the same Zod schemas the REST API uses, and its execution routed through the **same
authorization + audit-log path** as a human click.

```ts
// packages/ai/src/actions/registry.ts (illustrative)
interface ActionTool {
  name: string;                    // 'finance.invoice.create'
  description: string;             // LLM-facing
  permission: string;             // reuse existing 'module:entity:action' RBAC code
  input: ZodSchema;               // reuse existing API validators
  confirmation: 'none' | 'user' | 'approval-flow';  // money/law → always gated
  handler: (ctx: AuthedCtx, args) => Promise<Result>;  // SAME code the REST route calls
}
```

Rules:
- **Reuse, don't duplicate.** An action tool wraps the exact service function behind the
  existing API route so RBAC, workspace scoping, validation, and audit logging are
  identical whether triggered by a human or the agent.
- **Every AI-initiated action sets `actor = 'ai'` + the invoking user** in the audit log,
  so the audit trail distinguishes human vs. agent and stays reversible.
- **Confirmation gating:** read-only → auto; single low-risk write → user confirm; anything
  financial/legal → routed into the existing **approval flow engine.** The approvals module
  you already built *is* the human-in-the-loop layer for the agent. Reuse it.

Start read-only (query tools only), then add write tools one module at a time behind
confirmation. This bounds risk while the demo value shows up immediately.

---

## 4. RAG & tenant-scoped retrieval

For document search, Copilot grounding, and Q&A over a workspace's own data.

- **Vector store:** start with **`pgvector`** in the existing Postgres (one less system,
  and tenant isolation reuses RLS). Graduate to a dedicated store (Qdrant/Turbopuffer)
  only if scale demands.
- **Isolation:** every embedding row carries `workspace_id`; every query filters on it AND
  is re-checked against RBAC (a user may not see all docs in their workspace). RLS enforces
  it at the DB even if app code slips.
- **Pipeline (async, in `@crontract/jobs`):** on document/record change → chunk → embed
  (`embed` tier) → upsert with `workspace_id`, `entityType`, `entityId`, `permissionScope`.
- **Retrieval:** hybrid (vector + Postgres full-text) → rerank → assemble context with
  citations back to the source record (so answers link to `entityType/entityId`).

---

## 5. Text-to-SQL reporting (replaces the "report builder" backlog)

"Ask your business a question" → chart + narrative. Safer and more powerful than a manual
report builder.

- Runs **only against a read replica**, never the transactional primary.
- LLM sees a **curated semantic layer** (whitelisted views/columns, business definitions),
  **not** the raw schema — this bounds hallucination and prevents leaking internal columns.
- Generated SQL is **forced to include `workspace_id = $current`** by query rewriting, run
  under a **read-only role with a statement timeout and row cap**, and validated before
  execution. Never interpolate LLM text into SQL as a string — parse and re-emit.
- Output: results + auto-selected chart (reuse Recharts) + a short LLM narrative.

---

## 6. Guardrails & AI governance (non-negotiable for finance/compliance)

- **PII redaction before egress:** salaries, IDs, account numbers are masked/tokenized
  before any prompt leaves the boundary, unless the feature genuinely needs them and the
  workspace consented.
- **Prompt-injection defense:** the agent has tool access, so a hostile uploaded invoice
  or document could try to instruct it. Mitigations: treat retrieved/document content as
  *data, not instructions* (structural separation), never let retrieved text expand tool
  scope, require confirmation on all writes, and run an injection classifier on
  document-sourced context.
- **Output validation:** all structured extraction (OCR→line items, obligation extraction)
  is validated against Zod schemas; low-confidence → route to human review, never
  auto-post.
- **Eval harness (`packages/ai/src/evals`):** golden datasets per feature (invoice
  extraction accuracy, reconciliation match rate, report-SQL correctness). Prompts are
  versioned; CI runs regressions so a prompt tweak can't silently degrade finance accuracy.
- **Per-tenant controls:** train-on-my-data opt-out, feature-level enable/disable, full
  audit of every AI call (feature, tokens, cost, user, workspace) — powers billing,
  debugging, and the compliance story.

---

## 7. Schema additions (Prisma)

New models to add to `packages/db/prisma/schema.prisma` — all follow the existing
conventions (`id` UUID, `workspace_id`, `created_at/updated_at/deleted_at`).

```prisma
// --- AI infrastructure ---
model AiInteraction {          // every Copilot/agent call — metering, audit, evals
  id           String   @id @default(uuid())
  workspaceId  String
  userId       String
  feature      String          // 'copilot.chat', 'finance.invoice_ocr', ...
  provider     String
  model        String
  inputTokens  Int
  outputTokens Int
  costUsd      Decimal  @db.Decimal(10, 6)
  latencyMs    Int
  status       String          // ok | error | blocked_guardrail
  createdAt    DateTime @default(now())
  @@index([workspaceId, feature, createdAt])
}

model AiAction {               // every AI-initiated mutation (links to approvals + audit)
  id            String   @id @default(uuid())
  workspaceId   String
  userId        String          // human on whose behalf the agent acted
  actionName    String          // 'finance.invoice.create'
  args          Json
  confirmation  String          // none | user | approval-flow
  approvalId    String?         // FK to existing Approval when gated
  auditLogId    String?         // FK to existing AuditLog
  status        String          // proposed | confirmed | executed | rejected | reversed
  createdAt     DateTime @default(now())
  @@index([workspaceId, status])
}

model Embedding {              // pgvector-backed RAG index (tenant-scoped)
  id              String   @id @default(uuid())
  workspaceId     String
  entityType      String
  entityId        String
  chunkIndex      Int
  content         String
  permissionScope String?       // re-checked against RBAC at query time
  // embedding      Unsupported("vector(1536)")   // via pgvector
  createdAt       DateTime @default(now())
  @@index([workspaceId, entityType, entityId])
}

model WorkspaceAiSettings {    // per-tenant governance + billing tier
  id             String   @id @default(uuid())
  workspaceId    String   @unique
  tier           String          // off | standard | intelligence
  trainingOptOut Boolean  @default(true)
  monthlyBudgetUsd Decimal? @db.Decimal(10, 2)
  enabledFeatures Json           // feature flags
  updatedAt      DateTime @updatedAt
}
```

Plus: enable the `pgvector` extension, and extend the existing `AuditLog` with an
`actor` field (`human | ai`) so the audit trail distinguishes agent actions.

---

## 8. Environment variables to add

Append to `.env.example`:

```bash
# --- AI providers (model router) ---
ANTHROPIC_API_KEY=""          # primary: reason + fast tiers
OPENAI_API_KEY=""             # optional: embeddings / fallback
VOYAGE_API_KEY=""             # optional: embeddings
DEEPGRAM_API_KEY=""           # optional: speech-to-text (field voice, meetings)

# --- AI platform config ---
AI_DEFAULT_REASON_MODEL="claude-opus-4-8"
AI_DEFAULT_FAST_MODEL="claude-haiku-4-5-20251001"
AI_EMBEDDING_MODEL="voyage-3"
AI_MONTHLY_BUDGET_USD_DEFAULT="50"     # per-workspace guardrail default
PGVECTOR_ENABLED="true"
```

---

## 9. Build order (maps to the 18-month roadmap in VISION_SCALE.md)

| Phase | Ship | Depends on |
|---|---|---|
| **P0 (weeks)** | Model router + `AiInteraction` metering; Copilot **read-only** Finance Q&A over tenant RAG (`pgvector`) | RLS, job queue, pgvector |
| **P0** | Text-to-SQL reporting on read replica + semantic layer | read replica |
| **P1** | 3 flagship extractors: invoice/receipt OCR→GL, HSE voice-report, grants auto-report | vision + speech tiers, eval harness |
| **P1** | Action registry (read tools) → single-step writes behind confirmation | audit `actor` field, approvals reuse |
| **P2** | Agentic Copilot v2 (multi-step, approval-gated, fully audited) | action registry, guardrails hardened |
| **P2** | AI Intelligence **paid tier** enforced via `WorkspaceAiSettings` + metering | billing |
| **P3** | Embedded-finance underwriting models fed by the operational data lake | ledger core, event backbone |

**Cheapest highest-impact first move:** the read-only Finance Copilot + text-to-SQL. It
needs no write-path risk, showcases the entire thesis in a demo, and every piece
(router, metering, RAG, semantic layer) is reused by everything after it.
