import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PaySetupClient } from "./pay-setup-client"

export default async function PaySetupPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) notFound()

  const employee = await prisma.employee.findFirst({
    where: { id: params.id, workspaceId: session.user.workspaceId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, employeeNumber: true, jobTitle: true, basicSalary: true },
  })
  if (!employee) notFound()

  return (
    <div className="p-6 max-w-4xl">
      <Link href={`/people/${employee.id}`} className="inline-flex items-center text-sm text-muted-foreground mb-4 hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to employee
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Pay Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {employee.firstName} {employee.lastName} ({employee.employeeNumber})
          {employee.jobTitle && ` — ${employee.jobTitle}`}
          {employee.basicSalary && ` · Basic Salary: GHS ${Number(employee.basicSalary).toLocaleString()}`}
        </p>
      </div>
      <PaySetupClient employeeId={employee.id} />
    </div>
  )
}
