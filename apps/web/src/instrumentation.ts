/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * We use it to validate the environment up front so a misconfigured deployment
 * fails immediately with a clear message rather than on the first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env")
    validateEnv()

    // Rate limiting is in-memory (per-instance). On a horizontally-scaled production
    // deployment without a shared store, brute-force protection is bypassable across
    // instances. Warn loudly so this isn't a silent gap. See lib/rate-limit.ts.
    if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL) {
      console.warn(
        "[startup] WARNING: REDIS_URL is not set. Login/signup rate limiting is in-memory " +
        "and only effective on a single instance. Configure a shared store before scaling out.",
      )
    }
  }
}
