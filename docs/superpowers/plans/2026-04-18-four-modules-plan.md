# Four Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build four full-feature modules (Grants & M&E, CRM, Compliance, Social Media) for the Crontract enterprise operations platform.

**Architecture:** Each module follows the established Finance/Procurement pattern: Prisma schema models with workspace multi-tenancy, Next.js API routes with Zod validation and audit logging, server component pages for listing/overview, client component pages for create forms. Navigation uses `mainNavItems` with `children` sub-menus.

**Tech Stack:** Next.js 14, Prisma (PostgreSQL), Zod, shadcn/ui, Tailwind CSS, NextAuth, lucide-react icons

---

## Task 1: Database Schema — All Four Modules

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

This task adds all Prisma models for all 4 modules in one shot, then runs the migration. This avoids multiple migration steps.

- [ ] **Step 1: Add Grants & M&E models to schema.prisma**

Append after the HSE section (after line 1170):

```prisma
// ============================================================
// GRANTS & M&E
// ============================================================

model Donor {
  id          String   @id @default(uuid()) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  name        String
  type        DonorType
  contactName String?  @map("contact_name")
  email       String?
  phone       String?
  country     String?
  website     String?
  notes       String?  @db.Text
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  grants    Grant[]

  @@unique([workspaceId, name])
  @@map("donors")
}

enum DonorType {
  BILATERAL
  MULTILATERAL
  FOUNDATION
  CORPORATE
  GOVERNMENT
  INDIVIDUAL
}

model Grant {
  id                 String          @id @default(uuid()) @db.Uuid
  workspaceId        String          @map("workspace_id") @db.Uuid
  donorId            String          @map("donor_id") @db.Uuid
  grantNumber        String          @map("grant_number")
  title              String
  description        String?         @db.Text
  amount             Decimal         @db.Decimal(14, 2)
  currency           String          @default("GHS")
  startDate          DateTime        @map("start_date")
  endDate            DateTime        @map("end_date")
  status             GrantStatus     @default(PIPELINE)
  reportingFrequency ReportingFrequency @default(QUARTERLY) @map("reporting_frequency")
  programArea        String?         @map("program_area")
  contactPerson      String?         @map("contact_person")
  notes              String?         @db.Text
  lines              Json?
  createdBy          String          @map("created_by") @db.Uuid
  createdAt          DateTime        @default(now()) @map("created_at")
  updatedAt          DateTime        @updatedAt @map("updated_at")
  deletedAt          DateTime?       @map("deleted_at")

  workspace   Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  donor       Donor         @relation(fields: [donorId], references: [id])
  reports     GrantReport[]
  logframes   Logframe[]
  indicators  Indicator[]

  @@unique([workspaceId, grantNumber])
  @@map("grants")
}

enum GrantStatus {
  PIPELINE
  SUBMITTED
  APPROVED
  ACTIVE
  SUSPENDED
  CLOSEOUT
  CLOSED
}

enum ReportingFrequency {
  MONTHLY
  QUARTERLY
  SEMI_ANNUAL
  ANNUAL
}

model GrantReport {
  id            String            @id @default(uuid()) @db.Uuid
  workspaceId   String            @map("workspace_id") @db.Uuid
  grantId       String            @map("grant_id") @db.Uuid
  reportNumber  String            @map("report_number")
  period        String
  type          GrantReportType
  status        GrantReportStatus @default(DRAFT)
  dueDate       DateTime          @map("due_date")
  submittedDate DateTime?         @map("submitted_date")
  content       Json?
  createdBy     String            @map("created_by") @db.Uuid
  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  grant     Grant     @relation(fields: [grantId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, reportNumber])
  @@map("grant_reports")
}

enum GrantReportType {
  NARRATIVE
  FINANCIAL
  COMBINED
}

enum GrantReportStatus {
  DRAFT
  SUBMITTED
  ACCEPTED
  REVISION_REQUESTED
}

model Logframe {
  id          String   @id @default(uuid()) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  grantId     String   @map("grant_id") @db.Uuid
  goal        String   @db.Text
  purpose     String   @db.Text
  outputs     Json
  assumptions Json?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  grant     Grant     @relation(fields: [grantId], references: [id], onDelete: Cascade)

  @@map("logframes")
}

model Indicator {
  id                  String              @id @default(uuid()) @db.Uuid
  workspaceId         String              @map("workspace_id") @db.Uuid
  grantId             String              @map("grant_id") @db.Uuid
  name                String
  type                IndicatorType
  category            String?
  unit                String
  baseline            Decimal             @default(0) @db.Decimal(14, 2)
  target              Decimal             @db.Decimal(14, 2)
  collectionFrequency ReportingFrequency  @default(QUARTERLY) @map("collection_frequency")
  dataSource          String?             @map("data_source")
  responsible         String?
  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt @map("updated_at")

  workspace Workspace         @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  grant     Grant              @relation(fields: [grantId], references: [id], onDelete: Cascade)
  results   IndicatorResult[]

  @@map("indicators")
}

enum IndicatorType {
  OUTPUT
  OUTCOME
  IMPACT
}

model IndicatorResult {
  id           String   @id @default(uuid()) @db.Uuid
  workspaceId  String   @map("workspace_id") @db.Uuid
  indicatorId  String   @map("indicator_id") @db.Uuid
  period       String
  actualValue  Decimal  @map("actual_value") @db.Decimal(14, 2)
  notes        String?  @db.Text
  evidenceKey  String?  @map("evidence_key")
  reportedBy   String   @map("reported_by") @db.Uuid
  reportedDate DateTime @map("reported_date")
  createdAt    DateTime @default(now()) @map("created_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  indicator Indicator @relation(fields: [indicatorId], references: [id], onDelete: Cascade)

  @@map("indicator_results")
}
```

- [ ] **Step 2: Add CRM models to schema.prisma**

Append after the Grants section:

