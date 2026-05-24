# Payroll & Payslips — Design Spec

**Date:** 2026-05-23
**Scope:** Comprehensive v1 (Ghana 2024 tax law, monthly cycle)
**Status:** Approved for implementation

## 1. Goals

- Compute monthly Ghana-statutory payroll (SSNIT, PAYE, Tier 2) for all active employees in a workspace.
- Produce branded PDF payslips per employee, downloadable individually or as a zip.
- Post a single journal entry per run to the existing General Ledger.
- Provide employee self-service access to personal payslips.
- Allow workspace admins to edit tax rates without a code release (Ghana rates change).

## 2. Non-goals (v1)

- Payment disbursement (MoMo / bank file generation)
- Email delivery of payslips (Resend not yet wired)
- Multi-currency runs / FX conversion (employee currency stored, no conversion logic)
- Bonus / 13th-month *runs* (handled as ad-hoc EARNING components instead)
- Weekly / bi-weekly cycles
- Final-settlement workflow for leavers (pro-rate only)
- Year-end PAYE reconciliation against annual income
- Multi-step approval flows (single-approver only — `ApprovalFlow` not used)
- Background-job auto-creation of runs (manually triggered)

## 3. Architecture

Single Next.js vertical inside `apps/web` — no new package, no new service.

| Layer | Location | Notes |
|---|---|---|
| Pure tax engine | `apps/web/src/lib/payroll/` | Stateless functions, no DB, no I/O. Fully unit-tested. |
| API routes | `apps/web/src/app/api/payroll/*` | Session-auth, workspace-scoped, audit-logged. |
| UI — admin | `apps/web/src/app/(dashboard)/payroll/*` | New sidebar entry. |
| UI — employee | `apps/web/src/app/(dashboard)/profile/payslips/` | New tab. |
| PDF rendering | `apps/web/src/lib/pdf/payslip.tsx` | `@react-pdf/renderer`. |

## 4. Schema additions

### 4.1 Modify `Employee`

```prisma
model Employee {
  // existing fields ...
  basicSalary     Decimal? @db.Decimal(12, 2) @map("basic_salary")   // renamed from `salary`
  ssnitNumber     String?  @map("ssnit_number")
  tin             String?
  bankName        String?  @map("bank_name")
  bankAccount     String?  @map("bank_account")
  momoNumber      String?  @map("momo_number")
  currency        String   @default("GHS")
  taxReliefs      Json?    @map("tax_reliefs")
  // { personal: bool, marriage: bool, dependantChildren: int (0-3),
  //   oldAge: bool, agedDependant: bool, disability: bool }
}
```

Migration step: copy existing `salary` values into `basic_salary`, drop `salary`.

### 4.2 New models

