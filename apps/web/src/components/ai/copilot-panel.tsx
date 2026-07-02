"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles, Send, Loader2, Wrench } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ToolCall {
  name: string
  ok: boolean
  resultPreview: string
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  tools?: ToolCall[]
  error?: boolean
}

const SUGGESTIONS = [
  "What's my current cash position?",
  "Show my accounts receivable ageing",
  "Which invoices are overdue?",
  "List this month's expenses by category",
]

export function CopilotPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  // ⌘K / Ctrl+K opens the Copilot.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  async function send(text: string) {
    const message = text.trim()
    if (!message || loading) return
    setInput("")
    setMessages((m) => [...m, { role: "user", content: message }])
    setLoading(true)

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.error ?? "Something went wrong.", error: true },
        ])
        return
      }

      setConversationId(data.conversationId)
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply, tools: data.toolTrace },
      ])
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Couldn't reach the Copilot. Check your connection.", error: true },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Crontract Copilot"
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Crontract Copilot
            </SheetTitle>
            <SheetDescription>
              Ask about your finances. The Copilot reads your workspace data — it never guesses figures.
            </SheetDescription>
          </SheetHeader>

          {/* Thread */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Try one of these:</p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-md border bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : m.error
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted"
                  )}
                >
                  {m.content}
                  {m.tools && m.tools.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-border/40 pt-2">
                      {m.tools.map((t, j) => (
                        <span
                          key={j}
                          title={t.resultPreview}
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
                            t.ok ? "bg-background/60 text-muted-foreground" : "bg-destructive/10 text-destructive"
                          )}
                        >
                          <Wrench className="h-2.5 w-2.5" />
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex items-end gap-2 border-t px-5 py-4"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              rows={1}
              placeholder="Ask your business a question…"
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-md border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