```prisma
// ============================================================
// CRM
// ============================================================

model CrmCompany {
  id            String       @id @default(uuid()) @db.Uuid
  workspaceId   String       @map("workspace_id") @db.Uuid
  name          String
  industry      String?
  website       String?
  phone         String?
  email         String?
  address       String?      @db.Text
  size          CompanySize?
  annualRevenue Decimal?     @map("annual_revenue") @db.Decimal(14, 2)
  ownerId       String?      @map("owner_id") @db.Uuid
  notes         String?      @db.Text
  isActive      Boolean      @default(true) @map("is_active")
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")
  deletedAt     DateTime?    @map("deleted_at")

  workspace Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  contacts  CrmContact[]
  deals     CrmDeal[]

  @@unique([workspaceId, name])
  @@map("crm_companies")
}

enum CompanySize {
  SMALL
  MEDIUM
  LARGE
  ENTERPRISE
}

model CrmContact {
  id              String         @id @default(uuid()) @db.Uuid
  workspaceId     String         @map("workspace_id") @db.Uuid
  companyId       String?        @map("company_id") @db.Uuid
  firstName       String         @map("first_name")
  lastName        String         @map("last_name")
  email           String?
  phone           String?
  jobTitle        String?        @map("job_title")
  lifecycleStage  LifecycleStage @default(LEAD) @map("lifecycle_stage")
  source          LeadSource?
  ownerId         String?        @map("owner_id") @db.Uuid
  notes           String?        @db.Text
  lastContactedAt DateTime?      @map("last_contacted_at")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")
  deletedAt       DateTime?      @map("deleted_at")

  workspace  Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  company    CrmCompany?   @relation(fields: [companyId], references: [id])
  deals      CrmDeal[]
  activities CrmActivity[]

  @@map("crm_contacts")
}

enum LifecycleStage {
  LEAD
  PROSPECT
  OPPORTUNITY
  CUSTOMER
  CHURNED
}

enum LeadSource {
  WEB
  REFERRAL
  EVENT
  COLD_CALL
  SOCIAL
  OTHER
}

model CrmDeal {
  id                String    @id @default(uuid()) @db.Uuid
  workspaceId       String    @map("workspace_id") @db.Uuid
  contactId         String?   @map("contact_id") @db.Uuid
  companyId         String?   @map("company_id") @db.Uuid
  title             String
  value             Decimal   @db.Decimal(14, 2)
  currency          String    @default("GHS")
  stage             DealStage @default(QUALIFIED)
  probability       Int       @default(0)
  expectedCloseDate DateTime? @map("expected_close_date")
  actualCloseDate   DateTime? @map("actual_close_date")
  ownerId           String?   @map("owner_id") @db.Uuid
  lostReason        String?   @map("lost_reason")
  notes             String?   @db.Text
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  deletedAt         DateTime? @map("deleted_at")

  workspace  Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  contact    CrmContact?   @relation(fields: [contactId], references: [id])
  company    CrmCompany?   @relation(fields: [companyId], references: [id])
  activities CrmActivity[]

  @@map("crm_deals")
}

enum DealStage {
  QUALIFIED
  PROPOSAL
  NEGOTIATION
  CONTRACT_SENT
  WON
  LOST
}

model CrmActivity {
  id          String       @id @default(uuid()) @db.Uuid
  workspaceId String       @map("workspace_id") @db.Uuid
  contactId   String?      @map("contact_id") @db.Uuid
  dealId      String?      @map("deal_id") @db.Uuid
  type        ActivityType
  subject     String
  description String?      @db.Text
  dueDate     DateTime?    @map("due_date")
  completedAt DateTime?    @map("completed_at")
  createdBy   String       @map("created_by") @db.Uuid
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  workspace Workspace   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  contact   CrmContact? @relation(fields: [contactId], references: [id])
  deal      CrmDeal?    @relation(fields: [dealId], references: [id])

  @@index([contactId])
  @@index([dealId])
  @@map("crm_activities")
}

enum ActivityType {
  CALL
  EMAIL
  MEETING
  NOTE
  TASK
}
```

- [ ] **Step 3: Add Compliance models to schema.prisma**

Append after the CRM section:

