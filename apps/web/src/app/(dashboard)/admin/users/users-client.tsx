"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { formatDate, getInitials } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { UserPlus, Trash2, Crown, Loader2, Mail } from "lucide-react"

interface Member {
  id: string
  userId: string
  name: string
  email: string
  avatarUrl: string | null
  role: { id: string; name: string }
  isOwner: boolean
  joinedAt: Date
}

interface Role {
  id: string
  name: string
}

interface PendingInvitation {
  id: string
  email: string
  status: string
  expiresAt: Date
  createdAt: Date
}

interface Props {
  members: Member[]
  roles: Role[]
  pendingInvitations: PendingInvitation[]
  currentUserId: string
}

export function UsersClient({ members: initialMembers, roles, pendingInvitations, currentUserId }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRoleId, setInviteRoleId] = useState(roles[0]?.id ?? "")
  const [inviteSuccess, setInviteSuccess] = useState(false)

  async function handleInvite() {
    if (!inviteEmail || !inviteRoleId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, roleId: inviteRoleId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to send invitation"); return }
      setInviteSuccess(true)
      setInviteEmail("")
      router.refresh()
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  async function handleChangeRole(memberId: string, roleId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      })
      const data = await res.json()
      if (!res.ok) return
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: data.membership.role } : m))
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    if (!memberToRemove) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/members/${memberToRemove.id}`, { method: "DELETE" })
      if (!res.ok) return
      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id))
    } finally {
      setLoading(false)
      setMemberToRemove(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Team Members</CardTitle>
          <Button onClick={() => { setShowInviteDialog(true); setInviteSuccess(false); setError(null) }}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Member</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Joined</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {getInitials(member.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium">{member.name}</p>
                            {member.isOwner && (
                              <span title="Workspace Owner"><Crown className="h-3.5 w-3.5 text-amber-500" /></span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground sm:hidden">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{member.email}</td>
                    <td className="px-4 py-3">
                      {member.isOwner ? (
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Owner</span>
                      ) : (
                        <select
                          value={member.role.id}
                          onChange={(e) => handleChangeRole(member.id, e.target.value)}
                          disabled={loading || member.userId === currentUserId}
                          className="text-xs rounded border border-input bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell whitespace-nowrap">
                      {formatDate(member.joinedAt)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {!member.isOwner && member.userId !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMemberToRemove(member)}
                          className="text-muted-foreground hover:text-destructive h-8 w-8"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-500" />
            Pending Invitations ({pendingInvitations.length})
          </CardTitle></CardHeader>
          <CardContent className="p-0">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-6 py-3 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">Expires {formatDate(inv.expiresAt)}</p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">PENDING</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>Send an invitation to join this workspace.</DialogDescription>
          </DialogHeader>
          {inviteSuccess ? (
            <div className="text-center py-4 space-y-2">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              <p className="font-medium">Invitation sent!</p>
              <p className="text-sm text-muted-foreground">They will receive an email to join the workspace.</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 text-sm">{error}</div>
              )}
              <div>
                <Label htmlFor="invite-email">Email Address</Label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={inviteRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              {inviteSuccess ? "Close" : "Cancel"}
            </Button>
            {!inviteSuccess && (
              <Button onClick={handleInvite} disabled={loading || !inviteEmail}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send Invitation
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{memberToRemove?.name}</strong> from the workspace?
              They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
