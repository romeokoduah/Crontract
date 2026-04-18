import Link from "next/link"
import { prisma } from "@/lib/db"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AcceptInviteForm } from "./accept-invite-form"

interface InvitePageProps {
  params: { token: string }
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = params

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { name: true } },
      sender: { select: { name: true } },
    },
  })

  // Invalid token
  if (!invitation) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Invalid invitation link
          </h1>
          <p className="text-muted-foreground text-sm">
            This invitation link is not valid. It may have been revoked or the
            URL is incorrect.
          </p>
        </div>
        <Button asChild className="w-full font-semibold" size="lg">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    )
  }

  // Expired
  const isExpired =
    invitation.status === "EXPIRED" || invitation.expiresAt < new Date()

  if (isExpired || invitation.status === "CANCELLED") {
    // Update status in background if needed
    if (invitation.status === "PENDING" && invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      })
    }

    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            This invitation has expired
          </h1>
          <p className="text-muted-foreground text-sm">
            Please contact the workspace owner to send a new invitation.
          </p>
        </div>
        <Button asChild className="w-full font-semibold" size="lg">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    )
  }

  // Already accepted
  if (invitation.status === "ACCEPTED") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Invitation already accepted
          </h1>
          <p className="text-muted-foreground text-sm">
            This invitation has already been used. Sign in to access the
            workspace.
          </p>
        </div>
        <Button asChild className="w-full font-semibold" size="lg">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  // Valid — show form
  return (
    <AcceptInviteForm
      token={token}
      email={invitation.email}
      workspaceName={invitation.workspace.name}
      inviterName={invitation.sender.name}
    />
  )
}
