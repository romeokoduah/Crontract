import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { isAdmin, requireAuth, requireAdminRole } from "@/lib/authorization"

const patchDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  docType: z.enum(["GENERAL", "LETTER", "MEMO", "SOP", "POLICY", "CONTRACT", "REPORT"]).optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"]).optional(),
  folderId: z.string().uuid().nullable().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const admin = isAdmin(session)

    const document = await prisma.document.findFirst({
      where: { id: params.id, workspaceId: session!.user.workspaceId!, deletedAt: null },
    })
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (!admin && document.createdBy !== session!.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [creator, folder] = await Promise.all([
      prisma.user.findUnique({ where: { id: document.createdBy }, select: { id: true, name: true } }),
      document.folderId
        ? prisma.folder.findUnique({ where: { id: document.folderId }, select: { id: true, name: true } })
        : null,
    ])

    return NextResponse.json({ document: { ...document, creator, folder } })
  } catch (err) {
    console.error("[GET /api/documents/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const existing = await prisma.document.findFirst({
      where: { id: params.id, workspaceId: session!.user.workspaceId!, deletedAt: null },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json()
    const parsed = patchDocumentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id
    const data = parsed.data

    // Bump version on content change
    const versionBump = data.content !== undefined && data.content !== existing.content ? 1 : 0

    const document = await prisma.document.update({
      where: { id: params.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.docType !== undefined ? { docType: data.docType } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.folderId !== undefined ? { folderId: data.folderId } : {}),
        ...(versionBump ? { version: existing.version + 1 } : {}),
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "document",
        entityId: document.id,
        action: "UPDATE",
        beforeState: { status: existing.status, version: existing.version },
        afterState: { title: document.title, status: document.status, version: document.version },
      },
    })

    return NextResponse.json({ document })
  } catch (err) {
    console.error("[PATCH /api/documents/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
