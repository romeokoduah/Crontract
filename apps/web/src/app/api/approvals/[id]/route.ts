import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const approval = await prisma.approval.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId },
      include: {
        flow: true,
        decisions: true,
      },
    })
    if (!approval) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (approval.status !== "PENDING") {
      return NextResponse.json({ error: "Approval is no longer pending" }, { status: 400 })
    }

    const body = await req.json()
    const parsed = decisionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const { workspaceId, id: userId } = session.user
    const { decision, comment } = parsed.data

    // Verify the user is a valid approver for the current step
    const steps = (approval.flow.steps as { approverIds?: string[] }[]) ?? []
    const currentStepDef = steps[approval.currentStep]
    if (currentStepDef?.approverIds && !currentStepDef.approverIds.includes(userId)) {
      return NextResponse.json({ error: "You are not authorised to decide on this step" }, { status: 403 })
    }

    // Record the decision
    await prisma.approvalDecision.create({
      data: {
        approvalId: approval.id,
        step: approval.currentStep,
        decidedBy: userId,
        decision,
        comment,
      },
    })

    // Determine new approval status
    let newStatus: "PENDING" | "APPROVED" | "REJECTED" = "PENDING"
    let newStep = approval.currentStep

    if (decision === "REJECTED") {
      newStatus = "REJECTED"
    } else {
      // Move to next step or approve if last step
      const nextStep = approval.currentStep + 1
      if (nextStep >= steps.length) {
        newStatus = "APPROVED"
      } else {
        newStep = nextStep
        newStatus = "PENDING"
      }
    }

    const updated = await prisma.approval.update({
      where: { id: approval.id },
      data: { status: newStatus, currentStep: newStep },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "approval",
        entityId: approval.id,
        action: decision,
        beforeState: { status: approval.status, step: approval.currentStep },
        afterState: { status: updated.status, step: updated.currentStep },
      },
    })

    return NextResponse.json({ approval: updated })
  } catch (err) {
    console.error("[PATCH /api/approvals/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
