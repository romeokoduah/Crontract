import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"
import { seedDemoEmployeePayroll, seedPayrollDefaults } from "./payroll-seed"
import { seedPayrollPermissions } from "./permissions-seed"

const GOLDSTAR_SALARIES = {
  "admin@goldstar.io":  { basic: 22000, housing: 5000, transport: 2000 },
  "ama@goldstar.io":    { basic: 14000, housing: 3500, transport: 1500 },
  "kofi@goldstar.io":   { basic:  9500, housing: 2000, transport: 1000 },
  "abena@goldstar.io":  { basic:  8500, housing: 2000, transport: 1000 },
  "yaw@goldstar.io":    { basic:  9000, housing: 2000, transport: 1000 },
}

const prisma = new PrismaClient()

function addDays(base: Date, days: number, hours: number, minutes: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  d.setHours(hours, minutes, 0, 0)
  return d
}

// ── Helper: seed one workspace ───────────────────────────────────────────────

interface WorkspaceConfig {
  workspace: {
    name: string
    slug: string
    legalName: string
    businessType: "MINING_CONTRACTOR" | "NGO" | "STARTUP"
    country: string
    currency: string
    modules: string[]
  }
  users: { email: string; name: string; role: "Owner" | "Administrator" | "Manager" | "Employee"; empNumber: string; firstName: string; lastName: string; jobTitle: string; deptName: string }[]
  departments: string[]
  projects: { name: string; description: string; status: string; priority: string; ownerIdx: number; budget: number; startDate: string; endDate: string }[]
  tasks: { projectIdx: number; title: string; status: string; priority: string; assigneeIdx: number; dueDate: string }[]
  meetings: { title: string; description: string; daysOut: number; startH: number; startM: number; endH: number; endM: number; location: string; attendeeIdxs: number[]; creatorIdx: number }[]
  documents: { title: string; docType: string; status: string; creatorIdx: number }[]
}

