"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn, formatDateTime, getInitials } from "@/lib/utils"
import { ChevronDown, ChevronRight, ChevronLeft, Filter, X } from "lucide-react"

interface AuditLog {
  id: string
  entityType: string
  entityId: string
  action: string
  ipAddress: string | null
  createdAt: Date
  beforeState: unknown
  afterState: unknown
  user: { id: string; name: string; email: string }
}

interface User {
  id: string
  name: string
}

interface Filters {
  userId?: string
  entityType?: string
  action?: string
  from?: string
  to?: string
}

interface Props {
  logs: AuditLog[]
  total: number
  page: number
  totalPages: number
  workspaceUsers: User[]
  entityTypes: string[]
  actions: string[]
  filters: Filters
}

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  INVITE: "bg-purple-100 text-purple-700",
  REMOVE_MEMBER: "bg-orange-100 text-orange-700",
  CHANGE_ROLE: "bg-amber-100 text-amber-700",
  UPDATE_PERMISSIONS: "bg-indigo-100 text-indigo-700",
}

function getActionColor(action: string) {
  return actionColors[action] ?? "bg-gray-100 text-gray-700"
}

export function AuditClient({ logs, total, page, totalPages, workspaceUsers, entityTypes, actions, filters }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [localFilters, setLocalFilters] = useState<Filters>(filters)

  function applyFilters() {
    const params = new URLSearchParams()
    if (localFilters.userId) params.set("userId", localFilters.userId)
    if (localFilters.entityType) params.set("entityType", localFilters.entityType)
    if (localFilters.action) params.set("action", localFilters.action)
    if (localFilters.from) params.set("from", localFilters.from)
    if (localFilters.to) params.set("to", localFilters.to)
    params.set("page", "1")
    router.push(`${pathname}?${params.toString()}`)
  }

  function clearFilters() {
    setLocalFilters({})
    router.push(pathname)
  }

  function goToPage(p: number) {
    const params = new URLSearchParams()
    if (filters.userId) params.set("userId", filters.userId)
    if (filters.entityType) params.set("entityType", filters.entityType)
    if (filters.action) params.set("action", filters.action)
    if (filters.from) params.set("from", filters.from)
    if (filters.to) params.set("to", filters.to)
    params.set("page", String(p))
    router.push(`${pathname}?${params.toString()}`)
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">User</label>
              <select
                value={localFilters.userId ?? ""}
                onChange={(e) => setLocalFilters((p) => ({ ...p, userId: e.target.value || undefined }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All users</option>
                {workspaceUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Entity Type</label>
              <select
                value={localFilters.entityType ?? ""}
                onChange={(e) => setLocalFilters((p) => ({ ...p, entityType: e.target.value || undefined }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All types</option>
                {entityTypes.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Action</label>
              <select
                value={localFilters.action ?? ""}
                onChange={(e) => setLocalFilters((p) => ({ ...p, action: e.target.value || undefined }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <input
                type="date"
                value={localFilters.from ?? ""}
                onChange={(e) => setLocalFilters((p) => ({ ...p, from: e.target.value || undefined }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <input
                type="date"
                value={localFilters.to ?? ""}
                onChange={(e) => setLocalFilters((p) => ({ ...p, to: e.target.value || undefined }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex justify-between mt-3">
            <div className="text-xs text-muted-foreground">
              Showing {Math.min((page - 1) * 50 + 1, total)}–{Math.min(page * 50, total)} of {total.toLocaleString()} events
            </div>
            <div className="flex gap-2">
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
              <Button size="sm" onClick={applyFilters} className="h-7 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">No audit events found</p>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline mt-2">Clear filters</button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const isExpanded = expandedId === log.id
                const hasStateData = Boolean(log.beforeState || log.afterState)
                return (
                  <div key={log.id}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors",
                        isExpanded ? "bg-muted/20" : "",
                        hasStateData ? "cursor-pointer" : ""
                      )}
                      onClick={() => hasStateData && setExpandedId(isExpanded ? null : log.id)}
                    >
                      {/* Expand icon */}
                      <div className="w-4 flex-shrink-0">
                        {hasStateData ? (
                          isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 mx-auto" />
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="w-36 flex-shrink-0">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.createdAt)}</p>
                      </div>

                      {/* User */}
                      <div className="w-32 flex-shrink-0 hidden sm:block">
                        <div className="flex items-center gap-1.5">
                          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                            {getInitials(log.user.name)}
                          </div>
                          <span className="text-xs truncate">{log.user.name}</span>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="w-36 flex-shrink-0">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", getActionColor(log.action))}>
                          {log.action}
                        </span>
                      </div>

                      {/* Entity */}
                      <div className="flex-1 min-w-0 hidden md:block">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground">{log.entityType.replace(/_/g, " ")}</span>
                          <span className="text-xs text-muted-foreground/60 font-mono truncate">{log.entityId.slice(0, 8)}…</span>
                        </div>
                      </div>

                      {/* IP */}
                      {log.ipAddress && (
                        <div className="hidden xl:block flex-shrink-0">
                          <span className="text-xs text-muted-foreground font-mono">{log.ipAddress}</span>
                        </div>
                      )}
                    </div>

                    {/* Expanded diff view */}
                    {isExpanded && hasStateData && (
                      <div className="bg-slate-950 text-slate-100 px-6 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
                        {log.beforeState != null && (
                          <div>
                            <p className="text-red-400 font-semibold mb-2 font-sans text-[11px] uppercase tracking-wider">Before</p>
                            <pre className="overflow-x-auto text-red-300 leading-relaxed">
                              {JSON.stringify(log.beforeState, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.afterState != null && (
                          <div>
                            <p className="text-green-400 font-semibold mb-2 font-sans text-[11px] uppercase tracking-wider">After</p>
                            <pre className="overflow-x-auto text-green-300 leading-relaxed">
                              {JSON.stringify(log.afterState, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
