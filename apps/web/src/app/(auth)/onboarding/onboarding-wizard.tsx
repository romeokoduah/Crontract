"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  HardHat,
  Heart,
  Rocket,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Building2,
  DollarSign,
  Users,
  FolderKanban,
  Calendar,
  FileText,
  CheckSquare,
  PiggyBank,
  ShoppingCart,
  Package,
  BarChart3,
  Briefcase,
  Shield,
  ArrowRight,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { modulesByBusinessType } from "@/lib/navigation"
import type { LucideIcon } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

type BusinessType = "MINING_CONTRACTOR" | "NGO" | "STARTUP"

interface WizardProps {
  userId: string
  workspaceId: string
  userName: string
  workspaceName: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Business Type" },
  { id: 2, label: "Company" },
  { id: 3, label: "Modules" },
  { id: 4, label: "Team" },
  { id: 5, label: "Done" },
]

const BUSINESS_TYPES: {
  type: BusinessType
  icon: LucideIcon
  title: string
  description: string
  badge?: string
}[] = [
  {
    type: "MINING_CONTRACTOR",
    icon: HardHat,
    title: "Mining Contractor",
    description:
      "Heavy industry, HSE compliance, procurement, and site operations management.",
    badge: "Most popular",
  },
  {
    type: "NGO",
    icon: Heart,
    title: "NGO / Non-profit",
    description:
      "Grant management, M&E tracking, donor reporting, and programme delivery.",
  },
  {
    type: "STARTUP",
    icon: Rocket,
    title: "Startup / Other",
    description:
      "Finance, HR, projects, and CRM to grow your business from day one.",
  },
]

const MODULE_META: Record<
  string,
  { icon: LucideIcon; label: string; description: string }
