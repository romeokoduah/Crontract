/**
 * Email sending abstraction.
 *
 * Without RESEND_API_KEY the app runs in "no-op" mode: sends are logged and skipped
 * so local/dev and the demo work without an email provider. When the key is present
 * (and the optional `resend` package is installed) emails are delivered via Resend.
 *
 * Never throws — callers can fire-and-forget and must not block their response on email.
 */

type SendArgs = {
  to: string
  subject: string
  html: string
  text?: string
}

type SendResult = { sent: boolean; skipped?: boolean; error?: string }

const FROM = process.env.EMAIL_FROM ?? "Crontract <noreply@crontract.io>"

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.info(`[email] skipped (no RESEND_API_KEY): to=${to} subject=${JSON.stringify(subject)}`)
    return { sent: false, skipped: true }
  }

  try {
    // Dynamic import kept out of the bundle (webpackIgnore) so the build doesn't require the
    // package to be installed; at runtime a missing module is caught and we skip sending.
    const mod = await import(/* webpackIgnore: true */ "resend").catch(() => null)
    if (!mod?.Resend) {
      console.warn("[email] RESEND_API_KEY set but `resend` package is not installed — skipping send")
      return { sent: false, error: "resend package not installed" }
    }
    const resend = new mod.Resend(key)
    await resend.emails.send({ from: FROM, to, subject, html, text })
    return { sent: true }
  } catch (err) {
    console.error("[email] send failed", err)
    return { sent: false, error: (err as Error).message }
  }
}

type InvitationArgs = {
  to: string
  inviterName: string
  workspaceName: string
  acceptUrl: string
}

export async function sendInvitationEmail({
  to,
  inviterName,
  workspaceName,
  acceptUrl,
}: InvitationArgs): Promise<SendResult> {
  const subject = `${inviterName} invited you to ${workspaceName} on Crontract`
  const text =
    `${inviterName} has invited you to join ${workspaceName} on Crontract.\n\n` +
    `Accept your invitation: ${acceptUrl}\n\n` +
    `This invitation expires in 7 days.`
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #b45309;">You've been invited to Crontract</h2>
      <p><strong>${escapeHtml(inviterName)}</strong> has invited you to join
         <strong>${escapeHtml(workspaceName)}</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${acceptUrl}" style="background:#b45309;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">
          Accept invitation
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">This invitation expires in 7 days. If you weren't expecting it, you can ignore this email.</p>
    </div>`
  return sendEmail({ to, subject, html, text })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
