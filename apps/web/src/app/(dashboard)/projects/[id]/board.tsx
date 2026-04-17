"use client"

import { useState, useCallback, useRef } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { motion, AnimatePresence } from "framer-motion"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { TaskCard } from "./task-card"
import { TaskDetail } from "./task-detail"
import { cn } from "@/lib/utils"

type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED"

type Subtask = {
  id: string
  title: string
  status: string
}

type Task = {
  id: string
  projectId: string
  title: string
  description: string | null
  status: TaskStatus
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  assigneeId: string | null
  assignee: { id: string; name: string; avatarUrl: string | null } | null
  dueDate: string | null
  labels: string[]
  position: number
  subtasks: Subtask[]
}

type Member = {
  id: string
  name: string
  avatarUrl: string | null
}

interface KanbanBoardProps {
  projectId: string
  initialTasks: Task[]
  members: Member[]
}

const COLUMNS: { id: TaskStatus; label: string; accent: string; headerBg: string }[] = [
  {
    id: "TODO",
    label: "To Do",
    accent: "border-t-slate-400",
    headerBg: "bg-slate-50 dark:bg-slate-900/50",
  },
  {
    id: "IN_PROGRESS",
    label: "In Progress",
    accent: "border-t-blue-500",
    headerBg: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    id: "IN_REVIEW",
    label: "In Review",
    accent: "border-t-amber-500",
    headerBg: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    id: "DONE",
    label: "Done",
    accent: "border-t-green-500",
    headerBg: "bg-green-50 dark:bg-green-950/30",
  },
]

function AddTaskInline({
  columnId,
  projectId,
  onAdd,
}: {
  columnId: TaskStatus
  projectId: string
  onAdd: (task: Task) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const open = () => {
    setIsOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const submit = async () => {
    if (!title.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          status: columnId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to create task")
        return
      }
      onAdd({ ...data.task, assignee: null, subtasks: [] })
      setTitle("")
      setIsOpen(false)
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit()
    if (e.key === "Escape") {
      setIsOpen(false)
      setTitle("")
    }
  }

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground hover:text-foreground h-8 px-2"
        onClick={open}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add task
      </Button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Task title..."
        className="h-8 text-sm bg-background"
        disabled={isLoading}
      />
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs px-3" onClick={submit} disabled={isLoading || !title.trim()}>
          Add
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2"
          onClick={() => {
            setIsOpen(false)
            setTitle("")
          }}
        >
          Cancel
        </Button>
      </div>
    </motion.div>
  )
}

export function KanbanBoard({ projectId, initialTasks, members }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const getColumnTasks = (columnId: TaskStatus) =>
    tasks.filter((t) => t.status === columnId).sort((a, b) => a.position - b.position)

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id?.toString() ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    setOverId(null)

    if (!over) return

    const activeTaskId = active.id as string
    const task = tasks.find((t) => t.id === activeTaskId)
    if (!task) return

    // Determine target column
    const overIsColumn = COLUMNS.some((c) => c.id === over.id)
    let targetStatus: TaskStatus

    if (overIsColumn) {
      targetStatus = over.id as TaskStatus
    } else {
      const overTask = tasks.find((t) => t.id === over.id)
      if (!overTask) return
      targetStatus = overTask.status
    }

    const oldStatus = task.status
    const isSameColumn = oldStatus === targetStatus

    if (isSameColumn && active.id === over.id) return

    // Optimistic update
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === activeTaskId ? { ...t, status: targetStatus } : t
      )

      if (!isSameColumn) return updated

      // Reorder within same column
      const columnTasks = updated
        .filter((t) => t.status === targetStatus)
        .sort((a, b) => a.position - b.position)

      const oldIndex = columnTasks.findIndex((t) => t.id === activeTaskId)
      const newIndex = columnTasks.findIndex((t) => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return updated

      const reordered = arrayMove(columnTasks, oldIndex, newIndex).map((t, i) => ({
        ...t,
        position: i,
      }))

      return updated.map((t) => {
        const reorderedTask = reordered.find((r) => r.id === t.id)
        return reorderedTask ?? t
      })
    })

    // Persist to API
    try {
      await fetch(`/api/tasks/${activeTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      })
    } catch {
      toast.error("Failed to update task status")
      // Revert
      setTasks((prev) =>
        prev.map((t) => (t.id === activeTaskId ? { ...t, status: oldStatus } : t))
      )
    }
  }

  const addTask = useCallback((task: Task) => {
    setTasks((prev) => [...prev, task])
  }, [])

  const updateTask = useCallback((updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setSelectedTask(updated)
  }, [])

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setSelectedTask(null)
  }, [])

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-280px)]">
          {COLUMNS.map((column) => {
            const columnTasks = getColumnTasks(column.id)
            const isOver = overId === column.id || columnTasks.some((t) => t.id === overId)

            return (
              <div
                key={column.id}
                id={column.id}
                className={cn(
                  "flex-shrink-0 w-72 flex flex-col rounded-xl border-t-4 bg-card shadow-sm transition-all duration-200",
                  column.accent,
                  isOver && activeTask?.status !== column.id && "ring-2 ring-primary/30 shadow-md"
                )}
              >
                {/* Column Header */}
                <div className={cn("px-3 py-2.5 rounded-t-lg", column.headerBg)}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{column.label}</h3>
                    <span className="text-xs font-medium text-muted-foreground bg-background/80 rounded-full px-2 py-0.5 min-w-[1.5rem] text-center">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  <SortableContext
                    items={columnTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <AnimatePresence mode="popLayout">
                      {columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={() => setSelectedTask(task)}
                          isDragging={activeTask?.id === task.id}
                        />
                      ))}
                    </AnimatePresence>
                  </SortableContext>

                  {columnTasks.length === 0 && !activeTask && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center h-16 rounded-lg border-2 border-dashed border-border/40 text-xs text-muted-foreground/50"
                    >
                      Drop here
                    </motion.div>
                  )}
                </div>

                {/* Add Task */}
                <div className="p-2 pt-0 border-t border-border/40 mt-1">
                  <AddTaskInline columnId={column.id} projectId={projectId} onAdd={addTask} />
                </div>
              </div>
            )
          })}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
          {activeTask && (
            <div className="rotate-2 scale-105 opacity-90">
              <TaskCard task={activeTask} isDragging onClick={() => {}} isOverlay />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Task Detail Drawer */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          members={members}
          onClose={() => setSelectedTask(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
        />
      )}
    </>
  )
}
