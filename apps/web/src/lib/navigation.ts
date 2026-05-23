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
  Megaphone,
  UserCircle,
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
    children: [
      { title: "Overview", href: "/grants", icon: Heart },
      { title: "Grants", href: "/grants/grants", icon: Heart },
      { title: "Donors", href: "/grants/donors", icon: Heart },
      { title: "Logframes", href: "/grants/logframes", icon: Heart },
      { title: "Indicators", href: "/grants/indicators", icon: Heart },
      { title: "Reports", href: "/grants/reports", icon: Heart },
    ],
  },
  {
    title: "CRM",
    href: "/crm",
    icon: Briefcase,
    module: "crm",
    children: [
      { title: "Overview", href: "/crm", icon: Briefcase },
      { title: "Contacts", href: "/crm/contacts", icon: Briefcase },
      { title: "Companies", href: "/crm/companies", icon: Briefcase },
      { title: "Deals", href: "/crm/deals", icon: Briefcase },
      { title: "Pipeline", href: "/crm/pipeline", icon: Briefcase },
      { title: "Activities", href: "/crm/activities", icon: Briefcase },
    ],
  },
  {
    title: "Compliance",
    href: "/compliance",
    icon: Shield,
    module: "compliance",
    children: [
      { title: "Overview", href: "/compliance", icon: Shield },
      { title: "Obligations", href: "/compliance/obligations", icon: Shield },
      { title: "Licences", href: "/compliance/licences", icon: Shield },
      { title: "Policies", href: "/compliance/policies", icon: Shield },
      { title: "Audits", href: "/compliance/audits", icon: Shield },
      { title: "Actions", href: "/compliance/actions", icon: Shield },
    ],
  },
  {
    title: "Social Media",
    href: "/social-media",
    icon: Megaphone,
    module: "social-media",
    children: [
      { title: "Overview", href: "/social-media", icon: Megaphone },
      { title: "Compose", href: "/social-media/compose", icon: Megaphone },
      { title: "Calendar", href: "/social-media/calendar", icon: Megaphone },
      { title: "Posts", href: "/social-media/posts", icon: Megaphone },
      { title: "Accounts", href: "/social-media/accounts", icon: Megaphone },
    ],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    module: "reports",
  },
]

export const employeeNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "My Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    title: "My Tasks",
    href: "/tasks",
    icon: CheckSquare,
  },
  {
    title: "Meetings",
    href: "/meetings",
    icon: Calendar,
  },
  {
    title: "Documents",
    href: "/documents",
    icon: FileText,
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
  {
    title: "My Profile",
    href: "/profile",
    icon: UserCircle,
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
    "compliance", "crm", "grants", "social-media", "reports",
  ],
  NGO: [
    "people", "projects", "meetings", "documents", "approvals",
    "finance", "budget", "procurement", "grants", "crm",
    "compliance", "social-media", "reports",
  ],
  STARTUP: [
    "people", "projects", "meetings", "documents", "approvals",
    "finance", "budget", "crm", "social-media",
    "compliance", "grants", "reports",
  ],
}
