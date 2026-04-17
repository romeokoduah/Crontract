import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  FileText,
  Users,
  ShieldCheck,
  Layers,
  Globe,
  CheckCircle,
  Pickaxe,
  Heart,
  Rocket,
  ChevronRight,
} from "lucide-react"

// ─── Brand logo ────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/25">
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
      <span className="text-foreground text-lg font-semibold tracking-tight">
        Crontract
      </span>
    </div>
  )
}

// ─── Nav ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>

        <div className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <Link href="#features" className="hover:text-foreground transition-colors">
            Features
          </Link>
          <Link href="#archetypes" className="hover:text-foreground transition-colors">
            Who it&apos;s for
          </Link>
          <Link href="#pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
          >
            Start free
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>
    </header>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-28 sm:pt-28 sm:pb-36">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-32 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[80px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-primary text-xs font-semibold tracking-wider uppercase">
            Built for African SMEs
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-foreground leading-[1.08] mb-6">
          SAP + Trello,
          <br />
          <span className="text-primary">for the rest of us.</span>
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
          One platform for Finance, HR, Projects, Procurement, and HSE.
          Built for mining contractors, NGOs, and fast-growing startups across
          Africa.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground text-base font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:shadow-primary/35 hover:-translate-y-0.5"
          >
            Start free — no card needed
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-border bg-background text-foreground text-base font-medium hover:bg-muted/50 transition-all"
          >
            Explore a demo
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>

        {/* Social proof */}
        <p className="mt-8 text-sm text-muted-foreground">
          Trusted by teams across{" "}
          <span className="font-medium text-foreground">Ghana, Nigeria, Kenya</span>
          {" "}and growing.
        </p>
      </div>
    </section>
  )
}

// ─── Archetypes ────────────────────────────────────────────────────────────

const ARCHETYPES = [
  {
    icon: Pickaxe,
    label: "Mining Contractors",
    headline: "From drill site to boardroom",
    description:
      "Manage plant utilisation, site HSE compliance, subcontractor payments, and project P&L — all in one place. Built to handle Ghana Chamber of Mines reporting requirements.",
    color: "amber",
    modules: ["HSE & Safety", "Procurement", "Project Costing", "Payroll", "Fleet"],
    accent: "bg-amber-500",
    softBg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/50",
  },
  {
    icon: Heart,
    label: "NGOs & Non-profits",
    headline: "Donor trust through transparency",
    description:
      "Track donor funds across multiple grants, generate programme reports, and manage field operations — with audit trails that satisfy any external auditor.",
    color: "emerald",
    modules: ["Grant Management", "Donor Reporting", "Field Operations", "Finance", "HR"],
    accent: "bg-emerald-500",
    softBg: "bg-emerald-50 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-800/40",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
  },
  {
    icon: Rocket,
    label: "Growing Startups",
    headline: "Move fast, stay organised",
    description:
      "Sprint boards, OKRs, employee onboarding, invoicing, and approval workflows — everything your team needs to scale without the enterprise price tag.",
    color: "blue",
    modules: ["Projects & Sprints", "OKRs", "Invoicing", "HR & Onboarding", "Documents"],
    accent: "bg-blue-500",
    softBg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
  },
]

