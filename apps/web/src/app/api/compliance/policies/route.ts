import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createPolicySchema = z.object({
  title: z.string().min(1),
  category: z.enum(["HR", "SAFETY", "FINANCIAL", "IT", "OPERATIONAL", "LEGAL", "ENVIRONMENTAL"]),
  effectiveDate: z.string(),
  reviewDate: z.string().optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "ACTIVE", "ARCHIVED", "SUPERSEDED"]).default("DRAFT"),
  content: z.string().optional(),
  version: z.number().int().positive().default(1),
  notes: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const policies = await prisma.policy.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ policies })
  } catch (err) {
    console.error("[GET /api/compliance/policies]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createPolicySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    // Auto-generate policy number
    const count = await prisma.policy.count({ where: { workspaceId } })
    const policyNumber = `POL-${String(count + 1).padStart(4, "0")}`

    const policy = await prisma.policy.create({
      data: {
        workspaceId,
        title: data.title,
        policyNumber,
        category: data.category,
        version: data.version,
        effectiveDate: new Date(data.effectiveDate),
        reviewDate: data.reviewDate ? new Date(data.reviewDate) : undefined,
        status: data.status,
        content: data.content,
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "policy",
        entityId: policy.id,
        action: "CREATE",
        afterState: { policyNumber: policy.policyNumber, title: policy.title, status: policy.status },
      },
    })

    return NextResponse.json({ policy }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/compliance/policies]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