```prisma
model TaxRateTable {
  id          String          @id @default(uuid()) @db.Uuid
  workspaceId String          @map("workspace_id") @db.Uuid
  taxYear     Int             @map("tax_year")
  type        TaxRateType
  value       Decimal         @db.Decimal(10, 4)
  bracketMin  Decimal?        @map("bracket_min") @db.Decimal(14, 2)
  bracketMax  Decimal?        @map("bracket_max") @db.Decimal(14, 2)
  sequence    Int             @default(0)
  createdAt   DateTime        @default(now()) @map("created_at")

  workspace   Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, taxYear, type])
  @@map("tax_rate_table")
}

enum TaxRateType {
  PAYE_BRACKET
  SSNIT_EMPLOYEE
  SSNIT_EMPLOYER
  TIER2
  RELIEF_PERSONAL
  RELIEF_MARRIAGE
  RELIEF_DEPENDANT_PER_CHILD
  RELIEF_OLD_AGE
  RELIEF_AGED_DEPENDANT
  RELIEF_DISABILITY_PCT
}

model PayComponent {
  id            String           @id @default(uuid()) @db.Uuid
  workspaceId   String           @map("workspace_id") @db.Uuid
  code          String
  name          String
  type          PayComponentType
  taxable       Boolean          @default(true)
  pensionable   Boolean          @default(false)
  // `defaultAmount` is a UI suggestion shown when adding the component to an employee's pay setup.
  // It is NOT auto-applied to anyone — `EmployeePaySetup` is the sole source of truth for what an employee earns.
  defaultAmount Decimal?         @map("default_amount") @db.Decimal(12, 2)
  sequence      Int              @default(0)
  deletedAt     DateTime?        @map("deleted_at")
  createdAt     DateTime         @default(now()) @map("created_at")

  workspace        Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  employeeSetups   EmployeePaySetup[]

  @@unique([workspaceId, code])
  @@map("pay_components")
}

enum PayComponentType {
  EARNING
  DEDUCTION
  STATUTORY
  LOAN
}

model EmployeePaySetup {
  id             String   @id @default(uuid()) @db.Uuid
  employeeId     String   @map("employee_id") @db.Uuid
  payComponentId String   @map("pay_component_id") @db.Uuid
  amount         Decimal  @db.Decimal(12, 2)
  startDate      DateTime @map("start_date")
  endDate        DateTime? @map("end_date")
  createdAt      DateTime @default(now()) @map("created_at")

  employee     Employee     @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  payComponent PayComponent @relation(fields: [payComponentId], references: [id])

  @@unique([employeeId, payComponentId, startDate])
  @@map("employee_pay_setups")
}

model PayrollLoan {
  id               String          @id @default(uuid()) @db.Uuid
  workspaceId      String          @map("workspace_id") @db.Uuid
  employeeId       String          @map("employee_id") @db.Uuid
  principal        Decimal         @db.Decimal(12, 2)
  monthlyDeduction Decimal         @map("monthly_deduction") @db.Decimal(12, 2)
  startMonth       String          @map("start_month")  // YYYY-MM
  balance          Decimal         @db.Decimal(12, 2)
  status           PayrollLoanStatus @default(ACTIVE)
  createdBy        String          @map("created_by") @db.Uuid
  createdAt        DateTime        @default(now()) @map("created_at")
  updatedAt        DateTime        @updatedAt @map("updated_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  employee  Employee  @relation(fields: [employeeId], references: [id])

  @@map("payroll_loans")
}

enum PayrollLoanStatus {
  ACTIVE
  PAID
  CANCELLED
}

model PayrollRun {
  id                String           @id @default(uuid()) @db.Uuid
  workspaceId       String           @map("workspace_id") @db.Uuid
  year              Int
  month             Int               // 1-12
  status            PayrollRunStatus @default(DRAFT)
  totalGross        Decimal          @default(0) @map("total_gross") @db.Decimal(14, 2)
  totalDeductions   Decimal          @default(0) @map("total_deductions") @db.Decimal(14, 2)
  totalNet          Decimal          @default(0) @map("total_net") @db.Decimal(14, 2)
  totalEmployerCost Decimal          @default(0) @map("total_employer_cost") @db.Decimal(14, 2)
  createdBy         String           @map("created_by") @db.Uuid
  approvedBy        String?          @map("approved_by") @db.Uuid
  approvedAt        DateTime?        @map("approved_at")
  postedBy          String?          @map("posted_by") @db.Uuid
  postedAt          DateTime?        @map("posted_at")
  postedJournalId   String?          @map("posted_journal_id") @db.Uuid
  reversedAt        DateTime?        @map("reversed_at")
  createdAt         DateTime         @default(now()) @map("created_at")
  updatedAt         DateTime         @updatedAt @map("updated_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  payslips  Payslip[]
  journal   Journal?  @relation(fields: [postedJournalId], references: [id])

  @@unique([workspaceId, year, month])
  @@map("payroll_runs")
}

enum PayrollRunStatus {
  DRAFT
  APPROVED
  POSTED
  REVERSED
}

model Payslip {
  id                  String          @id @default(uuid()) @db.Uuid
  payrollRunId        String          @map("payroll_run_id") @db.Uuid
  employeeId          String          @map("employee_id") @db.Uuid
  daysWorked          Int             @default(30) @map("days_worked")
  basicSalary         Decimal         @map("basic_salary") @db.Decimal(12, 2)
  totalEarnings       Decimal         @map("total_earnings") @db.Decimal(12, 2)
  totalDeductions     Decimal         @map("total_deductions") @db.Decimal(12, 2)
  gross               Decimal         @db.Decimal(12, 2)
  paye                Decimal         @db.Decimal(12, 2)
  ssnitEmployee       Decimal         @map("ssnit_employee") @db.Decimal(12, 2)
  ssnitEmployer       Decimal         @map("ssnit_employer") @db.Decimal(12, 2)
  tier2               Decimal         @db.Decimal(12, 2)
  loanDeductions      Decimal         @map("loan_deductions") @db.Decimal(12, 2)
  otherDeductions     Decimal         @map("other_deductions") @db.Decimal(12, 2)
  netPay              Decimal         @map("net_pay") @db.Decimal(12, 2)
  currency            String          @default("GHS")
  componentsSnapshot  Json            @map("components_snapshot")
  ytdGross            Decimal         @map("ytd_gross") @db.Decimal(14, 2)
  ytdPaye             Decimal         @map("ytd_paye") @db.Decimal(14, 2)
  ytdSsnit            Decimal         @map("ytd_ssnit") @db.Decimal(14, 2)
  status              PayslipStatus   @default(DRAFT)
  createdAt           DateTime        @default(now()) @map("created_at")
  updatedAt           DateTime        @updatedAt @map("updated_at")

  payrollRun PayrollRun @relation(fields: [payrollRunId], references: [id], onDelete: Cascade)
  employee   Employee   @relation(fields: [employeeId], references: [id])

  @@unique([payrollRunId, employeeId])
  @@index([employeeId])
  @@map("payslips")
}

enum PayslipStatus {
  DRAFT
  APPROVED
  POSTED
  REVERSED
}

model PayrollGlMapping {
  id          String                @id @default(uuid()) @db.Uuid
  workspaceId String                @map("workspace_id") @db.Uuid
  lineType    PayrollGlLineType
  accountId   String                @map("account_id") @db.Uuid

  workspace Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  account   Account_GL @relation(fields: [accountId], references: [id])

  @@unique([workspaceId, lineType])
  @@map("payroll_gl_mappings")
}

enum PayrollGlLineType {
  WAGES_EXPENSE
  EMPLOYER_SSNIT_EXPENSE
  EMPLOYER_TIER2_EXPENSE
  SSNIT_PAYABLE
  PAYE_PAYABLE
  TIER2_PAYABLE
  LOAN_RECEIVABLE
  NET_PAY_CLEARING
}
```

