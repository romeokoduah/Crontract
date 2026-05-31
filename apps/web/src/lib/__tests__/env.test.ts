import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { validateEnv } from "../env"

const ORIGINAL = process.env

beforeEach(() => {
  // Start each test from a clean, minimal-but-valid env.
  process.env = {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    NEXTAUTH_SECRET: "a-secret",
  } as NodeJS.ProcessEnv
})

afterEach(() => {
  process.env = ORIGINAL
})

describe("validateEnv", () => {
  it("accepts a valid environment", () => {
    expect(() => validateEnv()).not.toThrow()
    expect(validateEnv().DATABASE_URL).toContain("postgresql://")
  })

  it("throws when DATABASE_URL is missing", () => {
    delete (process.env as Record<string, unknown>).DATABASE_URL
    expect(() => validateEnv()).toThrow(/DATABASE_URL/)
  })

  it("throws when DATABASE_URL is not a URL", () => {
    process.env.DATABASE_URL = "not-a-url"
    expect(() => validateEnv()).toThrow(/DATABASE_URL/)
  })

  it("throws when NEXTAUTH_SECRET is missing", () => {
    delete (process.env as Record<string, unknown>).NEXTAUTH_SECRET
    expect(() => validateEnv()).toThrow(/NEXTAUTH_SECRET/)
  })

  it("requires a 32+ char NEXTAUTH_SECRET in production", () => {
    process.env.NODE_ENV = "production"
    process.env.NEXTAUTH_SECRET = "too-short"
    expect(() => validateEnv()).toThrow(/at least 32 characters/)

    process.env.NEXTAUTH_SECRET = "x".repeat(32)
    expect(() => validateEnv()).not.toThrow()
  })

  it("allows a short secret outside production", () => {
    process.env.NODE_ENV = "development"
    process.env.NEXTAUTH_SECRET = "short"
    expect(() => validateEnv()).not.toThrow()
  })

  it("bypasses all checks when SKIP_ENV_VALIDATION is set", () => {
    process.env.SKIP_ENV_VALIDATION = "1"
    delete (process.env as Record<string, unknown>).DATABASE_URL
    expect(() => validateEnv()).not.toThrow()
  })
})
