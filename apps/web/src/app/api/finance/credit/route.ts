import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"
import { assessWorkspaceCredit } from "@/lib/credit"

export const runtime = "nodejs"

/** GET /api/finance/credit → deterministic working-capital assessment for the workspace. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const assessment = await assessWorkspaceCredit(session!.user.workspaceId!)
    return NextResponse.json({ assessment })
  } catch (err) {
    console.error("[GET /api/finance/credit]", err)
    return NextResponse.json({ error: "Failed to compute assessment" }, { status: 500 })
  }
}
