"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Plus,
  X,
  Image as ImageIcon,
  Send,
  Save,
  Clock,
  Megaphone,
} from "lucide-react"

interface SocialAccount {
  id: string
  platform: string
  accountName: string
  handle: string
  isConnected: boolean
}

const PLATFORMS = [
  { key: "FACEBOOK", name: "Facebook", color: "#1877F2", charLimit: 63206 },
  { key: "INSTAGRAM", name: "Instagram", color: "#E4405F", charLimit: 2200 },
  { key: "TWITTER", name: "Twitter / X", color: "#000000", charLimit: 280 },
  { key: "LINKEDIN", name: "LinkedIn", color: "#0A66C2", charLimit: 3000 },
  { key: "TIKTOK", name: "TikTok", color: "#000000", charLimit: 2200 },
  { key: "YOUTUBE", name: "YouTube", color: "#FF0000", charLimit: 5000 },
] as const

const platformPreviewStyles: Record<string, { bg: string; border: string; header: string }> = {
  FACEBOOK: { bg: "bg-white", border: "border-blue-200", header: "bg-blue-50" },
  INSTAGRAM: { bg: "bg-white", border: "border-pink-200", header: "bg-gradient-to-r from-purple-50 to-pink-50" },
  TWITTER: { bg: "bg-white", border: "border-gray-200", header: "bg-gray-50" },
  LINKEDIN: { bg: "bg-white", border: "border-sky-200", header: "bg-sky-50" },
  TIKTOK: { bg: "bg-white", border: "border-gray-300", header: "bg-gray-50" },
  YOUTUBE: { bg: "bg-white", border: "border-red-200", header: "bg-red-50" },
}