async function seedWorkspace(config: WorkspaceConfig, passwordHash: string) {
  const { workspace: wsConfig, departments: deptNames } = config

  // Workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: wsConfig.slug },
    update: {},
    create: wsConfig,
  })
  const wId = workspace.id

  // Roles
  const roles: Record<string, any> = {}
  for (const r of [
    { name: "Owner", description: "Full access" },
    { name: "Administrator", description: "Administrative access" },
    { name: "Manager", description: "Department management" },
    { name: "Employee", description: "Standard employee access" },
  ]) {
    roles[r.name] = await prisma.role.upsert({
      where: { workspaceId_name: { workspaceId: wId, name: r.name } },
      update: {},
      create: { workspaceId: wId, ...r, isSystem: true },
    })
  }

  // Departments
  const depts: Record<string, any> = {}
  for (const name of deptNames) {
    depts[name] = await prisma.department.upsert({
      where: { workspaceId_name: { workspaceId: wId, name } },
      update: {},
      create: { workspaceId: wId, name },
    })
  }

  // Users, memberships, employees
  const users: any[] = []
  for (const u of config.users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, passwordHash },
    })
    users.push(user)

    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: wId } },
      update: {},
      create: {
        userId: user.id,
        workspaceId: wId,
        roleId: roles[u.role].id,
        isOwner: u.role === "Owner",
      },
    })

    await prisma.employee.upsert({
      where: { workspaceId_employeeNumber: { workspaceId: wId, employeeNumber: u.empNumber } },
      update: {},
      create: {
        workspaceId: wId,
        userId: user.id,
        employeeNumber: u.empNumber,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        jobTitle: u.jobTitle,
        departmentId: depts[u.deptName]?.id,
        employmentType: "FULL_TIME",
        startDate: new Date("2022-01-15"),
      },
    })
  }

  // Projects
  const projects: any[] = []
  for (const p of config.projects) {
    const proj = await prisma.project.create({
      data: {
        workspaceId: wId,
        name: p.name,
        description: p.description,
        status: p.status as any,
        priority: p.priority as any,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
        budget: p.budget,
        ownerId: users[p.ownerIdx].id,
        createdBy: users[0].id,
      },
    })
    projects.push(proj)
  }

  // Tasks
  for (const t of config.tasks) {
    await prisma.task.create({
      data: {
        workspaceId: wId,
        projectId: projects[t.projectIdx].id,
        title: t.title,
        status: t.status as any,
        priority: t.priority as any,
        assigneeId: users[t.assigneeIdx].id,
        dueDate: new Date(t.dueDate),
        createdBy: users[0].id,
      },
    })
  }

  // Meetings
  const now = new Date()
  for (const m of config.meetings) {
    await prisma.meeting.create({
      data: {
        workspaceId: wId,
        title: m.title,
        description: m.description,
        startTime: addDays(now, m.daysOut, m.startH, m.startM),
        endTime: addDays(now, m.daysOut, m.endH, m.endM),
        location: m.location,
        attendees: m.attendeeIdxs.map((i) => users[i].id),
        createdBy: users[m.creatorIdx].id,
      },
    })
  }

  // Documents
  for (const doc of config.documents) {
    await prisma.document.create({
      data: {
        workspaceId: wId,
        title: doc.title,
        docType: doc.docType as any,
        status: doc.status as any,
        createdBy: users[doc.creatorIdx].id,
      },
    })
  }

  // Approval flow + approvals
  const flow = await prisma.approvalFlow.create({
    data: {
      workspaceId: wId,
      name: "Standard Approval",
      entityType: "PURCHASE_ORDER",
      flowType: "SEQUENTIAL",
      steps: [{ approverIds: [users[0].id], order: 1 }],
    },
  })

  for (let i = 1; i < Math.min(users.length, 4); i++) {
    await prisma.approval.create({
      data: {
        workspaceId: wId,
        flowId: flow.id,
        entityId: projects[0]?.id || wId,
        entityType: "PURCHASE_ORDER",
        requestedBy: users[i].id,
        status: i === 1 ? "PENDING" : i === 2 ? "PENDING" : "APPROVED",
      } as any,
    })
  }

  // Audit log
  for (const proj of projects.slice(0, 3)) {
    await prisma.auditLog.create({
      data: { workspaceId: wId, userId: users[0].id, entityType: "PROJECT", entityId: proj.id, action: "CREATE" },
    })
  }
  if (users[1]) {
    await prisma.auditLog.create({
      data: { workspaceId: wId, userId: users[1].id, entityType: "TASK", entityId: projects[0]?.id || wId, action: "UPDATE" },
    })
  }

  // Notifications
  const notifTemplates = [
    { idx: 1, type: "TASK_ASSIGNED", title: "New task assigned", body: "You have been assigned a new task" },
    { idx: 2, type: "APPROVAL_PENDING", title: "Approval pending", body: "Your request is pending approval" },
    { idx: 0, type: "SYSTEM", title: "System update", body: "Crontract platform has been updated" },
  ]
  for (const n of notifTemplates) {
    if (users[n.idx]) {
      await prisma.notification.create({
        data: { workspaceId: wId, userId: users[n.idx].id, type: n.type, title: n.title, body: n.body },
      })
    }
  }

  // Payroll defaults: Ghana 2024 tax rates + default pay components + permissions
  await seedPayrollDefaults(prisma, wId, 2024)
  await seedPayrollPermissions(prisma, wId)

  // Demo salaries only for the mining workspace (so payroll has interesting data out of the box)
  if (wsConfig.slug === "goldstar-mining") {
    await seedDemoEmployeePayroll(prisma, wId, GOLDSTAR_SALARIES)
  }

  return { workspace, users }
}

// ══════════════════════════════════════════════════════════════════════════════
// WORKSPACE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════

