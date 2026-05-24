import { TaxSettingsClient } from "./tax-settings-client"

export const metadata = { title: "Tax Settings — Crontract" }

export default function TaxSettingsPage() {
  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold">Tax Settings</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Ghana PAYE brackets, SSNIT and Tier 2 rates, and reliefs. Edit per tax year; historical
        POSTED runs are not affected because they snapshot the rates that were in effect at posting time.
      </p>
      <TaxSettingsClient defaultYear={new Date().getFullYear()} />
    </div>
  )
}
