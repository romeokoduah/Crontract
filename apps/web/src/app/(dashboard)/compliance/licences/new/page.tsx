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

const CURRENCIES = ["GHS", "USD", "EUR", "GBP", "NGN", "ZAR"]

export default function NewLicencePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [issuingAuthority, setIssuingAuthority] = useState("")
  const [licenceNumber, setLicenceNumber] = useState("")
  const [category, setCategory] = useState("")
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0])
  const [expiryDate, setExpiryDate] = useState("")
  const [renewalCost, setRenewalCost] = useState("")
  const [currency, setCurrency] = useState("GHS")
  const [alertDaysBefore, setAlertDaysBefore] = useState(30)
  const [notes, setNotes] = useState("")

  async function submit() {
    setError(null)
    if (!name.trim()) { setError("Name is required"); return }
    if (!issuingAuthority.trim()) { setError("Issuing authority is required"); return }
    if (!licenceNumber.trim()) { setError("Licence number is required"); return }
    if (!expiryDate) { setError("Expiry date is required"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/compliance/licences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          issuingAuthority,
          licenceNumber,
          category: category || undefined,
          issueDate,
          expiryDate,
          renewalCost: renewalCost ? parseFloat(renewalCost) : undefined,
          currency,
          alertDaysBefore,
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to create licence")
      }
      router.push("/compliance/licences")
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
          <Link href="/compliance/licences">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Licence</h1>
          <p className="text-muted-foreground">Register a new licence or permit</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Licence Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Licence name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issuingAuthority">Issuing Authority *</Label>
            <Input
              id="issuingAuthority"
              placeholder="e.g. Minerals Commission"
              value={issuingAuthority}
              onChange={(e) => setIssuingAuthority(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="licenceNumber">Licence Number *</Label>
            <Input
              id="licenceNumber"
              placeholder="e.g. MC-2024-001"
              value={licenceNumber}
              onChange={(e) => setLicenceNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="e.g. Mining, Environmental"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issueDate">Issue Date</Label>
            <Input
              id="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expiryDate">Expiry Date *</Label>
            <Input
              id="expiryDate"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="renewalCost">Renewal Cost</Label>
            <Input
              id="renewalCost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={renewalCost}
              onChange={(e) => setRenewalCost(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alertDaysBefore">Alert Days Before Expiry</Label>
            <Input
              id="alertDaysBefore"
              type="number"
              min="1"
              value={alertDaysBefore}
              onChange={(e) => setAlertDaysBefore(parseInt(e.target.value) || 30)}
            />
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
          {loading ? "Creating..." : "Add Licence"}
        </Button>
      </div>
    </div>
  )
}
