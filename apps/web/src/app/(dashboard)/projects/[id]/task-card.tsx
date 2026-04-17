"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { motion } from "framer-motion"
import { cn, formatDate, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Calendar, CheckSquare } from "lucide-react"

type Task = {
  id: string
  title: string
  description: string | null
  status: string
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  assigneeId: string | null
  assignee: { id: string; name: string; avatarUrl: string | null } | null
  dueDate: string | null
  labels: string[]
  subtasks: { id: string; title: string; status: string }[]
}

const priorityConfig: Record<
  Task["priority"],
  { label: string; borderClass: string; dotClass: string }
> = {
  LOW: {
    label: "Low",
    borderClass: "border-l-slate-300",
    dotClass: "bg-slate-400",
  },
  MEDIUM: {
    label: "Medium",
    borderClass: "border-l-blue-400",
    dotClass: "bg-blue-400",
  },
  HIGH: {
    label: "High",
    borderClass: "border-l-amber-500",
    dotClass: "bg-amber-500",
  },
  URGENT: {
    label: "Urgent",
    borderClass: "border-l-red-500",
    dotClass: "bg-red-500",
  },
}

interface TaskCardProps {
  task: Task
  onClick: () => void
  isDragging?: boolean
  isOverlay?: boolean
}

export function TaskCard({ task, onClick, isDragging, isOverlay }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const priority = priorityConfig[task.priority]
  const completedSubtasks = task.subtasks.filter((s) => s.status === "DONE").length
  const totalSubtasks = task.subtasks.length
  const isDueSoon =
    task.dueDate && !isOverlay
      ? new Date(task.dueDate) < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      : false
  const isOverdue =
    task.dueDate && !isOverlay ? new Date(task.dueDate) < new Date() : false

  if (isSortableDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-20 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5"
      />
    )
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "group relative bg-background rounded-lg border border-l-4 shadow-sm cursor-pointer",
        "hover:shadow-md hover:-translate-y-0.5 transition-all duration-150",
        "select-none",
        priority.borderClass,
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div className="p-3 space-y-2.5">
        {/* Labels */}
        {task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.labels.slice(0, 3).map((label) => (
              <span
                key={label}
                className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
              >
                {label}
              </span>
            ))}
            {task.labels.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{task.labels.length - 3}</span>
            )}
          </div>
        )}

        {/* Title */}
        <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {task.title}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Subtasks */}
            {totalSubtasks > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckSquare className="h-3 w-3" />
                <span>
                  {completedSubtasks}/{totalSubtasks}
                </span>
              </div>
            )}

            {/* Due date */}
            {task.dueDate && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs rounded px-1.5 py-0.5",
                  isOverdue
                    ? "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400"
                    : isDueSoon
                    ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400"
                    : "text-muted-foreground"
                )}
              >
                <Calendar className="h-3 w-3" />
                <span>{formatDate(task.dueDate)}</span>
              </div>
            )}
          </div>

          {/* Assignee avatar */}
          {task.assignee && (
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                {getInitials(task.assignee.name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </motion.div>
  )
}
