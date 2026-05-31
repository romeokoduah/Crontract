/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * We use it to validate the environment up front so a misconfigured deployment
 * fails immediately with a clear message rather than on the first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env")
    validateEnv()
  }
}
