import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./db"
import { compare, hash } from "bcryptjs"
import { rateLimit } from "./rate-limit"

// Brute-force protection: max failed-or-total login attempts per IP+email window.
const LOGIN_MAX_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      workspaceId?: string
      workspaceName?: string
      role?: string
      mustChangePassword?: boolean
    }
  }
  interface User {
    id: string
    email: string
    name: string
    mustChangePassword?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    workspaceId?: string
    workspaceName?: string
    role?: string
    mustChangePassword?: boolean
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email.toLowerCase()

        // Throttle login attempts per IP+email to blunt credential stuffing /
        // brute force. Throws a generic error surfaced to the client as a 401.
        const xff = (req?.headers?.["x-forwarded-for"] as string | undefined) ?? ""
        const ip = xff.split(",")[0]?.trim() || "unknown"
        const limit = rateLimit(`login:${ip}:${email}`, {
          limit: LOGIN_MAX_ATTEMPTS,
          windowMs: LOGIN_WINDOW_MS,
        })
        if (!limit.ok) {
          throw new Error("RATE_LIMITED")
        }

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        // Check if temp password has expired
        if (
          user.mustChangePassword &&
          user.tempPasswordExpiresAt &&
          user.tempPasswordExpiresAt < new Date()
        ) {
          throw new Error("TEMP_PASSWORD_EXPIRED")
        }

        const isValid = await compare(credentials.password, user.passwordHash)
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.mustChangePassword = user.mustChangePassword ?? false

        // Get the user's first workspace
        const membership = await prisma.membership.findFirst({
          where: { userId: user.id },
          include: {
            workspace: { select: { id: true, name: true } },
            role: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        })

        if (membership) {
          token.workspaceId = membership.workspace.id
          token.workspaceName = membership.workspace.name
          token.role = membership.role.name
        }
      }

      // Handle workspace switching
      if (trigger === "update" && session?.workspaceId) {
        const membership = await prisma.membership.findFirst({
          where: {
            userId: token.id,
            workspaceId: session.workspaceId,
          },
          include: {
            workspace: { select: { id: true, name: true } },
            role: { select: { name: true } },
          },
        })

        if (membership) {
          token.workspaceId = membership.workspace.id
          token.workspaceName = membership.workspace.name
          token.role = membership.role.name
        }
      }

      // Handle password changed — clear the flag
      if (trigger === "update" && session?.mustChangePassword === false) {
        token.mustChangePassword = false
      }

      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.workspaceId = token.workspaceId
      session.user.workspaceName = token.workspaceName
      session.user.role = token.role
      session.user.mustChangePassword = token.mustChangePassword
      return session
    },
  },
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12)
}
