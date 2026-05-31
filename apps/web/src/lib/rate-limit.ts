import { NextResponse } from "next/server"

/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * NOTE: state lives in the process memory of a single instance. This protects
 * against brute-force / abuse on a single-instance or sticky-session deployment.
 * For a horizontally-scaled (multi-instance / serverless) deployment, back this
 * with a shared store (Redis/Upstash) — keep the same `rateLimit()` signature and
 * swap the `store` implementation. REDIS_URL is already wired in the env example.
 */

type Bucket = { count: number; resetAt: number }

const store = new Map<string, Bucket>()

// Opportunistic cleanup so the map can't grow unbounded under key churn.
const MAX_KEYS = 10_000
function sweep(now: number) {
  if (store.size < MAX_KEYS) return
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key)
  }
}

export type RateLimitResult = {
  ok: boolean
  remaining: number
  resetAt: number
  /** Seconds until the window resets (for the Retry-After header). */
  retryAfter: number
}

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const existing = store.get(key)
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs })
    return {
      ok: true,
      remaining: opts.limit - 1,
      resetAt: now + opts.windowMs,
      retryAfter: 0,
    }
  }

  existing.count += 1
  if (existing.count > opts.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    }
  }

  return {
    ok: true,
    remaining: opts.limit - existing.count,
    resetAt: existing.resetAt,
    retryAfter: 0,
  }
}

/** Clear the limiter — exposed for tests only. */
export function __resetRateLimiter() {
  store.clear()
}

/**
 * Best-effort client IP from common proxy headers. Falls back to a constant so a
 * missing IP degrades to a shared (stricter) bucket rather than no limiting.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]!.trim()
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  )
}

/**
 * Enforce a rate limit for an API route. Returns a 429 NextResponse when the
 * limit is exceeded, or null when the request may proceed.
 *
 *   const limited = enforceRateLimit(req, "signup", { limit: 5, windowMs: 60_000 })
 *   if (limited) return limited
 */
export function enforceRateLimit(
  req: Request,
  scope: string,
  opts: { limit: number; windowMs: number },
  /** Extra key material (e.g. an email) to bucket alongside the IP. */
  discriminator?: string
): NextResponse | null {
  const ip = getClientIp(req)
  const key = `${scope}:${ip}${discriminator ? `:${discriminator}` : ""}`
  const result = rateLimit(key, opts)
  if (result.ok) return null
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    }
  )
}
