import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./db"
import { compare, hash } from "bcryptjs"

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
    }
  }
  interface User {
    id: string
    email: string
    name: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    workspaceId?: string
    workspaceName?: string
    role?: string
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const isValid = await compare(credentials.password, user.passwordHash)
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id

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

      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.workspaceId = token.workspaceId
      session.user.workspaceName = token.workspaceName
      session.user.role = token.role
      return session
    },
  },
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12)
}
