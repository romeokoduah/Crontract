import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2).max(100),
})

// Default modules for a STARTUP workspace
const STARTUP_MODULES = [
  "finance",
  "hr",
  "projects",
  "documents",
  "approvals",
]

// All permissions granted to the Owner role
const OWNER_PERMISSIONS = [
  // workspace
  "workspace:read",
  "workspace:update",
  "workspace:delete",
  "workspace:manage_members",
  "workspace:manage_roles",
  "workspace:manage_modules",
  // finance
  "finance:read",
  "finance:write",
  "finance:approve",
  "finance:manage",
  // hr
  "hr:read",
  "hr:write",
  "hr:approve",
  "hr:manage",
  // projects
  "projects:read",
  "projects:write",
  "projects:manage",
  // procurement
  "procurement:read",
  "procurement:write",
  "procurement:approve",
  "procurement:manage",
  // hse
  "hse:read",
  "hse:write",
  "hse:manage",
  // documents
  "documents:read",
  "documents:write",
  "documents:manage",
  // approvals
  "approvals:read",
  "approvals:approve",
  "approvals:manage",
  // reports
  "reports:read",
  "reports:export",
  // audit
  "audit:read",
]

function generateSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let attempt = 0
  while (true) {
    const existing = await prisma.workspace.findUnique({ where: { slug } })
    if (!existing) return slug
    attempt++
    slug = `${base}-${attempt}`
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = signupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          detail: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      )
    }

    const { name, email, password, companyName } = parsed.data
    const normalizedEmail = email.toLowerCase()

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)
    const baseSlug = generateSlug(companyName)
    const slug = await uniqueSlug(baseSlug)

    // Create user, workspace, role, and membership in a transaction
    const result = await prisma.$transaction(async (tx: TxClient) => {
      // 1. Create user
      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
        },
      })

      // 2. Create workspace (default STARTUP type)
      const workspace = await tx.workspace.create({
        data: {
          name: companyName,
          slug,
          businessType: "STARTUP",
          modules: STARTUP_MODULES,
        },
      })

      // 3. Ensure permissions exist (upsert so idempotent)
      await Promise.all(
        OWNER_PERMISSIONS.map((code) => {
          const [module, action] = code.split(":")
          return tx.permission.upsert({
            where: { code },
            update: {},
            create: {
              code,
              module,
              entity: module,
              action,
              description: `${action} access to ${module}`,
            },
          })
        })
      )

      // 4. Create Owner role for this workspace
      const ownerRole = await tx.role.create({
        data: {
          workspaceId: workspace.id,
          name: "Owner",
          description: "Full access to all workspace resources",
          isSystem: true,
        },
      })

      // 5. Connect all permissions to the Owner role
      const permissions = await tx.permission.findMany({
        where: { code: { in: OWNER_PERMISSIONS } },
      })

      await tx.rolePermission.createMany({
        data: permissions.map((p: { id: string }) => ({
          roleId: ownerRole.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      })

      // 6. Create membership (owner)
      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          roleId: ownerRole.id,
          isOwner: true,
        },
      })

      return { user, workspace, membership }
    })

    return NextResponse.json(
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        workspace: {
          id: result.workspace.id,
          name: result.workspace.name,
          slug: result.workspace.slug,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("[signup]", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
