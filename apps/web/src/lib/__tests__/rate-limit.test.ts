import { describe, it, expect, beforeEach } from "vitest"
import {
  rateLimit,
  enforceRateLimit,
  getClientIp,
  __resetRateLimiter,
} from "../rate-limit"

beforeEach(() => {
  __resetRateLimiter()
})

describe("rateLimit", () => {
  it("allows requests up to the limit, then blocks", () => {
    const key = "test-key"
    const opts = { limit: 3, windowMs: 1000 }

    expect(rateLimit(key, opts).ok).toBe(true)
    expect(rateLimit(key, opts).ok).toBe(true)
    expect(rateLimit(key, opts).ok).toBe(true)

    const blocked = rateLimit(key, opts)
    expect(blocked.ok).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it("decrements remaining on each allowed request", () => {
    const opts = { limit: 5, windowMs: 1000 }
    expect(rateLimit("k", opts).remaining).toBe(4)
    expect(rateLimit("k", opts).remaining).toBe(3)
  })

  it("isolates buckets by key", () => {
    const opts = { limit: 1, windowMs: 1000 }
    expect(rateLimit("a", opts).ok).toBe(true)
    expect(rateLimit("b", opts).ok).toBe(true) // different key, fresh bucket
    expect(rateLimit("a", opts).ok).toBe(false) // a is now exhausted
  })

  it("resets after the window elapses", async () => {
    const opts = { limit: 1, windowMs: 20 }
    expect(rateLimit("w", opts).ok).toBe(true)
    expect(rateLimit("w", opts).ok).toBe(false)
    await new Promise((r) => setTimeout(r, 30))
    expect(rateLimit("w", opts).ok).toBe(true)
  })
})

describe("getClientIp", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const req = new Request("https://x.test", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    })
    expect(getClientIp(req)).toBe("1.2.3.4")
  })

  it("falls back through x-real-ip then to 'unknown'", () => {
    const realIp = new Request("https://x.test", {
      headers: { "x-real-ip": "9.9.9.9" },
    })
    expect(getClientIp(realIp)).toBe("9.9.9.9")
    expect(getClientIp(new Request("https://x.test"))).toBe("unknown")
  })
})

describe("enforceRateLimit", () => {
  const makeReq = (ip: string) =>
    new Request("https://x.test", { headers: { "x-forwarded-for": ip } })

  it("returns null while under the limit and a 429 once exceeded", () => {
    const opts = { limit: 2, windowMs: 1000 }
    expect(enforceRateLimit(makeReq("8.8.8.8"), "scope", opts)).toBeNull()
    expect(enforceRateLimit(makeReq("8.8.8.8"), "scope", opts)).toBeNull()

    const res = enforceRateLimit(makeReq("8.8.8.8"), "scope", opts)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(429)
    expect(res!.headers.get("Retry-After")).toBeTruthy()
  })

  it("buckets separately per scope and per discriminator", () => {
    const opts = { limit: 1, windowMs: 1000 }
    const req = makeReq("8.8.8.8")
    expect(enforceRateLimit(req, "scopeA", opts)).toBeNull()
    expect(enforceRateLimit(req, "scopeB", opts)).toBeNull() // different scope
    expect(enforceRateLimit(req, "scopeA", opts, "user1")).toBeNull() // discriminator
    expect(enforceRateLimit(req, "scopeA", opts)).not.toBeNull() // scopeA/no-disc exhausted
  })
})