function Archetypes() {
  return (
    <section id="archetypes" className="py-24 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            Built for how you actually work
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Crontract adapts to your business type, pre-configuring the modules and
            workflows that matter most to you.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {ARCHETYPES.map((a) => {
            const Icon = a.icon
            return (
              <div
                key={a.label}
                className={`rounded-2xl border ${a.border} ${a.softBg} p-7 flex flex-col`}
              >
                <div className={`w-11 h-11 rounded-xl ${a.iconBg} flex items-center justify-center mb-5`}>
                  <Icon className={`h-5 w-5 ${a.iconColor}`} />
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${a.accent}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {a.label}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-foreground mb-3">
                  {a.headline}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-5">
                  {a.description}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {a.modules.map((m) => (
                    <span
                      key={m}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-background/70 text-muted-foreground border border-border/60"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Features ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Layers,
    title: "All modules, one subscription",
    description:
      "Finance, HR, Projects, Procurement, HSE, and Documents — activate only what you need. No per-module fees.",
  },
  {
    icon: Users,
    title: "Role-based access control",
    description:
      "Fine-grained permissions per module. Assign roles like Finance Manager, Site Supervisor, or HR Officer — each with the right access.",
  },
  {
    icon: ShieldCheck,
    title: "Approval workflows",
    description:
      "Multi-level approval chains for purchase requests, leave, expenses, and more. Full audit trail on every decision.",
  },
  {
    icon: BarChart3,
    title: "Live dashboards & reports",
    description:
      "Real-time KPIs, cash flow summaries, project burn rates, and HSE incident tracking — exportable to PDF or Excel.",
  },
  {
    icon: Globe,
    title: "Multi-currency & multi-entity",
    description:
      "GHS, USD, EUR — Crontract handles FX, consolidations, and separate workspaces for each entity or subsidiary.",
  },
  {
    icon: FileText,
    title: "Document management",
    description:
      "Version-controlled document library with folder permissions, e-signatures, and contract expiry reminders.",
  },
]

function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            Everything your business needs
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Stop stitching together spreadsheets and disconnected apps. Crontract
            gives you an integrated operations layer from day one.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="group p-6 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Comparison table ──────────────────────────────────────────────────────

function Comparison() {
  const rows = [
    { feature: "Finance & Accounting", sap: true, trello: false, crontract: true },
    { feature: "HR & Payroll", sap: true, trello: false, crontract: true },
    { feature: "Project Management", sap: false, trello: true, crontract: true },
    { feature: "HSE Compliance", sap: true, trello: false, crontract: true },
    { feature: "Approval Workflows", sap: true, trello: false, crontract: true },
    { feature: "SME-friendly pricing", sap: false, trello: true, crontract: true },
    { feature: "African market focus", sap: false, trello: false, crontract: true },
    { feature: "Multi-currency (GHS/USD)", sap: true, trello: false, crontract: true },
  ]

  return (
    <section className="py-24 bg-muted/30">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            SAP + Trello — without the compromise
          </h2>
          <p className="text-muted-foreground text-lg">
            Enterprise power at startup speed.
          </p>
        </div>

        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                  Feature
                </th>
                <th className="py-4 px-4 text-center text-sm font-medium text-muted-foreground">
                  SAP
                </th>
                <th className="py-4 px-4 text-center text-sm font-medium text-muted-foreground">
                  Trello
                </th>
                <th className="py-4 px-4 text-center text-sm font-semibold text-primary bg-primary/5">
                  Crontract
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-border/50 last:border-0 ${
                    i % 2 === 0 ? "" : "bg-muted/20"
                  }`}
                >
                  <td className="py-3.5 px-6 text-sm text-foreground font-medium">
                    {row.feature}
                  </td>
                  {(["sap", "trello", "crontract"] as const).map((col) => (
                    <td
                      key={col}
                      className={`py-3.5 px-4 text-center ${
                        col === "crontract" ? "bg-primary/5" : ""
                      }`}
                    >
                      {row[col] ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="w-4 h-4 block mx-auto text-muted-foreground/30 text-lg leading-none">
                          —
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ─── CTA ───────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[hsl(224,12%,8%)] dark:bg-[hsl(224,12%,6%)] px-8 py-20 text-center">
          {/* Glow */}
          <div className="absolute top-[-50%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-4">
              Get started today
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
              Ready to run your business
              <br />
              like clockwork?
            </h2>
            <p className="text-[hsl(220,14%,65%)] text-lg mb-10 max-w-xl mx-auto">
              Set up your workspace in under 5 minutes. No credit card. No
              contracts. Cancel anytime.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground text-base font-semibold hover:bg-primary/90 transition-all shadow-xl shadow-primary/30 hover:-translate-y-0.5"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/20 text-white text-base font-medium hover:bg-white/5 transition-all"
              >
                Explore demos
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-muted-foreground max-w-xs leading-relaxed">
              Enterprise operations platform for African SMEs. Finance, HR,
              Projects, Procurement, and HSE — unified.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="text-muted-foreground hover:text-foreground transition-colors">
              Sign up
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Crontract. All rights reserved.</p>
          <p>Built for African enterprise. 🌍</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Archetypes />
        <Features />
        <Comparison />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