const miningWorkspace: WorkspaceConfig = {
  workspace: {
    name: "GoldStar Mining Ltd",
    slug: "goldstar-mining",
    legalName: "GoldStar Mining Limited",
    businessType: "MINING_CONTRACTOR",
    country: "GH",
    currency: "GHS",
    modules: ["people","projects","meetings","documents","approvals","finance","budget","procurement","assets","hse","compliance","crm","grants","social-media","reports"],
  },
  departments: ["Operations", "Engineering", "Finance", "HSE"],
  users: [
    { email: "admin@goldstar.io", name: "Kwame Mensah", role: "Owner", empNumber: "GS-001", firstName: "Kwame", lastName: "Mensah", jobTitle: "Managing Director", deptName: "Operations" },
    { email: "ama@goldstar.io", name: "Ama Osei", role: "Manager", empNumber: "GS-002", firstName: "Ama", lastName: "Osei", jobTitle: "Operations Manager", deptName: "Operations" },
    { email: "kofi@goldstar.io", name: "Kofi Asante", role: "Employee", empNumber: "GS-003", firstName: "Kofi", lastName: "Asante", jobTitle: "Site Engineer", deptName: "Engineering" },
    { email: "abena@goldstar.io", name: "Abena Darko", role: "Employee", empNumber: "GS-004", firstName: "Abena", lastName: "Darko", jobTitle: "Accountant", deptName: "Finance" },
    { email: "yaw@goldstar.io", name: "Yaw Boateng", role: "Employee", empNumber: "GS-005", firstName: "Yaw", lastName: "Boateng", jobTitle: "HSE Officer", deptName: "HSE" },
  ],
  projects: [
    { name: "Tarkwa Gold Extraction Phase 2", description: "Expansion of gold extraction operations at the Tarkwa site.", status: "ACTIVE", priority: "HIGH", ownerIdx: 1, budget: 2500000, startDate: "2026-01-15", endDate: "2026-08-30" },
    { name: "Safety Compliance Upgrade", description: "Update safety systems to meet Ghana Minerals Commission standards.", status: "ACTIVE", priority: "HIGH", ownerIdx: 4, budget: 450000, startDate: "2026-02-01", endDate: "2026-06-15" },
    { name: "Fleet Maintenance Programme", description: "Scheduled maintenance and replacement for mining fleet vehicles.", status: "PLANNING", priority: "MEDIUM", ownerIdx: 1, budget: 800000, startDate: "2026-05-01", endDate: "2026-12-31" },
    { name: "ERP System Migration", description: "Migration from legacy systems to Crontract platform.", status: "ACTIVE", priority: "HIGH", ownerIdx: 0, budget: 150000, startDate: "2026-03-01", endDate: "2026-07-31" },
  ],
  tasks: [
    { projectIdx: 0, title: "Procure new ball mill equipment", status: "IN_PROGRESS", priority: "HIGH", assigneeIdx: 1, dueDate: "2026-04-25" },
    { projectIdx: 0, title: "Site preparation for Phase 2 area", status: "TODO", priority: "HIGH", assigneeIdx: 2, dueDate: "2026-05-10" },
    { projectIdx: 0, title: "Environmental impact assessment review", status: "IN_PROGRESS", priority: "HIGH", assigneeIdx: 4, dueDate: "2026-04-18" },
    { projectIdx: 0, title: "Hire additional operators for Phase 2", status: "TODO", priority: "MEDIUM", assigneeIdx: 1, dueDate: "2026-05-30" },
    { projectIdx: 0, title: "Install water recycling system", status: "TODO", priority: "HIGH", assigneeIdx: 2, dueDate: "2026-06-15" },
    { projectIdx: 1, title: "Audit current safety equipment inventory", status: "DONE", priority: "HIGH", assigneeIdx: 4, dueDate: "2026-03-15" },
    { projectIdx: 1, title: "Update emergency evacuation procedures", status: "IN_PROGRESS", priority: "HIGH", assigneeIdx: 4, dueDate: "2026-04-22" },
    { projectIdx: 1, title: "Train staff on new PPE protocols", status: "TODO", priority: "HIGH", assigneeIdx: 4, dueDate: "2026-05-01" },
    { projectIdx: 1, title: "Install gas detection monitors in tunnels", status: "TODO", priority: "HIGH", assigneeIdx: 2, dueDate: "2026-05-15" },
    { projectIdx: 2, title: "Complete fleet condition assessment", status: "TODO", priority: "MEDIUM", assigneeIdx: 2, dueDate: "2026-05-15" },
    { projectIdx: 2, title: "Get quotes for CAT 785 replacement parts", status: "TODO", priority: "LOW", assigneeIdx: 3, dueDate: "2026-05-30" },
    { projectIdx: 3, title: "Migrate financial data to new system", status: "IN_PROGRESS", priority: "HIGH", assigneeIdx: 3, dueDate: "2026-04-30" },
    { projectIdx: 3, title: "Configure user roles and permissions", status: "IN_PROGRESS", priority: "MEDIUM", assigneeIdx: 0, dueDate: "2026-04-28" },
    { projectIdx: 3, title: "Staff training on new platform", status: "TODO", priority: "MEDIUM", assigneeIdx: 1, dueDate: "2026-06-01" },
    { projectIdx: 3, title: "Set up automated backup schedules", status: "TODO", priority: "HIGH", assigneeIdx: 2, dueDate: "2026-05-10" },
  ],
  meetings: [
    { title: "Weekly Operations Standup", description: "Review progress on all active projects.", daysOut: 1, startH: 9, startM: 0, endH: 10, endM: 0, location: "Conference Room A", attendeeIdxs: [0,1,2,4], creatorIdx: 0 },
    { title: "Safety Compliance Review", description: "Review safety upgrade progress.", daysOut: 2, startH: 14, startM: 0, endH: 15, endM: 30, location: "HSE Office", attendeeIdxs: [1,4], creatorIdx: 1 },
    { title: "Finance Month-End Close", description: "Month-end reconciliation.", daysOut: 3, startH: 10, startM: 0, endH: 11, endM: 30, location: "Finance Dept", attendeeIdxs: [0,3], creatorIdx: 3 },
    { title: "Phase 2 Engineering Review", description: "Technical review of site preparation.", daysOut: 4, startH: 8, startM: 30, endH: 10, endM: 0, location: "Site Office", attendeeIdxs: [1,2], creatorIdx: 1 },
    { title: "All-Hands Town Hall", description: "Quarterly company update.", daysOut: 7, startH: 15, startM: 0, endH: 16, endM: 30, location: "Main Canteen", attendeeIdxs: [0,1,2,3,4], creatorIdx: 0 },
  ],
  documents: [
    { title: "Company Safety Policy 2026", docType: "POLICY", status: "APPROVED", creatorIdx: 0 },
    { title: "Tarkwa Phase 2 - Feasibility Study", docType: "REPORT", status: "APPROVED", creatorIdx: 1 },
    { title: "Monthly Operations Report - March 2026", docType: "REPORT", status: "DRAFT", creatorIdx: 1 },
    { title: "Equipment Purchase Justification", docType: "MEMO", status: "IN_REVIEW", creatorIdx: 2 },
    { title: "Environmental Compliance Certificate", docType: "CONTRACT", status: "APPROVED", creatorIdx: 4 },
  ],
}

