import { LoansClient } from "./loans-client"

export const metadata = { title: "Payroll Loans — Crontract" }

export default function PayrollLoansPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Staff Loans</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Loans deducted from monthly payroll. Active loans are auto-applied during run posting,
          capped at remaining balance.
        </p>
      </div>
      <LoansClient />
    </div>
  )
}
