import { describe, it, expect } from "vitest"
import { taskResourceCtx } from "../[id]/route"

describe("taskResourceCtx", () => {
  it("includes projectId for TEAM checks", () => {
    expect(taskResourceCtx({ projectId: "p1", assigneeId: null, createdBy: "u9" }).projectId).toBe("p1")
  })
  it("treats both assignee and creator as owners", () => {
    const ctx = taskResourceCtx({ projectId: "p1", assigneeId: "u2", createdBy: "u3" })
    expect(ctx.ownerIds).toEqual(["u2", "u3"])
  })
  it("omits null assignee from owners", () => {
    const ctx = taskResourceCtx({ projectId: "p1", assigneeId: null, createdBy: "u3" })
    expect(ctx.ownerIds).toEqual(["u3"])
  })
})