export default function ComposePage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set())
  const [content, setContent] = useState("")
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now")
  const [scheduledAt, setScheduledAt] = useState("")
  const [tagsInput, setTagsInput] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [campaignName, setCampaignName] = useState("")
  const [submitting, setSubmitting] = useState<"draft" | "publish" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/social-media/accounts")
      const data = await res.json()
      setAccounts(data.accounts || [])
    } catch {
      console.error("Failed to fetch accounts")
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // Group accounts by platform
  const accountsByPlatform = PLATFORMS.map((p) => ({
    ...p,
    accounts: accounts.filter((a) => a.platform === p.key && a.isConnected),
  }))

  const selectedPlatforms = PLATFORMS.filter((p) =>
    accounts.some((a) => a.platform === p.key && selectedAccountIds.has(a.id))
  )

  function togglePlatform(platformKey: string) {
    const platformAccounts = accounts.filter((a) => a.platform === platformKey && a.isConnected)
    if (platformAccounts.length === 0) return

    setSelectedAccountIds((prev) => {
      const next = new Set(prev)
      const anySelected = platformAccounts.some((a) => next.has(a.id))
      if (anySelected) {
        platformAccounts.forEach((a) => next.delete(a.id))
      } else {
        platformAccounts.forEach((a) => next.add(a.id))
      }
      return next
    })
  }

  function addMediaUrl() {
    setMediaUrls((prev) => [...prev, ""])
  }

  function updateMediaUrl(index: number, value: string) {
    setMediaUrls((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function removeMediaUrl(index: number) {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index))
  }

  function handleTagsKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      const tag = tagsInput.trim().replace(/,/g, "")
      if (tag && !tags.includes(tag)) {
        setTags((prev) => [...prev, tag])
      }
      setTagsInput("")
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  async function handleSubmit(mode: "draft" | "publish") {
    setError(null)
    if (!content.trim()) {
      setError("Post content is required")
      return
    }
    if (selectedAccountIds.size === 0) {
      setError("Select at least one platform")
      return
    }

    setSubmitting(mode)
    try {
      const postBody: Record<string, unknown> = {
        content: content.trim(),
        accountIds: Array.from(selectedAccountIds),
        tags: tags.length > 0 ? tags : undefined,
        campaignName: campaignName.trim() || undefined,
        mediaUrls: mediaUrls.filter((u) => u.trim()) || undefined,
      }

      if (mode === "draft" && scheduleMode === "later" && scheduledAt) {
        postBody.scheduledAt = new Date(scheduledAt).toISOString()
      }

      const res = await fetch("/api/social-media/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || err.error || "Failed to create post")
      }

      const { post } = await res.json()

      // If publishing now, call publish endpoint
      if (mode === "publish") {
        const pubRes = await fetch("/api/social-media/posts/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: post.id }),
        })
        if (!pubRes.ok) {
          throw new Error("Post created but failed to publish")
        }
      }

      router.push("/social-media/posts")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/social-media">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compose Post</h1>
          <p className="text-muted-foreground">Create and publish to multiple platforms</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Composer */}
        <div className="lg:col-span-2 space-y-5">
          {/* Platform Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Select Platforms
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAccounts ? (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-10 w-24 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {accountsByPlatform.map((platform) => {
                    const hasAccounts = platform.accounts.length > 0
                    const isSelected = platform.accounts.some((a) => selectedAccountIds.has(a.id))

                    return (
                      <button
                        key={platform.key}
                        onClick={() => togglePlatform(platform.key)}
                        disabled={!hasAccounts}
                        title={!hasAccounts ? "Not connected" : undefined}
                        className={cn(
                          "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border",
                          hasAccounts && isSelected
                            ? "text-white border-transparent shadow-sm"
                            : hasAccounts
                            ? "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                            : "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
                        )}
                        style={
                          hasAccounts && isSelected
                            ? { backgroundColor: platform.color }
                            : undefined
                        }
                      >
                        <span
                          className={cn(
                            "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                            hasAccounts && isSelected
                              ? "bg-white/20 text-white"
                              : hasAccounts
                              ? "text-white"
                              : "bg-gray-200 text-gray-400"
                          )}
                          style={
                            hasAccounts && !isSelected
                              ? { backgroundColor: platform.color }
                              : undefined
                          }
                        >
                          {platform.key[0]}
                        </span>
                        {platform.name}
                        {!hasAccounts && (
                          <span className="text-[10px] text-gray-400 ml-1">(not connected)</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
              {accounts.length === 0 && !loadingAccounts && (
                <p className="text-sm text-muted-foreground mt-3">
                  No accounts connected.{" "}
                  <Link href="/social-media/accounts" className="text-orange-600 hover:underline">
                    Connect accounts
                  </Link>{" "}
                  to start posting.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Content */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Post Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="What would you like to share?"
                className="min-h-[160px] resize-y text-base"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              {/* Character counts */}
              {selectedPlatforms.length > 0 && content.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {selectedPlatforms.map((p) => {
                    const exceeded = content.length > p.charLimit
                    return (
                      <span
                        key={p.key}
                        className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          exceeded
                            ? "bg-red-100 text-red-700 font-medium"
                            : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {p.name}: {content.length}/{p.charLimit}
                      </span>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Media URLs */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Media
              </CardTitle>
              <Button variant="outline" size="sm" onClick={addMediaUrl}>
                <Plus className="h-3 w-3 mr-1" />
                Add Media URL
              </Button>
            </CardHeader>
            {mediaUrls.length > 0 && (
              <CardContent className="space-y-2">
                {mediaUrls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="https://example.com/image.jpg"
                      value={url}
                      onChange={(e) => updateMediaUrl(i, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-red-500"
                      onClick={() => removeMediaUrl(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setScheduleMode("now")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                    scheduleMode === "now"
                      ? "bg-orange-50 border-orange-200 text-orange-700"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Send className="h-4 w-4" />
                  Post Now
                </button>
                <button
                  onClick={() => setScheduleMode("later")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                    scheduleMode === "later"
                      ? "bg-orange-50 border-orange-200 text-orange-700"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Clock className="h-4 w-4" />
                  Schedule for Later
                </button>
              </div>
              {scheduleMode === "later" && (
                <div className="max-w-xs">
                  <Label htmlFor="scheduledAt" className="text-xs text-muted-foreground">
                    Schedule Date & Time
                  </Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags & Campaign */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tags & Campaign
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tags" className="text-xs text-muted-foreground">
                  Tags (press Enter or comma to add)
                </Label>
                <Input
                  id="tags"
                  placeholder="marketing, launch, product"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  onKeyDown={handleTagsKeyDown}
                />
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="hover:text-orange-900"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign" className="text-xs text-muted-foreground">
                  Campaign Name (optional)
                </Label>
                <Input
                  id="campaign"
                  placeholder="Q1 Product Launch"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => handleSubmit("draft")}
              disabled={!!submitting}
              className="min-w-[140px]"
            >
              {submitting === "draft" ? (
                <>
                  <Save className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save as Draft
                </>
              )}
            </Button>
            <Button
              onClick={() => handleSubmit("publish")}
              disabled={!!submitting}
              className="min-w-[160px] bg-orange-600 hover:bg-orange-700"
            >
              {submitting === "publish" ? (
                <>
                  <Megaphone className="h-4 w-4 mr-2 animate-spin" />
                  {scheduleMode === "later" ? "Scheduling..." : "Publishing..."}
                </>
              ) : scheduleMode === "later" ? (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule Post
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Publish Now
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground px-1">Post Preview</h2>

          {selectedPlatforms.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Megaphone className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Select platforms to see preview
                </p>
              </CardContent>
            </Card>
          ) : (
            selectedPlatforms.map((platform) => {
              const style = platformPreviewStyles[platform.key]
              const account = accounts.find(
                (a) => a.platform === platform.key && selectedAccountIds.has(a.id)
              )
              const truncatedContent = content.slice(0, platform.charLimit)
              const filteredMedia = mediaUrls.filter((u) => u.trim())

              return (
                <Card
                  key={platform.key}
                  className={cn("overflow-hidden", style.border)}
                >
                  {/* Platform header */}
                  <div className={cn("px-4 py-2.5 flex items-center gap-2.5", style.header)}>
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: platform.color }}
                    >
                      {platform.key[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {account?.accountName || platform.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{account?.handle || "handle"}
                      </p>
                    </div>
                  </div>
                  {/* Content */}
                  <CardContent className="pt-3 pb-4">
                    {truncatedContent ? (
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {truncatedContent}
                        {content.length > platform.charLimit && (
                          <span className="text-red-400">...</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Your post content will appear here...
                      </p>
                    )}

                    {/* Media placeholders */}
                    {filteredMedia.length > 0 && (
                      <div
                        className={cn(
                          "mt-3 grid gap-1.5",
                          filteredMedia.length === 1
                            ? "grid-cols-1"
                            : "grid-cols-2"
                        )}
                      >
                        {filteredMedia.slice(0, 4).map((url, i) => (
                          <div
                            key={i}
                            className="bg-gray-100 rounded-lg flex items-center justify-center aspect-video overflow-hidden"
                          >
                            {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={url}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none"
                                  ;(e.target as HTMLImageElement).parentElement!.innerHTML =
                                    '<div class="flex flex-col items-center text-gray-400"><span class="text-xs">Media</span></div>'
                                }}
                              />
                            ) : (
                              <div className="flex flex-col items-center text-gray-400">
                                <ImageIcon className="h-6 w-6 mb-1" />
                                <span className="text-[10px]">Media</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <span key={tag} className="text-xs text-blue-500">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
