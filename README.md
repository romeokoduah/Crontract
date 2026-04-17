# Crontract — Enterprise Operations Platform

**SAP + Trello, for SMEs that can't afford SAP.**

Crontract is a multi-tenant enterprise operations platform built for small and medium enterprises. It integrates finance, HR, projects, procurement, HSE, and more into a single cohesive product with zero-training onboarding and Kanban-first work execution.

![Crontract](docs/screenshots/.gitkeep)

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker & Docker Compose

### Setup (under 5 minutes)

```bash
# 1. Clone and install
git clone <repo-url> crontract
cd crontract
pnpm install

# 2. Start infrastructure
docker compose up -d

# 3. Set up environment
cp .env.example apps/web/.env.local

# 4. Push database schema
cd apps/web
npx prisma db push

# 5. Seed demo data
npx prisma db seed

# 6. Start the app
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Credentials

All demo accounts use password: `demo123456`

| Workspace | Email | Type |
|---|---|---|
| Obuasi Mining Services Ltd | admin@obuasi-mining.com | Mining Contractor |
| Horizon Foundation Ghana | admin@horizon-ghana.org | NGO |
| Kobo Labs | admin@kobolabs.com | Startup |

## Architecture

```
crontract/
├── apps/
│   └── web/              # Next.js 14 App Router (frontend + API)
│       ├── prisma/       # Schema + seed
│       └── src/
│           ├── app/      # Pages and API routes
│           ├── components/  # UI components (shadcn/ui)
│           └── lib/      # Utilities, auth, db
├── packages/
│   ├── db/               # Prisma client package
│   ├── ui/               # Shared UI (future)
│   └── config/           # Shared config (future)
├── docker-compose.yml    # PostgreSQL, Redis, MinIO
└── docs/
```

### Tech Stack

- **Frontend:** Next.js 14, TypeScript (strict), Tailwind CSS, shadcn/ui, Radix primitives, Framer Motion, Recharts, @dnd-kit
- **Backend:** Next.js API routes + Server Components
- **Database:** PostgreSQL 16 via Prisma ORM
- **Auth:** NextAuth.js with JWT sessions
- **Infrastructure:** Docker Compose (Postgres, Redis, MinIO)

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

### Tier 3 — Segment-specific (Stubbed)
- Grants & M&E, CRM, Compliance, Reports & Analytics

## Development

```bash
# Run dev server
pnpm dev

# Build for production
pnpm build

# Database commands
npx prisma studio     # Visual DB browser
npx prisma db push    # Push schema changes
npx prisma db seed    # Re-seed demo data

# Lint
pnpm lint
```

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

### Docker Compose

The included `docker-compose.yml` starts:
- PostgreSQL 16 on port 5434
- Redis 7 on port 6379
- MinIO on ports 9000/9001

## License

Proprietary. All rights reserved.
