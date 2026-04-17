import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Heart, Bell } from "lucide-react"

export default function GrantsPage() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="max-w-md w-full text-center space-y-6 px-4">
        <div className="flex items-center justify-center">
          <div className="h-20 w-20 rounded-2xl bg-pink-100 flex items-center justify-center">
            <Heart className="h-10 w-10 text-pink-600" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Grants &amp; M&amp;E</h1>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-100 text-pink-700 border border-pink-200">
              Coming Soon
            </span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Track grants, donor funding, and monitoring &amp; evaluation frameworks. Manage grant budgets,
            reporting requirements, and outcome indicators all in one place.
          </p>
        </div>

        <Card className="bg-muted/40 border-dashed">
          <CardContent className="pt-5 pb-5">
            <ul className="text-sm text-left space-y-2 text-muted-foreground">
              {[
                "Grant lifecycle management (application → close-out)",
                "Donor reporting & compliance tracking",
                "Results framework & log frame management",
                "M&E indicator tracking with progress charts",
                "Budget vs actuals by grant",
                "Multi-donor fund management",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-pink-400 shrink-0" />
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
