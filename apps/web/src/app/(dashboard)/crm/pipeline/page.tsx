"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

const STAGES = [
  { key: "QUALIFIED", label: "Qualified" },
  { key: "PROPOSAL", label: "Proposal" },
  { key: "NEGOTIATION", label: "Negotiation" },
  { key: "CONTRACT_SENT", label: "Contract Sent" },
  { key: "WON", label: "Won" },
  { key: "LOST", label: "Lost" },
] as const

interface Deal {
  id: string
  number: string
  title: string
  value: string | number
  currency: string
  stage: string
  probability: number
  expectedCloseDate: string | null
  company: { name: string } | null
  contact: { firstName: string; lastName: string } | null
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/crm/deals")
      .then((res) => res.json())
      .then((data) => setDeals(data.deals ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="text-muted-foreground">Kanban view of your sales pipeline</p>
      </div>

      <div className="flex overflow-x-auto gap-4 pb-4">
        {STAGES.map(({ key, label }) => {
          const stageDeals = deals.filter((d) => d.stage === key)
          const totalValue = stageDeals.reduce((s, d) => s + Number(d.value), 0)

          const columnBg =
            key === "WON"
              ? "bg-green-50 border-green-200"
              : key === "LOST"
              ? "bg-red-50 border-red-200"
              : "bg-gray-50 border-gray-200"

          return (
            <div
              key={key}
              className={cn(
                "min-w-[280px] flex-shrink-0 rounded-lg border p-3 space-y-3",
                columnBg
              )}
            >
              {/* Column Header */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <span className="text-xs font-medium bg-white px-2 py-0.5 rounded-full border">
                    {stageDeals.length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  {formatCurrency(totalValue)}
                </p>
              </div>

              {/* Deal Cards */}
              <div className="space-y-2">
                {stageDeals.map((deal) => (
                  <Card key={deal.id} className="bg-white shadow-sm">
                    <CardContent className="p-3 space-y-2">
                      <div>
                        <p className="text-sm font-medium leading-tight">{deal.title}</p>
                        {deal.company && (
                          <p className="text-xs text-muted-foreground mt-0.5">{deal.company.name}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          {formatCurrency(Number(deal.value), deal.currency)}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded font-medium",
                            deal.probability >= 70
                              ? "bg-green-100 text-green-700"
                              : deal.probability >= 40
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                          )}
                        >
                          {deal.probability}%
                        </span>
                      </div>
                      {deal.expectedCloseDate && (
                        <p className="text-xs text-muted-foreground">
                          Close: {formatDate(deal.expectedCloseDate)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {stageDeals.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No deals</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
