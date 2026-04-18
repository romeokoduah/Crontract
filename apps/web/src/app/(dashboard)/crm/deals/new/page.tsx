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
import { formatCurrency } from "@/lib/utils"
import { ArrowLeft, Save } from "lucide-react"

const CURRENCIES = ["GHS", "USD", "EUR", "GBP", "NGN", "ZAR"]

const DEAL_STAGES = [
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "CONTRACT_SENT", label: "Contract Sent" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
]

interface Company {
  id: string
  name: string
}

interface Contact {
  id: string
  firstName: string
  lastName: string
}

export default function NewDealPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])

  const [title, setTitle] = useState("")
  const [value, setValue] = useState("")
  const [currency, setCurrency] = useState("GHS")
  const [contactId, setContactId] = useState("")
  const [companyId, setCompanyId] = useState("")
  const [stage, setStage] = useState("QUALIFIED")
  const [probability, setProbability] = useState("0")
  const [expectedCloseDate, setExpectedCloseDate] = useState("")
  const [notes, setNotes] = useState("")

  const numericValue = parseFloat(value) || 0
  const numericProbability = parseInt(probability) || 0
  const weightedValue = numericValue * (numericProbability / 100)

  useEffect(() => {
    Promise.all([
      fetch("/api/crm/companies").then((r) => r.json()),
      fetch("/api/crm/contacts").then((r) => r.json()),
    ]).then(([compData, contData]) => {
      setCompanies(compData.companies ?? [])
      setContacts(contData.contacts ?? [])
    }).catch(() => {})
  }, [])

  async function submit() {
    setError(null)
    if (!title.trim()) { setError("Deal title is required"); return }
    if (!numericValue || numericValue <= 0) { setError("Deal value must be positive"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          value: numericValue,
          currency,
          stage,
          probability: numericProbability,
          contactId: contactId || undefined,
          companyId: companyId || undefined,
          expectedCloseDate: expectedCloseDate || undefined,
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to create deal")
      }
      router.push("/crm/deals")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/crm/deals">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Deal</h1>
          <p className="text-muted-foreground">Create a new deal in your pipeline</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deal Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="title">Deal Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g. Enterprise License Agreement"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="value">Value *</Label>
                <Input
                  id="value"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
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
                <Label>Contact</Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEAL_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="probability">Probability (%)</Label>
                <Input
                  id="probability"
                  type="number"
                  min="0"
                  max="100"
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
                <Input
                  id="expectedCloseDate"
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Panel */}
        <div className="space-y-4">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Deal Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deal Value</span>
                  <span className="font-medium">{formatCurrency(numericValue, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Probability</span>
                  <span className="font-medium">{numericProbability}%</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-base">
                  <span>Weighted Value</span>
                  <span className="text-violet-600">{formatCurrency(weightedValue, currency)}</span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  className="w-full"
                  onClick={submit}
                  disabled={loading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Creating..." : "Create Deal"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
