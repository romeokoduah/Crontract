"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"

interface PostPlatform {
  id: string
  platform: string
  status: string
}

interface SocialPost {
  id: string
  content: string
  status: string
  scheduledAt: string | null
  publishedAt: string | null
  createdAt: string
  platforms: PostPlatform[]
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const statusDot: Record<string, string> = {
  DRAFT: "bg-gray-400",
  SCHEDULED: "bg-blue-500",
  PUBLISHING: "bg-amber-500",
  PUBLISHED: "bg-green-500",
  PARTIALLY_PUBLISHED: "bg-amber-500",
  FAILED: "bg-red-500",
}

const platformShort: Record<string, string> = {
  FACEBOOK: "FB",
  INSTAGRAM: "IG",
  TWITTER: "X",
  LINKEDIN: "LI",
  TIKTOK: "TT",
  YOUTUBE: "YT",
}

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/social-media/posts")
      const data = await res.json()
      setPosts(data.posts || [])
    } catch {
      console.error("Failed to fetch posts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  function prevMonth() {
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days: { date: Date; inMonth: boolean }[] = []

    // Previous month fill
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      days.push({ date: d, inMonth: false })
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), inMonth: true })
    }

    // Next month fill to complete grid
    const remaining = 7 - (days.length % 7)
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), inMonth: false })
      }
    }

    return days
  }, [year, month])

  // Map posts to dates
  const postsByDate = useMemo(() => {
    const map: Record<string, SocialPost[]> = {}
    posts.forEach((post) => {
      const dateStr = post.scheduledAt || post.publishedAt || post.createdAt
      if (!dateStr) return
      const d = new Date(dateStr)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push(post)
    })
    return map
  }, [posts])

  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/social-media">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Content Calendar</h1>
          <p className="text-muted-foreground">View your scheduled and published posts</p>
        </div>
        <Button asChild className="bg-orange-600 hover:bg-orange-700">
          <Link href="/social-media/compose">Compose Post</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg min-w-[180px] text-center">
              {MONTHS[month]} {year}
            </CardTitle>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40 animate-pulse" />
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 border-t border-l">
                {calendarDays.map(({ date, inMonth }, idx) => {
                  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
                  const isToday = dateKey === todayKey
                  const dayPosts = postsByDate[dateKey] || []

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "border-r border-b min-h-[100px] sm:min-h-[120px] p-1.5",
                        !inMonth && "bg-gray-50/50",
                        isToday && "ring-2 ring-inset ring-orange-400"
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-medium",
                          !inMonth && "text-muted-foreground/40",
                          isToday &&
                            "bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center"
                        )}
                      >
                        {date.getDate()}
                      </span>

                      <div className="mt-1 space-y-0.5">
                        {dayPosts.slice(0, 3).map((post) => (
                          <div
                            key={post.id}
                            className="flex items-start gap-1 px-1 py-0.5 rounded text-[10px] bg-white border hover:bg-gray-50 transition-colors cursor-default"
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full mt-1 shrink-0",
                                statusDot[post.status] || "bg-gray-400"
                              )}
                            />
                            <span className="truncate flex-1 leading-tight">
                              {post.content.slice(0, 30)}
                            </span>
                            <span className="text-muted-foreground shrink-0">
                              {post.platforms
                                .map((p) => platformShort[p.platform] || p.platform[0])
                                .join("/")}
                            </span>
                          </div>
                        ))}
                        {dayPosts.length > 3 && (
                          <p className="text-[10px] text-muted-foreground px-1">
                            +{dayPosts.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 px-2">
                {[
                  { label: "Draft", color: "bg-gray-400" },
                  { label: "Scheduled", color: "bg-blue-500" },
                  { label: "Published", color: "bg-green-500" },
                  { label: "Failed", color: "bg-red-500" },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", color)} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
