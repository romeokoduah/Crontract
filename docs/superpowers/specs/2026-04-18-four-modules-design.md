# Design: Grants & M&E, CRM, Compliance, Social Media Modules

## Overview

Four new full-feature modules for Crontract, following existing patterns (Finance/Procurement/HSE as templates). Each module includes: Prisma schema models, API routes, overview dashboard, list pages, create/edit forms, and navigation integration.

---

## Module 1: Grants & M&E

### Sub-pages
Overview, Grants, Donors, Logframes, Indicators, Reports

### Data Models

**Donor** — name, type (BILATERAL/MULTILATERAL/FOUNDATION/CORPORATE/GOVERNMENT/INDIVIDUAL), contactName, email, phone, country, website, notes, isActive

**Grant** — donor relation, title, grantNumber, description, amount, currency, startDate, endDate, status (PIPELINE/SUBMITTED/APPROVED/ACTIVE/SUSPENDED/CLOSEOUT/CLOSED), reportingFrequency (MONTHLY/QUARTERLY/SEMI_ANNUAL/ANNUAL), programArea, contactPerson, notes, lines (JSON budget breakdown)

**GrantReport** — grant relation, reportNumber, period, type (NARRATIVE/FINANCIAL/COMBINED), status (DRAFT/SUBMITTED/ACCEPTED/REVISION_REQUESTED), dueDate, submittedDate, content (JSON), createdBy

**Logframe** — grant relation, goal, purpose, outputs (JSON array of {description, indicators[], activities[]}), assumptions (JSON)

**Indicator** — grant relation, name, type (OUTPUT/OUTCOME/IMPACT), category, unit, baseline, target, collectionFrequency, dataSource, responsible

**IndicatorResult** — indicator relation, period, actualValue, notes, evidenceKey, reportedBy, reportedDate

### Key Features
- Grant lifecycle tracking with status pipeline
- Budget vs actuals tracking per grant (burn rate)
- Logframe/results framework builder
- Indicator data collection with period tracking
- Donor reporting with due date alerts
- M&E dashboard with progress charts (target vs actual)

---

## Module 2: CRM

### Sub-pages
Overview, Contacts, Companies, Deals, Pipeline (Kanban view), Activities

### Data Models

**CrmCompany** — name, industry, website, phone, email, address, size (SMALL/MEDIUM/LARGE/ENTERPRISE), annualRevenue, ownerId, notes, isActive

**CrmContact** — company relation (optional), firstName, lastName, email, phone, jobTitle, lifecycleStage (LEAD/PROSPECT/OPPORTUNITY/CUSTOMER/CHURNED), source (WEB/REFERRAL/EVENT/COLD_CALL/SOCIAL/OTHER), ownerId, notes, lastContactedAt

**CrmDeal** — contact relation, company relation, title, value, currency, stage (QUALIFIED/PROPOSAL/NEGOTIATION/CONTRACT_SENT/WON/LOST), probability, expectedCloseDate, actualCloseDate, ownerId, lostReason, notes

**CrmActivity** — contact relation (optional), deal relation (optional), type (CALL/EMAIL/MEETING/NOTE/TASK), subject, description, dueDate, completedAt, createdBy

### Key Features
- Contact and company management with lifecycle stages
- Deal pipeline with Kanban drag-and-drop view
- Activity timeline per contact/deal
- Revenue forecasting (weighted pipeline)
- Overview dashboard: pipeline value, conversion rate, activities due
- Deal stage history tracking

---

## Module 3: Compliance

### Sub-pages
Overview, Obligations, Licences, Policies, Audits, Actions

### Data Models

**ComplianceObligation** — title, regulation, category (REGULATORY/CONTRACTUAL/INTERNAL/INDUSTRY), description, frequency (ONE_TIME/DAILY/WEEKLY/MONTHLY/QUARTERLY/ANNUAL), ownerId, nextDueDate, status (COMPLIANT/NON_COMPLIANT/AT_RISK/NOT_ASSESSED), priority, notes

