import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session!.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Try to find the employee record linked to this user
    let employee = null
    if (session!.user.workspaceId!) {
      employee = await prisma.employee.findFirst({
        where: {
          workspaceId: session!.user.workspaceId!,
          email: user.email,
          deletedAt: null,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          jobTitle: true,
          employmentType: true,
          startDate: true,
          status: true,
          department: {
            select: { id: true, name: true },
          },
        },
      })
    }

    return NextResponse.json({
      user,
      employee,
      role: session!.user.role ?? null,
      workspaceName: session!.user.workspaceName ?? null,
    })
  } catch (error) {
    console.error("GET /api/profile error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
})

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, phone, avatarUrl } = parsed.data

    // Update user record (name, avatarUrl)
    const userUpdate: Record<string, unknown> = {}
    if (name !== undefined) userUpdate.name = name
    if (avatarUrl !== undefined) userUpdate.avatarUrl = avatarUrl

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: session!.user.id },
        data: userUpdate,
      })
    }

    // Update employee phone if applicable
    if (phone !== undefined && session!.user.workspaceId!) {
      const user = await prisma.user.findUnique({
        where: { id: session!.user.id },
        select: { email: true },
      })
      if (user) {
        await prisma.employee.updateMany({
          where: {
            workspaceId: session!.user.workspaceId!,
            email: user.email,
            deletedAt: null,
          },
          data: { phone },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("PATCH /api/profile error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