```prisma
// ============================================================
// COMPLIANCE
// ============================================================

model ComplianceObligation {
  id          String               @id @default(uuid()) @db.Uuid
  workspaceId String               @map("workspace_id") @db.Uuid
  title       String
  regulation  String?
  category    ObligationCategory
  description String?              @db.Text
  frequency   ObligationFrequency  @default(ANNUAL)
  ownerId     String?              @map("owner_id") @db.Uuid
  nextDueDate DateTime?            @map("next_due_date")
  status      ComplianceStatus     @default(NOT_ASSESSED)
  priority    Priority             @default(MEDIUM)
  notes       String?              @db.Text
  createdAt   DateTime             @default(now()) @map("created_at")
  updatedAt   DateTime             @updatedAt @map("updated_at")
  deletedAt   DateTime?            @map("deleted_at")

  workspace        Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  correctiveActions CorrectiveAction[] @relation("ObligationActions")

  @@map("compliance_obligations")
}

enum ObligationCategory {
  REGULATORY
  CONTRACTUAL
  INTERNAL
  INDUSTRY
}

enum ObligationFrequency {
  ONE_TIME
  DAILY
  WEEKLY
  MONTHLY
  QUARTERLY
  ANNUAL
}

enum ComplianceStatus {
  COMPLIANT
  NON_COMPLIANT
  AT_RISK
  NOT_ASSESSED
}

model Licence {
  id               String       @id @default(uuid()) @db.Uuid
  workspaceId      String       @map("workspace_id") @db.Uuid
  name             String
  issuingAuthority String       @map("issuing_authority")
  licenceNumber    String       @map("licence_number")
  category         String?
  issueDate        DateTime     @map("issue_date")
  expiryDate       DateTime     @map("expiry_date")
  status           LicenceStatus @default(ACTIVE)
  renewalCost      Decimal?     @map("renewal_cost") @db.Decimal(14, 2)
  currency         String       @default("GHS")
  alertDaysBefore  Int          @default(30) @map("alert_days_before")
  responsibleId    String?      @map("responsible_id") @db.Uuid
  notes            String?      @db.Text
  documentKey      String?      @map("document_key")
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")
  deletedAt        DateTime?    @map("deleted_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, licenceNumber])
  @@map("licences")
}

enum LicenceStatus {
  ACTIVE
  EXPIRING_SOON
  EXPIRED
  SUSPENDED
  REVOKED
}

model Policy {
  id           String       @id @default(uuid()) @db.Uuid
  workspaceId  String       @map("workspace_id") @db.Uuid
  title        String
  policyNumber String       @map("policy_number")
  category     PolicyCategory
  version      Int          @default(1)
  effectiveDate DateTime    @map("effective_date")
  reviewDate   DateTime?    @map("review_date")
  status       PolicyStatus @default(DRAFT)
  content      String?      @db.Text
  approvedBy   String?      @map("approved_by") @db.Uuid
  approvedDate DateTime?    @map("approved_date")
  createdBy    String       @map("created_by") @db.Uuid
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")
  deletedAt    DateTime?    @map("deleted_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, policyNumber])
  @@map("policies")
}

enum PolicyCategory {
  HR
  SAFETY
  FINANCIAL
  IT
  OPERATIONAL
  LEGAL
  ENVIRONMENTAL
}

enum PolicyStatus {
  DRAFT
  IN_REVIEW
  ACTIVE
  ARCHIVED
  SUPERSEDED
}

model ComplianceAudit {
  id             String      @id @default(uuid()) @db.Uuid
  workspaceId    String      @map("workspace_id") @db.Uuid
  auditNumber    String      @map("audit_number")
  title          String
  type           AuditType
  auditor        String?
  scope          String?     @db.Text
  scheduledDate  DateTime    @map("scheduled_date")
  completedDate  DateTime?   @map("completed_date")
  status         AuditStatus @default(PLANNED)
  findings       Json?
  overallRating  AuditRating? @map("overall_rating")
  createdBy      String      @map("created_by") @db.Uuid
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")

  workspace         Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  correctiveActions CorrectiveAction[] @relation("AuditActions")

  @@unique([workspaceId, auditNumber])
  @@map("compliance_audits")
}

enum AuditType {
  INTERNAL
  EXTERNAL
  REGULATORY
}

enum AuditStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum AuditRating {
  SATISFACTORY
  NEEDS_IMPROVEMENT
  UNSATISFACTORY
}

model CorrectiveAction {
  id            String                @id @default(uuid()) @db.Uuid
  workspaceId   String                @map("workspace_id") @db.Uuid
  auditId       String?               @map("audit_id") @db.Uuid
  obligationId  String?               @map("obligation_id") @db.Uuid
  title         String
  description   String?               @db.Text
  assigneeId    String?               @map("assignee_id") @db.Uuid
  dueDate       DateTime?             @map("due_date")
  completedDate DateTime?             @map("completed_date")
  status        CorrectiveActionStatus @default(OPEN)
  priority      Priority              @default(MEDIUM)
  createdBy     String                @map("created_by") @db.Uuid
  createdAt     DateTime              @default(now()) @map("created_at")
  updatedAt     DateTime              @updatedAt @map("updated_at")

  workspace  Workspace            @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  audit      ComplianceAudit?     @relation("AuditActions", fields: [auditId], references: [id])
  obligation ComplianceObligation? @relation("ObligationActions", fields: [obligationId], references: [id])

  @@map("corrective_actions")
}

enum CorrectiveActionStatus {
  OPEN
  IN_PROGRESS
  COMPLETED
  OVERDUE
  CANCELLED
}
```

- [ ] **Step 4: Add Social Media models to schema.prisma**

Append after the Compliance section:

```prisma
// ============================================================
// SOCIAL MEDIA
// ============================================================

model SocialAccount {
  id          String         @id @default(uuid()) @db.Uuid
  workspaceId String         @map("workspace_id") @db.Uuid
  platform    SocialPlatform
  accountName String         @map("account_name")
  handle      String
  avatarUrl   String?        @map("avatar_url")
  isConnected Boolean        @default(false) @map("is_connected")
  accessToken String?        @map("access_token") @db.Text
  tokenExpiry DateTime?      @map("token_expiry")
  metadata    Json?
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  workspace     Workspace             @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  postPlatforms SocialPostPlatform[]

  @@unique([workspaceId, platform, handle])
  @@map("social_accounts")
}

enum SocialPlatform {
  FACEBOOK
  INSTAGRAM
  TWITTER
  LINKEDIN
  TIKTOK
  YOUTUBE
}

model SocialPost {
  id           String           @id @default(uuid()) @db.Uuid
  workspaceId  String           @map("workspace_id") @db.Uuid
  content      String           @db.Text
  mediaUrls    Json?            @map("media_urls")
  status       SocialPostStatus @default(DRAFT)
  scheduledAt  DateTime?        @map("scheduled_at")
  publishedAt  DateTime?        @map("published_at")
  tags         String[]         @default([])
  campaignName String?          @map("campaign_name")
  createdBy    String           @map("created_by") @db.Uuid
  createdAt    DateTime         @default(now()) @map("created_at")
  updatedAt    DateTime         @updatedAt @map("updated_at")
  deletedAt    DateTime?        @map("deleted_at")

  workspace Workspace             @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  platforms SocialPostPlatform[]

  @@map("social_posts")
}

enum SocialPostStatus {
  DRAFT
  SCHEDULED
  PUBLISHING
  PUBLISHED
  PARTIALLY_PUBLISHED
  FAILED
}

model SocialPostPlatform {
  id             String                     @id @default(uuid()) @db.Uuid
  postId         String                     @map("post_id") @db.Uuid
  socialAccountId String                    @map("social_account_id") @db.Uuid
  platform       SocialPlatform
  platformPostId String?                    @map("platform_post_id")
  status         SocialPostPlatformStatus   @default(PENDING)
  publishedUrl   String?                    @map("published_url")
  errorMessage   String?                    @map("error_message")
  engagement     Json?
  createdAt      DateTime                   @default(now()) @map("created_at")
  updatedAt      DateTime                   @updatedAt @map("updated_at")

  post          SocialPost    @relation(fields: [postId], references: [id], onDelete: Cascade)
  socialAccount SocialAccount @relation(fields: [socialAccountId], references: [id])

  @@map("social_post_platforms")
}

enum SocialPostPlatformStatus {
  PENDING
  PUBLISHED
  FAILED
}
```

