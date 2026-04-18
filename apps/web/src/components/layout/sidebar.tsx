"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { mainNavItems, adminNavItems, employeeNavItems, type NavItem } from "@/lib/navigation"
import { ADMIN_ROLES } from "@/lib/authorization"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
} from "lucide-react"
import { useTheme } from "next-themes"
import { signOut } from "next-auth/react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  enabledModules?: string[]
  role?: string
}

function NavItemLink({
  item,
  collapsed,
  pathname,
}: {
  item: NavItem
  collapsed: boolean
  pathname: string
}) {
  const [expanded, setExpanded] = useState(false)
  const isActive =
    pathname === item.href ||
    (item.children && pathname.startsWith(item.href + "/"))
  const hasChildren = item.children && item.children.length > 0

  const Icon = item.icon

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
              isActive
                ? "bg-sidebar-accent text-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.title}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div>
      <div className="flex items-center">
        <Link
          href={item.href}
          className={cn(
            "flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "bg-sidebar-accent text-primary"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.title}</span>
        </Link>
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
          {item.children!.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                pathname === child.href
                  ? "text-primary"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
              )}
            >
              {child.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar({ collapsed, onToggle, enabledModules, role }: SidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const isAdminUser = role && ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])

  const navItems = isAdminUser
    ? mainNavItems.filter(
        (item) => !item.module || !enabledModules || enabledModules.includes(item.module)
      )
    : employeeNavItems

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-0 z-30 flex h-screen flex-col border-r bg-sidebar transition-all duration-200",
          collapsed ? "w-14" : "w-60"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex h-14 items-center border-b border-sidebar-border px-3",
            collapsed ? "justify-center" : "gap-2"
          )}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            C
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-sidebar-foreground">
              Crontract
            </span>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-3">
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavItemLink
                key={item.href + item.title}
                item={item}
                collapsed={collapsed}
                pathname={pathname}
              />
            ))}
          </div>

          {isAdminUser && (
            <>
              <Separator className="my-3 bg-sidebar-border" />

              <div className="space-y-1">
                {adminNavItems.map((item) => (
                  <NavItemLink
                    key={item.href}
                    item={item}
                    collapsed={collapsed}
                    pathname={pathname}
                  />
                ))}
              </div>
            </>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          {collapsed ? (
            <>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() =>
                      setTheme(theme === "dark" ? "light" : "dark")
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <Sun className="h-4 w-4 dark:hidden" />
                    <Moon className="hidden h-4 w-4 dark:block" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Toggle theme</TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggle}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <Sun className="h-4 w-4 dark:hidden" />
                <Moon className="hidden h-4 w-4 dark:block" />
                <span>Toggle theme</span>
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
              <button
                onClick={onToggle}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </button>
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
