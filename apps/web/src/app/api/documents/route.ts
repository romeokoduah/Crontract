import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { isAdmin, requireAuth } from "@/lib/authorization"

const createDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional(),
  docType: z
    .enum(["GENERAL", "LETTER", "MEMO", "SOP", "POLICY", "CONTRACT", "REPORT"])
    .default("GENERAL"),
  folderId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
})

const createFolderSchema = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const workspaceId = session!.user.workspaceId!
    const admin = isAdmin(session)

    const { searchParams } = new URL(req.url)
    const folderId = searchParams.get("folderId")
    const type = searchParams.get("type")

    const [documents, folders] = await Promise.all([
      prisma.document.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(folderId === "root" ? { folderId: null } : folderId ? { folderId } : {}),
          ...(type ? { docType: type as "GENERAL" | "LETTER" | "MEMO" | "SOP" | "POLICY" | "CONTRACT" | "REPORT" } : {}),
          ...(!admin ? { createdBy: session!.user.id } : {}),
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.folder.findMany({
        where: {
          workspaceId,
          ...(folderId === "root" ? { parentId: null } : folderId ? { parentId: folderId } : {}),
        },
        orderBy: { name: "asc" },
      }),
    ])

    // Enrich documents with creator names
    const userIds = [...new Set(documents.map((d) => d.createdBy))]
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : []
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    const enriched = documents.map((d) => ({
      ...d,
      createdByUser: userMap[d.createdBy] ?? null,
    }))

    return NextResponse.json({ documents: enriched, folders })
  } catch (err) {
    console.error("[GET /api/documents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const body = await req.json()
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    // Handle folder creation
    if (body._type === "folder") {
      const parsed = createFolderSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 })
      }
      const folder = await prisma.folder.create({
        data: {
          workspaceId,
          name: parsed.data.name,
          parentId: parsed.data.parentId ?? null,
          createdBy: userId,
        },
      })
      return NextResponse.json({ folder }, { status: 201 })
    }

    const parsed = createDocumentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const document = await prisma.document.create({
      data: {
        workspaceId,
        title: parsed.data.title,
        content: parsed.data.content,
        docType: parsed.data.docType,
        folderId: parsed.data.folderId ?? null,
        status: parsed.data.status,
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "document",
        entityId: document.id,
        action: "CREATE",
        afterState: { title: document.title, docType: document.docType, status: document.status },
      },
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/documents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
