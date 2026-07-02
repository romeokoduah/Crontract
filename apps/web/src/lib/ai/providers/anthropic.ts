/**
 * Anthropic provider for the model router.
 *
 * Uses the Messages API over `fetch` (no SDK dependency, keeps the install light
 * and works in the Next.js server runtime). Implements tool-use so the agent
 * runtime can drive multi-step, tool-calling conversations.
 *
 * https://docs.anthropic.com/en/api/messages
 */
import {
  AiConfigError,
  AiProviderError,
  type ModelCallOptions,
  type ModelResponse,
} from "../types"

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_VERSION = "2023-06-01"

interface AnthropicContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

interface AnthropicResponse {
  content: AnthropicContentBlock[]
  stop_reason: string | null
  usage: { input_tokens: number; output_tokens: number }
}

function mapStopReason(reason: string | null): ModelResponse["stopReason"] {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "end"
    case "tool_use":
      return "tool_use"
    case "max_tokens":
      return "max_tokens"
    default:
      return "other"
  }
}

export function anthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export async function callAnthropic(
  opts: ModelCallOptions
): Promise<ModelResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new AiConfigError(
      "ANTHROPIC_API_KEY is not set. Add it to the environment to enable the Copilot."
    )
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  }

  if (opts.tools?.length) {
    body.tools = opts.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }))
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000)

  let res: Response
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiProviderError("The AI model timed out. Please try again.")
    }
    throw new AiProviderError(
      `Failed to reach the AI provider: ${(err as Error).message}`
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new AiProviderError(
      `AI provider returned ${res.status}: ${detail.slice(0, 300)}`
    )
  }

  const data = (await res.json()) as AnthropicResponse

  const text = data.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n")
    .trim()

  const toolCalls = data.content
    .filter((b) => b.type === "tool_use" && b.id && b.name)
    .map((b) => ({
      id: b.id as string,
      name: b.name as string,
      input: (b.input ?? {}) as Record<string, unknown>,
    }))

  return {
    text,
    toolCalls,
    stopReason: mapStopReason(data.stop_reason),
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
    // Replay the exact assistant blocks back to Anthropic on the next turn so
    // tool_use/tool_result pairing stays valid.
    rawAssistantContent: data.content,
  }
}
