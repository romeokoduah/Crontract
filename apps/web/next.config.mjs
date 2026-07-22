/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production"

// Whether this deployment is actually served over TLS, derived from the
// canonical URL. A plain-HTTP deployment (e.g. a staging box reached at
// http://IP:PORT before a domain is attached) must NOT emit HTTPS-only
// directives: `upgrade-insecure-requests` is honoured regardless of the
// scheme the page was served over, so it would rewrite same-origin requests
// for /_next/static/* to https:// — where nothing is listening — and the app
// would render a blank page.
//
// NOTE: `headers()` is evaluated at BUILD time, so changing NEXTAUTH_URL
// requires a rebuild, not just a process restart.
const isHttps = (process.env.NEXTAUTH_URL ?? "").startsWith("https://")

// Content Security Policy.
// 'unsafe-inline' for scripts is required by next-themes' inline theme script and
// Next.js' bootstrap; 'unsafe-eval' is only needed by the dev server's HMR runtime.
// Tighten to a nonce-based policy when moving off the inline theme script.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `font-src 'self' data:`,
  `connect-src 'self'`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  // Only meaningful — and only safe — when the site is actually reachable
  // over TLS. See `isHttps` above.
  ...(isHttps ? [`upgrade-insecure-requests`] : []),
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // HSTS is ignored by browsers when sent over plain HTTP, but advertising a
  // two-year TLS-only policy from a deployment that has no TLS is misleading
  // and becomes a footgun the moment the host is reached over https once.
  ...(isHttps
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
]

const nextConfig = {
  poweredByHeader: false,
  // Enables src/instrumentation.ts (env validation at boot) on Next 14.
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
