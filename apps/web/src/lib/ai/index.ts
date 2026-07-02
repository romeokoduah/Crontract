/** Public surface of the Crontract AI layer. */
export * from "./types"
export { aiConfigured, modelForTier, estimateCostUsd } from "./router"
export { runAgent } from "./runtime"
export { buildFinanceTools } from "./finance-tools"
export {
  runCopilot,
  buildSystemPrompt,
  CopilotDisabledError,
  CopilotBudgetError,
  CopilotNotConfiguredError,
  type RunCopilotResult,
} from "./copilot-service"