**Licence** — name, issuingAuthority, licenceNumber, category, issueDate, expiryDate, status (ACTIVE/EXPIRING_SOON/EXPIRED/SUSPENDED/REVOKED), renewalCost, currency, alertDaysBefore (default 30), responsibleId, notes, documentKey

**Policy** — title, policyNumber, category (HR/SAFETY/FINANCIAL/IT/OPERATIONAL/LEGAL/ENVIRONMENTAL), version, effectiveDate, reviewDate, status (DRAFT/IN_REVIEW/ACTIVE/ARCHIVED/SUPERSEDED), content (text), approvedBy, approvedDate

**ComplianceAudit** — title, auditNumber, type (INTERNAL/EXTERNAL/REGULATORY), auditor, scope, scheduledDate, completedDate, status (PLANNED/IN_PROGRESS/COMPLETED/CANCELLED), findings (JSON array of {finding, severity, recommendation}), overallRating (SATISFACTORY/NEEDS_IMPROVEMENT/UNSATISFACTORY)

**CorrectiveAction** — audit relation (optional), obligation relation (optional), title, description, assigneeId, dueDate, completedDate, status (OPEN/IN_PROGRESS/COMPLETED/OVERDUE/CANCELLED), priority

### Key Features
- Obligation register with compliance status dashboard
- Licence expiry tracking with configurable alerts
- Policy register with version history
- Audit management with findings and ratings
- Corrective action tracking linked to audits/obligations
- Overview: compliance score, expiring licences, overdue actions

---

## Module 4: Social Media

### Sub-pages
Overview (analytics), Compose, Calendar, Posts, Accounts

### Data Models

**SocialAccount** — platform (FACEBOOK/INSTAGRAM/TWITTER/LINKEDIN/TIKTOK/YOUTUBE), accountName, handle, avatarUrl, isConnected, accessToken (encrypted string, nullable), tokenExpiry, metadata (JSON — follower count, etc.)

**SocialPost** — content (text), mediaUrls (JSON array), status (DRAFT/SCHEDULED/PUBLISHING/PUBLISHED/PARTIALLY_PUBLISHED/FAILED), scheduledAt, publishedAt, createdBy, tags (string array), campaignName

**SocialPostPlatform** — post relation, socialAccount relation, platform, platformPostId (external ID from platform), status (PENDING/PUBLISHED/FAILED), publishedUrl, errorMessage, engagement (JSON: {likes, comments, shares, reach, impressions, clicks})

### Key Features
- Multi-platform post composer with:
  - Per-platform character limits (Twitter 280, LinkedIn 3000, etc.)
  - Platform toggle selector
  - Media attachment preview
  - Preview per platform
- Content calendar (month/week view) with scheduled posts
- Post list with status and engagement metrics
- Account management page (connect/disconnect — OAuth stubs)
- Analytics dashboard: engagement by platform, reach over time, top posts
- Draft and scheduling workflow

### Platform Integration (Stubbed)
All platform API calls go through a `SocialService` that currently returns mock success responses. Each platform has a typed interface so real OAuth + posting can be wired in later without changing the UI.

---

## Cross-Cutting Concerns

### Navigation
- All 4 modules get `children` sub-menus in `mainNavItems`
- Social Media added with `Megaphone` icon (import from lucide-react)
- All modules added to all business types in `modulesByBusinessType`

### Patterns (matching existing codebase)
- Server Components for list/overview pages with Prisma queries
- Client Components for create/edit forms
- API routes with Zod validation + audit logging
- Status badges with color-coded configs
- Empty states with icon + CTA
- Summary cards grid on overview pages
- formatCurrency/formatDate utilities where applicable

### Schema Conventions
- All models have workspaceId (multi-tenancy)
- UUID primary keys with @db.Uuid
- Snake_case DB columns with @map
- Soft delete with deletedAt where appropriate
- Unique constraints for numbered sequences per workspace
- JSON fields for complex nested data (lines, findings, engagement)
