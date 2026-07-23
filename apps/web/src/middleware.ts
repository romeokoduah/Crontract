import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { MODULE_VIEW_PERMISSION, ROLE_MODULE_VIEW } from "@/lib/authz/route-map"

const ADMIN_ROLES = ["Owner", "Administrator"]

// Routes that bypass all middleware checks
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/invite",
  "/api/auth",
  "/api/health",
  "/_next",
  "/favicon.ico",
]

// Routes allowed during mustChangePassword flow
const PASSWORD_CHANGE_PATHS = [
  "/first-login/change-password",
  "/api/auth/change-password",
  "/api/auth/signout",
]

// Admin-only route prefixes
const ADMIN_ROUTE_PREFIXES = [
  "/admin",
  "/api/admin",
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. Skip public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 2. Get JWT token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  // 3. Auth gate — redirect unauthenticated users
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 4. Password change enforcement
  if (token.mustChangePassword) {
    if (PASSWORD_CHANGE_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.next()
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Password change required" },
        { status: 403 }
      )
    }
    return NextResponse.redirect(
      new URL("/first-login/change-password", req.url)
    )
  }

  // 5. Admin route protection
  if (ADMIN_ROUTE_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!token.role || !ADMIN_ROLES.includes(token.role)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      return NextResponse.redirect(new URL("/unauthorized", req.url))
    }
  }

  // 6. Coarse module-prefix gate for sensitive pages/routes (defense-in-depth).
  //    Only active when enforcement is switched on — otherwise a no-op so
  //    behaviour is identical to today. The API-route guards are authoritative;
  //    this is a static, role-name-based backstop so sensitive PAGES don't render
  //    server-side for roles that plainly shouldn't see them.
  if (process.env.AUTHZ_ENFORCED === "true") {
    for (const [prefix, code] of Object.entries(MODULE_VIEW_PERMISSION)) {
      if (pathname.startsWith(prefix)) {
        const roleName = token.role as string | undefined
        const visible = roleName ? ROLE_MODULE_VIEW[roleName] : undefined
        if (!visible?.has(code)) {
          if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
          }
          return NextResponse.redirect(new URL("/unauthorized", req.url))
        }
        break
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
