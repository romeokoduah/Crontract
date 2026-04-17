import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  parentId: z.string().uuid().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const accounts = await prisma.account_GL.findMany({
      where: { workspaceId: session.user.workspaceId },
      orderBy: [{ type: "asc" }, { code: "asc" }],
    })

    return NextResponse.json({ accounts })
  } catch (err) {
    console.error("[GET /api/finance/accounts]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session.user.workspaceId
    const userId = session.user.id

    const account = await prisma.account_GL.create({
      data: {
        workspaceId,
        code: data.code,
        name: data.name,
        type: data.type,
        parentId: data.parentId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "account_gl",
        entityId: account.id,
        action: "CREATE",
        afterState: { code: account.code, name: account.name, type: account.type },
      },
    })

    return NextResponse.json({ account }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/finance/accounts]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
