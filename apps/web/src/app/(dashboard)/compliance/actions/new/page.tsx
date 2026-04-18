"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save } from "lucide-react"

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]

interface AuditOption {
  id: string
  auditNumber: string
  title: string
}

interface ObligationOption {
  id: string
  title: string
}

export default function NewActionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [auditId, setAuditId] = useState("")
  const [obligationId, setObligationId] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState("MEDIUM")
  const [notes, setNotes] = useState("")

  const [audits, setAudits] = useState<AuditOption[]>([])
  const [obligations, setObligations] = useState<ObligationOption[]>([])

  useEffect(() => {
    fetch("/api/compliance/audits")
      .then((r) => r.json())
      .then((data) => setAudits(data.audits ?? []))
      .catch(() => {})
    fetch("/api/compliance/obligations")
      .then((r) => r.json())
      .then((data) => setObligations(data.obligations ?? []))
      .catch(() => {})
  }, [])

  async function submit() {
    setError(null)
    if (!title.trim()) { setError("Title is required"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/compliance/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          auditId: auditId || undefined,
          obligationId: obligationId || undefined,
          dueDate: dueDate || undefined,
          priority,
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to create action")
      }
      router.push("/compliance/actions")
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
          <Link href="/compliance/actions">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Corrective Action</h1>
          <p className="text-muted-foreground">Create a new corrective or preventive action</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Action Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Action title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the corrective action..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Audit</Label>
            <Select value={auditId} onValueChange={setAuditId}>
              <SelectTrigger>
                <SelectValue placeholder="Select audit (optional)" />
              </SelectTrigger>
              <SelectContent>
                {audits.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.auditNumber} - {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Obligation</Label>
            <Select value={obligationId} onValueChange={setObligationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select obligation (optional)" />
              </SelectTrigger>
              <SelectContent>
                {obligations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? "Creating..." : "Add Action"}
        </Button>
      </div>
    </div>
  )
}
