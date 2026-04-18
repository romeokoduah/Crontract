"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"

interface SocialAccount {
  id: string
  platform: string
  accountName: string
  handle: string
  avatarUrl: string | null
  isConnected: boolean
}

const PLATFORMS = [
  { key: "FACEBOOK", name: "Facebook", color: "#1877F2" },
  { key: "INSTAGRAM", name: "Instagram", color: "#E4405F" },
  { key: "TWITTER", name: "Twitter / X", color: "#000000" },
  { key: "LINKEDIN", name: "LinkedIn", color: "#0A66C2" },
  { key: "TIKTOK", name: "TikTok", color: "#000000" },
  { key: "YOUTUBE", name: "YouTube", color: "#FF0000" },
] as const

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connectDialog, setConnectDialog] = useState<string | null>(null)
  const [disconnectDialog, setDisconnectDialog] = useState<string | null>(null)
  const [accountName, setAccountName] = useState("")
  const [handle, setHandle] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/social-media/accounts")
      const data = await res.json()
      setAccounts(data.accounts || [])
    } catch {
      console.error("Failed to fetch accounts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const getAccountForPlatform = (platform: string) =>
    accounts.find((a) => a.platform === platform && a.isConnected)

  async function handleConnect() {
    if (!connectDialog || !accountName.trim() || !handle.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/social-media/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: connectDialog,
          accountName: accountName.trim(),
          handle: handle.trim(),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAccounts((prev) => [data.account, ...prev])
        setConnectDialog(null)
        setAccountName("")
        setHandle("")
      }
    } catch {
      console.error("Failed to connect")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDisconnect() {
    if (!disconnectDialog) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/social-media/accounts?id=${disconnectDialog}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== disconnectDialog))
        setDisconnectDialog(null)
      }
    } catch {
      console.error("Failed to disconnect")
    } finally {
      setSubmitting(false)
    }
  }

  const platformForDialog = PLATFORMS.find((p) => p.key === connectDialog)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/social-media">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connected Accounts</h1>
          <p className="text-muted-foreground">Manage your social media platform connections</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-[180px]" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLATFORMS.map((platform) => {
            const account = getAccountForPlatform(platform.key)
            const isConnected = !!account

            return (
              <Card
                key={platform.key}
                className={cn(
                  "transition-all",
                  isConnected ? "border-green-200" : "border-dashed opacity-75"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: platform.color }}
                    >
                      {platform.key[0]}
                    </div>
                    <div>
                      <CardTitle className="text-base">{platform.name}</CardTitle>
                      {isConnected ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span className="text-xs text-green-600 font-medium">Connected</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-0.5">
                          <XCircle className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-muted-foreground">Not Connected</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isConnected && account ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">{account.accountName}</p>
                        <p className="text-xs text-muted-foreground">@{account.handle}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setDisconnectDialog(account.id)}
                      >
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                      onClick={() => {
                        setConnectDialog(platform.key)
                        setAccountName("")
                        setHandle("")
                      }}
                    >
                      Connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Connect Dialog */}
      <Dialog open={!!connectDialog} onOpenChange={() => setConnectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {platformForDialog?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            OAuth integration for {platformForDialog?.name} would be configured here. For now, this creates a mock connection.
          </p>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                placeholder="My Business Page"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="handle">Handle</Label>
              <Input
                id="handle"
                placeholder="mybusiness"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={submitting || !accountName.trim() || !handle.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {submitting ? "Connecting..." : "Connect Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation */}
      <Dialog open={!!disconnectDialog} onOpenChange={() => setDisconnectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to disconnect this account? You can reconnect it later.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={submitting}
            >
              {submitting ? "Disconnecting..." : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
