"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Calendar, ArrowLeft, Plus, Trash2 } from "lucide-react"

interface AgendaItem {
  topic: string
  duration: string
}

interface Project {
  id: string
  name: string
}

export default function NewMeetingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  const [form, setForm] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    location: "",
    projectId: "",
  })

  const [agenda, setAgenda] = useState<AgendaItem[]>([{ topic: "", duration: "" }])

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {})
  }, [])

  function addAgendaItem() {
    setAgenda((prev) => [...prev, { topic: "", duration: "" }])
  }

  function removeAgendaItem(idx: number) {
    setAgenda((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateAgendaItem(idx: number, field: keyof AgendaItem, value: string) {
    setAgenda((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.startTime || !form.endTime) {
      setError("Start and end time are required")
      return
    }
    if (new Date(form.endTime) <= new Date(form.startTime)) {
      setError("End time must be after start time")
      return
    }

    setLoading(true)
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location || undefined,
        projectId: form.projectId || undefined,
        agenda: agenda
          .filter((a) => a.topic.trim())
          .map((a) => ({
            topic: a.topic,
            duration: a.duration ? parseInt(a.duration) : undefined,
          })),
      }

      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to create meeting")
        return
      }
      router.push(`/meetings/${data.meeting.id}`)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/meetings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Schedule Meeting
          </h1>
          <p className="text-muted-foreground text-sm">Create a new meeting and set the agenda</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meeting Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <input
                id="title"
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Weekly Project Sync"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                placeholder="Purpose and context for this meeting..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time *</Label>
                <input
                  id="startTime"
                  type="datetime-local"
                  required
                  value={form.startTime}
                  onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time *</Label>
                <input
                  id="endTime"
                  type="datetime-local"
                  required
                  value={form.endTime}
                  onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">Location</Label>
                <input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Board Room, Zoom Link"
                />
              </div>
              <div>
                <Label htmlFor="projectId">Project (optional)</Label>
                <select
                  id="projectId"
                  value={form.projectId}
                  onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agenda */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Agenda Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addAgendaItem}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {agenda.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No agenda items. Click Add Item to start.
              </p>
            ) : (
              agenda.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <span className="mt-2 text-sm font-medium text-muted-foreground w-5 text-right shrink-0">
                    {idx + 1}.
                  </span>
                  <div className="flex-1">
                    <input
                      value={item.topic}
                      onChange={(e) => updateAgendaItem(idx, "topic", e.target.value)}
                      placeholder="Agenda topic"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <div className="flex items-center">
                      <input
                        type="number"
                        min={0}
                        value={item.duration}
                        onChange={(e) => updateAgendaItem(idx, "duration", e.target.value)}
                        placeholder="mins"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAgendaItem(idx)}
                    className="text-muted-foreground hover:text-destructive mt-0.5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
            {agenda.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Duration in minutes (optional). Total:{" "}
                {agenda.reduce((s, a) => s + (parseInt(a.duration) || 0), 0)} min
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/meetings">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading} className="min-w-[140px]">
            {loading ? "Creating…" : "Schedule Meeting"}
          </Button>
        </div>
      </form>
    </div>
  )
}
