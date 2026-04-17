/**
 * The onboarding wizard is a standalone full-screen experience.
 * This layout overrides the shared (auth) two-panel layout so the
 * wizard can own its own chrome (header, step bar, etc.).
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
