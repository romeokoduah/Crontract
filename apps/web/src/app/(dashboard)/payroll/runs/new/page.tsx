import { NewRunClient } from "./new-run-client"

export const metadata = { title: "New Payroll Run — Crontract" }

export default function NewRunPage() {
  const now = new Date()
  // Default to last completed month (safer than current month-in-progress)
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">New Payroll Run</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Selecting a period below will compute payslips for all active employees with a basic salary set.
      </p>
      <NewRunClient defaultYear={prev.getFullYear()} defaultMonth={prev.getMonth() + 1} />
    </div>
  )
}
