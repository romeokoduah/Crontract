/**
 * Core types for the Crontract AI layer.
 *
 * Provider-agnostic on purpose: the model router (`router.ts`) maps these onto a
 * concrete provider (Anthropic today). Feature code and the agent runtime never
 * talk to a vendor SDK directly — see docs/AI_INTEGRATION_SPEC.md.
 */

/** Task tier drives model + cost/latency selection in the router. */
export type TaskTier = "reason" | "fast"

export type ChatRole = "user" | "assistant"

export interface ChatMessage {
  role: ChatRole
  content: string
}

/**
 * Lower-level message passed to a provider during an agentic loop. `content` may
 * be a plain string or an array of provider content blocks (e.g. Anthropic
 * tool_use / tool_result blocks) that must be replayed verbatim to keep the
 * tool-calling protocol valid.
 */
export interface ProviderMessage {
  role: ChatRole
  content: string | unknown[]
}

/** JSON-Schema-ish description of a tool's input (Anthropic `input_schema` shape). */
export interface JsonSchema {
  type: "object"
  properties: Record<string, unknown>
  required?: string[]
}

/**
 * A capability the agent may invoke. Handlers are supplied by the caller (the web
 * app) so tenant scoping, RBAC and audit logging live with the data — the AI
 * package never reaches into the database itself.
 */
export interface AgentTool {
  name: string
  description: string
  inputSchema: JsonSchema
  /** Whether running this tool mutates state. Read-only tools run without confirmation. */
  mutates?: boolean
  /** Execute the tool. Return any JSON-serialisable value; it is fed back to the model. */
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

/** One tool invocation captured for the audit trail / UI transparency. */
export interface ToolInvocation {
  name: string
  input: Record<string, unknown>
  ok: boolean
  /** Truncated, sanitised result preview for display + audit. */
  resultPreview: string
}

export interface AgentRunResult {
  /** Final natural-language answer for the user. */
  text: string
  usage: TokenUsage
  model: string
  provider: string
  /** Every tool the agent called, in order. */
  toolTrace: ToolInvocation[]
  /** True if the run stopped because it hit the tool-iteration cap. */
  truncated: boolean
}

export interface ModelCallOptions {
  model: string
  system: string
  messages: ProviderMessage[]
  tools?: AgentTool[]
  maxTokens?: number
  /** Abort if the model call exceeds this many ms. */
  timeoutMs?: number
}

/** Raw, provider-normalised response for a single model call. */
export interface ModelResponse {
  /** Assistant text emitted this turn (may be empty when only tool calls are made). */
  text: string
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>
  stopReason: "end" | "tool_use" | "max_tokens" | "other"
  usage: TokenUsage
  /** Opaque assistant content block to replay back to the provider on the next turn. */
  rawAssistantContent: unknown
}

export class AiConfigError extends Error {}
export class AiProviderError extends Error {}
