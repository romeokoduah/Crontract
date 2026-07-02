# Progress

## Status: MVP Shipped

Build compiles, all module pages render, seed data loads, auth works end-to-end.

## Done

### Infrastructure
- [x] Monorepo setup (pnpm workspaces)
- [x] Next.js 14 App Router with TypeScript strict mode
- [x] Tailwind CSS + shadcn/ui component library (25+ components)
- [x] PostgreSQL 16 (local)
- [x] Prisma ORM with comprehensive schema (30+ models, 15+ enums)
- [x] NextAuth.js with credentials provider, JWT sessions
- [x] Dark mode with custom design tokens (copper/amber brand)
- [x] Local development setup (no Docker required)
- [x] Production build passes (lint + typecheck + build)

### Auth & Onboarding
- [x] Landing page with value proposition and archetype cards
- [x] Signup with password hashing, workspace creation, role seeding
- [x] Login with credentials
- [x] Demo login for 3 seeded workspaces
- [x] 5-step onboarding wizard (business type, company basics, modules, invite team, welcome)
- [x] Session-based workspace context

### Core Modules (Tier 1)
- [x] Dashboard — KPI cards, recent activity, greeting
- [x] People (HR) — employee list/detail/create, department management, search/filter
- [x] Projects & Tasks — project list/detail/create, **Kanban board with drag-and-drop**, task detail drawer with comments
- [x] Meetings — list/detail/create, agenda, minutes, action items
- [x] Documents — folder tree, document list/detail, versioning, status workflow
- [x] Approvals — My Approvals inbox, approve/reject with comments
- [x] Notifications — in-app list with read/unread tracking
- [x] Admin — users/roles management, **permission matrix**, workspace settings, **audit log viewer**

### Operations Modules (Tier 2)
- [x] Finance — overview dashboard, invoices (create with line items), bills, expenses, chart of accounts (tree view), journals
- [x] Budget — list, detail with variance analysis, create with line items
- [x] Procurement — overview, POs (create/detail with **3-way match visualization**), requisitions, **vendor master**
- [x] Assets — register with stats, create form, categories
- [x] HSE — **dashboard with KPIs**, incidents (report/investigate/close with corrective actions), permits to work (6 types), risk assessments, toolbox talks, safety training with expiry alerts

### AI — Crontract Copilot (Phase 0)
- [x] Provider-agnostic **model router** with task tiers + cost estimation (`apps/web/src/lib/ai/router.ts`)
- [x] **Anthropic provider** over the Messages API with tool-use (`providers/anthropic.ts`)
- [x] **Agentic runtime** — multi-step tool-calling loop with iteration cap (`runtime.ts`)
- [x] **Guardrails** — tool-result sanitisation + prompt-injection hardening note (`guardrails.ts`)
- [x] **Workspace-scoped Finance read-tools** — invoices, bills, expenses, AR ageing, cash position, chart of accounts (`finance-tools.ts`)
- [x] **Copilot service** — per-tenant AI tier + monthly-budget guardrails, conversation persistence, usage metering (`copilot-service.ts`)
- [x] API: `POST /api/ai/copilot`, `GET /api/ai/conversations`
- [x] **⌘K Copilot chat panel** mounted app-wide (`components/ai/copilot-panel.tsx`)
- [x] Schema: `AiConversation`, `AiMessage`, `AiInteraction`, `WorkspaceAiSettings`; `actor` on `AuditLog`
- [ ] Next: RAG/pgvector, text-to-SQL reporting, write-actions behind approvals, OCR/ASR extractors

### Novelty — Working-Capital Creditworthiness Engine
- [x] **Deterministic scoring model** (`lib/credit/scoring.ts`) — 7 weighted factors → 0–100 score, grade A–E, confidence, reason codes, indicative facility. Pure/auditable/testable.
- [x] **Signal gathering** from operational data (`lib/credit/signals.ts`) — receivables ageing, collections, concentration, payables discipline, maturity, reliability, HSE risk
- [x] **Engine + AI memo** (`lib/credit/engine.ts`) — AI narrates the memo but never changes a number; deterministic template fallback + usage metering
- [x] **Financing Readiness page** (`/finance/capital`) — score, indicative facility, factor breakdown, one-click underwriting memo
- [x] API: `GET /api/finance/credit`, `POST /api/finance/credit/memo` (admin-gated)
- [x] Copilot tool `assess_financing_readiness` — "are we ready for financing?" answered from the deterministic engine
- [x] Verified: smoke-tested (strong→95/A/eligible, weak→13/E/ineligible), typecheck + lint + build pass
- [ ] Next: turn the indicative facility into a real invoice-financing product with a lending partner; instrument realised loss rates (see docs/NOVELTY_CREDIT_ENGINE.md)

### Segment Stubs (Tier 3)
- [x] Grants & M&E — Coming Soon page
- [x] CRM — Coming Soon page
- [x] Compliance — Coming Soon page
- [x] Reports & Analytics — Coming Soon page

### Data
- [x] 112 permissions seeded
- [x] 3 demo workspaces with realistic Ghana-context data
- [x] Seed script runs clean

### API
- [x] 30+ API routes covering all implemented modules
- [x] Session auth on all routes
- [x] Workspace isolation on all queries
- [x] Audit log on all mutations

## Stubbed (Functional but Simplified)

- Email verification — schema supports it, UI flow is present, actual email sending requires Resend API key
- File uploads — schema has `storageKey` fields, but upload UI and storage backend not wired yet
- Email notifications — in-app notifications work, email digest not implemented
- Gantt view — tab exists in project detail, shows placeholder
- Report builder — Coming Soon page
- Bank reconciliation — placeholder in finance
- Financial statements — not computed (requires journal posting logic)
- Dashboard widgets — static layout, drag-to-reorder not implemented
- Global search — search bar in topbar, not wired to backend

## Known Issues

- OAuth buttons (Google/Microsoft) are disabled — need API credentials
- Magic link login not implemented
- No Suspense boundaries on some dynamic pages (may show loading flash)
- Mobile responsive is basic — works but not polished for all screens

## Next Steps

See ROADMAP.md for prioritized feature backlog.