- [ ] **Step 5: Add Workspace relations for all new models**

In the `Workspace` model (around line 81-142), add these relation fields after the HSE section:

```prisma
  // Grants & M&E
  donors           Donor[]
  grants           Grant[]
  grantReports     GrantReport[]
  logframes        Logframe[]
  indicators       Indicator[]
  indicatorResults IndicatorResult[]

  // CRM
  crmCompanies   CrmCompany[]
  crmContacts    CrmContact[]
  crmDeals       CrmDeal[]
  crmActivities  CrmActivity[]

  // Compliance
  complianceObligations ComplianceObligation[]
  licences              Licence[]
  policies              Policy[]
  complianceAudits      ComplianceAudit[]
  correctiveActions     CorrectiveAction[]

  // Social Media
  socialAccounts SocialAccount[]
  socialPosts    SocialPost[]
```

- [ ] **Step 6: Generate Prisma client and push schema**

Run:
```bash
cd /Users/alva/Downloads/Crontract && pnpm db:generate && pnpm db:push
```

Expected: Schema pushed successfully, Prisma client generated.

- [ ] **Step 7: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat: add database schema for Grants, CRM, Compliance, Social Media modules"
```

---

## Task 2: Navigation — Register All Four Modules

**Files:**
- Modify: `apps/web/src/lib/navigation.ts`

- [ ] **Step 1: Add Megaphone icon import**

In the import block at the top of `apps/web/src/lib/navigation.ts`, add `Megaphone` to the lucide-react imports:

```typescript
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Calendar,
  FileText,
  CheckSquare,
  Bell,
  Settings,
  DollarSign,
  PiggyBank,
  ShoppingCart,
  Package,
  HardHat,
  BarChart3,
  Heart,
  Briefcase,
  Shield,
  Megaphone,
  type LucideIcon,
} from "lucide-react"
```

- [ ] **Step 2: Update Grants & M&E nav item with children**

Replace the existing Grants entry in `mainNavItems`:

```typescript
  {
    title: "Grants & M&E",
    href: "/grants",
    icon: Heart,
    module: "grants",
    children: [
      { title: "Overview", href: "/grants", icon: Heart },
      { title: "Grants", href: "/grants/grants", icon: Heart },
      { title: "Donors", href: "/grants/donors", icon: Heart },
      { title: "Logframes", href: "/grants/logframes", icon: Heart },
      { title: "Indicators", href: "/grants/indicators", icon: Heart },
      { title: "Reports", href: "/grants/reports", icon: Heart },
    ],
  },
```

- [ ] **Step 3: Update CRM nav item with children**

Replace the existing CRM entry:

```typescript
  {
    title: "CRM",
    href: "/crm",
    icon: Briefcase,
    module: "crm",
    children: [
      { title: "Overview", href: "/crm", icon: Briefcase },
      { title: "Contacts", href: "/crm/contacts", icon: Briefcase },
      { title: "Companies", href: "/crm/companies", icon: Briefcase },
      { title: "Deals", href: "/crm/deals", icon: Briefcase },
      { title: "Pipeline", href: "/crm/pipeline", icon: Briefcase },
      { title: "Activities", href: "/crm/activities", icon: Briefcase },
    ],
  },
```

- [ ] **Step 4: Update Compliance nav item with children**

Replace the existing Compliance entry:

```typescript
  {
    title: "Compliance",
    href: "/compliance",
    icon: Shield,
    module: "compliance",
    children: [
      { title: "Overview", href: "/compliance", icon: Shield },
      { title: "Obligations", href: "/compliance/obligations", icon: Shield },
      { title: "Licences", href: "/compliance/licences", icon: Shield },
      { title: "Policies", href: "/compliance/policies", icon: Shield },
      { title: "Audits", href: "/compliance/audits", icon: Shield },
      { title: "Actions", href: "/compliance/actions", icon: Shield },
    ],
  },
```

- [ ] **Step 5: Add Social Media nav item**

Add after the Compliance entry and before the Reports entry:

```typescript
  {
    title: "Social Media",
    href: "/social-media",
    icon: Megaphone,
    module: "social-media",
    children: [
      { title: "Overview", href: "/social-media", icon: Megaphone },
      { title: "Compose", href: "/social-media/compose", icon: Megaphone },
      { title: "Calendar", href: "/social-media/calendar", icon: Megaphone },
      { title: "Posts", href: "/social-media/posts", icon: Megaphone },
      { title: "Accounts", href: "/social-media/accounts", icon: Megaphone },
    ],
  },
