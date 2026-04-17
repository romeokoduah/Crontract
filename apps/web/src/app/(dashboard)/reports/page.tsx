import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BarChart3, Bell } from "lucide-react"

export default function ReportsPage() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="max-w-md w-full text-center space-y-6 px-4">
        <div className="flex items-center justify-center">
          <div className="h-20 w-20 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <BarChart3 className="h-10 w-10 text-indigo-600" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Reports &amp; Analytics</h1>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
              Coming Soon
            </span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Cross-module analytics, custom report builder, and executive dashboards. Turn your
            operational data into insights that drive better decisions.
          </p>
        </div>

        <Card className="bg-muted/40 border-dashed">
          <CardContent className="pt-5 pb-5">
            <ul className="text-sm text-left space-y-2 text-muted-foreground">
              {[
                "Custom report builder with drag & drop",
                "Cross-module data blending",
                "Executive KPI dashboards",
                "Scheduled report delivery via email",
                "Export to PDF, Excel, and CSV",
                "AI-powered insights and anomaly detection",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Button variant="outline" className="gap-2" disabled>
          <Bell className="h-4 w-4" />
          Notify me when it&apos;s ready
        </Button>
      </div>
    </div>
  )
}
