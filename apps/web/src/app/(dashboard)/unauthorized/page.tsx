import { Button } from "@/components/ui/button"
import { ShieldX } from "lucide-react"
import Link from "next/link"

export default function UnauthorizedPage() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="max-w-md w-full text-center space-y-6 px-4">
        <div className="flex items-center justify-center">
          <div className="h-20 w-20 rounded-2xl bg-red-100 flex items-center justify-center">
            <ShieldX className="h-10 w-10 text-red-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You don&apos;t have permission to access this page. If you believe
            this is an error, contact your workspace administrator.
          </p>
        </div>

        <Button asChild>
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