```

- [ ] **Step 6: Update modulesByBusinessType**

Replace the `modulesByBusinessType` object to include all modules for all business types:

```typescript
export const modulesByBusinessType: Record<string, string[]> = {
  MINING_CONTRACTOR: [
    "people", "projects", "meetings", "documents", "approvals",
    "finance", "budget", "procurement", "assets", "hse",
    "compliance", "crm", "grants", "social-media", "reports",
  ],
  NGO: [
    "people", "projects", "meetings", "documents", "approvals",
    "finance", "budget", "procurement", "grants", "crm",
    "compliance", "social-media", "reports",
  ],
  STARTUP: [
    "people", "projects", "meetings", "documents", "approvals",
    "finance", "budget", "crm", "social-media",
    "compliance", "grants", "reports",
  ],
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/navigation.ts
git commit -m "feat: register Grants, CRM, Compliance, Social Media in navigation"
```

---

## Task 3: Grants & M&E — API Routes

**Files:**
- Create: `apps/web/src/app/api/grants/donors/route.ts`
- Create: `apps/web/src/app/api/grants/grants/route.ts`
- Create: `apps/web/src/app/api/grants/reports/route.ts`
- Create: `apps/web/src/app/api/grants/logframes/route.ts`
- Create: `apps/web/src/app/api/grants/indicators/route.ts`

- [ ] **Step 1: Create donors API route**

Create `apps/web/src/app/api/grants/donors/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const createDonorSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["BILATERAL", "MULTILATERAL", "FOUNDATION", "CORPORATE", "GOVERNMENT", "INDIVIDUAL"]),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  country: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const donors = await prisma.donor.findMany({
      where: { workspaceId: session.user.workspaceId, deletedAt: null },
      include: { _count: { select: { grants: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ donors })
  } catch (err) {
    console.error("[GET /api/grants/donors]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createDonorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId
    const donor = await prisma.donor.create({
      data: { workspaceId, ...parsed.data },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId: session.user.id,
        entityType: "donor",
        entityId: donor.id,
        action: "CREATE",
        afterState: { name: donor.name, type: donor.type },
      },
    })

    return NextResponse.json({ donor }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/grants/donors]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create grants API route**

Create `apps/web/src/app/api/grants/grants/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const createGrantSchema = z.object({
  donorId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default("GHS"),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["PIPELINE", "SUBMITTED", "APPROVED", "ACTIVE", "SUSPENDED", "CLOSEOUT", "CLOSED"]).default("PIPELINE"),
  reportingFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).default("QUARTERLY"),
  programArea: z.string().optional(),
  contactPerson: z.string().optional(),
  notes: z.string().optional(),
  lines: z.any().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const grants = await prisma.grant.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        deletedAt: null,
        ...(status ? { status: status as any } : {}),
      },
      include: { donor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ grants })
  } catch (err) {
    console.error("[GET /api/grants/grants]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createGrantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId
    const count = await prisma.grant.count({ where: { workspaceId } })
    const grantNumber = `GRT-${String(count + 1).padStart(4, "0")}`

    const grant = await prisma.grant.create({
      data: {
        workspaceId,
        grantNumber,
        donorId: parsed.data.donorId,
        title: parsed.data.title,
        description: parsed.data.description,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        status: parsed.data.status,
        reportingFrequency: parsed.data.reportingFrequency,
        programArea: parsed.data.programArea,
        contactPerson: parsed.data.contactPerson,
        notes: parsed.data.notes,
        lines: parsed.data.lines,
        createdBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId: session.user.id,
        entityType: "grant",
        entityId: grant.id,
        action: "CREATE",
        afterState: { grantNumber: grant.grantNumber, title: grant.title, status: grant.status },
      },
    })

    return NextResponse.json({ grant }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/grants/grants]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create grant reports API route**

Create `apps/web/src/app/api/grants/reports/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const createReportSchema = z.object({
  grantId: z.string().uuid(),
  period: z.string().min(1),
  type: z.enum(["NARRATIVE", "FINANCIAL", "COMBINED"]),
  dueDate: z.string(),
  content: z.any().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "ACCEPTED", "REVISION_REQUESTED"]).default("DRAFT"),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const reports = await prisma.grantReport.findMany({
      where: { workspaceId: session.user.workspaceId },
      include: { grant: { select: { title: true, grantNumber: true } } },
      orderBy: { dueDate: "desc" },
    })

    return NextResponse.json({ reports })
  } catch (err) {
    console.error("[GET /api/grants/reports]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createReportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId
    const count = await prisma.grantReport.count({ where: { workspaceId } })
    const reportNumber = `RPT-${String(count + 1).padStart(4, "0")}`

    const report = await prisma.grantReport.create({
      data: {
        workspaceId,
        reportNumber,
        grantId: parsed.data.grantId,
        period: parsed.data.period,
        type: parsed.data.type,
        status: parsed.data.status,
        dueDate: new Date(parsed.data.dueDate),
        content: parsed.data.content,
        createdBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId: session.user.id,
        entityType: "grant_report",
        entityId: report.id,
        action: "CREATE",
        afterState: { reportNumber: report.reportNumber, type: report.type },
      },
    })

    return NextResponse.json({ report }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/grants/reports]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create logframes API route**

Create `apps/web/src/app/api/grants/logframes/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const createLogframeSchema = z.object({
  grantId: z.string().uuid(),
  goal: z.string().min(1),
  purpose: z.string().min(1),
  outputs: z.any(),
  assumptions: z.any().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const logframes = await prisma.logframe.findMany({
      where: { workspaceId: session.user.workspaceId },
      include: { grant: { select: { title: true, grantNumber: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ logframes })
  } catch (err) {
    console.error("[GET /api/grants/logframes]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createLogframeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId
    const logframe = await prisma.logframe.create({
      data: { workspaceId, ...parsed.data },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId: session.user.id,
        entityType: "logframe",
        entityId: logframe.id,
        action: "CREATE",
        afterState: { grantId: logframe.grantId, goal: logframe.goal },
      },
    })

    return NextResponse.json({ logframe }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/grants/logframes]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 5: Create indicators API route**

Create `apps/web/src/app/api/grants/indicators/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const createIndicatorSchema = z.object({
  grantId: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(["OUTPUT", "OUTCOME", "IMPACT"]),
  category: z.string().optional(),
  unit: z.string().min(1),
  baseline: z.number().default(0),
  target: z.number().positive(),
  collectionFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).default("QUARTERLY"),
  dataSource: z.string().optional(),
  responsible: z.string().optional(),
})

const createResultSchema = z.object({
  indicatorId: z.string().uuid(),
  period: z.string().min(1),
  actualValue: z.number(),
  notes: z.string().optional(),
  evidenceKey: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const indicators = await prisma.indicator.findMany({
      where: { workspaceId: session.user.workspaceId },
      include: {
        grant: { select: { title: true, grantNumber: true } },
        results: { orderBy: { reportedDate: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ indicators })
  } catch (err) {
    console.error("[GET /api/grants/indicators]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()

    // Check if this is a result submission or indicator creation
    if (body.indicatorId) {
      const parsed = createResultSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
      }

      const result = await prisma.indicatorResult.create({
        data: {
          workspaceId: session.user.workspaceId,
          indicatorId: parsed.data.indicatorId,
          period: parsed.data.period,
          actualValue: parsed.data.actualValue,
          notes: parsed.data.notes,
          evidenceKey: parsed.data.evidenceKey,
          reportedBy: session.user.id,
          reportedDate: new Date(),
        },
      })

      return NextResponse.json({ result }, { status: 201 })
    }

    const parsed = createIndicatorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId
    const indicator = await prisma.indicator.create({
      data: { workspaceId, ...parsed.data },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId: session.user.id,
        entityType: "indicator",
        entityId: indicator.id,
        action: "CREATE",
        afterState: { name: indicator.name, type: indicator.type },
      },
    })

    return NextResponse.json({ indicator }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/grants/indicators]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/grants/
git commit -m "feat: add Grants & M&E API routes (donors, grants, reports, logframes, indicators)"
```

---

## Task 4: Grants & M&E — UI Pages

**Files:**
- Modify: `apps/web/src/app/(dashboard)/grants/page.tsx` (replace stub)
- Create: `apps/web/src/app/(dashboard)/grants/donors/page.tsx`
- Create: `apps/web/src/app/(dashboard)/grants/donors/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/grants/grants/page.tsx`
- Create: `apps/web/src/app/(dashboard)/grants/grants/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/grants/logframes/page.tsx`
- Create: `apps/web/src/app/(dashboard)/grants/indicators/page.tsx`
- Create: `apps/web/src/app/(dashboard)/grants/reports/page.tsx`

Each page follows the exact Finance module pattern. The overview page fetches grants/donors/indicators, calculates metrics, and displays summary cards + recent items + quick actions. List pages show data tables with status badges. Create pages are client components with forms that POST to API routes.

See `apps/web/src/app/(dashboard)/finance/page.tsx` for overview pattern, `apps/web/src/app/(dashboard)/finance/invoices/page.tsx` for list pattern, and `apps/web/src/app/(dashboard)/finance/invoices/new/page.tsx` for create form pattern.

- [ ] **Step 1: Build overview page** — Replace `grants/page.tsx` stub with async server component showing: 4 summary cards (Total Grants Funding, Active Grants, Indicators on Track, Reports Due), recent grants table, quick action links, funding summary panel. Use pink color theme (`pink-100/pink-600/pink-700`).

- [ ] **Step 2: Build donors list page** — `grants/donors/page.tsx` — table with columns: Name, Type, Country, Grants Count, Status. Summary bar: total donors, active, by type. Empty state with Heart icon.

- [ ] **Step 3: Build new donor form** — `grants/donors/new/page.tsx` — client component form with fields: name, type (select from DonorType enum), contactName, email, phone, country, website, notes. POST to `/api/grants/donors`.

- [ ] **Step 4: Build grants list page** — `grants/grants/page.tsx` — table with columns: Grant #, Title, Donor, Amount, Start Date, End Date, Status. Summary bar: total funding, active amount, pipeline amount, closed amount. Status badges using `GrantStatus` enum with color config.

- [ ] **Step 5: Build new grant form** — `grants/grants/new/page.tsx` — client component. Fields: title, donor (select fetched from `/api/grants/donors`), amount, currency, startDate, endDate, status, reportingFrequency, programArea, contactPerson, description, notes. Budget lines table (description, planned amount — same pattern as invoice lines). POST to `/api/grants/grants`.

- [ ] **Step 6: Build logframes list page** — `grants/logframes/page.tsx` — table showing: Grant, Goal (truncated), # Outputs, Created. Link to grant detail.

- [ ] **Step 7: Build indicators list page** — `grants/indicators/page.tsx` — table with: Name, Type, Grant, Unit, Baseline, Target, Latest Actual, Progress (%). Summary bar: total indicators, on track, behind, not started.

- [ ] **Step 8: Build reports list page** — `grants/reports/page.tsx` — table with: Report #, Grant, Period, Type, Due Date, Status. Summary bar: total, draft, submitted, accepted. Highlight overdue reports in red.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/grants/
git commit -m "feat: add Grants & M&E UI pages (overview, donors, grants, logframes, indicators, reports)"
```

---

## Task 5: CRM — API Routes

**Files:**
- Create: `apps/web/src/app/api/crm/companies/route.ts`
- Create: `apps/web/src/app/api/crm/contacts/route.ts`
- Create: `apps/web/src/app/api/crm/deals/route.ts`
- Create: `apps/web/src/app/api/crm/activities/route.ts`

Follow exact same pattern as Task 3 (Grants API). Each route has GET (list with includes) and POST (Zod validation + audit log + auto-generated numbers).

- [ ] **Step 1: Create companies API** — GET returns companies with `_count: { contacts, deals }`. POST validates with schema: name (required), industry, website, phone, email, address, size (enum), annualRevenue, notes.

- [ ] **Step 2: Create contacts API** — GET returns contacts with company name include. POST validates: firstName, lastName (required), email, phone, jobTitle, companyId (optional UUID), lifecycleStage (enum), source (enum), notes.

- [ ] **Step 3: Create deals API** — GET returns deals with contact and company includes. POST validates: title (required), value (positive number), currency, contactId, companyId, stage (enum, default QUALIFIED), probability (0-100), expectedCloseDate, notes. Auto-generates deal number `DEAL-0001`.

- [ ] **Step 4: Create activities API** — GET returns activities with contact and deal includes, ordered by createdAt desc. POST validates: type (enum), subject (required), description, contactId, dealId, dueDate.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/crm/
git commit -m "feat: add CRM API routes (companies, contacts, deals, activities)"
```

---

## Task 6: CRM — UI Pages

**Files:**
- Modify: `apps/web/src/app/(dashboard)/crm/page.tsx` (replace stub)
- Create: `apps/web/src/app/(dashboard)/crm/contacts/page.tsx`
- Create: `apps/web/src/app/(dashboard)/crm/contacts/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/crm/companies/page.tsx`
- Create: `apps/web/src/app/(dashboard)/crm/companies/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/crm/deals/page.tsx`
- Create: `apps/web/src/app/(dashboard)/crm/deals/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/crm/pipeline/page.tsx`
- Create: `apps/web/src/app/(dashboard)/crm/activities/page.tsx`

- [ ] **Step 1: Build overview page** — Replace `crm/page.tsx` stub. Summary cards: Total Pipeline Value (weighted by probability), Active Deals, Total Contacts, Activities Due. Recent deals table. Quick actions. Conversion funnel summary. Use violet color theme (`violet-100/violet-600/violet-700`).

- [ ] **Step 2: Build contacts list page** — Table: Name, Company, Email, Phone, Stage, Source, Last Contacted. Summary bar by lifecycle stage. Empty state with Briefcase icon.

- [ ] **Step 3: Build new contact form** — Client component. Fields: firstName, lastName, email, phone, jobTitle, company (select fetched from `/api/crm/companies`), lifecycleStage, source, notes.

- [ ] **Step 4: Build companies list page** — Table: Name, Industry, Size, Contacts, Deals, Revenue.

- [ ] **Step 5: Build new company form** — Fields: name, industry, website, phone, email, address, size (select), annualRevenue, notes.

- [ ] **Step 6: Build deals list page** — Table: Deal #, Title, Company, Contact, Value, Stage, Probability, Expected Close. Summary bar by stage with totals.

- [ ] **Step 7: Build new deal form** — Fields: title, value, currency, contact (select), company (select), stage, probability (slider or input 0-100), expectedCloseDate, notes.

- [ ] **Step 8: Build pipeline Kanban page** — Client component (`"use client"`). Fetch deals from `/api/crm/deals`. Display as Kanban columns: QUALIFIED, PROPOSAL, NEGOTIATION, CONTRACT_SENT, WON, LOST. Each card shows deal title, company, value, expected close date. Column headers show count and total value. Use `flex` layout with `overflow-x-auto` for horizontal scrolling. Cards are `Card` components inside each column.

- [ ] **Step 9: Build activities list page** — Table: Subject, Type, Contact, Deal, Due Date, Completed. Filter by type. Show overdue activities in red.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/crm/
git commit -m "feat: add CRM UI pages (overview, contacts, companies, deals, pipeline, activities)"
```

---

## Task 7: Compliance — API Routes

**Files:**
- Create: `apps/web/src/app/api/compliance/obligations/route.ts`
- Create: `apps/web/src/app/api/compliance/licences/route.ts`
- Create: `apps/web/src/app/api/compliance/policies/route.ts`
- Create: `apps/web/src/app/api/compliance/audits/route.ts`
- Create: `apps/web/src/app/api/compliance/actions/route.ts`

- [ ] **Step 1: Create obligations API** — GET with ordering by nextDueDate. POST validates: title (required), regulation, category (enum), description, frequency (enum), ownerId, nextDueDate, status (enum), priority (reuse existing Priority enum), notes.

- [ ] **Step 2: Create licences API** — GET returns licences ordered by expiryDate. Auto-mark licences as EXPIRING_SOON when within alertDaysBefore days. POST validates: name, issuingAuthority, licenceNumber (required), category, issueDate, expiryDate, renewalCost, currency, alertDaysBefore, responsibleId, notes.

- [ ] **Step 3: Create policies API** — GET returns policies. POST validates: title (required), category (enum), effectiveDate, reviewDate, content, status (enum). Auto-generates policy number `POL-0001`.

- [ ] **Step 4: Create audits API** — GET returns audits with `_count: { correctiveActions }`. POST validates: title (required), type (enum), auditor, scope, scheduledDate, status (enum), findings (JSON array), overallRating (enum). Auto-generates audit number `AUD-0001`.

- [ ] **Step 5: Create corrective actions API** — GET returns actions with audit and obligation includes. POST validates: title (required), description, auditId, obligationId, assigneeId, dueDate, priority, status (enum).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/compliance/
git commit -m "feat: add Compliance API routes (obligations, licences, policies, audits, actions)"
```

---

## Task 8: Compliance — UI Pages

**Files:**
- Modify: `apps/web/src/app/(dashboard)/compliance/page.tsx` (replace stub)
- Create: `apps/web/src/app/(dashboard)/compliance/obligations/page.tsx`
- Create: `apps/web/src/app/(dashboard)/compliance/obligations/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/compliance/licences/page.tsx`
- Create: `apps/web/src/app/(dashboard)/compliance/licences/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/compliance/policies/page.tsx`
- Create: `apps/web/src/app/(dashboard)/compliance/policies/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/compliance/audits/page.tsx`
- Create: `apps/web/src/app/(dashboard)/compliance/audits/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/compliance/actions/page.tsx`
- Create: `apps/web/src/app/(dashboard)/compliance/actions/new/page.tsx`

- [ ] **Step 1: Build overview page** — Summary cards: Compliance Score (% compliant), Expiring Licences (within 30 days), Open Actions, Upcoming Audits. Expiring licences alert list. Recent actions table. Quick actions. Use blue color theme (`blue-100/blue-600/blue-700`).

- [ ] **Step 2: Build obligations list + create pages** — Table: Title, Regulation, Category, Frequency, Next Due, Status, Priority. Create form: all fields from schema.

- [ ] **Step 3: Build licences list + create pages** — Table: Name, Authority, Licence #, Issue Date, Expiry Date, Status, Renewal Cost. Highlight EXPIRED in red, EXPIRING_SOON in amber. Create form: all fields.

- [ ] **Step 4: Build policies list + create pages** — Table: Policy #, Title, Category, Version, Effective Date, Review Date, Status. Create form: all fields including content (textarea).

- [ ] **Step 5: Build audits list + create pages** — Table: Audit #, Title, Type, Auditor, Date, Status, Rating, Actions Count. Create form: all fields including findings (dynamic JSON rows: finding, severity, recommendation).

- [ ] **Step 6: Build actions list + create pages** — Table: Title, Audit, Obligation, Assignee, Due Date, Status, Priority. Summary bar by status. Highlight overdue in red.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/compliance/
git commit -m "feat: add Compliance UI pages (overview, obligations, licences, policies, audits, actions)"
```

---

## Task 9: Social Media — API Routes

**Files:**
- Create: `apps/web/src/app/api/social-media/accounts/route.ts`
- Create: `apps/web/src/app/api/social-media/posts/route.ts`
- Create: `apps/web/src/app/api/social-media/posts/publish/route.ts`

- [ ] **Step 1: Create accounts API** — GET returns social accounts. POST validates: platform (enum), accountName, handle, avatarUrl. Sets isConnected to true (mock). No real OAuth.

- [ ] **Step 2: Create posts API** — GET returns posts with platforms include, ordered by scheduledAt or createdAt. POST validates: content (required, max 5000 chars), mediaUrls (optional array), scheduledAt (optional datetime string), tags (optional array), campaignName (optional). Status defaults to DRAFT; if scheduledAt is provided and in the future, set to SCHEDULED.

- [ ] **Step 3: Create publish API** — POST takes `{ postId }`. Fetches the post and its target platform accounts. For each linked SocialPostPlatform, simulate publishing by setting status to PUBLISHED, generating a mock platformPostId and publishedUrl, and adding mock engagement data `{ likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 }`. Updates the parent post status to PUBLISHED (or PARTIALLY_PUBLISHED if any fail). Creates audit log.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/social-media/
git commit -m "feat: add Social Media API routes (accounts, posts, publish stub)"
```

---

## Task 10: Social Media — UI Pages

**Files:**
- Create: `apps/web/src/app/(dashboard)/social-media/page.tsx`
- Create: `apps/web/src/app/(dashboard)/social-media/compose/page.tsx`
- Create: `apps/web/src/app/(dashboard)/social-media/calendar/page.tsx`
- Create: `apps/web/src/app/(dashboard)/social-media/posts/page.tsx`
- Create: `apps/web/src/app/(dashboard)/social-media/accounts/page.tsx`

- [ ] **Step 1: Build overview page** — Summary cards: Total Posts, Scheduled, Published, Total Engagement. Recent published posts with engagement metrics. Quick actions. Use orange color theme (`orange-100/orange-600/orange-700`). Megaphone icon.

- [ ] **Step 2: Build compose page** — Client component. This is the Hootsuite-style multi-platform composer:
  - **Top:** Platform selector — row of toggle buttons for each platform (Facebook, Instagram, Twitter, LinkedIn, TikTok, YouTube). Each shows platform icon + name. Only enabled if a connected account exists for that platform.
  - **Main content:** Large textarea for post content. Below it, show character count per selected platform (e.g., "Twitter: 45/280", "LinkedIn: 45/3000"). Red text when limit exceeded.
  - **Media section:** "Add Media" button (shows placeholder — no actual upload, just URL input). Preview thumbnails in a grid.
  - **Schedule section:** Toggle between "Post Now" and "Schedule". If schedule, show datetime picker.
  - **Tags:** Input for comma-separated tags.
  - **Campaign:** Optional campaign name input.
  - **Preview panel:** Right sidebar showing how the post will look on each selected platform (simplified card previews with platform logo, handle, content, media).
  - **Actions:** "Save Draft" and "Schedule Post" / "Publish Now" buttons.
  - POST to `/api/social-media/posts` with platform account IDs.

- [ ] **Step 3: Build calendar page** — Client component. Monthly calendar view showing scheduled and published posts. Each day cell shows post cards (truncated content + platform icons + status badge). Navigation buttons for prev/next month. Today highlighted. Uses simple CSS grid (7 columns for days of week). Color-code: draft=gray, scheduled=blue, published=green, failed=red.

- [ ] **Step 4: Build posts list page** — Server component. Table: Content (truncated 50 chars), Platforms (icons), Status, Scheduled At, Published At, Engagement (total likes+comments+shares). Summary bar: total, draft, scheduled, published. Status badges.

- [ ] **Step 5: Build accounts page** — Client component. Grid of account cards (one per platform). Each card shows: platform icon + name, handle, connected/disconnected status, follower count (from metadata), "Connect" / "Disconnect" button. Connect button shows a mock dialog saying "OAuth flow would happen here" then creates the account via API. Disconnect button removes it. Show all 6 platforms even if not connected (grayed out with "Connect" CTA).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/social-media/
git commit -m "feat: add Social Media UI pages (overview, compose, calendar, posts, accounts)"
```

---

## Task 11: Final Integration & Verification

- [ ] **Step 1: Run Prisma generate to ensure schema compiles**

```bash
cd /Users/alva/Downloads/Crontract && pnpm db:generate
```

- [ ] **Step 2: Build the app to check for TypeScript errors**

```bash
cd /Users/alva/Downloads/Crontract && pnpm build
```

Fix any TypeScript errors that come up.

- [ ] **Step 3: Verify all pages load** — Start dev server and navigate to each module's overview page:
  - `/grants` — should show overview dashboard
  - `/crm` — should show overview dashboard
  - `/compliance` — should show overview dashboard
  - `/social-media` — should show overview dashboard

- [ ] **Step 4: Verify navigation** — All 4 modules should appear in sidebar with expandable sub-menus.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Grants, CRM, Compliance, Social Media modules"
```
