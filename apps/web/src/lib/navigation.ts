import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Calendar,
  FileText,
  CheckSquare,
  Bell,
  Settings,
  DollarSign,
  PiggyBank,
  ShoppingCart,
  Package,
  HardHat,
  BarChart3,
  Heart,
  Briefcase,
  Shield,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  module?: string
  children?: NavItem[]
}

export const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "People",
    href: "/people",
    icon: Users,
    module: "people",
  },
  {
    title: "Projects",
    href: "/projects",
    icon: FolderKanban,
    module: "projects",
  },
  {
    title: "Meetings",
    href: "/meetings",
    icon: Calendar,
    module: "meetings",
  },
  {
    title: "Documents",
    href: "/documents",
    icon: FileText,
    module: "documents",
  },
  {
    title: "Approvals",
    href: "/approvals",
    icon: CheckSquare,
    module: "approvals",
  },
  {
    title: "Finance",
    href: "/finance",
    icon: DollarSign,
    module: "finance",
    children: [
      { title: "Overview", href: "/finance", icon: DollarSign },
      { title: "Invoices", href: "/finance/invoices", icon: DollarSign },
      { title: "Bills", href: "/finance/bills", icon: DollarSign },
      { title: "Expenses", href: "/finance/expenses", icon: DollarSign },
      { title: "Chart of Accounts", href: "/finance/accounts", icon: DollarSign },
      { title: "Journals", href: "/finance/journals", icon: DollarSign },
    ],
  },
  {
    title: "Budget",
    href: "/budget",
    icon: PiggyBank,
    module: "budget",
  },
  {
    title: "Procurement",
    href: "/procurement",
    icon: ShoppingCart,
    module: "procurement",
    children: [
      { title: "Overview", href: "/procurement", icon: ShoppingCart },
      { title: "Requisitions", href: "/procurement/requisitions", icon: ShoppingCart },
      { title: "Purchase Orders", href: "/procurement/orders", icon: ShoppingCart },
      { title: "Vendors", href: "/procurement/vendors", icon: ShoppingCart },
    ],
  },
  {
    title: "Assets",
    href: "/assets",
    icon: Package,
    module: "assets",
  },
  {
    title: "HSE",
    href: "/hse",
    icon: HardHat,
    module: "hse",
    children: [
      { title: "Overview", href: "/hse", icon: HardHat },
      { title: "Incidents", href: "/hse/incidents", icon: HardHat },
      { title: "Permits", href: "/hse/permits", icon: HardHat },
      { title: "Risk Assessments", href: "/hse/risks", icon: HardHat },
      { title: "Toolbox Talks", href: "/hse/toolbox-talks", icon: HardHat },
      { title: "Training", href: "/hse/training", icon: HardHat },
    ],
  },
  {
    title: "Grants & M&E",
    href: "/grants",
    icon: Heart,
    module: "grants",
  },
  {
    title: "CRM",
    href: "/crm",
    icon: Briefcase,
    module: "crm",
  },
  {
    title: "Compliance",
    href: "/compliance",
    icon: Shield,
    module: "compliance",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    module: "reports",
  },
]

export const adminNavItems: NavItem[] = [
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
  {
    title: "Admin",
    href: "/admin",
    icon: Settings,
    children: [
      { title: "Users & Roles", href: "/admin/users", icon: Users },
      { title: "Permissions", href: "/admin/permissions", icon: Shield },
      { title: "Workspace", href: "/admin/workspace", icon: Settings },
      { title: "Audit Log", href: "/admin/audit", icon: FileText },
    ],
  },
]

export const modulesByBusinessType: Record<string, string[]> = {
  MINING_CONTRACTOR: [
    "people", "projects", "meetings", "documents", "approvals",
    "finance", "budget", "procurement", "assets", "hse",
    "compliance", "reports",
  ],
  NGO: [
    "people", "projects", "meetings", "documents", "approvals",
    "finance", "budget", "procurement", "grants",
    "reports",
  ],
  STARTUP: [
    "people", "projects", "meetings", "documents", "approvals",
    "finance", "budget", "crm",
    "reports",
  ],
}
