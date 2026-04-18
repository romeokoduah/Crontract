import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, cn } from "@/lib/utils"
import {
  Megaphone,
  FileText,
  Clock,
  CheckCircle2,
  Heart,
  PenSquare,
  Calendar,
  Users,
  List,
  ArrowRight,
} from "lucide-react"

const platformColors: Record<string, string> = {
  FACEBOOK: "bg-blue-100 text-blue-700",
  INSTAGRAM: "bg-pink-100 text-pink-700",
  TWITTER: "bg-gray-100 text-gray-800",
  LINKEDIN: "bg-sky-100 text-sky-700",
  TIKTOK: "bg-gray-100 text-gray-800",
  YOUTUBE: "bg-red-100 text-red-700",
}

export default async function SocialMediaPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const [posts, accounts, allPlatforms] = await Promise.all([
    prisma.socialPost.findMany({
      where: { workspaceId, deletedAt: null },
      include: { platforms: { include: { socialAccount: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.socialAccount.findMany({
      where: { workspaceId, isConnected: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.socialPostPlatform.findMany({
      where: { post: { workspaceId, deletedAt: null } },
    }),
  ])

  const totalPosts = posts.length
  const scheduledCount = posts.filter((p) => p.status === "SCHEDULED").length
  const publishedCount = posts.filter((p) => p.status === "PUBLISHED").length

  // Calculate total engagement
  const totalEngagement = allPlatforms.reduce((sum, pp) => {
    const eng = pp.engagement as Record<string, number> | null
    if (!eng) return sum
    return sum + (eng.likes || 0) + (eng.comments || 0) + (eng.shares || 0)
  }, 0)

  // Recent published posts
  const recentPublished = posts
    .filter((p) => p.status === "PUBLISHED")
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Social Media</h1>
          <p className="text-muted-foreground">Manage and schedule your social media content</p>
        </div>
        <Button asChild className="bg-orange-600 hover:bg-orange-700">
          <Link href="/social-media/compose">
            <PenSquare className="h-4 w-4 mr-2" />
            Compose Post
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-500" />
              Total Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{totalPosts}</p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{scheduledCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Upcoming posts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Published
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{publishedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Live posts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-500" />
              Total Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-pink-600">{totalEngagement.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Likes, comments & shares</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Published Posts */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Published Posts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/social-media/posts">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentPublished.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Megaphone className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No published posts yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {recentPublished.map((post) => {
                  const eng = post.platforms.reduce(
                    (acc, pp) => {
                      const e = pp.engagement as Record<string, number> | null
                      if (!e) return acc
                      return {
                        likes: acc.likes + (e.likes || 0),
                        comments: acc.comments + (e.comments || 0),
                        shares: acc.shares + (e.shares || 0),
                      }
                    },
                    { likes: 0, comments: 0, shares: 0 }
                  )

                  return (
                    <div key={post.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium truncate">
                          {post.content.length > 60 ? post.content.slice(0, 60) + "..." : post.content}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {post.platforms.map((pp) => (
                            <span
                              key={pp.id}
                              className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", platformColors[pp.platform])}
                            >
                              {pp.platform}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {post.publishedAt ? formatDate(post.publishedAt) : "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {eng.likes}L / {eng.comments}C / {eng.shares}S
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions + Connected Accounts */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: "/social-media/compose", label: "Compose Post", icon: PenSquare, color: "text-orange-500" },
                { href: "/social-media/calendar", label: "View Calendar", icon: Calendar, color: "text-blue-500" },
                { href: "/social-media/accounts", label: "Manage Accounts", icon: Users, color: "text-purple-500" },
                { href: "/social-media/posts", label: "View All Posts", icon: List, color: "text-green-500" },
              ].map(({ href, label, icon: Icon, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("h-4 w-4", color)} />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">No accounts connected</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/social-media/accounts">Connect Accounts</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <div key={account.id} className="flex items-center gap-3 p-2 rounded-md">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                          account.platform === "FACEBOOK" && "bg-[#1877F2]",
                          account.platform === "INSTAGRAM" && "bg-[#E4405F]",
                          account.platform === "TWITTER" && "bg-black",
                          account.platform === "LINKEDIN" && "bg-[#0A66C2]",
                          account.platform === "TIKTOK" && "bg-black",
                          account.platform === "YOUTUBE" && "bg-[#FF0000]"
                        )}
                      >
                        {account.platform[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{account.accountName}</p>
                        <p className="text-xs text-muted-foreground">@{account.handle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
