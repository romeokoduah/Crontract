import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

// ─── Schema ────────────────────────────────────────────────────────────────────

const onboardingSchema = z.object({
  businessType: z.enum(["MINING_CONTRACTOR", "NGO", "STARTUP"]),
  legalName: z.string().min(2).max(200),
  tradingName: z.string().max(200).optional(),
  country: z.string().min(2).max(10),
  currency: z.string().min(3).max(5),
  fiscalYearStart: z.number().int().min(1).max(12),
  modules: z.array(z.string()).min(1),
  invites: z
    .array(
      z.object({
        email: z.string().email(),
        role: z.string().min(1),
      })
    )
    .max(10)
    .default([]),
})

// ─── Role taxonomy ─────────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Administrator: [
    "workspace:read",
    "workspace:update",
    "workspace:manage_members",
    "workspace:manage_roles",
    "workspace:manage_modules",
    "finance:read", "finance:write", "finance:approve", "finance:manage",
    "hr:read", "hr:write", "hr:approve", "hr:manage",
    "projects:read", "projects:write", "projects:manage",
    "procurement:read", "procurement:write", "procurement:approve", "procurement:manage",
    "hse:read", "hse:write", "hse:manage",
    "documents:read", "documents:write", "documents:manage",
    "approvals:read", "approvals:approve", "approvals:manage",
    "reports:read", "reports:export",
    "audit:read",
  ],
  "Finance Manager": [
    "workspace:read",
    "finance:read", "finance:write", "finance:approve", "finance:manage",
    "procurement:read", "procurement:write", "procurement:approve",
    "documents:read", "documents:write",
    "approvals:read", "approvals:approve",
    "reports:read", "reports:export",
  ],
  "HR Manager": [
    "workspace:read",
    "hr:read", "hr:write", "hr:approve", "hr:manage",
    "documents:read", "documents:write",
    "approvals:read", "approvals:approve",
    "reports:read",
  ],
  "Project Manager": [
    "workspace:read",
    "projects:read", "projects:write", "projects:manage",
    "hr:read",
    "procurement:read", "procurement:write",
    "hse:read", "hse:write",
    "documents:read", "documents:write",
    "approvals:read", "approvals:approve",
    "reports:read",
  ],
  "Team Member": [
    "workspace:read",
    "projects:read", "projects:write",
    "hr:read",
    "documents:read",
    "approvals:read",
  ],
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    if (!session.user.workspaceId) {
      return NextResponse.json(
        { error: "No workspace found for this account" },
        { status: 400 }
      )
    }

    const body = await req.json()
    const parsed = onboardingSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          detail: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      )
    }

    const {
      businessType,
      legalName,
      tradingName,
      country,
      currency,
      fiscalYearStart,
      modules,
      invites,
    } = parsed.data

    const workspaceId = session.user.workspaceId
    const userId = session.user.id

    await prisma.$transaction(async (tx) => {
      // 1. Update workspace
      await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          legalName,
          ...(tradingName ? { name: tradingName } : {}),
          businessType,
          country,
          currency,
          fiscalYearStart,
          modules,
        },
      })

      // 2. Ensure all needed permissions exist
      const allPermCodes = Array.from(
        new Set(Object.values(ROLE_PERMISSIONS).flat())
      )

      await Promise.all(
        allPermCodes.map((code) => {
          const [module, action] = code.split(":")
          return tx.permission.upsert({
            where: { code },
            update: {},
            create: {
              code,
              module: module ?? code,
              entity: module ?? code,
              action: action ?? code,
              description: `${action ?? "access"} on ${module ?? code}`,
            },
          })
        })
      )

      // 3. Create default roles for the workspace (skip if already exists)
      const roleNames = Object.keys(ROLE_PERMISSIONS)

      for (const roleName of roleNames) {
        // Check if the role already exists
        const existingRole = await tx.role.findFirst({
          where: { workspaceId, name: roleName },
        })

        if (existingRole) continue

        const permCodes = ROLE_PERMISSIONS[roleName] ?? []
        const permissions = await tx.permission.findMany({
          where: { code: { in: permCodes } },
          select: { id: true },
        })

        const newRole = await tx.role.create({
          data: {
            workspaceId,
            name: roleName,
            description: `Default ${roleName} role`,
            isSystem: true,
          },
        })

        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map((p) => ({
              roleId: newRole.id,
              permissionId: p.id,
            })),
            skipDuplicates: true,
          })
        }
      }

      // 4. Send invitations
      if (invites.length > 0) {
        // Find or create a role for each invite
        const invitationData = await Promise.all(
          invites.map(async (invite) => {
            // Find the role in this workspace, fall back to Team Member
            let role = await tx.role.findFirst({
              where: { workspaceId, name: invite.role },
            })

            if (!role) {
              role = await tx.role.findFirst({
                where: { workspaceId, name: "Team Member" },
              })
            }

            if (!role) return null

            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + 7)

            return {
              email: invite.email.toLowerCase(),
              workspaceId,
              roleId: role.id,
              invitedBy: userId,
              expiresAt,
            }
          })
        )

        const validInvitations = invitationData.filter(
          (d): d is NonNullable<typeof d> => d !== null
        )

        if (validInvitations.length > 0) {
          await tx.invitation.createMany({
            data: validInvitations,
            skipDuplicates: true,
          })
        }
      }
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("[onboarding/complete]", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
