"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatDateTime } from "@/lib/utils"
import { FileText, ArrowLeft, Save, Clock, User, Folder } from "lucide-react"

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

const DOC_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"]

interface Document {
  id: string
  title: string
  content?: string
  docType: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
  creator?: { id: string; name: string } | null
  folder?: { id: string; name: string } | null
}

export default function DocumentDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState("")
  const [dirty, setDirty] = useState(false)

  const fetchDoc = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${id}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to load document")
        return
      }
      const d = data.document as Document
      setDoc(d)
      setContent(d.content ?? "")
      setTitle(d.title)
      setStatus(d.status)
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDoc()
  }, [fetchDoc])

  async function saveDocument() {
    if (!doc) return
    setSaving(true)
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, status }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to save")
        return
      }
      setDoc(data.document)
      setDirty(false)
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error && !doc) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <p className="text-muted-foreground">{error}</p>
        <Button asChild variant="outline">
          <Link href="/documents">Back to Documents</Link>
        </Button>
      </div>
    )
  }

  if (!doc) return null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="mt-1">
          <Link href="/documents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn("text-xs px-2 py-0.5 rounded font-medium", docTypeColors[doc.docType])}>
              {doc.docType}
            </span>
            <span className="text-xs text-muted-foreground">v{doc.version}</span>
            {doc.folder && (
              <Link
                href={`/documents?folderId=${doc.folder.id}`}
                className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
              >
                <Folder className="h-3 w-3" />
                {doc.folder.name}
              </Link>
            )}
          </div>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
            className="text-2xl font-bold tracking-tight w-full bg-transparent border-0 border-b border-transparent hover:border-input focus:border-input focus:outline-none py-1 transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-6">
        {/* Editor */}
        <div className="flex-1 min-w-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Content</CardTitle>
                <Button
                  size="sm"
                  onClick={saveDocument}
                  disabled={saving || !dirty}
                  variant={dirty ? "default" : "outline"}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? "Saving…" : dirty ? "Save Changes" : "Saved"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <textarea
                rows={20}
                value={content}
                onChange={(e) => { setContent(e.target.value); setDirty(true) }}
                placeholder="Start writing your document..."
                className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono leading-relaxed"
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="w-56 shrink-0 hidden lg:block space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setDirty(true) }}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {DOC_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <span
                  className={cn(
                    "mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium inline-block",
                    statusColors[status]
                  )}
                >
                  {status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                {doc.creator && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    <span>{doc.creator.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span>Created {formatDateTime(doc.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span>Modified {formatDateTime(doc.updatedAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Version History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-sm">v{doc.version} (current)</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Full version history coming soon
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Approval Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-2">
                <FileText className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">
                  {status === "APPROVED"
                    ? "This document is approved"
                    : "Not yet approved"}
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