const ngoWorkspace: WorkspaceConfig = {
  workspace: {
    name: "Horizon Foundation Ghana",
    slug: "horizon-ghana",
    legalName: "Horizon Foundation Ghana",
    businessType: "NGO",
    country: "GH",
    currency: "GHS",
    modules: ["people","projects","meetings","documents","approvals","finance","budget","procurement","grants","crm","compliance","social-media","reports"],
  },
  departments: ["Programmes", "Finance & Admin", "M&E", "Communications"],
  users: [
    { email: "admin@horizon-ghana.org", name: "Efua Appiah", role: "Owner", empNumber: "HF-001", firstName: "Efua", lastName: "Appiah", jobTitle: "Executive Director", deptName: "Programmes" },
    { email: "kwesi@horizon-ghana.org", name: "Kwesi Mensah", role: "Manager", empNumber: "HF-002", firstName: "Kwesi", lastName: "Mensah", jobTitle: "Programmes Manager", deptName: "Programmes" },
    { email: "akua@horizon-ghana.org", name: "Akua Sarpong", role: "Employee", empNumber: "HF-003", firstName: "Akua", lastName: "Sarpong", jobTitle: "M&E Officer", deptName: "M&E" },
    { email: "nana@horizon-ghana.org", name: "Nana Adjei", role: "Employee", empNumber: "HF-004", firstName: "Nana", lastName: "Adjei", jobTitle: "Finance Officer", deptName: "Finance & Admin" },
    { email: "esi@horizon-ghana.org", name: "Esi Owusu", role: "Employee", empNumber: "HF-005", firstName: "Esi", lastName: "Owusu", jobTitle: "Communications Officer", deptName: "Communications" },
  ],
  projects: [
    { name: "WASH Programme - Northern Region", description: "Water, sanitation and hygiene programme for 50 communities in Northern Ghana.", status: "ACTIVE", priority: "HIGH", ownerIdx: 1, budget: 1200000, startDate: "2025-09-01", endDate: "2027-08-31" },
    { name: "Girls Education Initiative", description: "Scholarship and mentoring programme for 500 girls in rural communities.", status: "ACTIVE", priority: "HIGH", ownerIdx: 1, budget: 350000, startDate: "2026-01-01", endDate: "2026-12-31" },
    { name: "Livelihood Support - Volta Region", description: "Skills training and micro-grants for 200 women in the Volta Region.", status: "PLANNING", priority: "MEDIUM", ownerIdx: 0, budget: 180000, startDate: "2026-06-01", endDate: "2027-05-31" },
  ],
  tasks: [
    { projectIdx: 0, title: "Submit Q1 narrative report to USAID", status: "IN_PROGRESS", priority: "HIGH", assigneeIdx: 2, dueDate: "2026-04-30" },
    { projectIdx: 0, title: "Conduct baseline survey in Tamale district", status: "TODO", priority: "HIGH", assigneeIdx: 2, dueDate: "2026-05-15" },
    { projectIdx: 0, title: "Procure 20 borehole drilling kits", status: "IN_PROGRESS", priority: "HIGH", assigneeIdx: 3, dueDate: "2026-04-22" },
    { projectIdx: 0, title: "Community hygiene training - Batch 3", status: "TODO", priority: "MEDIUM", assigneeIdx: 1, dueDate: "2026-05-20" },
    { projectIdx: 1, title: "Selection committee for scholarship applicants", status: "TODO", priority: "HIGH", assigneeIdx: 1, dueDate: "2026-05-01" },
    { projectIdx: 1, title: "Design mentoring curriculum", status: "IN_PROGRESS", priority: "MEDIUM", assigneeIdx: 4, dueDate: "2026-04-28" },
    { projectIdx: 1, title: "Partner school MOU signing", status: "DONE", priority: "HIGH", assigneeIdx: 0, dueDate: "2026-03-15" },
    { projectIdx: 1, title: "Social media campaign for International Day of the Girl", status: "TODO", priority: "LOW", assigneeIdx: 4, dueDate: "2026-10-11" },
    { projectIdx: 2, title: "Draft programme proposal for DFID", status: "IN_PROGRESS", priority: "HIGH", assigneeIdx: 0, dueDate: "2026-05-10" },
    { projectIdx: 2, title: "Identify community partners in Volta Region", status: "TODO", priority: "MEDIUM", assigneeIdx: 1, dueDate: "2026-05-30" },
  ],
  meetings: [
    { title: "Senior Management Team Meeting", description: "Weekly SMT review of programmes and operations.", daysOut: 1, startH: 9, startM: 0, endH: 10, endM: 30, location: "Boardroom", attendeeIdxs: [0,1,3], creatorIdx: 0 },
    { title: "WASH Programme Review", description: "Monthly review with field team.", daysOut: 3, startH: 10, startM: 0, endH: 12, endM: 0, location: "Programme Room", attendeeIdxs: [0,1,2], creatorIdx: 1 },
    { title: "Donor Call - USAID", description: "Quarterly check-in with USAID programme officer.", daysOut: 5, startH: 14, startM: 0, endH: 15, endM: 0, location: "Zoom", attendeeIdxs: [0,1,2], creatorIdx: 0 },
    { title: "Comms Team Sync", description: "Weekly content planning.", daysOut: 2, startH: 11, startM: 0, endH: 11, endM: 45, location: "Comms Corner", attendeeIdxs: [4,0], creatorIdx: 4 },
  ],
  documents: [
    { title: "WASH Programme Proposal - USAID", docType: "REPORT", status: "APPROVED", creatorIdx: 0 },
    { title: "M&E Framework 2026", docType: "SOP", status: "APPROVED", creatorIdx: 2 },
    { title: "Q1 2026 Financial Report", docType: "REPORT", status: "DRAFT", creatorIdx: 3 },
    { title: "Safeguarding Policy", docType: "POLICY", status: "APPROVED", creatorIdx: 0 },
    { title: "Girls Education MOU - Tamale Schools", docType: "CONTRACT", status: "APPROVED", creatorIdx: 1 },
  ],
}

