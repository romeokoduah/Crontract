import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { OnboardingWizard } from "./onboarding-wizard"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Crontract — Set up your workspace",
}

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <OnboardingWizard
      userId={session.user.id}
      workspaceId={session.user.workspaceId ?? ""}
      userName={session.user.name}
      workspaceName={session.user.workspaceName ?? ""}
    />
  )
}
