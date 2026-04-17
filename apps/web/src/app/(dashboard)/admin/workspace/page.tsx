import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Settings } from "lucide-react"
import { WorkspaceSettingsClient } from "./workspace-settings-client"

const ALL_MODULES = [
  { key: "people", label: "People & HR" },
  { key: "projects", label: "Projects & Tasks" },
  { key: "meetings", label: "Meetings" },
  { key: "documents", label: "Documents" },
  { key: "approvals", label: "Approvals" },
  { key: "finance", label: "Finance" },
  { key: "budget", label: "Budget" },
  { key: "procurement", label: "Procurement" },
  { key: "assets", label: "Assets" },
  { key: "hse", label: "HSE" },
  { key: "grants", label: "Grants & M&E" },
  { key: "crm", label: "CRM" },
  { key: "compliance", label: "Compliance" },
  { key: "reports", label: "Reports" },
]

export default async function WorkspacePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.user.workspaceId },
    select: {
      id: true, name: true, legalName: true, slug: true,
      businessType: true, country: true, currency: true,
      timezone: true, modules: true, logoUrl: true,
    },
  })

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Workspace not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-gray-500" />
          Workspace Settings
        </h1>
        <p className="text-muted-foreground">Manage your organisation profile and configuration</p>
      </div>

      <WorkspaceSettingsClient workspace={workspace} allModules={ALL_MODULES} />
    </div>
  )
}
