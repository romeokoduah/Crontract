"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Save, Loader2, CheckSquare, Square, Minus } from "lucide-react"

interface Role {
  id: string
  name: string
  isSystem: boolean
}

interface Permission {
  id: string
  code: string
  module: string
  entity: string
  action: string
  description: string | null
}

interface Props {
  roles: Role[]
  permissions: Permission[]
  permissionsByModule: Record<string, Permission[]>
  initialState: Record<string, string[]> // roleId -> permissionIds
}

type MatrixState = Record<string, Set<string>> // roleId -> Set<permissionId>

export function PermissionMatrix({ roles, permissions, permissionsByModule, initialState }: Props) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const [state, setState] = useState<MatrixState>(() => {
    const m: MatrixState = {}
    for (const [roleId, permIds] of Object.entries(initialState)) {
      m[roleId] = new Set(permIds)
    }
    return m
  })

  function toggle(roleId: string, permissionId: string) {
    setState((prev) => {
      const next = { ...prev }
      const set = new Set(prev[roleId] ?? [])
      if (set.has(permissionId)) {
        set.delete(permissionId)
      } else {
        set.add(permissionId)
      }
      next[roleId] = set
      return next
    })
  }

  function toggleModule(roleId: string, moduleName: string, checked: boolean) {
    const modulePermIds = (permissionsByModule[moduleName] ?? []).map((p) => p.id)
    setState((prev) => {
      const next = { ...prev }
      const set = new Set(prev[roleId] ?? [])
      if (checked) {
        modulePermIds.forEach((id) => set.add(id))
      } else {
        modulePermIds.forEach((id) => set.delete(id))
      }
      next[roleId] = set
      return next
    })
  }

  function getModuleState(roleId: string, moduleName: string): "all" | "none" | "partial" {
    const modulePermIds = (permissionsByModule[moduleName] ?? []).map((p) => p.id)
    const rolePerms = state[roleId] ?? new Set<string>()
    const count = modulePermIds.filter((id) => rolePerms.has(id)).length
    if (count === 0) return "none"
    if (count === modulePermIds.length) return "all"
    return "partial"
  }

  async function saveAll() {
    setSaveStatus("saving")
    setErrorMsg("")

    try {
      const results = await Promise.all(
        roles.map((role) =>
          fetch(`/api/admin/roles/${role.id}/permissions`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ permissionIds: Array.from(state[role.id] ?? []) }),
          }).then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
        )
      )

      const failed = results.find((r) => !r.ok)
      if (failed) {
        setErrorMsg(failed.data.error ?? "Failed to save some permissions")
        setSaveStatus("error")
      } else {
        setSaveStatus("saved")
        setTimeout(() => setSaveStatus("idle"), 2500)
      }
    } catch {
      setErrorMsg("Network error")
      setSaveStatus("error")
    }
  }

  const modules = Object.keys(permissionsByModule).sort()

  return (
    <div className="space-y-4">
      {/* Save bar */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
        <div className="text-sm text-muted-foreground">
          {roles.length} role{roles.length !== 1 ? "s" : ""} · {permissions.length} permission{permissions.length !== 1 ? "s" : ""} · {modules.length} module{modules.length !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === "error" && (
            <p className="text-sm text-red-600">{errorMsg}</p>
          )}
          {saveStatus === "saved" && (
            <p className="text-sm text-green-600 font-medium">Saved!</p>
          )}
          <Button onClick={saveAll} disabled={saveStatus === "saving"} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saveStatus === "saving" ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Save Permissions</>
            )}
          </Button>
        </div>
      </div>

      {permissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">No permissions defined yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Permissions are seeded by the system. Contact your administrator.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/70 border-b">
                <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap min-w-[220px] sticky left-0 bg-muted/70 z-10">
                  Permission
                </th>
                {roles.map((role) => (
                  <th key={role.id} className="px-3 py-3 font-semibold text-center whitespace-nowrap min-w-[110px]">
                    <div className="flex flex-col items-center gap-1">
                      <span>{role.name}</span>
                      {role.isSystem && (
                        <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 rounded">SYSTEM</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((moduleName) => {
                const modulePerms = permissionsByModule[moduleName] ?? []
                return (
                  <>
                    {/* Module header row */}
                    <tr key={`module-${moduleName}`} className="bg-muted/30 border-b border-t">
                      <td className="px-4 py-2 sticky left-0 bg-muted/30 z-10">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {moduleName}
                        </span>
                      </td>
                      {roles.map((role) => {
                        const ms = getModuleState(role.id, moduleName)
                        return (
                          <td key={role.id} className="px-3 py-2 text-center">
                            <button
                              onClick={() => toggleModule(role.id, moduleName, ms !== "all")}
                              className="mx-auto flex items-center justify-center h-5 w-5 rounded hover:bg-muted transition-colors"
                              title={ms === "all" ? "Uncheck all" : "Check all"}
                            >
                              {ms === "all" ? (
                                <CheckSquare className="h-4 w-4 text-indigo-600" />
                              ) : ms === "partial" ? (
                                <Minus className="h-4 w-4 text-indigo-400" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                    {/* Permission rows */}
                    {modulePerms.map((perm, idx) => (
                      <tr
                        key={perm.id}
                        className={cn(
                          "border-b hover:bg-muted/20 transition-colors",
                          idx % 2 === 1 ? "bg-muted/5" : ""
                        )}
                      >
                        <td className="px-4 py-2 sticky left-0 bg-background hover:bg-muted/20 z-10">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{perm.entity} · {perm.action}</span>
                            {perm.description && (
                              <span className="text-xs text-muted-foreground">{perm.description}</span>
                            )}
                            <span className="text-[10px] text-muted-foreground/70 font-mono">{perm.code}</span>
                          </div>
                        </td>
                        {roles.map((role) => {
                          const hasPermission = state[role.id]?.has(perm.id) ?? false
                          return (
                            <td key={role.id} className="px-3 py-2 text-center">
                              <button
                                onClick={() => toggle(role.id, perm.id)}
                                className={cn(
                                  "mx-auto h-5 w-5 rounded border-2 flex items-center justify-center transition-all",
                                  hasPermission
                                    ? "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700"
                                    : "border-muted-foreground/30 hover:border-indigo-400"
                                )}
                              >
                                {hasPermission && (
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
