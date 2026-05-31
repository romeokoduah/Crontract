import { z } from "zod"

/**
 * Single source of truth for password strength across every flow that sets a
 * password (signup, invite acceptance, password change/reset). Keeping this in
 * one place prevents the policy from drifting between endpoints.
 *
 * Policy: ≥10 chars, with upper, lower, digit, and symbol.
 */
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one digit")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one symbol")
