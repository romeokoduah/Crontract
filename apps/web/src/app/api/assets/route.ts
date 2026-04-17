import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const createAssetSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  categoryId: z.string().uuid(),
  location: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string(),
  purchaseCost: z.number().min(0),
  currentValue: z.number().min(0),
  status: z.enum(["ACTIVE", "MAINTENANCE", "CHECKED_OUT", "RETIRED", "DISPOSED"]).default("ACTIVE"),
  assignedTo: z.string().uuid().optional(),
  warrantyExpiry: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const categoryId = searchParams.get("categoryId")

    const assets = await prisma.asset.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        deletedAt: null,
        ...(status ? { status: status as "ACTIVE" | "MAINTENANCE" | "CHECKED_OUT" | "RETIRED" | "DISPOSED" } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { assetNumber: "asc" },
    })

    // Enrich with assignee names
    const assigneeIds = [...new Set(assets.map((a) => a.assignedTo).filter(Boolean))] as string[]
    const assignees = assigneeIds.length
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true },
        })
      : []
    const assigneeMap = Object.fromEntries(assignees.map((u) => [u.id, u]))

    // Stats
    const totalAssets = assets.length
    const activeCount = assets.filter((a) => a.status === "ACTIVE").length
    const maintenanceCount = assets.filter((a) => a.status === "MAINTENANCE").length
    const totalValue = assets.reduce((sum, a) => sum + Number(a.currentValue), 0)

    const enriched = assets.map((a) => ({
      ...a,
      assignedToUser: a.assignedTo ? (assigneeMap[a.assignedTo] ?? null) : null,
    }))

    // Asset categories for filter
    const categories = await prisma.assetCategory.findMany({
      where: { workspaceId: session.user.workspaceId },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({
      assets: enriched,
      categories,
      stats: { totalAssets, activeCount, maintenanceCount, totalValue },
    })
  } catch (err) {
    console.error("[GET /api/assets]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createAssetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const { workspaceId, id: userId } = session.user

    // Verify category belongs to workspace
    const category = await prisma.assetCategory.findFirst({
      where: { id: parsed.data.categoryId, workspaceId },
    })
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 })

    // Generate asset number
    const count = await prisma.asset.count({ where: { workspaceId } })
    const assetNumber = `AST-${String(count + 1).padStart(4, "0")}`

    const asset = await prisma.asset.create({
      data: {
        workspaceId,
        assetNumber,
        name: parsed.data.name,
        description: parsed.data.description,
        categoryId: parsed.data.categoryId,
        location: parsed.data.location,
        serialNumber: parsed.data.serialNumber,
        purchaseDate: new Date(parsed.data.purchaseDate),
        purchaseCost: parsed.data.purchaseCost,
        currentValue: parsed.data.currentValue,
        status: parsed.data.status,
        assignedTo: parsed.data.assignedTo ?? null,
        warrantyExpiry: parsed.data.warrantyExpiry ? new Date(parsed.data.warrantyExpiry) : null,
        notes: parsed.data.notes,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "asset",
        entityId: asset.id,
        action: "CREATE",
        afterState: { assetNumber: asset.assetNumber, name: asset.name, status: asset.status },
      },
    })

    return NextResponse.json({ asset }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/assets]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