Add inverse relations on `Workspace` and `Employee` accordingly.

## 5. Tax engine (Ghana 2024)

Pure functions in `apps/web/src/lib/payroll/tax-ghana.ts`. Pull rates from `TaxRateTable` per workspace per year — historical runs are immutable because the active rates are snapshotted into `Payslip.componentsSnapshot`.

### Default seed (Ghana 2024 — admin-verifiable)

> **NOTE:** The figures below are seeded as defaults. Because Ghana revises PAYE brackets and reliefs periodically (latest material change: 2023 Income Tax Amendment Act), the workspace admin is expected to verify rates against the current GRA tables on first run and update them via `/payroll/tax-settings` if the engine ships behind the law. Historical runs use snapshotted rates from `Payslip.componentsSnapshot` so prior payslips remain correct.

**PAYE annual brackets (GHS):**

| Lower | Upper | Rate |
|---|---|---|
| 0 | 4,824 | 0% |
| 4,824 | 6,144 | 5% |
| 6,144 | 7,704 | 10% |
| 7,704 | 43,704 | 17.5% |
| 43,704 | 240,444 | 25% |
| 240,444 | 600,444 | 30% |
| 600,444 | ∞ | 35% |

**Statutory rates:**
- SSNIT employee: 5.5% of basic
- SSNIT employer: 13% of basic
- Tier 2: 5% of basic (mandatory)

**Annual reliefs (GHS):**
- Personal: 1,200 (universal)
- Marriage / responsibility: 1,200
- Dependant child: 600 each, max 3
- Old age (60+): 1,500
- Aged dependant: 1,000
- Disability: 25% of *assessable income*, where assessable income = `annualGross − annualSsnitDeduction` (before other reliefs). Applied as a deduction in the same pool as the other reliefs.

### Compute pseudocode

