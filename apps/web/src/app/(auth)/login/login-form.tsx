"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Mail, Lock } from "lucide-react"

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
import { DemoLogin } from "./demo-login"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"
  const [isLoading, setIsLoading] = useState(false)
  const [showDemo, setShowDemo] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginValues) {
    setIsLoading(true)
    try {
      const result = await signIn("credentials", {
        email: values.email.toLowerCase(),
        password: values.password,
        redirect: false,
      })

      if (result?.error) {
        toast.error("Invalid email or password", {
          description: "Please check your credentials and try again.",
        })
        return
      }

      toast.success("Welcome back!")
      router.push(callbackUrl)
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
          Sign in to Crontract
        </h1>
        <p className="text-muted-foreground text-sm">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-primary font-medium hover:underline underline-offset-4 transition-colors"
          >
            Create one free
          </Link>
        </p>
      </div>

      {/* OAuth buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          disabled
          className="gap-2 text-muted-foreground"
          title="Google login coming soon"
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
          title="Microsoft login coming soon"
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
            or continue with email
          </span>
        </div>
      </div>

      {/* Credentials form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
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
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...field}
                      type="password"
                      placeholder="Enter your password"
                      autoComplete="current-password"
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
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </Form>

      {/* Demo workspaces */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowDemo(!showDemo)}
          className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <span className="flex-1 h-px bg-border" />
          <span className="font-medium group-hover:text-primary transition-colors">
            {showDemo ? "Hide demo workspaces" : "Explore with a demo workspace"}
          </span>
          <span className="flex-1 h-px bg-border" />
        </button>

        {showDemo && (
          <div className="mt-4">
            <DemoLogin />
          </div>
        )}
      </div>
    </div>
  )
}
