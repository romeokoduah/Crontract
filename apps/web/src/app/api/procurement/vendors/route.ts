import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createVendorSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  category: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const vendors = await prisma.vendor.findMany({
      where: { workspaceId: session!.user.workspaceId!, deletedAt: null },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ vendors })
  } catch (err) {
    console.error("[GET /api/procurement/vendors]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createVendorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const vendor = await prisma.vendor.create({
      data: {
        workspaceId,
        name: data.name,
        contactName: data.contactName,
        email: data.email || null,
        phone: data.phone,
        address: data.address,
        taxId: data.taxId,
        category: data.category,
        rating: data.rating,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "vendor",
        entityId: vendor.id,
        action: "CREATE",
        afterState: { name: vendor.name, category: vendor.category },
      },
    })

    return NextResponse.json({ vendor }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/procurement/vendors]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
