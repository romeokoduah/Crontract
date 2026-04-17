# Roadmap

## Phase 1 — MVP Polish (Next Sprint)

### P0 — Critical
- [ ] Global search wired to Postgres full-text search
- [ ] File upload/download (connect MinIO, wire attachment UI)
- [ ] Email sending via Resend (verification, invitations, notifications)
- [ ] Dashboard widgets — drag-to-reorder, role-aware widget selection
- [ ] Mobile responsive audit — fix all breakpoints for top 10 pages

### P1 — Important
- [ ] OAuth providers (Google, Microsoft) — just need API keys
- [ ] Magic link login via Resend
- [ ] Password reset flow
- [ ] Gantt view for projects (lightweight timeline, no full MS Project)
- [ ] Financial statements computation (P&L, Balance Sheet, Cash Flow)
- [ ] Journal posting workflow with balance validation
- [ ] Bank reconciliation — match transactions to journal entries
- [ ] Org chart visualization (tree diagram)
- [ ] Employee document management (contracts, certificates)

## Phase 2 — Tier 3 Modules

### Grants & M&E (NGO)
- [ ] Donor master with contact details and preferences
- [ ] Grant lifecycle (proposal → awarded → active → closed)
- [ ] Restricted vs unrestricted fund tracking
- [ ] Budget lines per grant with disbursement schedules
- [ ] Indicators with targets and quarterly actuals
- [ ] Beneficiary registry (disaggregated by sex/age/location/disability)
- [ ] Field activity reports
- [ ] Donor report generator (template-based)

### CRM (Startup)
- [ ] Contact and company management
- [ ] Pipeline stages (configurable)
- [ ] Deals with amount, probability, close date
- [ ] Activity tracking (calls, emails, meetings)
- [ ] Email sync stub
- [ ] Pipeline dashboard with funnel chart

### Compliance
- [ ] Regulatory register (EPA Ghana, Minerals Commission, GRA, SSNIT)
- [ ] Obligation calendar with due dates
- [ ] Filing tracker with status
- [ ] Certificate library with expiry alerts
- [ ] Auto-generated compliance reports

### Communications
- [ ] In-app chat (channels per project/department + DMs)
- [ ] Announcements (workspace-wide or group-targeted)
- [ ] @mentions in comments and chat
- [ ] Notification preferences per channel

### Time Tracking
- [ ] Timesheets against projects/tasks
- [ ] Billable vs non-billable hours
- [ ] Approval workflow for timesheets
- [ ] Export to payroll/invoicing
- [ ] Weekly timesheet view

### Reports & Analytics
- [ ] Report builder (pick entity, columns, filter, group, pivot)
- [ ] Export to CSV, XLSX, PDF
- [ ] Saved reports with sharing
- [ ] Scheduled email delivery
- [ ] Executive dashboard with cross-module KPIs

## Phase 3 — Enterprise Features

- [ ] PostgreSQL Row-Level Security policies
- [ ] Multi-currency with exchange rate management
- [ ] Period-based accounting (open/close periods)
- [ ] Payroll module (Ghana-specific: SSNIT, PAYE, Tier 2/3)
- [ ] Leave management with accrual policies
- [ ] Workflow builder (visual, drag-and-drop approval flow designer)
- [ ] Custom fields on any entity
- [ ] API keys for external integrations
- [ ] Webhook delivery for events
- [ ] Bulk import/export (CSV upload with field mapping)
- [ ] Two-factor authentication (TOTP)
- [ ] SSO (SAML 2.0) for enterprise clients
- [ ] White-labeling (custom logo, colors, domain)
- [ ] Internationalization (fr, tw, ha)
- [ ] Offline mode (PWA with sync)
- [ ] Mobile app (React Native or Expo)

## Phase 4 — Scale

- [ ] Read replicas for reporting queries
- [ ] Redis caching for dashboard aggregations
- [ ] Background job queue (BullMQ) for reports, depreciation, notifications
- [ ] Meilisearch/Typesense for advanced search
- [ ] CDN for static assets
- [ ] Rate limiting and abuse prevention
- [ ] SOC 2 compliance preparation
- [ ] Load testing and performance optimization