const startupWorkspace: WorkspaceConfig = {
  workspace: {
    name: "Kobo Labs",
    slug: "kobo-labs",
    legalName: "Kobo Labs Ltd",
    businessType: "STARTUP",
    country: "GH",
    currency: "GHS",
    modules: ["people","projects","meetings","documents","approvals","finance","budget","crm","social-media","compliance","grants","reports"],
  },
  departments: ["Engineering", "Product", "Growth", "Operations"],
  users: [
    { email: "admin@kobolabs.com", name: "Kelvin Tetteh", role: "Owner", empNumber: "KL-001", firstName: "Kelvin", lastName: "Tetteh", jobTitle: "CEO & Co-founder", deptName: "Operations" },
    { email: "serwa@kobolabs.com", name: "Serwa Addo", role: "Manager", empNumber: "KL-002", firstName: "Serwa", lastName: "Addo", jobTitle: "CTO & Co-founder", deptName: "Engineering" },
    { email: "fiifi@kobolabs.com", name: "Fiifi Mensah", role: "Employee", empNumber: "KL-003", firstName: "Fiifi", lastName: "Mensah", jobTitle: "Full-Stack Developer", deptName: "Engineering" },
    { email: "adwoa@kobolabs.com", name: "Adwoa Boateng", role: "Employee", empNumber: "KL-004", firstName: "Adwoa", lastName: "Boateng", jobTitle: "Product Designer", deptName: "Product" },
    { email: "kojo@kobolabs.com", name: "Kojo Owusu", role: "Employee", empNumber: "KL-005", firstName: "Kojo", lastName: "Owusu", jobTitle: "Growth Lead", deptName: "Growth" },
  ],
  projects: [
    { name: "Mobile App v2.0", description: "Major redesign of the Kobo mobile app with new payments feature.", status: "ACTIVE", priority: "HIGH", ownerIdx: 1, budget: 50000, startDate: "2026-03-01", endDate: "2026-06-30" },
    { name: "Series A Fundraise", description: "Prepare materials and pitch to Series A investors.", status: "ACTIVE", priority: "HIGH", ownerIdx: 0, budget: 15000, startDate: "2026-04-01", endDate: "2026-07-31" },
    { name: "USSD Integration", description: "Build USSD channel for feature phone users.", status: "PLANNING", priority: "MEDIUM", ownerIdx: 1, budget: 25000, startDate: "2026-06-01", endDate: "2026-09-30" },
  ],
  tasks: [
    { projectIdx: 0, title: "Implement new payment flow UI", status: "IN_PROGRESS", priority: "HIGH", assigneeIdx: 2, dueDate: "2026-04-25" },
    { projectIdx: 0, title: "Design onboarding screens v2", status: "IN_PROGRESS", priority: "HIGH", assigneeIdx: 3, dueDate: "2026-04-22" },
    { projectIdx: 0, title: "Mobile money API integration", status: "TODO", priority: "HIGH", assigneeIdx: 2, dueDate: "2026-05-10" },
    { projectIdx: 0, title: "QA testing for payments module", status: "TODO", priority: "HIGH", assigneeIdx: 1, dueDate: "2026-05-20" },
    { projectIdx: 0, title: "App store submission", status: "TODO", priority: "MEDIUM", assigneeIdx: 2, dueDate: "2026-06-15" },
    { projectIdx: 1, title: "Update pitch deck with Q1 metrics", status: "IN_PROGRESS", priority: "HIGH", assigneeIdx: 0, dueDate: "2026-04-28" },
    { projectIdx: 1, title: "Financial model refresh", status: "TODO", priority: "HIGH", assigneeIdx: 0, dueDate: "2026-05-05" },
    { projectIdx: 1, title: "Schedule meetings with 5 target VCs", status: "TODO", priority: "HIGH", assigneeIdx: 0, dueDate: "2026-05-15" },
    { projectIdx: 1, title: "Prepare data room", status: "TODO", priority: "MEDIUM", assigneeIdx: 3, dueDate: "2026-05-20" },
    { projectIdx: 1, title: "Social media Series A announcement draft", status: "TODO", priority: "LOW", assigneeIdx: 4, dueDate: "2026-07-01" },
    { projectIdx: 2, title: "Research USSD gateway providers", status: "DONE", priority: "MEDIUM", assigneeIdx: 2, dueDate: "2026-04-15" },
    { projectIdx: 2, title: "USSD menu flow design", status: "TODO", priority: "MEDIUM", assigneeIdx: 3, dueDate: "2026-06-15" },
  ],
  meetings: [
    { title: "Daily Standup", description: "Quick sync across engineering and product.", daysOut: 1, startH: 9, startM: 30, endH: 9, endM: 45, location: "Slack Huddle", attendeeIdxs: [1,2,3], creatorIdx: 1 },
    { title: "Investor Prep Session", description: "Review pitch deck and practice.", daysOut: 2, startH: 14, startM: 0, endH: 16, endM: 0, location: "Boardroom", attendeeIdxs: [0,1], creatorIdx: 0 },
    { title: "Growth Sprint Review", description: "Review growth experiments and metrics.", daysOut: 3, startH: 11, startM: 0, endH: 12, endM: 0, location: "Meeting Room", attendeeIdxs: [0,4], creatorIdx: 4 },
    { title: "Product Design Review", description: "Review v2 onboarding and payment flow designs.", daysOut: 4, startH: 10, startM: 0, endH: 11, endM: 0, location: "Design Lab", attendeeIdxs: [1,2,3], creatorIdx: 3 },
    { title: "All-Hands Friday", description: "Weekly team sync and demo.", daysOut: 5, startH: 16, startM: 0, endH: 17, endM: 0, location: "Common Area", attendeeIdxs: [0,1,2,3,4], creatorIdx: 0 },
  ],
  documents: [
    { title: "Kobo Labs Pitch Deck Q2 2026", docType: "REPORT", status: "DRAFT", creatorIdx: 0 },
    { title: "Mobile App v2 PRD", docType: "SOP", status: "APPROVED", creatorIdx: 1 },
    { title: "USSD Integration Spec", docType: "SOP", status: "DRAFT", creatorIdx: 1 },
    { title: "Data Protection Policy", docType: "POLICY", status: "APPROVED", creatorIdx: 0 },
    { title: "Growth Experiment Tracker", docType: "REPORT", status: "APPROVED", creatorIdx: 4 },
  ],
}

// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("Seeding database...\n")

  const passwordHash = await hash("password123", 12)

  console.log("━━━ 1/3 GoldStar Mining Ltd (Mining Contractor) ━━━")
  await seedWorkspace(miningWorkspace, passwordHash)
  console.log("  Done\n")

  console.log("━━━ 2/3 Horizon Foundation Ghana (NGO) ━━━")
  await seedWorkspace(ngoWorkspace, passwordHash)
  console.log("  Done\n")

  console.log("━━━ 3/3 Kobo Labs (Startup) ━━━")
  await seedWorkspace(startupWorkspace, passwordHash)
  console.log("  Done\n")

  console.log("════════════════════════════════════════════════════")
  console.log("  Seed complete! All passwords: password123")
  console.log("════════════════════════════════════════════════════")
  console.log("")
  console.log("  GoldStar Mining Ltd (Mining Contractor)")
  console.log("    admin@goldstar.io        (Owner)")
  console.log("    ama@goldstar.io          (Manager)")
  console.log("    kofi@goldstar.io         (Employee)")
  console.log("    abena@goldstar.io        (Employee)")
  console.log("    yaw@goldstar.io          (Employee)")
  console.log("")
  console.log("  Horizon Foundation Ghana (NGO)")
  console.log("    admin@horizon-ghana.org  (Owner)")
  console.log("    kwesi@horizon-ghana.org  (Manager)")
  console.log("    akua@horizon-ghana.org   (Employee)")
  console.log("    nana@horizon-ghana.org   (Employee)")
  console.log("    esi@horizon-ghana.org    (Employee)")
  console.log("")
  console.log("  Kobo Labs (Startup)")
  console.log("    admin@kobolabs.com       (Owner)")
  console.log("    serwa@kobolabs.com       (Manager)")
  console.log("    fiifi@kobolabs.com       (Employee)")
  console.log("    adwoa@kobolabs.com       (Employee)")
  console.log("    kojo@kobolabs.com        (Employee)")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
