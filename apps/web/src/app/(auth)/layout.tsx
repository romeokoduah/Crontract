import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Crontract — Sign in",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col relative overflow-hidden bg-[hsl(224,12%,8%)]">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(25,85%,45%) 1px, transparent 1px), linear-gradient(90deg, hsl(25,85%,45%) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Radial glow */}
        <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full bg-[hsl(25,85%,45%)] opacity-[0.07] blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-[hsl(25,85%,55%)] opacity-[0.05] blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group w-fit">
            <div className="w-9 h-9 rounded-xl bg-[hsl(25,85%,45%)] flex items-center justify-center shadow-lg shadow-[hsl(25,85%,45%)]/30">
              <svg
                width="20"
                height="20"
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
                <path
                  d="M10 7L13 8.5V11.5L10 13L7 11.5V8.5L10 7Z"
                  fill="white"
                />
              </svg>
            </div>
            <span className="text-white text-xl font-semibold tracking-tight">
              Crontract
            </span>
          </Link>

          {/* Main content */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(25,85%,45%)]/30 bg-[hsl(25,85%,45%)]/10 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(25,85%,55%)] animate-pulse" />
                <span className="text-[hsl(25,85%,65%)] text-xs font-medium tracking-wide uppercase">
                  Enterprise Operations Platform
                </span>
              </div>
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight">
                Run your business
                <br />
                <span className="text-[hsl(25,85%,55%)]">like clockwork.</span>
              </h1>
              <p className="mt-4 text-[hsl(220,14%,60%)] text-lg leading-relaxed">
                Finance, HR, projects, procurement — unified in one platform
                built for African SMEs.
              </p>
            </div>

            {/* Feature list */}
            <ul className="space-y-4">
              {[
                {
                  icon: "💼",
                  title: "Multi-module ERP",
                  desc: "Finance, HR, projects, procurement, HSE",
                },
                {
                  icon: "🏢",
                  title: "Multi-tenant workspaces",
                  desc: "Separate environments for every entity",
                },
                {
                  icon: "🔒",
                  title: "Role-based access control",
                  desc: "Granular permissions at every level",
                },
                {
                  icon: "📊",
                  title: "Real-time dashboards",
                  desc: "KPIs, reports, and approvals in one view",
                },
              ].map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <span className="text-xl leading-none mt-0.5">{f.icon}</span>
                  <div>
                    <p className="text-[hsl(220,14%,88%)] font-medium text-sm">
                      {f.title}
                    </p>
                    <p className="text-[hsl(220,9%,50%)] text-sm">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Archetype badges */}
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              { label: "Mining Contractors", color: "amber" },
              { label: "NGOs", color: "emerald" },
              { label: "Startups", color: "blue" },
            ].map((a) => (
              <span
                key={a.label}
                className="px-3 py-1 rounded-full text-xs font-medium border border-white/10 text-[hsl(220,14%,65%)] bg-white/5"
              >
                {a.label}
              </span>
            ))}
          </div>

          <p className="mt-6 text-[hsl(220,9%,40%)] text-xs">
            © {new Date().getFullYear()} Crontract. Built for African enterprise.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col min-h-screen bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center justify-center pt-8 pb-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
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
                <path
                  d="M10 7L13 8.5V11.5L10 13L7 11.5V8.5L10 7Z"
                  fill="white"
                />
              </svg>
            </div>
            <span className="text-foreground text-lg font-semibold tracking-tight">
              Crontract
            </span>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </div>
    </div>
  )
}
