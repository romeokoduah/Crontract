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
