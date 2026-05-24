import { ComponentsClient } from "./components-client"

export const metadata = { title: "Pay Components — Crontract" }

export default function PayComponentsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Pay Components</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Earnings, deductions, and statutory items used to build payslips.
        </p>
      </div>
      <ComponentsClient />
    </div>
  )
}
