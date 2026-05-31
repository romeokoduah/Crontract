import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// Always evaluated at request time — never cached.
export const dynamic = "force-dynamic"

/**
 * Liveness/readiness probe for load balancers and uptime monitors.
 * Returns 200 when the app can reach the database, 503 otherwise.
 * Intentionally unauthenticated (allow-listed in middleware) and leaks no
 * internal detail on failure.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json(
      { status: "ok", db: "up" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
