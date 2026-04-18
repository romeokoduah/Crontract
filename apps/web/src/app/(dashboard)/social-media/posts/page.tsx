import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, cn } from "@/lib/utils"
import { Plus, Megaphone } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  SCHEDULED: { label: "Scheduled", className: "bg-blue-100 text-blue-700 border-blue-200" },
  PUBLISHING: { label: "Publishing", className: "bg-amber-100 text-amber-700 border-amber-200" },
  PUBLISHED: { label: "Published", className: "bg-green-100 text-green-700 border-green-200" },
  PARTIALLY_PUBLISHED: { label: "Partial", className: "bg-amber-100 text-amber-700 border-amber-200" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-700 border-red-200" },
}

const platformBadge: Record<string, string> = {
  FACEBOOK: "bg-blue-50 text-blue-700",
  INSTAGRAM: "bg-pink-50 text-pink-700",
  TWITTER: "bg-gray-100 text-gray-800",
  LINKEDIN: "bg-sky-50 text-sky-700",
  TIKTOK: "bg-gray-100 text-gray-800",
  YOUTUBE: "bg-red-50 text-red-700",
}

export default async function PostsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const posts = await prisma.socialPost.findMany({
    where: { workspaceId, deletedAt: null },
    include: {
      platforms: {
        include: { socialAccount: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const counts = {
    total: posts.length,
    draft: posts.filter((p) => p.status === "DRAFT").length,
    scheduled: posts.filter((p) => p.status === "SCHEDULED").length,
    published: posts.filter((p) => p.status === "PUBLISHED").length,
    failed: posts.filter((p) => p.status === "FAILED").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
          <p className="text-muted-foreground">All your social media posts</p>
        </div>
        <Button asChild className="bg-orange-600 hover:bg-orange-700">
          <Link href="/social-media/compose">
            <Plus className="h-4 w-4 mr-2" />
            Compose Post
          </Link>
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-orange-600" },
          { label: "Draft", value: counts.draft, color: "text-gray-600" },
          { label: "Scheduled", value: counts.scheduled, color: "text-blue-600" },
          { label: "Published", value: counts.published, color: "text-green-600" },
          { label: "Failed", value: counts.failed, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-lg font-bold mt-1", color)}>{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No posts yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Create your first post to get started</p>
              <Button asChild className="bg-orange-600 hover:bg-orange-700">
                <Link href="/social-media/compose">
                  <Plus className="h-4 w-4 mr-2" />
                  Compose Post
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content</TableHead>
                  <TableHead>Platforms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Engagement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => {
                  const cfg = statusConfig[post.status] ?? statusConfig.DRAFT
                  const engagement = post.platforms.reduce(
                    (sum, pp) => {
                      const e = pp.engagement as Record<string, number> | null
                      if (!e) return sum
                      return sum + (e.likes || 0) + (e.comments || 0) + (e.shares || 0)
                    },
                    0
                  )

                  return (
                    <TableRow key={post.id} className="hover:bg-muted/30">
                      <TableCell className="max-w-[300px]">
                        <p className="text-sm font-medium truncate">
                          {post.content.length > 60 ? post.content.slice(0, 60) + "..." : post.content}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {post.platforms.map((pp) => (
                            <span
                              key={pp.id}
                              className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", platformBadge[pp.platform])}
                            >
                              {pp.platform}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", cfg.className)}>
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {post.scheduledAt ? formatDate(post.scheduledAt) : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {post.publishedAt ? formatDate(post.publishedAt) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {engagement > 0 ? engagement.toLocaleString() : "-"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
