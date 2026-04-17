"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, Save, Trash2, Building2, Globe, Puzzle } from "lucide-react"
import { cn } from "@/lib/utils"

interface Workspace {
  id: string
  name: string
  legalName: string | null
  slug: string
  businessType: string
  country: string
  currency: string
  timezone: string
  modules: string[]
  logoUrl: string | null
}

interface Module {
  key: string
  label: string
}

interface Props {
  workspace: Workspace
  allModules: Module[]
}

const BUSINESS_TYPES = [
  { value: "MINING_CONTRACTOR", label: "Mining Contractor" },
  { value: "NGO", label: "NGO / Non-profit" },
  { value: "STARTUP", label: "Startup / SME" },
]

const TIMEZONES = [
  "Africa/Accra", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles",
  "Asia/Dubai", "Asia/Singapore", "Australia/Sydney",
]

const CURRENCIES = ["GHS", "USD", "EUR", "GBP", "NGN", "KES", "ZAR", "AED", "SGD", "AUD"]

export function WorkspaceSettingsClient({ workspace, allModules }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showDangerZone, setShowDangerZone] = useState(false)
  const [confirmName, setConfirmName] = useState("")

  const [form, setForm] = useState({
    name: workspace.name,
    legalName: workspace.legalName ?? "",
    slug: workspace.slug,
    businessType: workspace.businessType,
    country: workspace.country,
    currency: workspace.currency,
    timezone: workspace.timezone,
  })

  const [enabledModules, setEnabledModules] = useState<Set<string>>(new Set(workspace.modules))

  function toggleModule(key: string) {
    setEnabledModules((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  async function handleSave() {
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch("/api/admin/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          legalName: form.legalName || null,
          modules: Array.from(enabledModules),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to save"); return }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      router.refresh()
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Workspace Name *</Label>
              <input
                id="name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <Label htmlFor="legalName">Legal Name</Label>
              <input
                id="legalName"
                value={form.legalName}
                onChange={(e) => setForm((p) => ({ ...p, legalName: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Legal company name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="slug">URL Slug</Label>
              <div className="flex mt-1">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                  crontract.app/
                </span>
                <input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                  className="flex-1 rounded-r-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="businessType">Business Type</Label>
              <select
                id="businessType"
                value={form.businessType}
                onChange={(e) => setForm((p) => ({ ...p, businessType: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {BUSINESS_TYPES.map((bt) => (
                  <option key={bt.value} value={bt.value}>{bt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regional */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-green-500" />
            Regional Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="country">Country</Label>
              <input
                id="country"
                value={form.country}
                onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="GH"
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={form.currency}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={form.timezone}
                onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-purple-500" />
            Enabled Modules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {allModules.map((mod) => (
              <div
                key={mod.key}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                  enabledModules.has(mod.key) ? "border-indigo-200 bg-indigo-50" : "border-muted"
                )}
              >
                <span className={cn("text-sm font-medium", enabledModules.has(mod.key) ? "text-indigo-700" : "text-muted-foreground")}>
                  {mod.label}
                </span>
                <Switch
                  checked={enabledModules.has(mod.key)}
                  onCheckedChange={() => toggleModule(mod.key)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-between">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600 font-medium">Settings saved!</p>}
        {!error && !success && <span />}
        <Button onClick={handleSave} disabled={loading} className="min-w-[120px]">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
            <div>
              <p className="font-medium text-sm text-red-700">Delete Workspace</p>
              <p className="text-xs text-red-600 mt-0.5">Permanently delete this workspace and all its data. This cannot be undone.</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDangerZone(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={showDangerZone} onOpenChange={setShowDangerZone}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{workspace.name}</strong> and all its data including projects, finance records, and HSE records.
              <br /><br />
              Type <strong>{workspace.name}</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={workspace.name}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmName !== workspace.name}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
              onClick={() => {
                // In production: call DELETE /api/admin/workspace and redirect
                alert("Delete workspace functionality - implement in production")
              }}
            >
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