```
function computePayslip(employee, components, rates, loans, daysWorked, daysInMonth, ytd) {
  basic = employee.basicSalary
  earnings = components.filter(EARNING).sum(amount)
  taxableEarnings = components.filter(EARNING && taxable).sum(amount)

  proRate = daysWorked / daysInMonth
  basicPro = basic * proRate
  earningsPro = earnings * proRate
  taxableEarningsPro = taxableEarnings * proRate

  ssnitEmployee = basicPro * rates.SSNIT_EMPLOYEE
  ssnitEmployer = basicPro * rates.SSNIT_EMPLOYER
  tier2 = basicPro * rates.TIER2

  // PAYE: annualise, apply brackets, divide by 12
  annualGross = (basicPro + taxableEarningsPro) * 12
  annualSsnitDeduction = ssnitEmployee * 12   // SSNIT employee portion is allowable
  annualReliefs = computeReliefs(employee.taxReliefs, rates, annualGross - annualSsnitDeduction)
  taxableAnnual = max(0, annualGross - annualSsnitDeduction - annualReliefs)
  annualPAYE = applyBrackets(taxableAnnual, rates.PAYE_BRACKET)
  monthlyPAYE = annualPAYE / 12

  // Loans: cap at remaining balance
  loanDeductions = loans.sum(min(loan.monthlyDeduction, loan.balance))

  // Other non-statutory deductions
  otherDeductions = components.filter(DEDUCTION).sum(amount)

  gross = basicPro + earningsPro
  totalDeductions = ssnitEmployee + tier2 + monthlyPAYE + loanDeductions + otherDeductions

  // Cap non-statutory deductions so net pay can't go negative.
  // Statutory (PAYE, SSNIT, Tier 2) always apply in full — only loans + other deductions are capped.
  if (gross - totalDeductions < 0) {
    statutory = ssnitEmployee + tier2 + monthlyPAYE
    nonStatutoryRoom = max(0, gross - statutory)
    scaleFactor = nonStatutoryRoom / (loanDeductions + otherDeductions)
    loanDeductions = loanDeductions * scaleFactor   // unpaid portion stays on loan balance
    otherDeductions = otherDeductions * scaleFactor
    totalDeductions = statutory + loanDeductions + otherDeductions
  }
  netPay = gross - totalDeductions   // ≥ 0 guaranteed (clamped to 0 if statutory exceeds gross)

  return {
    basicSalary: basicPro, totalEarnings: earningsPro, gross,
    paye: monthlyPAYE, ssnitEmployee, ssnitEmployer, tier2,
    loanDeductions, otherDeductions, totalDeductions, netPay,
    ytdGross: ytd.gross + gross,
    ytdPaye: ytd.paye + monthlyPAYE,
    ytdSsnit: ytd.ssnit + ssnitEmployee,
    componentsSnapshot: { ratesUsed: rates, components, reliefs: employee.taxReliefs }
  }
}
```

## 6. Workflow

```
[New Run]
   │
   ▼
 DRAFT  ──Approve──►  APPROVED  ──Post──►  POSTED  ──Reverse──►  REVERSED
   ▲                     │
   └── editable          └── locked from edit
```

- **Create run** (`POST /api/payroll/runs`): Body `{ year, month, employeeIds?[] }`. Loads ACTIVE employees (or filtered set). Employees missing `basicSalary` are **excluded with a warning returned in the response** (`{ run, skipped: [{ employeeId, reason: "MISSING_BASIC_SALARY" }] }`) — the run still creates with the remaining employees. Computes payslips, creates `PayrollRun` + `Payslip` rows in a single transaction.
- **Override payslip** (`PATCH /api/payroll/payslips/:id`): Allowed only while `DRAFT`. Override the per-component `componentsSnapshot` amounts; recompute that payslip's totals; update run totals.
- **Approve run** (`POST /api/payroll/runs/:id/approve`): DRAFT → APPROVED. Sets `approvedBy`, `approvedAt`.
- **Post run** (`POST /api/payroll/runs/:id/post`): APPROVED → POSTED. Creates `Journal` + 5–8 `JournalLine`s, links via `postedJournalId`. Decrements active loan balances by their applied deduction.
- **Reverse run** (`POST /api/payroll/runs/:id/reverse`): POSTED → REVERSED. Creates reversing journal. Loan balance increments rolled back.

All state transitions write to `AuditLog` (matches existing convention).

## 7. GL posting

Single journal per run, dated last day of run month.

| Side | Account (via PayrollGlMapping) | Amount |
|---|---|---|
| DR | Wages & Salaries Expense | Σ (basic + taxable allowances), pro-rated |
| DR | Employer SSNIT Expense | Σ basic × 13% |
| DR | Employer Tier 2 Expense | Σ basic × 5% |
| CR | SSNIT Payable | Σ basic × 18.5% (5.5 + 13) |
| CR | PAYE Payable | Σ monthlyPAYE |
| CR | Tier 2 Payable | Σ basic × 5% |
| CR | Loan Receivable (one line per loan account) | Σ loan deductions |
| CR | Net Pay Clearing | Σ net pay |

Net pay disbursement (paying employees via bank/MoMo) clears `Net Pay Clearing` against Cash — handled outside payroll for v1.

### GL mapping auto-create

