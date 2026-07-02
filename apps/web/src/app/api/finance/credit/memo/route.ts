import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"
import { assessWorkspaceCredit, generateUnderwritingMemo } from "@/lib/credit"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/finance/credit/memo → AI-narrated underwriting memo over the
 * deterministic assessment. The model explains the numbers; it never changes them.
 * Falls back to a templated memo when AI is not configured. Metered like any AI call.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const workspaceId = session!.user.workspaceId!
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, businessType: true },
    })
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })

    const assessment = await assessWorkspaceCredit(workspaceId)
    const result = await generateUnderwritingMemo(assessment, {
      workspaceName: workspace.name,
      businessType: workspace.businessType,
    })

    // Meter AI usage (best-effort; never blocks the response).
    if (result.source === "ai" && result.usage) {
      try {
        await prisma.aiInteraction.create({
          data: {
            workspaceId,
            userId: session!.user.id,
            feature: "credit.memo",
            provider: result.provider ?? "anthropic",
            model: result.model ?? "unknown",
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            costUsd: result.costUsd ?? 0,
            latencyMs: 0,
            status: "ok",
          },
        })
      } catch (e) {
        console.error("[credit.memo] metering failed", e)
      }
    }

    return NextResponse.json({ assessment, memo: result.memo, source: result.source })
  } catch (err) {
    console.error("[POST /api/finance/credit/memo]", err)
    return NextResponse.json({ error: "Failed to generate memo" }, { status: 500 })
  }
}
