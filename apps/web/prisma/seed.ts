/**
 * Crontract Seed Script
 * Seeds three demo workspaces with realistic Ghana-context data.
 * Password for all demo users: demo123456
 */

import { PrismaClient, BusinessType, EmploymentType, EmployeeStatus, ProjectStatus, Priority, TaskStatus, MeetingStatus, DocumentType, DocumentStatus, AccountType, JournalStatus, InvoiceStatus, BillStatus, ExpenseStatus, BudgetStatus, POStatus, PRStatus, AssetStatus, DepreciationMethod, IncidentSeverity, IncidentType, IncidentStatus, PermitType, PermitStatus, FlowType, ApprovalStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEMO_PASSWORD = "demo123456";

async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

// ---------------------------------------------------------------------------
// Permission matrix
// ---------------------------------------------------------------------------

const MODULES_ENTITIES: Record<string, string> = {
  workspace: "workspace",
  people: "employee",
  projects: "project",
  meetings: "meeting",
  documents: "document",
  approvals: "approval",
  finance: "invoice",
  budget: "budget",
  procurement: "purchase_order",
  assets: "asset",
  hse: "incident",
  grants: "grant",
  crm: "contact",
  compliance: "compliance",
  reports: "report",
  admin: "admin",
};

const ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "configure"];

