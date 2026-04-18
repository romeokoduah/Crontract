"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save } from "lucide-react"

const TYPES = ["INTERNAL", "EXTERNAL", "REGULATORY"]

export default function NewAuditPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [type, setType] = useState("INTERNAL")
  const [auditor, setAuditor] = useState("")
  const [scope, setScope] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")

  async function submit() {
    setError(null)
    if (!title.trim()) { setError("Title is required"); return }
    if (!scheduledDate) { setError("Scheduled date is required"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/compliance/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          auditor: auditor || undefined,
          scope: scope || undefined,
          scheduledDate,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to schedule audit")
      }
      router.push("/compliance/audits")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/compliance/audits">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule Audit</h1>
          <p className="text-muted-foreground">Schedule a new compliance audit</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Audit title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auditor">Auditor</Label>
            <Input
              id="auditor"
              placeholder="Auditor name or firm"
              value={auditor}
              onChange={(e) => setAuditor(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scheduledDate">Scheduled Date *</Label>
            <Input
              id="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="scope">Scope</Label>
            <Textarea
              id="scope"
              placeholder="Describe the audit scope..."
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? "Scheduling..." : "Schedule Audit"}
        </Button>
      </div>
    </div>
  )
}
