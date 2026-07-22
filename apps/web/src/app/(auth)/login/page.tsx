import { Suspense } from "react"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  // Demo workspace logins expose hardcoded credentials — only available outside production.
  const showDemoLogin = process.env.NODE_ENV !== "production"
  return (
    <Suspense>
      <LoginForm showDemoLogin={showDemoLogin} />
    </Suspense>
  )
}