On first visit to `/payroll/gl-mapping`, if no mappings exist, show a wizard:
- Lists the 8 required accounts with proposed codes:
  - 5000 — Wages & Salaries Expense (EXPENSE)
  - 5010 — Employer SSNIT Expense (EXPENSE)
  - 5020 — Employer Tier 2 Expense (EXPENSE)
  - 2100 — SSNIT Payable (LIABILITY)
  - 2110 — PAYE Payable (LIABILITY)
  - 2120 — Tier 2 Payable (LIABILITY)
  - 1310 — Staff Loans Receivable (ASSET)
  - 1010 — Net Pay Clearing (LIABILITY)
- For each line: "Create new" / "Map to existing" with searchable account picker.
- Single "Apply" button creates new accounts (skipping any code collisions with a `-1` suffix) and writes `PayrollGlMapping` rows in one transaction.

A run cannot be posted until all 8 mappings exist.

## 8. PDF payslip layout

Library: `@react-pdf/renderer`. Layout in `apps/web/src/lib/pdf/payslip.tsx`.

```
┌────────────────────────────────────────────────┐
│  [Workspace Logo]      WORKSPACE NAME          │
│                        Address line             │
│                                                 │
│  PAYSLIP — May 2026                             │
├────────────────────────────────────────────────┤
│  Employee: Kwame Mensah        EMP#: GS-001    │
│  Position: Managing Director   Dept: Ops       │
│  TIN: P0001234567   SSNIT#: A123456789B        │
├────────────────┬───────────────────────────────┤
│  EARNINGS      │  Amount (GHS)                  │
│  Basic Salary  │   12,000.00                    │
│  Housing       │    3,000.00                    │
│  Transport     │    1,500.00                    │
│  ─────────────────────────────────              │
│  Gross         │   16,500.00                    │
├────────────────┼───────────────────────────────┤
│  DEDUCTIONS    │  Amount (GHS)                  │
│  PAYE          │    1,847.50                    │
│  SSNIT (5.5%)  │      660.00                    │
│  Tier 2 (5%)   │      600.00                    │
│  Staff Loan    │      500.00                    │
│  ─────────────────────────────────              │
│  Total Deduct. │    3,607.50                    │
├────────────────┴───────────────────────────────┤
│  NET PAY                          GHS 12,892.50 │
├────────────────────────────────────────────────┤
│  YEAR-TO-DATE                                   │
│  Gross: 82,500   PAYE: 9,237.50   SSNIT: 3,300  │
├────────────────────────────────────────────────┤
│  Payment Method: Bank · GCB · ****1234          │
│  ───────────────       ───────────────          │
│  Employee Signature    Authorised Signatory     │
└────────────────────────────────────────────────┘
```

Bulk download (`GET /api/payroll/runs/:id/payslips.zip`) returns a zip of all payslip PDFs for the run, named `payslip-{empNumber}-{YYYY-MM}.pdf`.

## 9. Routes

| Route | Purpose | Permission |
|---|---|---|
| `/payroll` | Runs list | `payroll:run:view` |
| `/payroll/runs/new` | Period + employee selection + preview | `payroll:run:create` |
| `/payroll/runs/[id]` | Review table, approve, post | `payroll:run:view` |
| `/payroll/runs/[id]/payslips/[empId]` | Single payslip preview + PDF | `payroll:run:view` |
| `/payroll/components` | Pay components library | `payroll:component:manage` |
| `/payroll/loans` | Loan ledger | `payroll:loan:manage` |
| `/payroll/tax-settings` | Editable tax rates per year | `payroll:settings:manage` |
| `/payroll/gl-mapping` | GL account mapping wizard | `payroll:settings:manage` |
| `/payroll/statutory` | SSNIT + GRA PAYE CSV exports | `payroll:run:view` |
| `/payroll/ytd` | Year-to-date per employee | `payroll:run:view` |
| `/profile/payslips` | Employee self-service (own only) | session check |

### API surface