function buildPermissions() {
  const perms: { code: string; module: string; entity: string; action: string; description: string }[] = [];
  for (const [module, entity] of Object.entries(MODULES_ENTITIES)) {
    for (const action of ACTIONS) {
      const code = `${module}:${entity}:${action}`;
      perms.push({
        code,
        module,
        entity,
        action,
        description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${entity} in ${module}`,
      });
    }
  }
  return perms;
}

// ---------------------------------------------------------------------------
// Clean all data in correct FK order
// ---------------------------------------------------------------------------

async function cleanDatabase() {
  console.log("  Cleaning existing data...");

  // HSE
  await prisma.safetyTraining.deleteMany();
  await prisma.toolboxTalk.deleteMany();
  await prisma.permit.deleteMany();
  await prisma.riskAssessment.deleteMany();
  await prisma.incident.deleteMany();

  // Assets
  await prisma.asset.deleteMany();
  await prisma.assetCategory.deleteMany();

  // Procurement
  await prisma.goodsReceipt.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.purchaseRequisition.deleteMany();
  await prisma.vendor.deleteMany();

  // Budget & Finance
  await prisma.budget.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.journal.deleteMany();
  await prisma.account_GL.deleteMany();
  await prisma.bankAccount.deleteMany();

  // Approvals
  await prisma.approvalDecision.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.approvalFlow.deleteMany();

  // Documents & Folders
  await prisma.document.deleteMany();
  await prisma.folder.deleteMany();

  // Meetings
  await prisma.meeting.deleteMany();

  // Tasks & Projects
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();

  // People
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();

  // Core
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.role.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("  Database cleaned.");
}

// ---------------------------------------------------------------------------
// Seed permissions
// ---------------------------------------------------------------------------

async function seedPermissions() {
  console.log("  Seeding permissions...");
  const permDefs = buildPermissions();

  const perms: Record<string, string> = {}; // code -> id

  for (const p of permDefs) {
    const created = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
    perms[created.code] = created.id;
  }

  console.log(`  Created ${permDefs.length} permissions.`);
  return perms;
}

// ---------------------------------------------------------------------------
// Helper: assign permissions to a role
// ---------------------------------------------------------------------------

async function assignPermissions(roleId: string, codes: string[], permMap: Record<string, string>) {
  for (const code of codes) {
    const permId = permMap[code];
    if (!permId) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: permId } },
      update: {},
      create: { roleId, permissionId: permId },
    });
  }
}

// ---------------------------------------------------------------------------
// All permissions for a set of modules
// ---------------------------------------------------------------------------

function allPermsForModules(modules: string[]): string[] {
  const codes: string[] = [];
  for (const mod of modules) {
    const entity = MODULES_ENTITIES[mod];
    if (!entity) continue;
    for (const action of ACTIONS) {
      codes.push(`${mod}:${entity}:${action}`);
    }
  }
  return codes;
}

function viewPermsForModules(modules: string[]): string[] {
  return modules.map((mod) => {
    const entity = MODULES_ENTITIES[mod];
    return `${mod}:${entity}:view`;
  });
}

// ---------------------------------------------------------------------------
// WORKSPACE 1: Obuasi Mining Services Ltd
// ---------------------------------------------------------------------------

async function seedObuasiMining(permMap: Record<string, string>) {
  console.log("\n  [1/3] Seeding Obuasi Mining Services Ltd...");

  const pwHash = await hashPassword(DEMO_PASSWORD);

  // --- Workspace ---
  const ws = await prisma.workspace.create({
    data: {
      name: "Obuasi Mining Services Ltd",
      slug: "obuasi-mining",
      legalName: "Obuasi Mining Services Limited",
      businessType: BusinessType.MINING_CONTRACTOR,
      country: "GH",
      currency: "GHS",
      fiscalYearStart: 1,
      timezone: "Africa/Accra",
      modules: ["people", "projects", "meetings", "documents", "approvals", "finance", "budget", "procurement", "assets", "hse", "compliance", "reports"],
    },
  });

  // --- Admin user ---
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@obuasi-mining.com",
      name: "Kwame Asante",
      passwordHash: pwHash,
      emailVerified: new Date(),
    },
  });

  // --- Additional users ---
  const users = await Promise.all([
    prisma.user.create({ data: { email: "kofi.boateng@obuasi-mining.com", name: "Kofi Boateng", passwordHash: pwHash, emailVerified: new Date() } }),
    prisma.user.create({ data: { email: "abena.mensah@obuasi-mining.com", name: "Abena Mensah", passwordHash: pwHash, emailVerified: new Date() } }),
    prisma.user.create({ data: { email: "yaw.darko@obuasi-mining.com", name: "Yaw Darko", passwordHash: pwHash, emailVerified: new Date() } }),
    prisma.user.create({ data: { email: "akua.frimpong@obuasi-mining.com", name: "Akua Frimpong", passwordHash: pwHash, emailVerified: new Date() } }),
  ]);

  const [kofiUser, abenaUser, yawUser, akuaUser] = users;

  // --- Roles ---
  const ownerRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Owner", description: "Full access to everything", isSystem: true } });
  const adminRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Administrator", description: "Workspace administrator", isSystem: true } });
  const siteManagerRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Site Manager", description: "Manages site operations and projects" } });
  const hseOfficerRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "HSE Officer", description: "Health, Safety & Environment officer" } });
  const financeManagerRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Finance Manager", description: "Manages financial operations" } });
  const projectManagerRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Project Manager", description: "Manages projects and tasks" } });
  const teamMemberRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Team Member", description: "Standard team member" } });

  const miningModules = ["people", "projects", "meetings", "documents", "approvals", "finance", "budget", "procurement", "assets", "hse", "compliance", "reports"];

  // Assign permissions
  await assignPermissions(ownerRole.id, allPermsForModules([...miningModules, "workspace", "admin"]), permMap);
  await assignPermissions(adminRole.id, allPermsForModules([...miningModules, "workspace", "admin"]), permMap);
  await assignPermissions(siteManagerRole.id, allPermsForModules(["projects", "people", "meetings", "documents", "hse", "procurement"]), permMap);
  await assignPermissions(hseOfficerRole.id, allPermsForModules(["hse", "meetings", "documents", "reports"]), permMap);
  await assignPermissions(financeManagerRole.id, allPermsForModules(["finance", "budget", "procurement", "reports", "documents"]), permMap);
  await assignPermissions(projectManagerRole.id, allPermsForModules(["projects", "meetings", "documents", "people"]), permMap);
  await assignPermissions(teamMemberRole.id, viewPermsForModules(["projects", "meetings", "documents", "hse"]), permMap);

  // --- Memberships ---
  await prisma.membership.create({ data: { userId: adminUser.id, workspaceId: ws.id, roleId: ownerRole.id, isOwner: true } });
  await prisma.membership.create({ data: { userId: kofiUser.id, workspaceId: ws.id, roleId: siteManagerRole.id } });
  await prisma.membership.create({ data: { userId: abenaUser.id, workspaceId: ws.id, roleId: hseOfficerRole.id } });
  await prisma.membership.create({ data: { userId: yawUser.id, workspaceId: ws.id, roleId: financeManagerRole.id } });
  await prisma.membership.create({ data: { userId: akuaUser.id, workspaceId: ws.id, roleId: teamMemberRole.id } });

  // --- Departments ---
  const deptOps = await prisma.department.create({ data: { workspaceId: ws.id, name: "Operations" } });
  const deptHSE = await prisma.department.create({ data: { workspaceId: ws.id, name: "HSE" } });
  const deptFinance = await prisma.department.create({ data: { workspaceId: ws.id, name: "Finance & Admin" } });
  const deptFleet = await prisma.department.create({ data: { workspaceId: ws.id, name: "Fleet & Equipment" } });
  const deptProjects = await prisma.department.create({ data: { workspaceId: ws.id, name: "Projects" } });

  // --- Employees ---
  const emp1 = await prisma.employee.create({
    data: {
      workspaceId: ws.id, userId: adminUser.id, employeeNumber: "OMS-001",
      firstName: "Kwame", lastName: "Asante", email: "admin@obuasi-mining.com",
      phone: "+233244100001", jobTitle: "Chief Executive Officer",
      departmentId: deptOps.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2020-01-15"), status: EmployeeStatus.ACTIVE,
      basicSalary: 18000, emergencyName: "Ama Asante", emergencyPhone: "+233244100099",
    },
  });
  const emp2 = await prisma.employee.create({
    data: {
      workspaceId: ws.id, userId: kofiUser.id, employeeNumber: "OMS-002",
      firstName: "Kofi", lastName: "Boateng", email: "kofi.boateng@obuasi-mining.com",
      phone: "+233244100002", jobTitle: "Site Manager",
      departmentId: deptOps.id, managerId: emp1.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2020-03-01"), status: EmployeeStatus.ACTIVE,
      basicSalary: 12000,
    },
  });
  const emp3 = await prisma.employee.create({
    data: {
      workspaceId: ws.id, userId: abenaUser.id, employeeNumber: "OMS-003",
      firstName: "Abena", lastName: "Mensah", email: "abena.mensah@obuasi-mining.com",
      phone: "+233244100003", jobTitle: "HSE Officer",
      departmentId: deptHSE.id, managerId: emp1.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2021-06-01"), status: EmployeeStatus.ACTIVE,
      basicSalary: 9000,
    },
  });
  const emp4 = await prisma.employee.create({
    data: {
      workspaceId: ws.id, userId: yawUser.id, employeeNumber: "OMS-004",
      firstName: "Yaw", lastName: "Darko", email: "yaw.darko@obuasi-mining.com",
      phone: "+233244100004", jobTitle: "Finance Manager",
      departmentId: deptFinance.id, managerId: emp1.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2020-05-15"), status: EmployeeStatus.ACTIVE,
      basicSalary: 11000,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, userId: akuaUser.id, employeeNumber: "OMS-005",
      firstName: "Akua", lastName: "Frimpong", email: "akua.frimpong@obuasi-mining.com",
      phone: "+233244100005", jobTitle: "Project Coordinator",
      departmentId: deptProjects.id, managerId: emp2.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2022-02-01"), status: EmployeeStatus.ACTIVE,
      basicSalary: 7500,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "OMS-006",
      firstName: "Ebo", lastName: "Agyei", email: "ebo.agyei@obuasi-mining.com",
      phone: "+233244100006", jobTitle: "Equipment Operator",
      departmentId: deptFleet.id, managerId: emp2.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2021-01-10"), status: EmployeeStatus.ACTIVE,
      basicSalary: 6000,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "OMS-007",
      firstName: "Efua", lastName: "Owusu", email: "efua.owusu@obuasi-mining.com",
      phone: "+233244100007", jobTitle: "Safety Inspector",
      departmentId: deptHSE.id, managerId: emp3.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2022-08-15"), status: EmployeeStatus.ACTIVE,
      basicSalary: 6500,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "OMS-008",
      firstName: "Nana", lastName: "Osei", email: "nana.osei@obuasi-mining.com",
      phone: "+233244100008", jobTitle: "Accounts Officer",
      departmentId: deptFinance.id, managerId: emp4.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2022-11-01"), status: EmployeeStatus.ACTIVE,
      basicSalary: 5500,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "OMS-009",
      firstName: "Kojo", lastName: "Asare", email: "kojo.asare@obuasi-mining.com",
      phone: "+233244100009", jobTitle: "Procurement Officer",
      departmentId: deptFinance.id, managerId: emp4.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2023-01-16"), status: EmployeeStatus.ACTIVE,
      basicSalary: 5800,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "OMS-010",
      firstName: "Adwoa", lastName: "Amponsah", email: "adwoa.amponsah@obuasi-mining.com",
      phone: "+233244100010", jobTitle: "Fleet Supervisor",
      departmentId: deptFleet.id, managerId: emp2.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2021-09-01"), status: EmployeeStatus.ACTIVE,
      basicSalary: 7000,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "OMS-011",
      firstName: "Kweku", lastName: "Donkor", email: "kweku.donkor@obuasi-mining.com",
      phone: "+233244100011", jobTitle: "Site Engineer",
      departmentId: deptOps.id, managerId: emp2.id, employmentType: EmploymentType.CONTRACT,
      startDate: new Date("2023-07-01"), endDate: new Date("2024-06-30"), status: EmployeeStatus.ACTIVE,
      basicSalary: 8500,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "OMS-012",
      firstName: "Esi", lastName: "Baah", email: "esi.baah@obuasi-mining.com",
      phone: "+233244100012", jobTitle: "Administrative Assistant",
      departmentId: deptFinance.id, managerId: emp1.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2023-04-01"), status: EmployeeStatus.ACTIVE,
      basicSalary: 4500,
    },
  });

  // --- Projects ---
  const proj1 = await prisma.project.create({
    data: {
      workspaceId: ws.id, name: "Tarkwa Site Mobilization",
      description: "Full mobilization of operations team and equipment to Tarkwa gold mine site.",
      status: ProjectStatus.ACTIVE, priority: Priority.HIGH,
      startDate: new Date("2026-01-15"), endDate: new Date("2026-06-30"),
      budget: 850000, ownerId: emp2.id, createdBy: adminUser.id,
    },
  });
  const proj2 = await prisma.project.create({
    data: {
      workspaceId: ws.id, name: "Equipment Maintenance Q2",
      description: "Scheduled preventive maintenance for all heavy equipment in Q2 2026.",
      status: ProjectStatus.ACTIVE, priority: Priority.MEDIUM,
      startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30"),
      budget: 120000, ownerId: emp2.id, createdBy: adminUser.id,
    },
  });
  const proj3 = await prisma.project.create({
    data: {
      workspaceId: ws.id, name: "Safety Training Program",
      description: "Company-wide HSE training covering HAVS, confined space, and fire response.",
      status: ProjectStatus.PLANNING, priority: Priority.HIGH,
      startDate: new Date("2026-05-01"), endDate: new Date("2026-07-31"),
      budget: 45000, ownerId: emp3.id, createdBy: adminUser.id,
    },
  });

  // --- Tasks (Kanban) ---
  // Project 1 tasks
  await prisma.task.createMany({
    data: [
      { workspaceId: ws.id, projectId: proj1.id, title: "Site survey and assessment", status: TaskStatus.DONE, priority: Priority.HIGH, assigneeId: emp2.id, dueDate: new Date("2026-01-25"), estimatedHours: 16, actualHours: 18, position: 0, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Equipment transport logistics", status: TaskStatus.DONE, priority: Priority.HIGH, assigneeId: emp2.id, dueDate: new Date("2026-02-10"), estimatedHours: 24, actualHours: 22, position: 1, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Temporary camp setup", status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assigneeId: emp2.id, dueDate: new Date("2026-04-30"), estimatedHours: 40, position: 2, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Site safety induction for new crew", status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assigneeId: emp3.id, dueDate: new Date("2026-04-22"), estimatedHours: 8, position: 3, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Obtain regulatory permits", status: TaskStatus.TODO, priority: Priority.URGENT, assigneeId: emp1.id, dueDate: new Date("2026-05-15"), estimatedHours: 12, position: 4, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Community engagement meetings", status: TaskStatus.TODO, priority: Priority.MEDIUM, assigneeId: emp1.id, dueDate: new Date("2026-05-30"), estimatedHours: 16, position: 5, createdBy: adminUser.id },
    ],
  });

  // Project 2 tasks
  await prisma.task.createMany({
    data: [
      { workspaceId: ws.id, projectId: proj2.id, title: "CAT 785 haul truck service", status: TaskStatus.DONE, priority: Priority.HIGH, dueDate: new Date("2026-04-10"), estimatedHours: 20, actualHours: 21, position: 0, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj2.id, title: "Hydraulic excavator inspection", status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, dueDate: new Date("2026-04-20"), estimatedHours: 16, position: 1, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj2.id, title: "Grader blade replacement", status: TaskStatus.IN_REVIEW, priority: Priority.MEDIUM, dueDate: new Date("2026-04-25"), estimatedHours: 8, position: 2, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj2.id, title: "Fleet fuel system audit", status: TaskStatus.TODO, priority: Priority.LOW, dueDate: new Date("2026-05-15"), estimatedHours: 12, position: 3, createdBy: adminUser.id },
    ],
  });

  // Project 3 tasks
  await prisma.task.createMany({
    data: [
      { workspaceId: ws.id, projectId: proj3.id, title: "Training needs assessment", status: TaskStatus.DONE, priority: Priority.MEDIUM, assigneeId: emp3.id, dueDate: new Date("2026-04-15"), estimatedHours: 8, actualHours: 8, position: 0, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj3.id, title: "Develop HAVS training module", status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assigneeId: emp3.id, dueDate: new Date("2026-05-05"), estimatedHours: 24, position: 1, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj3.id, title: "Confined space entry procedures update", status: TaskStatus.TODO, priority: Priority.HIGH, assigneeId: emp3.id, dueDate: new Date("2026-05-20"), estimatedHours: 16, position: 2, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj3.id, title: "Fire response drill planning", status: TaskStatus.TODO, priority: Priority.MEDIUM, dueDate: new Date("2026-06-01"), estimatedHours: 12, position: 3, createdBy: adminUser.id },
    ],
  });

  // --- Meetings ---
  await prisma.meeting.createMany({
    data: [
      {
        workspaceId: ws.id, projectId: proj1.id,
        title: "Tarkwa Mobilization Progress Review",
        description: "Weekly progress review for site mobilization",
        startTime: new Date("2026-04-14T09:00:00Z"), endTime: new Date("2026-04-14T10:00:00Z"),
        location: "Boardroom A, Obuasi HQ",
        status: MeetingStatus.COMPLETED,
        attendees: [adminUser.id, kofiUser.id, abenaUser.id],
        agenda: [{ item: "Camp setup update" }, { item: "Equipment delivery status" }, { item: "AOB" }],
        minutes: "Camp setup is 65% complete. Remaining equipment due end of April. Action: Kofi to follow up with logistics provider.",
        decisions: [{ decision: "Equipment delivery deadline extended to April 30" }],
        createdBy: adminUser.id,
      },
      {
        workspaceId: ws.id,
        title: "Q2 HSE Committee Meeting",
        description: "Quarterly HSE review and planning",
        startTime: new Date("2026-04-21T14:00:00Z"), endTime: new Date("2026-04-21T16:00:00Z"),
        location: "Conference Room B",
        status: MeetingStatus.SCHEDULED,
        attendees: [adminUser.id, abenaUser.id, kofiUser.id],
        agenda: [{ item: "Q1 incident review" }, { item: "Training program status" }, { item: "Permit audit" }],
        createdBy: abenaUser.id,
      },
      {
        workspaceId: ws.id, projectId: proj2.id,
        title: "Equipment Maintenance Planning",
        description: "Plan Q2 maintenance schedule",
        startTime: new Date("2026-04-07T10:00:00Z"), endTime: new Date("2026-04-07T11:30:00Z"),
        location: "Workshop Office",
        status: MeetingStatus.COMPLETED,
        attendees: [kofiUser.id, adminUser.id],
        agenda: [{ item: "CAT 785 service scope" }, { item: "Parts procurement" }],
        minutes: "CAT 785 service completed satisfactorily. Parts for excavator ordered.",
        decisions: [{ decision: "Approve GHS 18,500 for spare parts" }],
        createdBy: kofiUser.id,
      },
    ],
  });

  // --- Documents ---
  const folder1 = await prisma.folder.create({
    data: { workspaceId: ws.id, name: "HSE Documents", createdBy: adminUser.id },
  });
  const folder2 = await prisma.folder.create({
    data: { workspaceId: ws.id, name: "Contracts & Agreements", createdBy: adminUser.id },
  });

  await prisma.document.createMany({
    data: [
      { workspaceId: ws.id, folderId: folder1.id, title: "HSE Management System Policy", docType: DocumentType.POLICY, status: DocumentStatus.PUBLISHED, version: 3, content: "This policy outlines the HSE management framework for Obuasi Mining Services Ltd...", createdBy: abenaUser.id },
      { workspaceId: ws.id, folderId: folder1.id, title: "Confined Space Entry Procedure", docType: DocumentType.SOP, status: DocumentStatus.APPROVED, version: 2, content: "Procedure for safe entry into confined spaces on all OMS sites...", createdBy: abenaUser.id },
      { workspaceId: ws.id, folderId: folder2.id, title: "Tarkwa Site Service Agreement", docType: DocumentType.CONTRACT, status: DocumentStatus.PUBLISHED, version: 1, content: "Service agreement between Obuasi Mining Services Ltd and Ghana Gold Corp...", createdBy: adminUser.id },
      { workspaceId: ws.id, title: "Q1 2026 Operational Report", docType: DocumentType.REPORT, status: DocumentStatus.DRAFT, version: 1, content: "Q1 operational summary covering site activities, financial performance, and HSE metrics...", createdBy: kofiUser.id },
    ],
  });

  // --- HSE: Permits ---
  await prisma.permit.create({
    data: {
      workspaceId: ws.id, number: "PTW-2026-001",
      type: PermitType.HOT_WORK, title: "Welding works on haul truck chassis",
      location: "Tarkwa Workshop Bay 3", description: "Repair welding on CAT 785 chassis rail",
      status: PermitStatus.ACTIVE,
      issuedBy: emp3.id, issuedDate: new Date("2026-04-15"),
      validFrom: new Date("2026-04-15T08:00:00Z"), validTo: new Date("2026-04-15T17:00:00Z"),
      hazards: [{ hazard: "Sparks / fire risk", rating: "HIGH" }, { hazard: "UV radiation", rating: "MEDIUM" }],
      precautions: [{ action: "Fire watch posted" }, { action: "Fire extinguisher on standby" }, { action: "Welding screens erected" }],
    },
  });
  await prisma.permit.create({
    data: {
      workspaceId: ws.id, number: "PTW-2026-002",
      type: PermitType.CONFINED_SPACE, title: "Fuel tank internal inspection",
      location: "Fuel Farm, OMS Obuasi Yard", description: "Internal visual inspection of 50,000L diesel tank",
      status: PermitStatus.CLOSED,
      issuedBy: emp3.id, issuedDate: new Date("2026-03-20"),
      validFrom: new Date("2026-03-20T07:00:00Z"), validTo: new Date("2026-03-20T14:00:00Z"),
      hazards: [{ hazard: "Toxic vapours", rating: "HIGH" }, { hazard: "Oxygen deficiency", rating: "HIGH" }],
      precautions: [{ action: "Atmospheric testing completed" }, { action: "Standby person assigned" }, { action: "Rescue equipment on standby" }],
    },
  });

  // --- HSE: Incident ---
  await prisma.incident.create({
    data: {
      workspaceId: ws.id, number: "INC-2026-001",
      title: "Minor hand laceration during maintenance",
      description: "Technician sustained a minor laceration on right hand while removing a filter housing. Gloves were not worn at time of injury.",
      incidentDate: new Date("2026-03-28T10:30:00Z"),
      location: "OMS Obuasi Workshop",
      severity: IncidentSeverity.MINOR,
      type: IncidentType.INJURY,
      status: IncidentStatus.CLOSED,
      reportedBy: emp3.id,
      investigator: emp3.id,
      rootCause: "Failure to wear appropriate PPE (cut-resistant gloves) during routine maintenance task.",
      correctiveActions: [
        { action: "Refresher PPE toolbox talk conducted", dueDate: "2026-04-05", status: "COMPLETED" },
        { action: "PPE compliance checklist added to morning inspection", dueDate: "2026-04-10", status: "COMPLETED" },
      ],
      injuredPersons: [{ name: "Anonymous Technician", injury: "Laceration, right hand", treatment: "First aid on site", lostTime: false }],
      witnesses: ["Ebo Agyei"],
    },
  });

  // --- Vendors ---
  const vendor1 = await prisma.vendor.create({
    data: { workspaceId: ws.id, name: "Mantrac Ghana Ltd", contactName: "Samuel Kumi", email: "sales@mantrac.com.gh", phone: "+233302123456", address: "Accra, Ghana", category: "Mining Equipment", taxId: "GH-VAT-00123", rating: 5 },
  });
  const vendor2 = await prisma.vendor.create({
    data: { workspaceId: ws.id, name: "GOIL Company Ltd", contactName: "Comfort Asiedu", email: "bulk@goil.com.gh", phone: "+233302654321", address: "Kumasi Depot, Ghana", category: "Fuel & Lubricants", taxId: "GH-VAT-00456", rating: 4 },
  });
  const vendor3 = await prisma.vendor.create({
    data: { workspaceId: ws.id, name: "Rockstone Catering Services", contactName: "Patricia Ankrah", email: "info@rockstone-catering.com.gh", phone: "+233244987654", address: "Obuasi, Ashanti Region", category: "Catering", rating: 4 },
  });
  const vendor4 = await prisma.vendor.create({
    data: { workspaceId: ws.id, name: "Afripack Safety Supplies", contactName: "Mensah Osei", email: "orders@afripack.com.gh", phone: "+233302789012", address: "Accra, Ghana", category: "PPE & Safety", rating: 3 },
  });
  await prisma.vendor.create({
    data: { workspaceId: ws.id, name: "Ghana Explosives & Chemicals", contactName: "Daniel Ofori", email: "d.ofori@ghec.com.gh", phone: "+233244567890", address: "Tema Industrial Area, Ghana", category: "Chemicals & Explosives", taxId: "GH-VAT-00789", rating: 5 },
  });

  // --- Purchase Orders ---
  const po1 = await prisma.purchaseOrder.create({
    data: {
      workspaceId: ws.id, number: "PO-2026-001", vendorId: vendor1.id,
      title: "CAT 785 Spare Parts - Q2 Maintenance",
      status: POStatus.RECEIVED, issueDate: new Date("2026-03-20"), deliveryDate: new Date("2026-04-08"),
      lines: [{ description: "CAT 785 Engine Filter Set", qty: 4, unitPrice: 1850, amount: 7400 }, { description: "Hydraulic Hose Assembly", qty: 6, unitPrice: 620, amount: 3720 }],
      subtotal: 11120, tax: 1668, total: 12788, currency: "GHS",
      notes: "Priority order for Q2 maintenance schedule", createdBy: adminUser.id,
    },
  });
  await prisma.purchaseOrder.create({
    data: {
      workspaceId: ws.id, number: "PO-2026-002", vendorId: vendor2.id,
      title: "Diesel Fuel Supply - April 2026",
      status: POStatus.SENT, issueDate: new Date("2026-04-01"), deliveryDate: new Date("2026-04-15"),
      lines: [{ description: "AGO Diesel (Litres)", qty: 50000, unitPrice: 14.5, amount: 725000 }],
      subtotal: 725000, tax: 0, total: 725000, currency: "GHS",
      notes: "Monthly fuel supply for Tarkwa site", createdBy: yawUser.id,
    },
  });
  await prisma.purchaseOrder.create({
    data: {
      workspaceId: ws.id, number: "PO-2026-003", vendorId: vendor3.id,
      title: "Site Catering Services - April",
      status: POStatus.APPROVED, issueDate: new Date("2026-04-01"), deliveryDate: new Date("2026-04-30"),
      lines: [{ description: "Daily meals - 50 personnel x 30 days", qty: 1500, unitPrice: 55, amount: 82500 }],
      subtotal: 82500, tax: 0, total: 82500, currency: "GHS",
      createdBy: yawUser.id,
    },
  });
  await prisma.purchaseOrder.create({
    data: {
      workspaceId: ws.id, number: "PO-2026-004", vendorId: vendor4.id,
      title: "PPE Restock - Q2",
      status: POStatus.SUBMITTED, issueDate: new Date("2026-04-10"),
      lines: [{ description: "Hard Hats (Type II)", qty: 50, unitPrice: 85, amount: 4250 }, { description: "Safety Boots (size assorted)", qty: 30, unitPrice: 220, amount: 6600 }, { description: "Cut-resistant gloves (pairs)", qty: 200, unitPrice: 35, amount: 7000 }],
      subtotal: 17850, tax: 2677.5, total: 20527.5, currency: "GHS",
      notes: "Q2 PPE replenishment following HSE audit", createdBy: abenaUser.id,
    },
  });
  await prisma.purchaseOrder.create({
    data: {
      workspaceId: ws.id, number: "PO-2026-005", vendorId: vendor1.id,
      title: "Grader Blade Set Replacement",
      status: POStatus.DRAFT, issueDate: new Date("2026-04-15"),
      lines: [{ description: "Motor Grader Blade Set - 6-way", qty: 2, unitPrice: 8500, amount: 17000 }],
      subtotal: 17000, tax: 2550, total: 19550, currency: "GHS",
      createdBy: adminUser.id,
    },
  });

  // Goods receipt for PO1
  await prisma.goodsReceipt.create({
    data: {
      workspaceId: ws.id, purchaseOrderId: po1.id, number: "GRN-2026-001",
      receivedDate: new Date("2026-04-09"), receivedBy: emp2.id,
      lines: [{ description: "CAT 785 Engine Filter Set", qty: 4, unitPrice: 1850, amount: 7400 }, { description: "Hydraulic Hose Assembly", qty: 6, unitPrice: 620, amount: 3720 }],
      notes: "All items received in good condition. Stored in workshop cage.",
    },
  });

  // --- Chart of Accounts (Ghana-style) ---
  const coa: { code: string; name: string; type: AccountType; parentCode?: string }[] = [
    // Assets
    { code: "1000", name: "Assets", type: AccountType.ASSET },
    { code: "1100", name: "Current Assets", type: AccountType.ASSET, parentCode: "1000" },
    { code: "1110", name: "Cash at Bank - GCB Main", type: AccountType.ASSET, parentCode: "1100" },
    { code: "1120", name: "Cash at Bank - Ecobank", type: AccountType.ASSET, parentCode: "1100" },
    { code: "1130", name: "Petty Cash", type: AccountType.ASSET, parentCode: "1100" },
    { code: "1200", name: "Accounts Receivable", type: AccountType.ASSET, parentCode: "1100" },
    { code: "1300", name: "Inventory & Stores", type: AccountType.ASSET, parentCode: "1100" },
    { code: "1500", name: "Fixed Assets", type: AccountType.ASSET, parentCode: "1000" },
    { code: "1510", name: "Plant & Equipment", type: AccountType.ASSET, parentCode: "1500" },
    { code: "1520", name: "Motor Vehicles", type: AccountType.ASSET, parentCode: "1500" },
    // Liabilities
    { code: "2000", name: "Liabilities", type: AccountType.LIABILITY },
    { code: "2100", name: "Current Liabilities", type: AccountType.LIABILITY, parentCode: "2000" },
    { code: "2110", name: "Accounts Payable", type: AccountType.LIABILITY, parentCode: "2100" },
    { code: "2120", name: "VAT Payable", type: AccountType.LIABILITY, parentCode: "2100" },
    { code: "2130", name: "PAYE Payable", type: AccountType.LIABILITY, parentCode: "2100" },
    { code: "2140", name: "SSNIT Payable", type: AccountType.LIABILITY, parentCode: "2100" },
    // Equity
    { code: "3000", name: "Equity", type: AccountType.EQUITY },
    { code: "3100", name: "Share Capital", type: AccountType.EQUITY, parentCode: "3000" },
    { code: "3200", name: "Retained Earnings", type: AccountType.EQUITY, parentCode: "3000" },
    // Revenue
    { code: "4000", name: "Revenue", type: AccountType.REVENUE },
    { code: "4100", name: "Contract Revenue", type: AccountType.REVENUE, parentCode: "4000" },
    { code: "4200", name: "Equipment Hire Income", type: AccountType.REVENUE, parentCode: "4000" },
    // Expenses
    { code: "5000", name: "Expenses", type: AccountType.EXPENSE },
    { code: "5100", name: "Personnel Costs", type: AccountType.EXPENSE, parentCode: "5000" },
    { code: "5110", name: "Salaries & Wages", type: AccountType.EXPENSE, parentCode: "5100" },
    { code: "5120", name: "SSNIT Contributions", type: AccountType.EXPENSE, parentCode: "5100" },
    { code: "5200", name: "Fuel & Lubricants", type: AccountType.EXPENSE, parentCode: "5000" },
    { code: "5300", name: "Repairs & Maintenance", type: AccountType.EXPENSE, parentCode: "5000" },
    { code: "5400", name: "Subcontractor Costs", type: AccountType.EXPENSE, parentCode: "5000" },
    { code: "5500", name: "Site Overheads", type: AccountType.EXPENSE, parentCode: "5000" },
    { code: "5600", name: "Safety & PPE", type: AccountType.EXPENSE, parentCode: "5000" },
    { code: "5700", name: "Administration", type: AccountType.EXPENSE, parentCode: "5000" },
  ];

  // Create accounts in order (parents first)
  const coaMap: Record<string, string> = {}; // code -> id
  for (const acct of coa) {
    const created = await prisma.account_GL.create({
      data: {
        workspaceId: ws.id,
        code: acct.code,
        name: acct.name,
        type: acct.type,
        parentId: acct.parentCode ? coaMap[acct.parentCode] : undefined,
      },
    });
    coaMap[acct.code] = created.id;
  }

  // --- Bank Accounts ---
  await prisma.bankAccount.createMany({
    data: [
      { workspaceId: ws.id, name: "GCB Main Account", bankName: "Ghana Commercial Bank", accountNumber: "1441001234567", currency: "GHS", balance: 1240000 },
      { workspaceId: ws.id, name: "Ecobank Operations", bankName: "Ecobank Ghana", accountNumber: "0010345678901", currency: "GHS", balance: 380000 },
      { workspaceId: ws.id, name: "Petty Cash", bankName: "On-Site Cash", accountNumber: "CASH-001", currency: "GHS", balance: 5000 },
    ],
  });

  // --- Budget ---
  await prisma.budget.create({
    data: {
      workspaceId: ws.id,
      name: "FY 2026 Operating Budget",
      year: 2026,
      status: BudgetStatus.ACTIVE,
      totalAmount: 8500000,
      lines: [
        { month: "January", category: "Personnel Costs", budgeted: 340000, actual: 338500 },
        { month: "January", category: "Fuel & Lubricants", budgeted: 720000, actual: 698000 },
        { month: "January", category: "Repairs & Maintenance", budgeted: 85000, actual: 92000 },
        { month: "January", category: "Site Overheads", budgeted: 120000, actual: 118000 },
        { month: "February", category: "Personnel Costs", budgeted: 340000, actual: 341200 },
        { month: "February", category: "Fuel & Lubricants", budgeted: 720000, actual: 710000 },
        { month: "February", category: "Repairs & Maintenance", budgeted: 85000, actual: 78000 },
        { month: "February", category: "Site Overheads", budgeted: 120000, actual: 122500 },
        { month: "March", category: "Personnel Costs", budgeted: 340000, actual: 342000 },
        { month: "March", category: "Fuel & Lubricants", budgeted: 720000, actual: 735000 },
        { month: "March", category: "Repairs & Maintenance", budgeted: 85000, actual: 89000 },
        { month: "March", category: "Site Overheads", budgeted: 120000, actual: 119000 },
      ],
      createdBy: yawUser.id,
    },
  });

  // --- Approval Flow ---
  const approvalFlow = await prisma.approvalFlow.create({
    data: {
      workspaceId: ws.id,
      name: "Purchase Order Approval",
      entityType: "PurchaseOrder",
      flowType: FlowType.SEQUENTIAL,
      steps: [
        { step: 1, role: "Finance Manager", action: "APPROVE" },
        { step: 2, role: "Owner", action: "APPROVE", threshold: 100000 },
      ],
      isActive: true,
    },
  });

  // --- Audit Logs ---
  await prisma.auditLog.createMany({
    data: [
      { workspaceId: ws.id, userId: adminUser.id, entityType: "Workspace", entityId: ws.id, action: "CREATE", afterState: { name: "Obuasi Mining Services Ltd" }, ipAddress: "196.168.1.10" },
      { workspaceId: ws.id, userId: adminUser.id, entityType: "Project", entityId: proj1.id, action: "CREATE", afterState: { name: "Tarkwa Site Mobilization" }, ipAddress: "196.168.1.10" },
      { workspaceId: ws.id, userId: yawUser.id, entityType: "PurchaseOrder", entityId: po1.id, action: "STATUS_CHANGE", beforeState: { status: "SUBMITTED" }, afterState: { status: "APPROVED" }, ipAddress: "196.168.1.15" },
      { workspaceId: ws.id, userId: abenaUser.id, entityType: "Incident", entityId: (await prisma.incident.findFirst({ where: { workspaceId: ws.id } }))!.id, action: "STATUS_CHANGE", beforeState: { status: "REPORTED" }, afterState: { status: "CLOSED" }, ipAddress: "196.168.1.12" },
    ],
  });

  console.log("  Obuasi Mining Services Ltd seeded.");
  return ws;
}

// ---------------------------------------------------------------------------
// WORKSPACE 2: Horizon Foundation Ghana
// ---------------------------------------------------------------------------

async function seedHorizonFoundation(permMap: Record<string, string>) {
  console.log("\n  [2/3] Seeding Horizon Foundation Ghana...");

  const pwHash = await hashPassword(DEMO_PASSWORD);

  const ws = await prisma.workspace.create({
    data: {
      name: "Horizon Foundation Ghana",
      slug: "horizon-foundation",
      legalName: "Horizon Foundation Ghana (Registered)",
      businessType: BusinessType.NGO,
      country: "GH",
      currency: "GHS",
      fiscalYearStart: 1,
      timezone: "Africa/Accra",
      modules: ["people", "projects", "meetings", "documents", "approvals", "finance", "budget", "procurement", "grants", "reports"],
    },
  });

  // Users
  const adminUser = await prisma.user.create({ data: { email: "admin@horizon-ghana.org", name: "Ama Darko", passwordHash: pwHash, emailVerified: new Date() } });
  const user2 = await prisma.user.create({ data: { email: "kwesi.appiah@horizon-ghana.org", name: "Kwesi Appiah", passwordHash: pwHash, emailVerified: new Date() } });
  const user3 = await prisma.user.create({ data: { email: "senam.fiagbe@horizon-ghana.org", name: "Senam Fiagbe", passwordHash: pwHash, emailVerified: new Date() } });

  // Roles
  const ownerRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Owner", description: "Executive Director", isSystem: true } });
  const adminRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Program Manager", description: "Manages programs and projects" } });
  const meRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "M&E Officer", description: "Monitoring and Evaluation" } });
  const finRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Finance Officer", description: "Financial management" } });
  const staffRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Program Staff", description: "Program implementation staff" } });

  const ngoModules = ["people", "projects", "meetings", "documents", "approvals", "finance", "budget", "procurement", "grants", "reports"];
  await assignPermissions(ownerRole.id, allPermsForModules([...ngoModules, "workspace", "admin"]), permMap);
  await assignPermissions(adminRole.id, allPermsForModules(["projects", "people", "meetings", "documents", "reports", "grants"]), permMap);
  await assignPermissions(meRole.id, allPermsForModules(["projects", "reports", "documents", "meetings"]), permMap);
  await assignPermissions(finRole.id, allPermsForModules(["finance", "budget", "procurement", "reports", "documents"]), permMap);
  await assignPermissions(staffRole.id, viewPermsForModules(["projects", "meetings", "documents"]), permMap);

  // Memberships
  await prisma.membership.create({ data: { userId: adminUser.id, workspaceId: ws.id, roleId: ownerRole.id, isOwner: true } });
  await prisma.membership.create({ data: { userId: user2.id, workspaceId: ws.id, roleId: adminRole.id } });
  await prisma.membership.create({ data: { userId: user3.id, workspaceId: ws.id, roleId: finRole.id } });

  // Departments
  const deptPrograms = await prisma.department.create({ data: { workspaceId: ws.id, name: "Programs" } });
  const deptME = await prisma.department.create({ data: { workspaceId: ws.id, name: "M&E" } });
  const deptFinance = await prisma.department.create({ data: { workspaceId: ws.id, name: "Finance" } });
  const deptAdmin = await prisma.department.create({ data: { workspaceId: ws.id, name: "Administration" } });

  // Employees
  const emp1 = await prisma.employee.create({
    data: {
      workspaceId: ws.id, userId: adminUser.id, employeeNumber: "HFG-001",
      firstName: "Ama", lastName: "Darko", email: "admin@horizon-ghana.org",
      phone: "+233244200001", jobTitle: "Executive Director",
      departmentId: deptAdmin.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2018-04-01"), status: EmployeeStatus.ACTIVE, basicSalary: 14000,
    },
  });
  const emp2 = await prisma.employee.create({
    data: {
      workspaceId: ws.id, userId: user2.id, employeeNumber: "HFG-002",
      firstName: "Kwesi", lastName: "Appiah", email: "kwesi.appiah@horizon-ghana.org",
      phone: "+233244200002", jobTitle: "Program Manager",
      departmentId: deptPrograms.id, managerId: emp1.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2019-09-01"), status: EmployeeStatus.ACTIVE, basicSalary: 9500,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, userId: user3.id, employeeNumber: "HFG-003",
      firstName: "Senam", lastName: "Fiagbe", email: "senam.fiagbe@horizon-ghana.org",
      phone: "+233244200003", jobTitle: "Finance Officer",
      departmentId: deptFinance.id, managerId: emp1.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2020-03-15"), status: EmployeeStatus.ACTIVE, basicSalary: 7500,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "HFG-004",
      firstName: "Adjoa", lastName: "Quaye", email: "adjoa.quaye@horizon-ghana.org",
      phone: "+233244200004", jobTitle: "M&E Officer",
      departmentId: deptME.id, managerId: emp2.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2021-06-01"), status: EmployeeStatus.ACTIVE, basicSalary: 6500,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "HFG-005",
      firstName: "Kobby", lastName: "Amoah", email: "kobby.amoah@horizon-ghana.org",
      phone: "+233244200005", jobTitle: "Program Officer - Education",
      departmentId: deptPrograms.id, managerId: emp2.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2021-11-01"), status: EmployeeStatus.ACTIVE, basicSalary: 6000,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "HFG-006",
      firstName: "Gifty", lastName: "Bediako", email: "gifty.bediako@horizon-ghana.org",
      phone: "+233244200006", jobTitle: "Community Liaison Officer",
      departmentId: deptPrograms.id, managerId: emp2.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2022-04-01"), status: EmployeeStatus.ACTIVE, basicSalary: 5500,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "HFG-007",
      firstName: "Ato", lastName: "Koomson", email: "ato.koomson@horizon-ghana.org",
      phone: "+233244200007", jobTitle: "Admin Officer",
      departmentId: deptAdmin.id, managerId: emp1.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2023-02-01"), status: EmployeeStatus.ACTIVE, basicSalary: 5000,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "HFG-008",
      firstName: "Dede", lastName: "Tetteh", email: "dede.tetteh@horizon-ghana.org",
      phone: "+233244200008", jobTitle: "Field Officer",
      departmentId: deptPrograms.id, managerId: emp2.id, employmentType: EmploymentType.CONTRACT,
      startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), status: EmployeeStatus.ACTIVE, basicSalary: 4800,
    },
  });

  // Projects
  const proj1 = await prisma.project.create({
    data: {
      workspaceId: ws.id, name: "Girls Education Northern Region",
      description: "3-year program to increase girls' enrolment and retention in JHS schools across Northern Region. Funded by USAID.",
      status: ProjectStatus.ACTIVE, priority: Priority.HIGH,
      startDate: new Date("2025-01-01"), endDate: new Date("2027-12-31"),
      budget: 2400000, ownerId: emp2.id, createdBy: adminUser.id,
    },
  });
  const proj2 = await prisma.project.create({
    data: {
      workspaceId: ws.id, name: "Community Health Outreach",
      description: "Mobile health clinics serving underserved communities in Brong-Ahafo region. GHS-funded pilot.",
      status: ProjectStatus.ACTIVE, priority: Priority.HIGH,
      startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"),
      budget: 450000, ownerId: emp2.id, createdBy: adminUser.id,
    },
  });

  // Tasks
  await prisma.task.createMany({
    data: [
      { workspaceId: ws.id, projectId: proj1.id, title: "Baseline survey data collection", status: TaskStatus.DONE, priority: Priority.HIGH, assigneeId: emp1.id, dueDate: new Date("2025-04-30"), estimatedHours: 80, actualHours: 85, position: 0, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Recruit and train female mentors", status: TaskStatus.DONE, priority: Priority.HIGH, assigneeId: emp2.id, dueDate: new Date("2025-09-30"), estimatedHours: 40, actualHours: 44, position: 1, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Q1 2026 school visits and data collection", status: TaskStatus.DONE, priority: Priority.MEDIUM, dueDate: new Date("2026-03-31"), estimatedHours: 60, actualHours: 58, position: 2, createdBy: user2.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Mid-term evaluation preparation", status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assigneeId: emp1.id, dueDate: new Date("2026-06-30"), estimatedHours: 48, position: 3, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Scholarship disbursement - 250 girls", status: TaskStatus.TODO, priority: Priority.URGENT, dueDate: new Date("2026-05-15"), estimatedHours: 24, position: 4, createdBy: user2.id },
    ],
  });
  await prisma.task.createMany({
    data: [
      { workspaceId: ws.id, projectId: proj2.id, title: "Procure mobile clinic equipment", status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assigneeId: emp2.id, dueDate: new Date("2026-04-30"), estimatedHours: 32, position: 0, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj2.id, title: "Community health worker training", status: TaskStatus.TODO, priority: Priority.HIGH, dueDate: new Date("2026-05-15"), estimatedHours: 40, position: 1, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj2.id, title: "First outreach - Techiman South", status: TaskStatus.TODO, priority: Priority.MEDIUM, dueDate: new Date("2026-06-01"), estimatedHours: 48, position: 2, createdBy: user2.id },
    ],
  });

  // Meetings
  await prisma.meeting.createMany({
    data: [
      {
        workspaceId: ws.id, projectId: proj1.id,
        title: "Q1 2026 Program Review - Girls Education",
        description: "Quarterly review of program activities and outcomes",
        startTime: new Date("2026-04-10T10:00:00Z"), endTime: new Date("2026-04-10T12:00:00Z"),
        location: "Horizon Foundation Accra Office",
        status: MeetingStatus.COMPLETED,
        attendees: [adminUser.id, user2.id, user3.id],
        agenda: [{ item: "Q1 enrolment statistics" }, { item: "Mentor program feedback" }, { item: "Q2 activities plan" }],
        minutes: "Q1 saw 847 girls enrolled vs target of 800. Mentor feedback positive. Scholarship disbursement scheduled for May.",
        decisions: [{ decision: "Approve Q2 field budget of GHS 45,000" }],
        createdBy: adminUser.id,
      },
      {
        workspaceId: ws.id,
        title: "Donor Reporting Preparation - USAID",
        description: "Prepare Q1 donor report for USAID submission",
        startTime: new Date("2026-04-28T09:00:00Z"), endTime: new Date("2026-04-28T11:00:00Z"),
        location: "Online - Zoom",
        status: MeetingStatus.SCHEDULED,
        attendees: [adminUser.id, user2.id, user3.id],
        agenda: [{ item: "Results framework update" }, { item: "Financial report review" }, { item: "Narrative report drafting" }],
        createdBy: adminUser.id,
      },
    ],
  });

  // Documents
  const grantFolder = await prisma.folder.create({ data: { workspaceId: ws.id, name: "Grant Documents", createdBy: adminUser.id } });
  const policyFolder = await prisma.folder.create({ data: { workspaceId: ws.id, name: "Policies & SOPs", createdBy: adminUser.id } });

  await prisma.document.createMany({
    data: [
      { workspaceId: ws.id, folderId: grantFolder.id, title: "USAID Grant Agreement - Girls Education", docType: DocumentType.CONTRACT, status: DocumentStatus.PUBLISHED, version: 1, content: "Grant agreement between Horizon Foundation Ghana and USAID for the Girls Education Northern Region project...", createdBy: adminUser.id },
      { workspaceId: ws.id, folderId: grantFolder.id, title: "Q1 2026 USAID Quarterly Report", docType: DocumentType.REPORT, status: DocumentStatus.IN_REVIEW, version: 1, content: "This report covers program activities from January 1 to March 31, 2026...", createdBy: user2.id },
      { workspaceId: ws.id, folderId: policyFolder.id, title: "Safeguarding Policy", docType: DocumentType.POLICY, status: DocumentStatus.PUBLISHED, version: 2, content: "Horizon Foundation Ghana is committed to the highest standards of safeguarding...", createdBy: adminUser.id },
      { workspaceId: ws.id, title: "Community Health Outreach - Project Proposal", docType: DocumentType.GENERAL, status: DocumentStatus.APPROVED, version: 1, content: "Project proposal for the Community Health Outreach program in Brong-Ahafo...", createdBy: user2.id },
    ],
  });

  // Budget
  await prisma.budget.create({
    data: {
      workspaceId: ws.id,
      name: "FY 2026 Organisational Budget",
      year: 2026,
      status: BudgetStatus.ACTIVE,
      totalAmount: 3200000,
      lines: [
        { month: "January", category: "Personnel", budgeted: 95000, actual: 95000 },
        { month: "January", category: "Program Activities", budgeted: 180000, actual: 167000 },
        { month: "January", category: "Administration", budgeted: 25000, actual: 26500 },
        { month: "February", category: "Personnel", budgeted: 95000, actual: 95000 },
        { month: "February", category: "Program Activities", budgeted: 180000, actual: 192000 },
        { month: "February", category: "Administration", budgeted: 25000, actual: 24200 },
        { month: "March", category: "Personnel", budgeted: 95000, actual: 95000 },
        { month: "March", category: "Program Activities", budgeted: 180000, actual: 178500 },
        { month: "March", category: "Administration", budgeted: 25000, actual: 27000 },
      ],
      createdBy: user3.id,
    },
  });

  // Audit logs
  await prisma.auditLog.createMany({
    data: [
      { workspaceId: ws.id, userId: adminUser.id, entityType: "Workspace", entityId: ws.id, action: "CREATE", afterState: { name: "Horizon Foundation Ghana" } },
      { workspaceId: ws.id, userId: adminUser.id, entityType: "Project", entityId: proj1.id, action: "CREATE", afterState: { name: "Girls Education Northern Region" } },
      { workspaceId: ws.id, userId: user2.id, entityType: "Project", entityId: proj2.id, action: "STATUS_CHANGE", beforeState: { status: "PLANNING" }, afterState: { status: "ACTIVE" } },
    ],
  });

  console.log("  Horizon Foundation Ghana seeded.");
  return ws;
}

// ---------------------------------------------------------------------------
// WORKSPACE 3: Kobo Labs
// ---------------------------------------------------------------------------

async function seedKoboLabs(permMap: Record<string, string>) {
  console.log("\n  [3/3] Seeding Kobo Labs...");

  const pwHash = await hashPassword(DEMO_PASSWORD);

  const ws = await prisma.workspace.create({
    data: {
      name: "Kobo Labs",
      slug: "kobo-labs",
      legalName: "Kobo Labs Ltd",
      businessType: BusinessType.STARTUP,
      country: "GH",
      currency: "GHS",
      fiscalYearStart: 1,
      timezone: "Africa/Accra",
      modules: ["people", "projects", "meetings", "documents", "approvals", "finance", "budget", "crm", "reports"],
    },
  });

  // Users
  const adminUser = await prisma.user.create({ data: { email: "admin@kobolabs.com", name: "Kofi Mensah", passwordHash: pwHash, emailVerified: new Date() } });
  const user2 = await prisma.user.create({ data: { email: "ama.boateng@kobolabs.com", name: "Ama Boateng", passwordHash: pwHash, emailVerified: new Date() } });
  const user3 = await prisma.user.create({ data: { email: "kwame.antwi@kobolabs.com", name: "Kwame Antwi", passwordHash: pwHash, emailVerified: new Date() } });

  // Roles
  const ownerRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Owner", description: "Founder / CEO", isSystem: true } });
  const adminRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Administrator", isSystem: true, description: "Admin access" } });
  const engineerRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Engineer", description: "Software engineer" } });
  const productRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Product Manager", description: "Product management" } });
  const growthRole = await prisma.role.create({ data: { workspaceId: ws.id, name: "Growth", description: "Growth & Marketing" } });

  const startupModules = ["people", "projects", "meetings", "documents", "approvals", "finance", "budget", "crm", "reports"];
  await assignPermissions(ownerRole.id, allPermsForModules([...startupModules, "workspace", "admin"]), permMap);
  await assignPermissions(adminRole.id, allPermsForModules([...startupModules, "workspace", "admin"]), permMap);
  await assignPermissions(engineerRole.id, allPermsForModules(["projects", "meetings", "documents"]), permMap);
  await assignPermissions(productRole.id, allPermsForModules(["projects", "meetings", "documents", "crm", "reports"]), permMap);
  await assignPermissions(growthRole.id, allPermsForModules(["crm", "reports", "meetings", "documents"]), permMap);

  // Memberships
  await prisma.membership.create({ data: { userId: adminUser.id, workspaceId: ws.id, roleId: ownerRole.id, isOwner: true } });
  await prisma.membership.create({ data: { userId: user2.id, workspaceId: ws.id, roleId: productRole.id } });
  await prisma.membership.create({ data: { userId: user3.id, workspaceId: ws.id, roleId: engineerRole.id } });

  // Departments
  const deptEng = await prisma.department.create({ data: { workspaceId: ws.id, name: "Engineering" } });
  const deptProduct = await prisma.department.create({ data: { workspaceId: ws.id, name: "Product" } });
  const deptGrowth = await prisma.department.create({ data: { workspaceId: ws.id, name: "Growth & Marketing" } });

  // Employees
  const emp1 = await prisma.employee.create({
    data: {
      workspaceId: ws.id, userId: adminUser.id, employeeNumber: "KL-001",
      firstName: "Kofi", lastName: "Mensah", email: "admin@kobolabs.com",
      phone: "+233244300001", jobTitle: "CEO & Co-Founder",
      departmentId: deptProduct.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2022-09-01"), status: EmployeeStatus.ACTIVE, basicSalary: 12000,
    },
  });
  const emp2 = await prisma.employee.create({
    data: {
      workspaceId: ws.id, userId: user2.id, employeeNumber: "KL-002",
      firstName: "Ama", lastName: "Boateng", email: "ama.boateng@kobolabs.com",
      phone: "+233244300002", jobTitle: "Head of Product",
      departmentId: deptProduct.id, managerId: emp1.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2022-09-01"), status: EmployeeStatus.ACTIVE, basicSalary: 9000,
    },
  });
  const emp3 = await prisma.employee.create({
    data: {
      workspaceId: ws.id, userId: user3.id, employeeNumber: "KL-003",
      firstName: "Kwame", lastName: "Antwi", email: "kwame.antwi@kobolabs.com",
      phone: "+233244300003", jobTitle: "Lead Engineer",
      departmentId: deptEng.id, managerId: emp1.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2022-10-15"), status: EmployeeStatus.ACTIVE, basicSalary: 10000,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "KL-004",
      firstName: "Nana", lastName: "Agyekum", email: "nana.agyekum@kobolabs.com",
      phone: "+233244300004", jobTitle: "Backend Engineer",
      departmentId: deptEng.id, managerId: emp3.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2023-04-01"), status: EmployeeStatus.ACTIVE, basicSalary: 8000,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "KL-005",
      firstName: "Abena", lastName: "Asante", email: "abena.asante@kobolabs.com",
      phone: "+233244300005", jobTitle: "Growth Manager",
      departmentId: deptGrowth.id, managerId: emp1.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2023-07-01"), status: EmployeeStatus.ACTIVE, basicSalary: 7000,
    },
  });
  await prisma.employee.create({
    data: {
      workspaceId: ws.id, employeeNumber: "KL-006",
      firstName: "Yaw", lastName: "Osei", email: "yaw.osei@kobolabs.com",
      phone: "+233244300006", jobTitle: "Frontend Engineer",
      departmentId: deptEng.id, managerId: emp3.id, employmentType: EmploymentType.FULL_TIME,
      startDate: new Date("2024-01-08"), status: EmployeeStatus.ACTIVE, basicSalary: 7500,
    },
  });

  // Projects
  const proj1 = await prisma.project.create({
    data: {
      workspaceId: ws.id, name: "Mobile App v2.0",
      description: "Major rebuild of the Kobo mobile app with offline-first architecture and new UX.",
      status: ProjectStatus.ACTIVE, priority: Priority.HIGH,
      startDate: new Date("2026-02-01"), endDate: new Date("2026-07-31"),
      budget: 180000, ownerId: emp2.id, createdBy: adminUser.id,
    },
  });
  const proj2 = await prisma.project.create({
    data: {
      workspaceId: ws.id, name: "API Integration Platform",
      description: "Build a developer-facing API platform for third-party integrations.",
      status: ProjectStatus.ACTIVE, priority: Priority.HIGH,
      startDate: new Date("2026-03-01"), endDate: new Date("2026-09-30"),
      budget: 120000, ownerId: emp3.id, createdBy: adminUser.id,
    },
  });
  const proj3 = await prisma.project.create({
    data: {
      workspaceId: ws.id, name: "Growth Campaign Q2",
      description: "Multi-channel growth campaign targeting SMEs in Accra and Kumasi.",
      status: ProjectStatus.ACTIVE, priority: Priority.MEDIUM,
      startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30"),
      budget: 55000, ownerId: emp1.id, createdBy: adminUser.id,
    },
  });

  // Tasks
  await prisma.task.createMany({
    data: [
      { workspaceId: ws.id, projectId: proj1.id, title: "Figma prototype - new onboarding", status: TaskStatus.DONE, priority: Priority.HIGH, assigneeId: emp2.id, dueDate: new Date("2026-02-28"), estimatedHours: 24, actualHours: 20, position: 0, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Setup offline sync architecture", status: TaskStatus.DONE, priority: Priority.HIGH, assigneeId: emp3.id, dueDate: new Date("2026-03-15"), estimatedHours: 40, actualHours: 45, position: 1, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Implement dashboard screens", status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assigneeId: emp3.id, dueDate: new Date("2026-04-25"), estimatedHours: 32, position: 2, createdBy: emp2.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Push notification integration", status: TaskStatus.IN_REVIEW, priority: Priority.MEDIUM, dueDate: new Date("2026-04-30"), estimatedHours: 16, position: 3, createdBy: emp2.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "Beta testing with 50 users", status: TaskStatus.TODO, priority: Priority.HIGH, assigneeId: emp2.id, dueDate: new Date("2026-05-31"), estimatedHours: 20, position: 4, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj1.id, title: "App Store submission", status: TaskStatus.TODO, priority: Priority.MEDIUM, dueDate: new Date("2026-07-15"), estimatedHours: 8, position: 5, createdBy: adminUser.id },
    ],
  });
  await prisma.task.createMany({
    data: [
      { workspaceId: ws.id, projectId: proj2.id, title: "API design and documentation", status: TaskStatus.DONE, priority: Priority.HIGH, assigneeId: emp3.id, dueDate: new Date("2026-03-31"), estimatedHours: 24, actualHours: 26, position: 0, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj2.id, title: "Authentication & rate limiting", status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assigneeId: emp3.id, dueDate: new Date("2026-04-30"), estimatedHours: 32, position: 1, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj2.id, title: "Developer portal frontend", status: TaskStatus.TODO, priority: Priority.MEDIUM, dueDate: new Date("2026-05-31"), estimatedHours: 40, position: 2, createdBy: emp2.id },
      { workspaceId: ws.id, projectId: proj2.id, title: "Sandbox environment setup", status: TaskStatus.TODO, priority: Priority.HIGH, dueDate: new Date("2026-06-15"), estimatedHours: 20, position: 3, createdBy: emp3.id },
    ],
  });
  await prisma.task.createMany({
    data: [
      { workspaceId: ws.id, projectId: proj3.id, title: "Define ICP and messaging", status: TaskStatus.DONE, priority: Priority.HIGH, dueDate: new Date("2026-04-07"), estimatedHours: 12, actualHours: 10, position: 0, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj3.id, title: "Social media ad creatives", status: TaskStatus.IN_PROGRESS, priority: Priority.MEDIUM, dueDate: new Date("2026-04-25"), estimatedHours: 16, position: 1, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj3.id, title: "Partner with 10 Accra SME hubs", status: TaskStatus.TODO, priority: Priority.HIGH, dueDate: new Date("2026-05-15"), estimatedHours: 20, position: 2, createdBy: adminUser.id },
      { workspaceId: ws.id, projectId: proj3.id, title: "Referral program launch", status: TaskStatus.TODO, priority: Priority.MEDIUM, dueDate: new Date("2026-06-01"), estimatedHours: 16, position: 3, createdBy: adminUser.id },
    ],
  });

  // Meetings
  await prisma.meeting.createMany({
    data: [
      {
        workspaceId: ws.id, projectId: proj1.id,
        title: "Mobile App v2.0 Sprint Review",
        description: "Sprint 6 review and sprint 7 planning",
        startTime: new Date("2026-04-15T09:00:00Z"), endTime: new Date("2026-04-15T10:30:00Z"),
        location: "Kobo Labs HQ - Osu, Accra",
        status: MeetingStatus.COMPLETED,
        attendees: [adminUser.id, user2.id, user3.id],
        agenda: [{ item: "Sprint 6 demo" }, { item: "Velocity review" }, { item: "Sprint 7 backlog refinement" }],
        minutes: "Sprint 6 delivered dashboard screens and push notification module. Team velocity at 42 points. Sprint 7 focus: beta testing prep.",
        decisions: [{ decision: "Launch beta to 50 users by May 31" }],
        createdBy: user2.id,
      },
      {
        workspaceId: ws.id,
        title: "All-hands - April 2026",
        description: "Monthly company all-hands meeting",
        startTime: new Date("2026-04-28T16:00:00Z"), endTime: new Date("2026-04-28T17:00:00Z"),
        location: "Online - Google Meet",
        status: MeetingStatus.SCHEDULED,
        attendees: [adminUser.id, user2.id, user3.id],
        agenda: [{ item: "Company update" }, { item: "Product roadmap" }, { item: "Q&A" }],
        createdBy: adminUser.id,
      },
      {
        workspaceId: ws.id, projectId: proj3.id,
        title: "Q2 Growth Campaign Kickoff",
        description: "Kickoff the Q2 growth campaign planning",
        startTime: new Date("2026-04-02T14:00:00Z"), endTime: new Date("2026-04-02T15:00:00Z"),
        location: "Kobo Labs HQ",
        status: MeetingStatus.COMPLETED,
        attendees: [adminUser.id, user2.id],
        agenda: [{ item: "Campaign objectives" }, { item: "Channel strategy" }, { item: "Budget allocation" }],
        minutes: "Campaign objectives set: 500 new sign-ups in Q2. Focus channels: Meta Ads, WhatsApp, SME partnerships.",
        decisions: [{ decision: "Approve GHS 30,000 initial campaign spend" }],
        createdBy: adminUser.id,
      },
    ],
  });

  // Documents
  const engFolder = await prisma.folder.create({ data: { workspaceId: ws.id, name: "Engineering", createdBy: user3.id } });
  const productFolder = await prisma.folder.create({ data: { workspaceId: ws.id, name: "Product", createdBy: user2.id } });

  await prisma.document.createMany({
    data: [
      { workspaceId: ws.id, folderId: engFolder.id, title: "API Design Guidelines", docType: DocumentType.SOP, status: DocumentStatus.PUBLISHED, version: 1, content: "This document outlines the standards for API design at Kobo Labs...", createdBy: user3.id },
      { workspaceId: ws.id, folderId: productFolder.id, title: "Mobile App v2.0 PRD", docType: DocumentType.GENERAL, status: DocumentStatus.APPROVED, version: 2, content: "Product Requirements Document for Kobo Mobile App v2.0...", createdBy: user2.id },
      { workspaceId: ws.id, title: "Q2 2026 Growth Strategy", docType: DocumentType.REPORT, status: DocumentStatus.DRAFT, version: 1, content: "Growth strategy document for Q2 2026 covering Accra and Kumasi markets...", createdBy: adminUser.id },
    ],
  });

  // Budget
  await prisma.budget.create({
    data: {
      workspaceId: ws.id,
      name: "Q2 2026 Budget",
      year: 2026,
      status: BudgetStatus.ACTIVE,
      totalAmount: 420000,
      lines: [
        { month: "April", category: "Engineering", budgeted: 65000, actual: 63000 },
        { month: "April", category: "Product", budgeted: 25000, actual: 24500 },
        { month: "April", category: "Growth & Marketing", budgeted: 38000, actual: 32000 },
        { month: "April", category: "Operations", budgeted: 12000, actual: 12200 },
        { month: "May", category: "Engineering", budgeted: 65000 },
        { month: "May", category: "Product", budgeted: 25000 },
        { month: "May", category: "Growth & Marketing", budgeted: 42000 },
        { month: "May", category: "Operations", budgeted: 12000 },
        { month: "June", category: "Engineering", budgeted: 65000 },
        { month: "June", category: "Product", budgeted: 25000 },
        { month: "June", category: "Growth & Marketing", budgeted: 30000 },
        { month: "June", category: "Operations", budgeted: 11000 },
      ],
      createdBy: adminUser.id,
    },
  });

  // Approval Flow
  await prisma.approvalFlow.create({
    data: {
      workspaceId: ws.id,
      name: "Expense Approval",
      entityType: "Expense",
      flowType: FlowType.SINGLE,
      steps: [{ step: 1, role: "Owner", action: "APPROVE" }],
      isActive: true,
    },
  });

  // Audit logs
  await prisma.auditLog.createMany({
    data: [
      { workspaceId: ws.id, userId: adminUser.id, entityType: "Workspace", entityId: ws.id, action: "CREATE", afterState: { name: "Kobo Labs" } },
      { workspaceId: ws.id, userId: adminUser.id, entityType: "Project", entityId: proj1.id, action: "CREATE", afterState: { name: "Mobile App v2.0" } },
      { workspaceId: ws.id, userId: user2.id, entityType: "Project", entityId: proj1.id, action: "UPDATE", beforeState: { status: "PLANNING" }, afterState: { status: "ACTIVE" } },
      { workspaceId: ws.id, userId: adminUser.id, entityType: "Project", entityId: proj3.id, action: "CREATE", afterState: { name: "Growth Campaign Q2" } },
    ],
  });

  console.log("  Kobo Labs seeded.");
  return ws;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Crontract seed starting...\n");

  try {
    await cleanDatabase();

    const permMap = await seedPermissions();

    await seedObuasiMining(permMap);
    await seedHorizonFoundation(permMap);
    await seedKoboLabs(permMap);

    console.log("\nSeed completed successfully!");
    console.log("Demo credentials (all workspaces): password = demo123456");
    console.log("  Obuasi Mining: admin@obuasi-mining.com");
    console.log("  Horizon Foundation: admin@horizon-ghana.org");
    console.log("  Kobo Labs: admin@kobolabs.com");
  } catch (err) {
    console.error("\nSeed failed:", err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
