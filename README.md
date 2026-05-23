# Crontract — Enterprise Operations Platform

**SAP + Trello, for SMEs that can't afford SAP.**

Crontract is a multi-tenant enterprise operations platform built for small and medium enterprises. It integrates finance, HR, projects, procurement, HSE, and more into a single cohesive product with zero-training onboarding and Kanban-first work execution.

![Crontract](docs/screenshots/.gitkeep)

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 16+

### Setup (under 5 minutes)

```bash
# 1. Clone and install
git clone <repo-url> crontract
cd crontract
pnpm install

# 2. Create the database
createdb crontract_dev

# 3. Set up environment
cp .env.example apps/web/.env.local

# 4. Push database schema & generate client
pnpm run db:push

# 5. Seed demo data
pnpm run db:seed

# 6. Start the app
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Credentials

All demo accounts use password: `password123`

| Role | Email |
|---|---|
| Admin (Owner) | admin@crontract.io |
| Manager | manager@crontract.io |
| Employee | kofi@crontract.io |
| Employee | abena@crontract.io |
| Employee | yaw@crontract.io |

## Architecture

```
crontract/
├── apps/
│   └── web/              # Next.js 14 App Router (frontend + API)
│       ├── prisma/       # Schema symlink → packages/db
│       └── src/
│           ├── app/      # Pages and API routes
│           ├── components/  # UI components (shadcn/ui)
│           └── lib/      # Utilities, auth, db
├── packages/
│   ├── db/               # Prisma schema, client, seed
│   ├── ui/               # Shared UI (future)
│   └── config/           # Shared config (future)
└── docs/
```

### Tech Stack

- **Frontend:** Next.js 14, TypeScript (strict), Tailwind CSS, shadcn/ui, Radix primitives, Framer Motion, Recharts, @dnd-kit
- **Backend:** Next.js API routes + Server Components
- **Database:** PostgreSQL 16 via Prisma ORM
- **Auth:** NextAuth.js with JWT sessions

### Multi-tenancy

Every record carries a `workspace_id`. Access is enforced at both the application layer (session-based workspace filtering) and planned for database layer (RLS policies). Users can belong to multiple workspaces.

### RBAC

Fine-grained permissions in `module:entity:action` format (112 total). Roles are per-workspace with a visual Permission Matrix in Admin. Seeded roles are business-type aware.

## Modules

### Tier 1 — Core (Shipped)
- **Dashboard** — Role-aware KPIs, activity feed, quick actions
- **People (HR)** — Employee records, departments, org chart
- **Projects & Tasks** — Kanban board with drag-and-drop, task detail, comments
- **Meetings** — Scheduling, agenda, minutes, action items → tasks
- **Documents** — Folder tree, versioning, status workflow
- **Approvals** — Configurable flows, My Approvals inbox
- **Notifications** — In-app bell with read/unread tracking
- **Admin** — Users, roles, permission matrix, workspace settings, audit log

### Tier 2 — Operations (Shipped)
- **Finance** — Chart of accounts, invoices (AR), bills (AP), expenses, journals
- **Budget** — Annual budgets, monthly phasing, variance analysis
- **Procurement** — Requisitions → POs → goods receipt → 3-way match to bills
- **Assets** — Asset register, categories, depreciation, checkout
- **HSE** — Incidents, permits to work, risk assessments, toolbox talks, training

### Tier 3 — Segment-specific (Shipped)
- **Grants & M&E** — Donors, grants, logframes, indicators, reports
- **CRM** — Contacts, companies, deals, pipeline, activities
- **Compliance** — Obligations, licences, policies, audits, corrective actions
- **Social Media** — Accounts, posts, calendar, compose

## Development

```bash
# Run dev server
pnpm dev

# Build for production
pnpm build

# Database commands
pnpm run db:push      # Push schema changes
pnpm run db:seed      # Seed demo data
npx prisma studio     # Visual DB browser (from packages/db)

# Lint
pnpm lint
```

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://user@localhost:5432/crontract_dev`)
- `NEXTAUTH_SECRET` — JWT signing secret
- `NEXTAUTH_URL` — App URL (e.g. `http://localhost:3000`)

## License

Proprietary. All rights reserved.
