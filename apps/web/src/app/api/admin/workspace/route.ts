import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().optional().nullable(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens only").optional(),
  businessType: z.enum(["MINING_CONTRACTOR", "NGO", "STARTUP"]).optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  modules: z.array(z.string()).optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session!.user.workspaceId!) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const workspace = await prisma.workspace.findUnique({
      where: { id: session!.user.workspaceId! },
      select: {
        id: true, name: true, legalName: true, slug: true,
        businessType: true, country: true, currency: true,
        timezone: true, modules: true, logoUrl: true,
        createdAt: true,
      },
    })

    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    return NextResponse.json({ workspace })
  } catch (err) {
    console.error("[GET /api/admin/workspace]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session!.user.workspaceId!) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    // Check slug uniqueness if changing
    if (parsed.data.slug) {
      const slugConflict = await prisma.workspace.findFirst({
        where: { slug: parsed.data.slug, id: { not: workspaceId } },
      })
      if (slugConflict) return NextResponse.json({ error: "Slug already taken" }, { status: 409 })
    }

    const existing = await prisma.workspace.findUnique({ where: { id: workspaceId } })

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: parsed.data,
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "workspace",
        entityId: workspaceId,
        action: "UPDATE",
        beforeState: existing ? { name: existing.name, slug: existing.slug, modules: existing.modules } : undefined,
        afterState: parsed.data,
      },
    })

    return NextResponse.json({ workspace })
  } catch (err) {
    console.error("[PATCH /api/admin/workspace]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
