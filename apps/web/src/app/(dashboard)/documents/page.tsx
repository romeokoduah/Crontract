import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatDate } from "@/lib/utils"
import { FileText, Folder, Plus, Upload } from "lucide-react"

const docTypeColors: Record<string, string> = {
  GENERAL: "bg-gray-100 text-gray-700",
  LETTER: "bg-blue-100 text-blue-700",
  MEMO: "bg-purple-100 text-purple-700",
  SOP: "bg-orange-100 text-orange-700",
  POLICY: "bg-red-100 text-red-700",
  CONTRACT: "bg-green-100 text-green-700",
  REPORT: "bg-indigo-100 text-indigo-700",
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  PUBLISHED: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { folderId?: string; type?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId
  const { folderId, type } = searchParams
  const currentFolderId = folderId ?? null

  const [documents, folders, allFolders] = await Promise.all([
    prisma.document.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        folderId: currentFolderId,
        ...(type ? { docType: type as "GENERAL" | "LETTER" | "MEMO" | "SOP" | "POLICY" | "CONTRACT" | "REPORT" } : {}),
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.folder.findMany({
      where: { workspaceId, parentId: currentFolderId },
      orderBy: { name: "asc" },
    }),
    prisma.folder.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    }),
  ])

  // Enrich with creator names
  const userIds = [...new Set(documents.map((d) => d.createdBy))]
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
    : []
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  // Build folder breadcrumb
  type FolderRecord = (typeof allFolders)[0]
  const breadcrumb: { id: string | null; name: string }[] = [{ id: null, name: "All Documents" }]
  if (currentFolderId) {
    const folderMap: Record<string, FolderRecord> = Object.fromEntries(allFolders.map((f) => [f.id, f]))
    const crumbFolders: FolderRecord[] = []
    let cursor: string | null = currentFolderId
    while (cursor) {
      const f: FolderRecord | undefined = folderMap[cursor]
      if (!f) break
      crumbFolders.unshift(f)
      cursor = f.parentId
    }
    crumbFolders.forEach((f) => breadcrumb.push({ id: f.id, name: f.name }))
  }

  // Root-level folders for sidebar
  const rootFolders = allFolders.filter((f) => !f.parentId)

  const docTypes = ["GENERAL", "LETTER", "MEMO", "SOP", "POLICY", "CONTRACT", "REPORT"]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Documents
          </h1>
          <p className="text-muted-foreground">
            {documents.length} document{documents.length !== 1 ? "s" : ""} ·{" "}
            {folders.length} folder{folders.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
          <Button asChild>
            <Link
              href={`/documents/new${currentFolderId ? `?folderId=${currentFolderId}` : ""}`}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Document
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 hidden md:block">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-2">
              Folders
            </p>
            <Link
              href="/documents"
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors",
                !currentFolderId && "bg-muted font-medium"
              )}
            >
              <Folder className="h-4 w-4 text-amber-500" />
              All Documents
            </Link>
            {rootFolders.map((f) => (
              <Link
                key={f.id}
                href={`/documents?folderId=${f.id}`}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors",
                  currentFolderId === f.id && "bg-muted font-medium"
                )}
              >
                <Folder className="h-4 w-4 text-amber-500" />
                {f.name}
              </Link>
            ))}
          </div>

          <div className="mt-6 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-2">
              Type
            </p>
            <Link
              href={currentFolderId ? `/documents?folderId=${currentFolderId}` : "/documents"}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors",
                !type && "bg-muted font-medium"
              )}
            >
              All Types
            </Link>
            {docTypes.map((t) => (
              <Link
                key={t}
                href={`/documents?${currentFolderId ? `folderId=${currentFolderId}&` : ""}type=${t}`}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors",
                  type === t && "bg-muted font-medium"
                )}
              >
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded font-medium",
                    docTypeColors[t]
                  )}
                >
                  {t}
                </span>
              </Link>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            {breadcrumb.map((crumb, idx) => (
              <span key={idx} className="flex items-center gap-1">
                {idx > 0 && <span>/</span>}
                {idx === breadcrumb.length - 1 ? (
                  <span className="text-foreground font-medium">{crumb.name}</span>
                ) : (
                  <Link
                    href={crumb.id ? `/documents?folderId=${crumb.id}` : "/documents"}
                    className="hover:underline"
                  >
                    {crumb.name}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          {/* Folders */}
          {folders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {folders.map((f) => (
                <Link
                  key={f.id}
                  href={`/documents?folderId=${f.id}`}
                  className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <Folder className="h-5 w-5 text-amber-500 shrink-0" />
                  <span className="text-sm font-medium truncate">{f.name}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Documents */}
          <Card>
            <CardContent className="p-0">
              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No documents found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {type ? "Try removing type filter" : "Create a document using the button above"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Version</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Modified</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Created By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => (
                        <tr key={doc.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <Link
                              href={`/documents/${doc.id}`}
                              className="font-medium hover:underline flex items-center gap-2"
                            >
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="line-clamp-1">{doc.title}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className={cn("text-xs px-2 py-0.5 rounded font-medium", docTypeColors[doc.docType])}>
                              {doc.docType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                            v{doc.version}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColors[doc.status])}>
                              {doc.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                            {formatDate(doc.updatedAt)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell whitespace-nowrap">
                            {userMap[doc.createdBy]?.name ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
