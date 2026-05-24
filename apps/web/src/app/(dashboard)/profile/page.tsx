"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { KeyRound, Loader2, Save, Wallet } from "lucide-react"

interface ProfileData {
  user: {
    id: string
    email: string
    name: string
    avatarUrl: string | null
    createdAt: string
  }
  employee: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    jobTitle: string | null
    employmentType: string
    startDate: string
    status: string
    department: { id: string; name: string } | null
  } | null
  role: string | null
  workspaceName: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile")
        if (!res.ok) throw new Error("Failed to fetch profile")
        const data: ProfileData = await res.json()
        setProfile(data)
        setName(data.user.name)
        setPhone(data.employee?.phone ?? "")
      } catch {
        toast({
          title: "Error",
          description: "Could not load profile data.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [toast])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }
      toast({ title: "Saved", description: "Profile updated successfully." })
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not save profile.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Unable to load profile.
      </div>
    )
  }

  const { user, employee, role, workspaceName } = profile

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">
          View and manage your account information.
        </p>
      </div>

      {/* Editable fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Read-only account info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-muted-foreground text-xs">Email</Label>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Role</Label>
              <div>
                <Badge variant="secondary">{role ?? "Member"}</Badge>
              </div>
            </div>
            {workspaceName && (
              <div>
                <Label className="text-muted-foreground text-xs">
                  Workspace
                </Label>
                <p className="text-sm font-medium">{workspaceName}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground text-xs">
                Account Created
              </Label>
              <p className="text-sm font-medium">
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee details (if linked) */}
      {employee && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Employment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {employee.jobTitle && (
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Job Title
                  </Label>
                  <p className="text-sm font-medium">{employee.jobTitle}</p>
                </div>
              )}
              {employee.department && (
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Department
                  </Label>
                  <p className="text-sm font-medium">
                    {employee.department.name}
                  </p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground text-xs">
                  Employment Type
                </Label>
                <p className="text-sm font-medium">
                  {employee.employmentType.replace(/_/g, " ")}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">
                  Employment Status
                </Label>
                <div>
                  <Badge
                    variant={
                      employee.status === "ACTIVE" ? "default" : "secondary"
                    }
                  >
                    {employee.status}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">
                  Start Date
                </Label>
                <p className="text-sm font-medium">
                  {new Date(employee.startDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payroll</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => router.push("/profile/payslips")}>
            <Wallet className="mr-2 h-4 w-4" />
            My Payslips
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => router.push("/first-login/change-password")}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
