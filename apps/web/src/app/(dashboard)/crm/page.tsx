import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Briefcase, Bell } from "lucide-react"

export default function CRMPage() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="max-w-md w-full text-center space-y-6 px-4">
        <div className="flex items-center justify-center">
          <div className="h-20 w-20 rounded-2xl bg-violet-100 flex items-center justify-center">
            <Briefcase className="h-10 w-10 text-violet-600" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
              Coming Soon
            </span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Manage your client relationships, track leads and opportunities, and monitor your sales
            pipeline. Keep every customer interaction organised and accessible.
          </p>
        </div>

        <Card className="bg-muted/40 border-dashed">
          <CardContent className="pt-5 pb-5">
            <ul className="text-sm text-left space-y-2 text-muted-foreground">
              {[
                "Contact & account management",
                "Lead and opportunity pipeline",
                "Deal tracking with stage management",
                "Client communication history",
                "Quote and proposal management",
                "Revenue forecasting dashboard",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
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
