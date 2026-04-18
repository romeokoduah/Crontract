import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

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

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const donors = await prisma.donor.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
        deletedAt: null,
      },
      include: {
        _count: { select: { grants: true } },
      },
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
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createDonorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const donor = await prisma.donor.create({
      data: {
        workspaceId,
        name: data.name,
        type: data.type,
        contactName: data.contactName,
        email: data.email || null,
        phone: data.phone,
        country: data.country,
        website: data.website,
        notes: data.notes,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
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
