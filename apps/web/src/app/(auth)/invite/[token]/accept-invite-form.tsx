"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, User, Lock, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const acceptInviteSchema = z
  .object({
    name: z.string().min(2, "Full name must be at least 2 characters"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type AcceptInviteValues = z.infer<typeof acceptInviteSchema>

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
  ]

  if (!password) return null

  return (
    <div className="flex gap-2 mt-1.5">
      {checks.map((check) => (
        <div key={check.label} className="flex items-center gap-1 text-xs">
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              check.pass ? "bg-green-500" : "bg-muted-foreground/30"
            }`}
          />
          <span
            className={
              check.pass
                ? "text-green-600 dark:text-green-400"
                : "text-muted-foreground"
            }
          >
            {check.label}
          </span>
        </div>
      ))}
    </div>
  )
}

interface AcceptInviteFormProps {
  token: string
  email: string
  workspaceName: string
  inviterName: string
}

export function AcceptInviteForm({
  token,
  email,
  workspaceName,
  inviterName,
}: AcceptInviteFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<AcceptInviteValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      name: "",
      password: "",
      confirmPassword: "",
    },
  })

  const watchedPassword = form.watch("password")

  async function onSubmit(values: AcceptInviteValues) {
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: values.name,
          password: values.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Failed to accept invitation", {
          description: data.detail ?? "Please try again.",
        })
        return
      }

      toast.success("Invitation accepted!", {
        description: "Signing you in...",
      })

      const signInResult = await signIn("credentials", {
        email: email.toLowerCase(),
        password: values.password,
        redirect: false,
      })

      if (signInResult?.error) {
        toast.error("Account created but sign-in failed", {
          description: "Please sign in manually.",
        })
        router.push("/login")
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again later.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          You&apos;ve been invited to join{" "}
          <span className="text-primary">{workspaceName}</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          Invited by {inviterName}
        </p>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Email (read-only) */}
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                readOnly
                disabled
                className="pl-9 bg-muted/50"
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...field}
                      placeholder="Jane Mensah"
                      autoComplete="name"
                      className="pl-9"
                      disabled={isLoading}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...field}
                      type="password"
                      placeholder="Choose a strong password"
                      autoComplete="new-password"
                      className="pl-9"
                      disabled={isLoading}
                    />
                  </div>
                </FormControl>
                <PasswordStrength password={watchedPassword} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...field}
                      type="password"
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      className="pl-9"
                      disabled={isLoading}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full font-semibold"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Accepting invitation...
              </>
            ) : (
              "Accept Invitation & Join"
            )}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary font-medium hover:underline underline-offset-4 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
