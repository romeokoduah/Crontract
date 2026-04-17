# Decisions Log

## Architecture

| Decision | Rationale |
|---|---|
| **Single Next.js app** (no separate FastAPI) | Faster to ship, simpler deployment, server components + API routes handle everything needed for MVP |
| **Prisma 5** instead of Prisma 7 | Prisma 7 has breaking changes (removed datasource URL from schema), Prisma 5 is stable and well-documented with Next.js 14 |
| **JWT sessions** over database sessions | Lower latency, no session table queries on every request, workspace context stored in token |
| **PostgreSQL port 5434** | Avoid conflicts with locally-running PostgreSQL instances on the default port 5432 |
| **Soft deletes** via `deleted_at` column | Enterprise apps need data recovery, audit compliance, and referential integrity preservation |
| **UUIDs** for all IDs | Multi-tenant isolation, no sequential ID guessing, easier future sharding |

## Design

| Decision | Rationale |
|---|---|
| **Copper/amber primary** (hsl 25 85% 45%) | Distinctive brand color — not the generic blue of most SaaS apps, warm and professional |
| **Dark sidebar** always (even in light mode) | Creates clear navigation hierarchy, feels enterprise-grade, matches the SAP DNA |
| **Inter font** | Clean, professional, excellent readability at small sizes for dense data tables |
| **shadcn/ui** as component base | Unstyled Radix primitives with full customization control, no vendor lock-in |
| **@dnd-kit** for Kanban drag-and-drop | Most maintained React DnD library, accessibility-first, smooth animations |

## Modules

| Decision | Rationale |
|---|---|
| **All modules in one app** (no micro-frontends) | MVP speed — a single deployment is faster to build and debug |
| **Audit log on every mutation** | Non-negotiable per spec — compliance backbone for mining/NGO customers |
| **Permission format `module:entity:action`** | Readable, grep-able, scalable — easy to add new modules without schema changes |
| **Business-type-aware module defaults** | Mining contractors need HSE by default, NGOs need Grants, startups need CRM — reduces onboarding friction |
| **112 permissions** seeded at startup | Covers 16 modules × 7 actions — comprehensive without being overwhelming |
| **Approval flows stored as JSON steps** | Flexible enough for single/sequential/parallel without separate tables per flow type |

## Data

| Decision | Rationale |
|---|---|
| **Ghana-focused seed data** | Target market is West African SMEs — realistic names, GHS currency, Ghanaian companies |
| **3 demo workspaces** | One per business type archetype, showcases different module configurations |
| **`demo123456` password** for all demo users | Simple to remember, clearly marked as demo, consistent across workspaces |
| **Invoice/PO auto-numbering** (INV-0001, PO-0001) | Professional, sequential, workspace-scoped — standard enterprise pattern |

## Deferred

| Decision | Rationale |
|---|---|
| **No real email sending** | Resend API key not configured — email functions are stubbed but the interface is ready |
| **No file uploads** | MinIO container is configured but file upload UI is deferred — storage key fields exist in schema |
| **No real-time updates** | Polling via TanStack Query staleTime is sufficient for MVP — Soketi/WebSocket can be added later |
| **RLS policies not implemented** | Application-layer workspace filtering is in place — RLS is defense-in-depth and can be added without schema changes |
| **OAuth providers disabled** | Google/Microsoft buttons present but disabled — requires API key configuration |
