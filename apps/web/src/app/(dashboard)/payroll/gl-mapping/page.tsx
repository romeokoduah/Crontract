import { GlMappingClient } from "./gl-mapping-client"

export const metadata = { title: "Payroll GL Mapping — Crontract" }

export default function GlMappingPage() {
  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-1">Payroll GL Mapping</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Map each payroll posting line to a chart-of-accounts entry. You can auto-create new accounts
        using Ghana-standard codes, or pick existing ones. All 8 lines must be mapped before a
        payroll run can be posted.
      </p>
      <GlMappingClient />
    </div>
  )
}
