import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createPermitSchema = z.object({
  type: z.enum(["HOT_WORK", "CONFINED_SPACE", "WORKING_AT_HEIGHT", "ELECTRICAL", "EXCAVATION", "GENERAL"]),
  title: z.string().min(1).max(500),
  location: z.string().min(1),
  description: z.string().optional(),
  validFrom: z.string(),
  validTo: z.string(),
  hazards: z.array(z.string()).optional().default([]),
  precautions: z.array(z.string()).optional().default([]),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type")
    const status = searchParams.get("status")

    const permits = await prisma.permit.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
        ...(type ? { type: type as "HOT_WORK" | "CONFINED_SPACE" | "WORKING_AT_HEIGHT" | "ELECTRICAL" | "EXCAVATION" | "GENERAL" } : {}),
        ...(status ? { status: status as "DRAFT" | "REQUESTED" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CLOSED" | "EXPIRED" } : {}),
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ permits })
  } catch (err) {
    console.error("[GET /api/hse/permits]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createPermitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const count = await prisma.permit.count({ where: { workspaceId } })
    const number = `PTW-${String(count + 1).padStart(4, "0")}`

    const permit = await prisma.permit.create({
      data: {
        workspaceId,
        number,
        type: parsed.data.type,
        title: parsed.data.title,
        location: parsed.data.location,
        description: parsed.data.description,
        validFrom: new Date(parsed.data.validFrom),
        validTo: new Date(parsed.data.validTo),
        hazards: parsed.data.hazards,
        precautions: parsed.data.precautions,
        status: "DRAFT",
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "permit",
        entityId: permit.id,
        action: "CREATE",
        afterState: { number: permit.number, type: permit.type, title: permit.title },
      },
    })

    return NextResponse.json({ permit }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/hse/permits]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
