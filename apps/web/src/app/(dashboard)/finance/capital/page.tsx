import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isAdmin } from "@/lib/authorization"
import { assessWorkspaceCredit } from "@/lib/credit"
import { CapitalClient } from "./capital-client"

export const dynamic = "force-dynamic"

export default async function CapitalPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.workspaceId) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }
  if (!isAdmin(session)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">
          Financing readiness is available to workspace owners and administrators.
        </p>
      </div>
    )
  }

  const assessment = await assessWorkspaceCredit(session.user.workspaceId)

  return <CapitalClient initial={assessment} />
}
