"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn, getInitials } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  X,
  Trash2,
  MessageSquare,
  Send,
  Plus,
  Check,
  Calendar,
  Tag,
  CheckSquare,
  Loader2,
  Pencil,
} from "lucide-react"
import { toast } from "sonner"

type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED"
type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

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
  priority: TaskPriority
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

type Comment = {
  id: string
  content: string
  createdAt: string
  user: { id: string; name: string; avatarUrl: string | null }
  replies?: Comment[]
}

interface TaskDetailProps {
  task: Task
  members: Member[]
  onClose: () => void
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
}

const statusConfig: Record<TaskStatus, { label: string }> = {
  TODO: { label: "To Do" },
  IN_PROGRESS: { label: "In Progress" },
  IN_REVIEW: { label: "In Review" },
  DONE: { label: "Done" },
  CANCELLED: { label: "Cancelled" },
}

const priorityConfig: Record<TaskPriority, { label: string; dotClass: string }> = {
  LOW: { label: "Low", dotClass: "bg-slate-400" },
  MEDIUM: { label: "Medium", dotClass: "bg-blue-400" },
  HIGH: { label: "High", dotClass: "bg-amber-500" },
  URGENT: { label: "Urgent", dotClass: "bg-red-500" },
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export function TaskDetail({ task, members, onClose, onUpdate, onDelete }: TaskDetailProps) {
  const [title, setTitle] = useState(task.title)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [description, setDescription] = useState(task.description ?? "")
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [assigneeId, setAssigneeId] = useState<string>(task.assigneeId ?? "")
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split("T")[0] : "")
  const [labels, setLabels] = useState<string[]>(task.labels)
  const [newLabel, setNewLabel] = useState("")
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const debouncedDescription = useDebounce(description, 800)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // Load comments
  useEffect(() => {
    fetch(`/api/tasks/${task.id}/comments`)
      .then((r) => r.json())
      .then((data) => {
        if (isMounted.current && data.comments) setComments(data.comments)
      })
      .catch(() => {})
  }, [task.id])

  // Auto-save description
  useEffect(() => {
    if (debouncedDescription === (task.description ?? "")) return
    patchTask({ description: debouncedDescription || null })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDescription])

  const patchTask = useCallback(
    async (updates: Partial<Task>) => {
      setIsSaving(true)
      try {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || "Failed to update task")
          return
        }
        if (isMounted.current) {
          onUpdate({ ...task, ...updates, ...data.task })
        }
      } catch {
        toast.error("Something went wrong")
      } finally {
        if (isMounted.current) setIsSaving(false)
      }
    },
    [task, onUpdate]
  )

  const saveTitle = async () => {
    if (!title.trim()) {
      setTitle(task.title)
      setIsEditingTitle(false)
      return
    }
    setIsEditingTitle(false)
    if (title !== task.title) await patchTask({ title })
  }

  const handleStatusChange = async (val: string) => {
    const newStatus = val as TaskStatus
    setStatus(newStatus)
    await patchTask({ status: newStatus })
  }

  const handlePriorityChange = async (val: string) => {
    const newPriority = val as TaskPriority
    setPriority(newPriority)
    await patchTask({ priority: newPriority })
  }

  const handleAssigneeChange = async (val: string) => {
    const newAssigneeId = val === "unassigned" ? null : val
    setAssigneeId(val)
    await patchTask({ assigneeId: newAssigneeId })
  }

  const handleDueDateChange = async (val: string) => {
    setDueDate(val)
    await patchTask({ dueDate: val || null })
  }

  const addLabel = async () => {
    if (!newLabel.trim()) return
    const updated = [...labels, newLabel.trim()]
    setLabels(updated)
    setNewLabel("")
    await patchTask({ labels: updated })
  }

  const removeLabel = async (label: string) => {
    const updated = labels.filter((l) => l !== label)
    setLabels(updated)
    await patchTask({ labels: updated })
  }

  const addSubtask = async () => {
    if (!newSubtaskTitle.trim()) return
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: task.projectId,
          parentId: task.id,
          title: newSubtaskTitle.trim(),
          status: "TODO",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to create subtask")
        return
      }
      setSubtasks((prev) => [...prev, { id: data.task.id, title: data.task.title, status: "TODO" }])
      setNewSubtaskTitle("")
      setAddingSubtask(false)
    } catch {
      toast.error("Something went wrong")
    }
  }

  const toggleSubtask = async (subtaskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "DONE" ? "TODO" : "DONE"
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, status: newStatus } : s))
    )
    try {
      await fetch(`/api/tasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch {
      // revert
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtaskId ? { ...s, status: currentStatus } : s))
      )
    }
  }

  const submitComment = async () => {
    if (!newComment.trim()) return
    setIsSubmittingComment(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to post comment")
        return
      }
      setComments((prev) => [...prev, { ...data.comment, replies: [] }])
      setNewComment("")
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Delete this task? This cannot be undone.")) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" })
      if (!res.ok) {
        toast.error("Failed to delete task")
        return
      }
      toast.success("Task deleted")
      onDelete(task.id)
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsDeleting(false)
    }
  }

  const completedSubtasks = subtasks.filter((s) => s.status === "DONE").length

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-[580px] bg-background shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            {isSaving && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-8 px-2"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-6">
            {/* Title */}
            <div>
              {isEditingTitle ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle()
                    if (e.key === "Escape") {
                      setTitle(task.title)
                      setIsEditingTitle(false)
                    }
                  }}
                  className="text-xl font-bold border-0 border-b-2 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="group flex items-start gap-2 w-full text-left"
                >
                  <h2 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors flex-1">
                    {title}
                  </h2>
                  <Pencil className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
                </button>
              )}
            </div>

            {/* Properties Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select value={priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", cfg.dotClass)} />
                          {cfg.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assignee</Label>
                <Select value={assigneeId || "unassigned"} onValueChange={handleAssigneeChange}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          {m.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Due Date
                </Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={4}
                className="text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground">Auto-saved</p>
            </div>

            <Separator />

            {/* Labels */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Tag className="h-3 w-3" />
                Labels
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => (
                  <Badge
                    key={label}
                    variant="secondary"
                    className="text-xs cursor-pointer group gap-1"
                    onClick={() => removeLabel(label)}
                  >
                    {label}
                    <X className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addLabel()
                  }}
                  placeholder="Add label..."
                  className="h-7 text-xs"
                />
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={addLabel}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Subtasks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckSquare className="h-3 w-3" />
                  Subtasks
                  {subtasks.length > 0 && (
                    <span className="text-muted-foreground/60">
                      ({completedSubtasks}/{subtasks.length})
                    </span>
                  )}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setAddingSubtask(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>

              {subtasks.length > 0 && (
                <div className="space-y-1">
                  {subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2 py-1">
                      <Checkbox
                        checked={subtask.status === "DONE"}
                        onCheckedChange={() => toggleSubtask(subtask.id, subtask.status)}
                        className="h-4 w-4"
                      />
                      <span
                        className={cn(
                          "text-sm flex-1",
                          subtask.status === "DONE" && "line-through text-muted-foreground"
                        )}
                      >
                        {subtask.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {addingSubtask && (
                <div className="flex gap-2">
                  <Input
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addSubtask()
                      if (e.key === "Escape") {
                        setAddingSubtask(false)
                        setNewSubtaskTitle("")
                      }
                    }}
                    placeholder="Subtask title..."
                    className="h-7 text-sm"
                    autoFocus
                  />
                  <Button size="sm" variant="outline" className="h-7 px-2" onClick={addSubtask}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => {
                      setAddingSubtask(false)
                      setNewSubtaskTitle("")
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Comments */}
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" />
                Comments ({comments.length})
              </Label>

              {comments.length > 0 && (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2.5">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                          {getInitials(comment.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium">{comment.user.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("en-GB", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(comment.createdAt))}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* New comment */}
              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  rows={2}
                  className="text-sm resize-none flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment()
                  }}
                />
                <Button
                  size="sm"
                  className="h-auto self-end"
                  onClick={submitComment}
                  disabled={isSubmittingComment || !newComment.trim()}
                >
                  {isSubmittingComment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">⌘+Enter to send</p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
