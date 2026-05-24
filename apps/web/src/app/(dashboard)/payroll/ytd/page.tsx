import { YtdClient } from "./ytd-client"

export const metadata = { title: "Year-to-Date — Crontract" }

export default function YtdPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Year-to-Date</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Aggregate payroll figures per employee across all POSTED runs in the selected year.
      </p>
      <YtdClient defaultYear={new Date().getFullYear()} />
    </div>
  )
}
