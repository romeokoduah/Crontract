import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { requireAuth, type AuthedUser } from "@/lib/authorization"
import {
  runCopilot,
  CopilotDisabledError,
  CopilotBudgetError,
  CopilotNotConfiguredError,
} from "@/lib/ai"

export const runtime = "nodejs"
export const maxDuration = 60

const bodySchema = z.object({
  message: z.string().min(1, "Message is required").max(4000),
  conversationId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAuth(session)
    if (denied) return denied

    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const user: AuthedUser = {
      id: session!.user.id,
      email: session!.user.email,
      name: session!.user.name,
      role: session!.user.role,
      workspaceId: session!.user.workspaceId!,
    }

    const result = await runCopilot({
      user,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof CopilotNotConfiguredError) {
      return NextResponse.json({ error: err.message, code: "not_configured" }, { status: 503 })
    }
    if (err instanceof CopilotDisabledError) {
      return NextResponse.json({ error: err.message, code: "disabled" }, { status: 403 })
    }
    if (err instanceof CopilotBudgetError) {
      return NextResponse.json({ error: err.message, code: "budget_exceeded" }, { status: 429 })
    }
    console.error("[POST /api/ai/copilot]", err)
    return NextResponse.json({ error: "The Copilot hit an unexpected error." }, { status: 500 })
  }
}
