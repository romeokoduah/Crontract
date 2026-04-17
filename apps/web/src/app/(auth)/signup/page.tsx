"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, User, Mail, Lock, Building2, CheckCircle2 } from "lucide-react"

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
import { Separator } from "@/components/ui/separator"

const signupSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
  companyName: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name too long"),
})

type SignupValues = z.infer<typeof signupSchema>

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
              check.pass ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
            }
          >
            {check.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      companyName: "",
    },
  })

  const watchedPassword = form.watch("password")

  async function onSubmit(values: SignupValues) {
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Signup failed", {
          description: data.detail ?? "Please try again.",
        })
        return
      }

      toast.success("Account created!", {
        description: "Signing you in…",
      })

      const signInResult = await signIn("credentials", {
        email: values.email.toLowerCase(),
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

      router.push("/onboarding")
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
          Create your workspace
        </h1>
        <p className="text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary font-medium hover:underline underline-offset-4 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>

      {/* Trust signals */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border/60">
        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Free to start — no credit card required. Your workspace is ready in seconds.
        </p>
      </div>

      {/* OAuth buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          disabled
          className="gap-2 text-muted-foreground"
          title="Google signup coming soon"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            className="h-4 w-4"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.5 0 6.3 1.2 8.5 3.2l6.3-6.3C34.8 2.9 29.8 1 24 1 14.6 1 6.6 6.6 2.7 14.6l7.4 5.7C12 14.3 17.5 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.6h12.4c-.5 2.8-2.1 5.1-4.5 6.7l7.1 5.5c4.1-3.8 6.5-9.4 6.5-16.3z"
            />
            <path
              fill="#FBBC05"
              d="M10.1 28.6A14.8 14.8 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6L2.7 13.7A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.7 10.6l7.4-6z"
            />
            <path
              fill="#34A853"
              d="M24 47c5.8 0 10.7-1.9 14.3-5.2l-7.1-5.5c-1.9 1.3-4.4 2.1-7.2 2.1-6.5 0-12-4.8-13.9-11.2l-7.4 5.7C6.6 41.4 14.6 47 24 47z"
            />
          </svg>
          Google
        </Button>
        <Button
          variant="outline"
          disabled
          className="gap-2 text-muted-foreground"
          title="Microsoft signup coming soon"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 23 23"
            className="h-4 w-4"
          >
            <rect x="1" y="1" width="10" height="10" fill="#F25022" />
            <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
            <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
            <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
          </svg>
          Microsoft
        </Button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-3 text-muted-foreground font-medium tracking-wider">
            or sign up with email
          </span>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="col-span-2 sm:col-span-1">
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
              name="companyName"
              render={({ field }) => (
                <FormItem className="col-span-2 sm:col-span-1">
                  <FormLabel>Company name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        placeholder="Acme Corp Ltd"
                        autoComplete="organization"
                        className="pl-9"
                        disabled={isLoading}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...field}
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
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

          <Button
            type="submit"
            className="w-full font-semibold"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating workspace…
              </>
            ) : (
              "Create free workspace"
            )}
          </Button>
        </form>
      </Form>

      <p className="text-center text-xs text-muted-foreground leading-relaxed">
        By signing up you agree to our{" "}
        <Link href="/terms" className="underline hover:text-foreground transition-colors">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-foreground transition-colors">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  )
}