> = {
  people: {
    icon: Users,
    label: "People & HR",
    description: "Employee records, leave, payroll, and org chart",
  },
  projects: {
    icon: FolderKanban,
    label: "Projects",
    description: "Task boards, milestones, timesheets, and deliverables",
  },
  meetings: {
    icon: Calendar,
    label: "Meetings",
    description: "Agendas, minutes, action items, and scheduling",
  },
  documents: {
    icon: FileText,
    label: "Documents",
    description: "Contracts, SOPs, version control, and e-signatures",
  },
  approvals: {
    icon: CheckSquare,
    label: "Approvals",
    description: "Multi-level approval workflows for any request type",
  },
  finance: {
    icon: DollarSign,
    label: "Finance",
    description: "Invoices, bills, expenses, journals, and accounts",
  },
  budget: {
    icon: PiggyBank,
    label: "Budget",
    description: "Cost centres, budget lines, variance analysis",
  },
  procurement: {
    icon: ShoppingCart,
    label: "Procurement",
    description: "Requisitions, purchase orders, and vendor management",
  },
  assets: {
    icon: Package,
    label: "Assets",
    description: "Asset register, depreciation, and maintenance tracking",
  },
  hse: {
    icon: HardHat,
    label: "HSE",
    description: "Incidents, permits, risk assessments, and toolbox talks",
  },
  grants: {
    icon: Heart,
    label: "Grants & M&E",
    description: "Donor tracking, indicator monitoring, and reporting",
  },
  crm: {
    icon: Briefcase,
    label: "CRM",
    description: "Leads, opportunities, contacts, and pipeline",
  },
  compliance: {
    icon: Shield,
    label: "Compliance",
    description: "Regulatory filings, certifications, and audit readiness",
  },
  reports: {
    icon: BarChart3,
    label: "Reports",
    description: "KPI dashboards, exports, and scheduled reports",
  },
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const ROLE_OPTIONS = [
  "Administrator",
  "Finance Manager",
  "HR Manager",
  "Project Manager",
  "Team Member",
]

// ─── Schemas ──────────────────────────────────────────────────────────────────

const companySchema = z.object({
  legalName: z.string().min(2, "Legal name must be at least 2 characters"),
  tradingName: z.string().optional(),
  country: z.string().min(1, "Please select a country"),
  currency: z.string().min(1, "Please select a currency"),
  fiscalYearStart: z.number().min(1).max(12),
})

const teamSchema = z.object({
  invites: z.array(
    z.object({
      email: z
        .string()
        .email("Invalid email address")
        .or(z.literal("")),
      role: z.string(),
    })
  ),
})

type CompanyValues = z.infer<typeof companySchema>
type TeamValues = z.infer<typeof teamSchema>

// ─── Step Components ──────────────────────────────────────────────────────────

function StepBusinessType({
  selected,
  onSelect,
}: {
  selected: BusinessType | null
  onSelect: (type: BusinessType) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          What best describes your business?
        </h2>
        <p className="mt-1.5 text-muted-foreground text-sm">
          We&apos;ll pre-configure modules and defaults to match your industry.
        </p>
      </div>

      <div className="grid gap-3">
        {BUSINESS_TYPES.map(({ type, icon: Icon, title, description, badge }) => {
          const isSelected = selected === type
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className={[
                "group relative flex items-start gap-4 rounded-xl border-2 p-5 text-left transition-all duration-150",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
              ].join(" ")}
            >
              {/* Icon */}
              <div
                className={[
                  "flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">
                    {title}
                  </span>
                  {badge && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-primary/10 text-primary">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-muted-foreground text-sm leading-snug">
                  {description}
                </p>
              </div>

              {/* Check */}
              <div
                className={[
                  "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors mt-0.5",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-border group-hover:border-primary/40",
                ].join(" ")}
              >
                {isSelected && (
                  <svg
                    width="10"
                    height="8"
                    viewBox="0 0 10 8"
                    fill="none"
                    className="text-primary-foreground"
                  >
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepCompanyBasics({ form }: { form: ReturnType<typeof useForm<CompanyValues>> }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Company details
        </h2>
        <p className="mt-1.5 text-muted-foreground text-sm">
          This information appears on documents and reports generated by Crontract.
        </p>
      </div>

      <Form {...form}>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="legalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Legal name</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...field}
                      placeholder="Acme Mining Company Limited"
                      className="pl-9"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tradingName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Trading name{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Acme Mining"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="GH">Ghana</SelectItem>
                      <SelectItem value="NG">Nigeria</SelectItem>
                      <SelectItem value="KE">Kenya</SelectItem>
                      <SelectItem value="ZA">South Africa</SelectItem>
                      <SelectItem value="TZ">Tanzania</SelectItem>
                      <SelectItem value="UG">Uganda</SelectItem>
                      <SelectItem value="RW">Rwanda</SelectItem>
                      <SelectItem value="ZM">Zambia</SelectItem>
                      <SelectItem value="ZW">Zimbabwe</SelectItem>
                      <SelectItem value="ET">Ethiopia</SelectItem>
                      <SelectItem value="SN">Senegal</SelectItem>
                      <SelectItem value="CI">Côte d&apos;Ivoire</SelectItem>
                      <SelectItem value="CM">Cameroon</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base currency</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="GHS">GHS — Ghanaian Cedi</SelectItem>
                      <SelectItem value="NGN">NGN — Nigerian Naira</SelectItem>
                      <SelectItem value="KES">KES — Kenyan Shilling</SelectItem>
                      <SelectItem value="ZAR">ZAR — South African Rand</SelectItem>
                      <SelectItem value="TZS">TZS — Tanzanian Shilling</SelectItem>
                      <SelectItem value="UGX">UGX — Ugandan Shilling</SelectItem>
                      <SelectItem value="RWF">RWF — Rwandan Franc</SelectItem>
                      <SelectItem value="USD">USD — US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR — Euro</SelectItem>
                      <SelectItem value="GBP">GBP — British Pound</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="fiscalYearStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fiscal year starts in</FormLabel>
                <Select
                  value={String(field.value)}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MONTHS.map((month, idx) => (
                      <SelectItem key={month} value={String(idx + 1)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Form>
    </div>
  )
}

function StepModules({
  enabled,
  onToggle,
}: {
  businessType: BusinessType
  enabled: Set<string>
  onToggle: (module: string) => void
}) {
  const allModules = Object.keys(MODULE_META)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Choose your modules
        </h2>
        <p className="mt-1.5 text-muted-foreground text-sm">
          Pre-selected based on your business type. Toggle any module on or off — you can always change this later.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {allModules.map((key) => {
          const meta = MODULE_META[key]
          if (!meta) return null
          const { icon: Icon, label, description } = meta
          const isOn = enabled.has(key)

          return (
            <div
              key={key}
              className={[
                "flex items-center gap-3.5 rounded-lg border px-4 py-3.5 transition-colors",
                isOn
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-card",
              ].join(" ")}
            >
              <div
                className={[
                  "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                  isOn
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={[
                    "text-sm font-medium",
                    isOn ? "text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {description}
                </p>
              </div>
              <Switch
                checked={isOn}
                onCheckedChange={() => onToggle(key)}
                className="flex-shrink-0"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StepInviteTeam({
  form,
  onSkip,
}: {
  form: ReturnType<typeof useForm<TeamValues>>
  onSkip: () => void
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "invites",
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Invite your team
        </h2>
        <p className="mt-1.5 text-muted-foreground text-sm">
          Add colleagues who will work with you in Crontract. They&apos;ll receive an invitation email.
        </p>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Email address
          </span>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-36">
            Role
          </span>
          <span className="w-8" />
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-start">
            <FormField
              control={form.control}
              name={`invites.${index}.email`}
              render={({ field: f }) => (
                <FormItem className="space-y-0">
                  <FormControl>
                    <Input
                      {...f}
                      type="email"
                      placeholder="colleague@company.com"
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-1" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`invites.${index}.role`}
              render={({ field: f }) => (
                <FormItem className="space-y-0">
                  <Select value={f.value} onValueChange={f.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {fields.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => append({ email: "", role: "Team Member" })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add another
          </Button>
        )}
      </div>

      <div className="pt-2 border-t border-border">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          Skip for now, I&apos;ll invite team members later
        </button>
      </div>
    </div>
  )
}

function StepComplete({
  userName,
  workspaceName,
  onGoToDashboard,
  isLoading,
}: {
  userName: string
  workspaceName: string
  onGoToDashboard: () => void
  isLoading: boolean
}) {
  const firstName = userName.split(" ")[0]

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      {/* Success icon */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          You&apos;re all set, {firstName}!
        </h2>
        <p className="text-muted-foreground leading-relaxed max-w-sm">
          <strong className="text-foreground">{workspaceName}</strong> is ready to go.
          Your workspace has been configured with the modules and team you selected.
        </p>
      </div>

      <div className="w-full max-w-xs space-y-3 pt-2">
        <Button
          className="w-full gap-2 font-semibold"
          size="lg"
          onClick={onGoToDashboard}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting up…
            </>
          ) : (
            <>
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        You can change any of these settings from the Admin panel at any time.
      </p>
    </div>
  )
}

// ─── Slide animation variants ─────────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export function OnboardingWizard({
  userName,
  workspaceName,
}: WizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Step 1
  const [businessType, setBusinessType] = useState<BusinessType | null>(null)

  // Step 2
  const companyForm = useForm<CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      legalName: workspaceName,
      tradingName: "",
      country: "GH",
      currency: "GHS",
      fiscalYearStart: 1,
    },
  })

  // Step 3
  const [enabledModules, setEnabledModules] = useState<Set<string>>(
    new Set(modulesByBusinessType["STARTUP"])
  )

  // Step 4
  const teamForm = useForm<TeamValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      invites: [{ email: "", role: "Team Member" }],
    },
  })

  // Update modules when business type changes
  function handleBusinessTypeSelect(type: BusinessType) {
    setBusinessType(type)
    setEnabledModules(new Set(modulesByBusinessType[type] ?? modulesByBusinessType["STARTUP"]))
  }

  function toggleModule(key: string) {
    setEnabledModules((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function navigate(newStep: number) {
    setDirection(newStep > step ? 1 : -1)
    setStep(newStep)
  }

  async function handleNext() {
    if (step === 1) {
      if (!businessType) {
        toast.error("Please select a business type to continue.")
        return
      }
      navigate(2)
    } else if (step === 2) {
      const valid = await companyForm.trigger()
      if (!valid) return
      navigate(3)
    } else if (step === 3) {
      if (enabledModules.size === 0) {
        toast.error("Please enable at least one module.")
        return
      }
      navigate(4)
    } else if (step === 4) {
      // Validate non-empty rows
      const invites = teamForm.getValues("invites")
      const nonEmpty = invites.filter((i) => i.email.trim() !== "")
      let valid = true
      for (let i = 0; i < invites.length; i++) {
        if (invites[i].email.trim() !== "") {
          const result = await teamForm.trigger(`invites.${i}.email`)
          if (!result) valid = false
        }
      }
      if (!valid) return
      await submitOnboarding(nonEmpty)
    }
  }

  async function submitOnboarding(
    invites: { email: string; role: string }[]
  ) {
    setIsSubmitting(true)
    try {
      const companyValues = companyForm.getValues()
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType,
          legalName: companyValues.legalName,
          tradingName: companyValues.tradingName || undefined,
          country: companyValues.country,
          currency: companyValues.currency,
          fiscalYearStart: companyValues.fiscalYearStart,
          modules: Array.from(enabledModules),
          invites: invites.filter((i) => i.email.trim() !== ""),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong", {
          description: "Please try again.",
        })
        return
      }

      navigate(5)
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again later.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSkipInvites() {
    submitOnboarding([])
  }

  async function handleGoToDashboard() {
    router.push("/dashboard")
    router.refresh()
  }

  const progress = ((step - 1) / (STEPS.length - 1)) * 100

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <svg
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10 2L17 5.5V14.5L10 18L3 14.5V5.5L10 2Z"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path d="M10 7L13 8.5V11.5L10 13L7 11.5V8.5L10 7Z" fill="white" />
              </svg>
            </div>
            <span className="text-foreground font-semibold tracking-tight">Crontract</span>
          </div>

          {/* Step counter */}
          <span className="text-sm text-muted-foreground">
            Step {step} of {STEPS.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-border">
          <motion.div
            className="h-full bg-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          />
        </div>
      </header>

      {/* Step indicators */}
      <div className="flex-shrink-0 max-w-2xl mx-auto w-full px-6 pt-6">
        <div className="flex items-center justify-between">
          {STEPS.map((s, idx) => {
            const isCompleted = step > s.id
            const isCurrent = step === s.id

            return (
              <div key={s.id} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={[
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                        ? "bg-primary/10 text-primary border-2 border-primary"
                        : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {isCompleted ? (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      s.id
                    )}
                  </div>
                  <span
                    className={[
                      "text-[10px] font-medium whitespace-nowrap",
                      isCurrent ? "text-primary" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {s.label}
                  </span>
                </div>

                {/* Connector */}
                {idx < STEPS.length - 1 && (
                  <div
                    className={[
                      "flex-1 h-px mx-2 mb-5 transition-colors",
                      step > s.id ? "bg-primary" : "bg-border",
                    ].join(" ")}
                    style={{ width: "clamp(16px, 6vw, 48px)" }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-6 pb-8">
        <div className="flex-1 relative overflow-hidden pt-8">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="w-full"
            >
              {step === 1 && (
                <StepBusinessType
                  selected={businessType}
                  onSelect={handleBusinessTypeSelect}
                />
              )}
              {step === 2 && <StepCompanyBasics form={companyForm} />}
              {step === 3 && businessType && (
                <StepModules
                  businessType={businessType}
                  enabled={enabledModules}
                  onToggle={toggleModule}
                />
              )}
              {step === 4 && (
                <StepInviteTeam form={teamForm} onSkip={handleSkipInvites} />
              )}
              {step === 5 && (
                <StepComplete
                  userName={userName}
                  workspaceName={workspaceName}
                  onGoToDashboard={handleGoToDashboard}
                  isLoading={false}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation footer */}
        {step < 5 && (
          <div className="flex-shrink-0 pt-6 border-t border-border mt-6">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="default"
                onClick={() => navigate(step - 1)}
                disabled={step === 1 || isSubmitting}
                className="gap-2 text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>

              <Button
                type="button"
                size="default"
                onClick={handleNext}
                disabled={isSubmitting}
                className="gap-2 min-w-[120px] font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : step === 4 ? (
                  <>
                    Finish setup
                    <ChevronRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