```
GET    /api/payroll/runs                       list runs (paginated)
POST   /api/payroll/runs                       create new run
GET    /api/payroll/runs/:id                   get run with payslips
PATCH  /api/payroll/runs/:id                   update run metadata (DRAFT only)
DELETE /api/payroll/runs/:id                   delete (DRAFT only)
POST   /api/payroll/runs/:id/approve
POST   /api/payroll/runs/:id/post
POST   /api/payroll/runs/:id/reverse
GET    /api/payroll/runs/:id/payslips.zip
GET    /api/payroll/payslips/:id               single payslip
PATCH  /api/payroll/payslips/:id               override (DRAFT only)
GET    /api/payroll/payslips/:id/pdf           PDF stream

GET    /api/payroll/components                 list
POST   /api/payroll/components                 create
PATCH  /api/payroll/components/:id
DELETE /api/payroll/components/:id             soft-delete

GET    /api/payroll/employees/:id/setup        list pay setup
POST   /api/payroll/employees/:id/setup        add component
PATCH  /api/payroll/employees/:id/setup/:setupId
DELETE /api/payroll/employees/:id/setup/:setupId

GET    /api/payroll/loans                      list
POST   /api/payroll/loans                      create
PATCH  /api/payroll/loans/:id                  cancel only

GET    /api/payroll/tax-rates                  list for year
POST   /api/payroll/tax-rates                  upsert rate row
DELETE /api/payroll/tax-rates/:id

GET    /api/payroll/gl-mapping                 current mapping
POST   /api/payroll/gl-mapping                 wizard apply (creates accounts + mappings)
PATCH  /api/payroll/gl-mapping/:lineType       remap single line

GET    /api/payroll/statutory/ssnit/:year/:month.csv
GET    /api/payroll/statutory/paye/:year/:month.csv

GET    /api/payroll/ytd?year=YYYY              YTD per employee for year

GET    /api/profile/payslips                   current user's payslips
GET    /api/profile/payslips/:id/pdf
```

## 10. Permissions (seed at workspace creation)

```
payroll:run:create
payroll:run:approve
payroll:run:post
payroll:run:view
payroll:settings:manage
payroll:component:manage
payroll:loan:manage
payroll:payslip:view_own        (auto-granted to all roles)
```

Default role assignments:
- **Owner / Administrator**: all
- **Manager**: `view_own` only
- **Employee**: `view_own` only

## 11. Testing

- **Unit (tax engine)**: `apps/web/src/lib/payroll/__tests__/tax-ghana.test.ts`
  - Every PAYE bracket boundary (above/below/at)
  - Each relief combination (single, married, with children, old age, disability)
  - SSNIT / Tier 2 floor and zero cases
  - Pro-ration: 0 days, full month, partial month
  - YTD accumulation across runs
- **Integration (workflow)**: `apps/web/src/app/api/payroll/__tests__/run-lifecycle.test.ts`
  - DRAFT → APPROVED → POSTED with journal verification (debits == credits)
  - Reverse run rolls back loan balances
  - Cannot post without GL mapping
- **Snapshot (PDF)**: `apps/web/src/lib/pdf/__tests__/payslip.snapshot.test.ts`

## 12. Implementation order

1. Prisma schema additions + migration (`prisma db push --force-reset` acceptable in dev, since we already reset earlier).
2. Tax engine pure functions + unit tests.
3. Seed: Ghana 2024 tax rates + default pay components on workspace creation.
4. Seed: 8 new permissions, role assignments.
5. GL mapping wizard (API + UI).
6. Pay components CRUD (API + UI).
7. Employee schema additions wired into people module (form fields).
8. Payroll loans CRUD (API + UI).
9. Payroll run creation + computation engine (API).
10. Run review UI with overrides table.
11. Approve + post endpoints with journal posting.
12. PDF payslip rendering.
13. Run list UI + run detail UI.
14. Statutory exports (SSNIT + GRA CSV).
15. YTD report.
16. Employee self-service `/profile/payslips` tab.
17. Demo data: seed one POSTED run for May 2026 in GoldStar workspace.
18. Add "Payroll" to dashboard sidebar (HR section).

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Ghana tax rates drift after release | Tax rates editable in DB by admin; engine reads at compute time. |
| Decimal rounding in tax math | Use Prisma `Decimal` end-to-end; round only at final display + GL posting (2dp). |
| Re-running a month creates duplicates | `UNIQUE(workspaceId, year, month)` on `PayrollRun`. |
| Posting journal partially fails mid-write | Wrap journal+lines+loan-decrements in one Prisma transaction. |
| Employee added mid-month after run created | Manual: admin reverses + recreates. (Automated late-add deferred.) |
| Sensitive salary data exposure | Permission `view_own` checked at API; UI hides salary fields from Manager/Employee on people module. |
| Pre-2023 `salary` field rename breaks consumers | `salary` is only referenced in seed and Employee form; greppable and small. |
