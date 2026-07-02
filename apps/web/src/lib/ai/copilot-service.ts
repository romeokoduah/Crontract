/**
 * Copilot orchestration: the seam between an authenticated request and the agent
 * runtime. Responsibilities:
 *   - enforce per-workspace AI tier + monthly cost budget (billing guardrails)
 *   - assemble the system prompt + tools + prior conversation
 *   - run the agent, persist the turn, and meter the call (AiInteraction)
 *
 * All DB access is workspace-scoped. This is the only place that ties AI to a tenant.
 */
import { prisma } from "@/lib/db"
import { type AuthedUser } from "@/lib/authorization"
import { runAgent } from "./runtime"
import { buildFinanceTools } from "./finance-tools"
import { aiConfigured, estimateCostUsd, PROVIDER } from "./router"
import { HARDENING_NOTE } from "./guardrails"
import { type AgentRunResult, type ProviderMessage } from "./types"

const FEATURE = "copilot.chat"
const HISTORY_LIMIT = 20

export class CopilotDisabledError extends Error {}
export class CopilotBudgetError extends Error {}
export class CopilotNotConfiguredError extends Error {}

export interface CopilotContext {
  workspaceName: string
  businessType: string
  currency: string
  userName: string
  role: string
}

export function buildSystemPrompt(ctx: CopilotContext): string {
  return [
    `You are Crontract Copilot, the AI assistant embedded in Crontract — an enterprise`,
    `operations platform for ${ctx.businessType.toLowerCase().replace(/_/g, " ")} businesses.`,
    ``,
    `Current context:`,
    `- Workspace: ${ctx.workspaceName}`,
    `- Reporting currency: ${ctx.currency}`,
    `- User: ${ctx.userName} (role: ${ctx.role})`,
    `- Today: ${new Date().toISOString().slice(0, 10)}`,
    ``,
    `You help the user understand and run their business by querying the workspace's`,
    `finance data through the provided tools, then answering clearly and concisely.`,
    ``,
    `Style:`,
    `- Be direct and practical. Lead with the answer, then the supporting numbers.`,
    `- Format currency with the workspace currency code (e.g. "${ctx.currency} 12,400").`,
    `- Use short tables or bullet lists for multi-row results.`,
    `- If the data is empty or a tool errors, say so plainly and suggest a next step.`,
    `- Never invent figures. Every number must trace to a tool result.`,
    ``,
    HARDENING_NOTE,
  ].join("\n")
}

async function ensureWithinBudget(workspaceId: string): Promise<void> {
  const settings = await prisma.workspaceAiSettings.findUnique({ where: { workspaceId } })

  // Default: AI enabled at the standard tier if no explicit settings row exists.
  const tier = settings?.tier ?? "standard"
  if (tier === "off") {
    throw new CopilotDisabledError("The AI Copilot is turned off for this workspace.")
  }

  const budget = settings ? Number(settings.monthlyBudgetUsd) : Number(process.env.AI_MONTHLY_BUDGET_USD_DEFAULT || 50)
  if (budget <= 0) return

  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)

  const spend = await prisma.aiInteraction.aggregate({
    where: { workspaceId, createdAt: { gte: startOfMonth } },
    _sum: { costUsd: true },
  })
  const spent = Number(spend._sum.costUsd ?? 0)
  if (spent >= budget) {
    throw new CopilotBudgetError(
      `This workspace has reached its monthly AI budget (${budget} USD). Increase it in AI settings to continue.`
    )
  }
}

export interface RunCopilotArgs {
  user: AuthedUser
  message: string
  conversationId?: string
}

export interface RunCopilotResult {
  conversationId: string
  reply: string
  toolTrace: { name: string; ok: boolean; resultPreview: string }[]
  usage: { inputTokens: number; outputTokens: number; costUsd: number }
  model: string
  truncated: boolean
}

export async function runCopilot(args: RunCopilotArgs): Promise<RunCopilotResult> {
  const { user, message } = args
  const workspaceId = user.workspaceId

  if (!aiConfigured()) {
    throw new CopilotNotConfiguredError(
      "AI is not configured on this server. Set ANTHROPIC_API_KEY to enable the Copilot."
    )
  }

  await ensureWithinBudget(workspaceId)

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, businessType: true, currency: true },
  })
  if (!workspace) throw new Error("Workspace not found")

  // Load the conversation (scoped to this workspace + user) for history.
  const conversation = args.conversationId
    ? await prisma.aiConversation.findFirst({
        where: { id: args.conversationId, workspaceId, userId: user.id },
        include: { messages: { orderBy: { createdAt: "asc" }, take: HISTORY_LIMIT } },
      })
    : null

  const history: ProviderMessage[] = (conversation?.messages ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

  const system = buildSystemPrompt({
    workspaceName: workspace.name,
    businessType: workspace.businessType,
    currency: workspace.currency,
    userName: user.name,
    role: user.role ?? "Member",
  })

  const startedAt = Date.now()
  let status = "ok"
  let result: AgentRunResult
  try {
    result = await runAgent({
      system,
      history,
      userMessage: message,
      tools: buildFinanceTools(workspaceId),
      tier: "reason",
    })
  } catch (err) {
    status = "error"
    await recordInteraction(workspaceId, user.id, "error", { inputTokens: 0, outputTokens: 0 }, "unknown", Date.now() - startedAt)
    throw err
  }

  const latencyMs = Date.now() - startedAt
  const costUsd = estimateCostUsd(result.model, result.usage)

  // Persist the conversation turn in one transaction. `toolTrace` is a plain
  // JSON-serialisable array; round-trip it so it satisfies Prisma's Json input.
  const title = message.trim().slice(0, 60) || "New conversation"
  const existingId = conversation?.id
  const toolTraceJson = JSON.parse(JSON.stringify(result.toolTrace))

  const savedConversationId = await prisma.$transaction(async (tx) => {
    let cid = existingId
    if (!cid) {
      const created = await tx.aiConversation.create({
        data: { workspaceId, userId: user.id, title },
      })
      cid = created.id
    } else {
      await tx.aiConversation.update({ where: { id: cid }, data: { updatedAt: new Date() } })
    }
    await tx.aiMessage.createMany({
      data: [
        { conversationId: cid, workspaceId, role: "user", content: message },
        { conversationId: cid, workspaceId, role: "assistant", content: result.text, toolTrace: toolTraceJson },
      ],
    })
    return cid
  })

  await recordInteraction(workspaceId, user.id, status, result.usage, result.model, latencyMs, costUsd)

  return {
    conversationId: savedConversationId,
    reply: result.text,
    toolTrace: result.toolTrace.map((t) => ({ name: t.name, ok: t.ok, resultPreview: t.resultPreview })),
    usage: { ...result.usage, costUsd },
    model: result.model,
    truncated: result.truncated,
  }
}

async function recordInteraction(
  workspaceId: string,
  userId: string,
  status: string,
  usage: { inputTokens: number; outputTokens: number },
  model: string,
  latencyMs: number,
  costUsd = 0
): Promise<void> {
  try {
    await prisma.aiInteraction.create({
      data: {
        workspaceId, userId, feature: FEATURE, provider: PROVIDER, model,
        inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
        costUsd, latencyMs, status,
      },
    })
  } catch (err) {
    // Metering must never break the user-facing response.
    console.error("[copilot] failed to record interaction", err)
  }
}
