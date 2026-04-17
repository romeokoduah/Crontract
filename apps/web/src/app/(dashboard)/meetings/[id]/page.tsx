"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatDateTime } from "@/lib/utils"
import {
  ArrowLeft,
  MapPin,
  Users,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
} from "lucide-react"

interface AgendaItem {
  topic: string
  duration?: number
}

interface Decision {
  text: string
  owner?: string
}

interface Meeting {
  id: string
  title: string
  description?: string
  startTime: string
  endTime: string
  location?: string
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  attendees: string[]
  agenda?: AgendaItem[]
  minutes?: string
  decisions?: Decision[]
  project?: { id: string; name: string } | null
  creator?: { id: string; name: string } | null
}

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
}

export default function MeetingDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [minutes, setMinutes] = useState("")
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [newAttendee, setNewAttendee] = useState("")

  const fetchMeeting = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${id}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to load meeting")
        return
      }
      const m = data.meeting as Meeting
      setMeeting(m)
      setMinutes(m.minutes ?? "")
      setDecisions(m.decisions ?? [])
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchMeeting()
  }, [fetchMeeting])

  async function saveMinutes() {
    if (!meeting) return
    setSaving(true)
    try {
      const res = await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes, decisions }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to save")
        return
      }
      setMeeting(data.meeting)
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  async function completeMeeting() {
    if (!meeting) return
    setSaving(true)
    try {
      const res = await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED", minutes, decisions }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to complete meeting")
        return
      }
      setMeeting(data.meeting)
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  async function addAttendee() {
    if (!newAttendee.trim() || !meeting) return
    const updated = [...meeting.attendees, newAttendee.trim()]
    try {
      const res = await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendees: updated }),
      })
      const data = await res.json()
      if (res.ok) {
        setMeeting(data.meeting)
        setNewAttendee("")
      }
    } catch {
      /* ignore */
    }
  }

  function addDecision() {
    setDecisions((prev) => [...prev, { text: "", owner: "" }])
  }

  function updateDecision(idx: number, field: keyof Decision, value: string) {
    setDecisions((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)))
  }

  function removeDecision(idx: number) {
    setDecisions((prev) => prev.filter((_, i) => i !== idx))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error && !meeting) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <p className="text-muted-foreground">{error}</p>
        <Button asChild variant="outline">
          <Link href="/meetings">Back to Meetings</Link>
        </Button>
      </div>
    )
  }

  if (!meeting) return null

  const agenda = meeting.agenda ?? []
  const totalDuration = agenda.reduce((s, a) => s + (a.duration ?? 0), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="mt-1">
          <Link href="/meetings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    statusColors[meeting.status]
                  )}
                >
                  {meeting.status.replace(/_/g, " ")}
                </span>
                {meeting.project && (
                  <Link
                    href={`/projects/${meeting.project.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {meeting.project.name}
                  </Link>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{meeting.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDateTime(meeting.startTime)} – {formatDateTime(meeting.endTime)}
                </span>
                {meeting.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {meeting.location}
                  </span>
                )}
              </div>
            </div>
            {meeting.status !== "COMPLETED" && meeting.status !== "CANCELLED" && (
              <Button
                onClick={completeMeeting}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Complete Meeting
              </Button>
            )}
          </div>
          {meeting.description && (
            <p className="mt-3 text-sm text-muted-foreground">{meeting.description}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Agenda */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Agenda
                {totalDuration > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    Total: {totalDuration} min
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agenda.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agenda items</p>
              ) : (
                <ol className="space-y-2">
                  {agenda.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm">
                      <span className="font-semibold text-muted-foreground w-5 shrink-0">
                        {idx + 1}.
                      </span>
                      <span className="flex-1">{item.topic}</span>
                      {item.duration && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {item.duration} min
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Minutes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meeting Minutes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                rows={8}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="Record what was discussed during the meeting..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
              <Button variant="outline" size="sm" onClick={saveMinutes} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saving ? "Saving…" : "Save Minutes"}
              </Button>
            </CardContent>
          </Card>

          {/* Decisions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Decisions</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addDecision}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Decision
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {decisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No decisions recorded yet</p>
              ) : (
                decisions.map((d, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <input
                        value={d.text}
                        onChange={(e) => updateDecision(idx, "text", e.target.value)}
                        placeholder="Decision or action agreed upon"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        value={d.owner ?? ""}
                        onChange={(e) => updateDecision(idx, "owner", e.target.value)}
                        placeholder="Owner (optional)"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDecision(idx)}
                      className="text-muted-foreground hover:text-destructive mt-0.5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
              {decisions.length > 0 && (
                <Button variant="outline" size="sm" onClick={saveMinutes} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? "Saving…" : "Save Decisions"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Attendees ({meeting.attendees.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {meeting.attendees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendees added</p>
              ) : (
                <ul className="space-y-1">
                  {meeting.attendees.map((a, idx) => (
                    <li key={idx} className="text-sm flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                        {a.charAt(0).toUpperCase()}
                      </div>
                      {a}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2 pt-1">
                <input
                  value={newAttendee}
                  onChange={(e) => setNewAttendee(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAttendee())}
                  placeholder="Name or email"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button type="button" size="sm" variant="outline" onClick={addAttendee}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {meeting.creator && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Organised by</p>
                <p className="text-sm font-medium mt-0.5">{meeting.creator.name}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
