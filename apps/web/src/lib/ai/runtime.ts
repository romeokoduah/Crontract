/**
 * The agentic loop. Drives a multi-step, tool-calling conversation:
 *   model → (tool_use?) → run tools → feed results back → repeat → final answer.
 *
 * Provider-agnostic in shape; today it replays Anthropic content blocks. Tool
 * handlers are supplied by the caller, so all tenant scoping / RBAC / audit lives
 * with the data. This file never touches the database.
 */
import { callModel, modelForTier, PROVIDER } from "./router"
import { sanitizeToolResult, previewToolResult } from "./guardrails"
import {
  type AgentRunResult,
  type AgentTool,
  type ProviderMessage,
  type TaskTier,
  type ToolInvocation,
  type TokenUsage,
} from "./types"

export interface RunAgentOptions {
  system: string
  /** Conversation so far (prior user/assistant turns), oldest first. */
  history: ProviderMessage[]
  /** The new user message driving this run. */
  userMessage: string
  tools: AgentTool[]
  tier?: TaskTier
  maxTokens?: number
  /** Safety cap on tool round-trips before we force a final answer. */
  maxIterations?: number
}

export async function runAgent(opts: RunAgentOptions): Promise<AgentRunResult> {
  const model = modelForTier(opts.tier ?? "reason")
  const maxIterations = opts.maxIterations ?? 6
  const toolsByName = new Map(opts.tools.map((t) => [t.name, t]))

  const messages: ProviderMessage[] = [
    ...opts.history,
    { role: "user", content: opts.userMessage },
  ]

  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 }
  const toolTrace: ToolInvocation[] = []
  let finalText = ""
  let truncated = false

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const isLast = iteration === maxIterations - 1
    const response = await callModel({
      model,
      system: opts.system,
      messages,
      // On the final allowed turn, drop tools so the model must answer in prose.
      tools: isLast ? undefined : opts.tools,
      maxTokens: opts.maxTokens ?? 1500,
    })

    usage.inputTokens += response.usage.inputTokens
    usage.outputTokens += response.usage.outputTokens
    if (response.text) finalText = response.text

    if (response.stopReason !== "tool_use" || response.toolCalls.length === 0) {
      return {
        text: finalText || "I wasn't able to produce an answer for that.",
        usage,
        model,
        provider: PROVIDER,
        toolTrace,
        truncated,
      }
    }

    if (isLast) {
      truncated = true
      break
    }

    // Replay the assistant's tool_use blocks, then answer with tool_result blocks.
    messages.push({ role: "assistant", content: response.rawAssistantContent as unknown[] })

    const toolResultBlocks: unknown[] = []
    for (const call of response.toolCalls) {
      const tool = toolsByName.get(call.name)
      let ok = true
      let resultForModel: string

      if (!tool) {
        ok = false
        resultForModel = `Error: no such tool "${call.name}".`
      } else {
        try {
          const result = await tool.execute(call.input)
          resultForModel = sanitizeToolResult(result)
        } catch (err) {
          ok = false
          resultForModel = `Error running tool: ${(err as Error).message}`
        }
      }

      toolTrace.push({
        name: call.name,
        input: call.input,
        ok,
        resultPreview: previewToolResult(resultForModel),
      })

      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: resultForModel,
        is_error: !ok,
      })
    }

    messages.push({ role: "user", content: toolResultBlocks })
  }

  return {
    text:
      finalText ||
      "I gathered some information but ran out of steps before answering. Please refine your question.",
    usage,
    model,
    provider: PROVIDER,
    toolTrace,
    truncated,
  }
}
