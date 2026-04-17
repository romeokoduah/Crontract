import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Shield, Bell } from "lucide-react"

export default function CompliancePage() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="max-w-md w-full text-center space-y-6 px-4">
        <div className="flex items-center justify-center">
          <div className="h-20 w-20 rounded-2xl bg-blue-100 flex items-center justify-center">
            <Shield className="h-10 w-10 text-blue-600" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Compliance</h1>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
              Coming Soon
            </span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Stay on top of regulatory obligations, licences, and internal policy compliance. Get
            alerts before deadlines and maintain a complete compliance register.
          </p>
        </div>

        <Card className="bg-muted/40 border-dashed">
          <CardContent className="pt-5 pb-5">
            <ul className="text-sm text-left space-y-2 text-muted-foreground">
              {[
                "Regulatory licence & permit register",
                "Compliance obligation tracking",
                "Automated expiry & renewal alerts",
                "Policy register with version control",
                "Internal audit management",
                "Corrective action tracking",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
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
