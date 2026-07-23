<#
.SYNOPSIS
    Deploy Crontract to the Contabo VPS.

.DESCRIPTION
    Ships the current working tree to /var/www/crontract on the VPS, installs
    dependencies, syncs the Prisma schema, builds, and restarts the PM2 process.

    Live at https://crontract.com  (also reachable at http://169.58.42.182:8083)

    Requires the `contabo` SSH alias (already in ~/.ssh/config, key-based auth).

.PARAMETER SkipBuild
    Ship files and restart without reinstalling/rebuilding. Only safe for changes
    that do not affect compiled output (e.g. editing a markdown doc).

.PARAMETER Seed
    Re-run the demo seed after pushing the schema. DESTRUCTIVE to existing rows.
#>
[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$Seed
)

$ErrorActionPreference = "Stop"

$Remote  = "contabo"
$AppDir  = "/var/www/crontract"
$Url     = "https://crontract.com"
$RepoDir = $PSScriptRoot

# Files that must NEVER reach the server.
#
# .env.local is the critical one: Next.js gives it HIGHER precedence than .env,
# so shipping a developer's local file silently overrides the production config
# (wrong NEXTAUTH_URL, wrong DATABASE_URL) *and* leaks dev secrets onto the box.
# This has already happened once. Do not remove this exclusion.
$Excludes = @(
    "node_modules",
    ".next",
    ".git",
    ".env",
    ".env.local",
    ".env.example",
    "tsconfig.tsbuildinfo",
    ".devserver.log",
    ".app-screenshot.png"
)

Write-Host ""
Write-Host "Deploying Crontract -> $Remote`:$AppDir" -ForegroundColor Cyan
Write-Host ""

# --- 0. Record a baseline of the OTHER sites on this shared box -------------
# The VPS also serves cleen, carlab, groupeania, eclipsemotors and a portfolio.
# Breaking them is worse than a failed deploy, so verify before and after.
Write-Host "[0/5] Baselining co-hosted sites..." -ForegroundColor Yellow
$baseline = ssh $Remote 'for p in 80 8080 8081 8082; do printf "%s:%s " "$p" "$(curl -s -o /dev/null -w %{http_code} --max-time 10 http://127.0.0.1:$p/)"; done'
Write-Host "      $baseline"

# --- 1. Ship the working tree ----------------------------------------------
Write-Host "[1/5] Shipping working tree..." -ForegroundColor Yellow
$excludeArgs = $Excludes | ForEach-Object { "--exclude=$_" }
Push-Location $RepoDir
try {
    # tar to stdout -> ssh -> untar on the server
    & tar czf - @excludeArgs . | & ssh $Remote "mkdir -p $AppDir && tar xzf - -C $AppDir"
    if ($LASTEXITCODE -ne 0) { throw "File transfer failed (exit $LASTEXITCODE)" }
}
finally {
    Pop-Location
}

# --- 2. Install + schema ----------------------------------------------------
if ($SkipBuild) {
    Write-Host "[2/5] Skipping install/build (-SkipBuild)" -ForegroundColor DarkGray
    Write-Host "[3/5] Skipping schema sync (-SkipBuild)" -ForegroundColor DarkGray
}
else {
    Write-Host "[2/5] Installing dependencies..." -ForegroundColor Yellow
    ssh $Remote "cd $AppDir && export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 && corepack pnpm install --frozen-lockfile 2>&1 | tail -5"
    if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }

    Write-Host "[3/5] Applying Prisma migrations..." -ForegroundColor Yellow
    # Migrations are now adopted (packages/db/prisma/migrations/). `migrate deploy`
    # only applies pending migrations and NEVER drops columns — unlike `db push`.
    # ONE-TIME adoption on the live box must be done first (see the runbook in
    # docs/PRODUCTION-FOLLOWUPS.md "Adopting Prisma migrations"); until the baseline
    # is resolved there, this step fails loudly rather than mutating the schema.
    ssh $Remote "cd $AppDir && export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 && corepack pnpm db:generate 2>&1 | tail -2 && corepack pnpm --filter @crontract/db migrate:deploy 2>&1 | tail -5"
    if ($LASTEXITCODE -ne 0) { throw "Prisma migrate deploy failed (has the baseline been resolved on the box? see docs/PRODUCTION-FOLLOWUPS.md)" }

    if ($Seed) {
        Write-Host "      Seeding demo data (destructive)..." -ForegroundColor Red
        ssh $Remote "cd $AppDir && export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 && corepack pnpm db:seed 2>&1 | tail -5"
    }

    Write-Host "[4/5] Building (takes ~3 min)..." -ForegroundColor Yellow
    # 6 GB heap: the box has 7.8 GB total and co-hosts 3 other Node apps.
    ssh $Remote "cd $AppDir && export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=6144 && corepack pnpm build 2>&1 | tail -6"
    if ($LASTEXITCODE -ne 0) { throw "Build failed - NOT restarting, old version stays live" }
}

# --- 5. Restart + verify ----------------------------------------------------
Write-Host "[5/5] Restarting and verifying..." -ForegroundColor Yellow
ssh $Remote "pm2 restart crontract --update-env >/dev/null && sleep 8 && pm2 save >/dev/null 2>&1; echo done"

# Health-check the app on its internal port (independent of nginx/TLS).
$status = ssh $Remote "curl -s -o /dev/null -w '%{http_code}' --max-time 25 http://127.0.0.1:3003/login"
$after   = ssh $Remote 'for p in 80 8080 8081 8082; do printf "%s:%s " "$p" "$(curl -s -o /dev/null -w %{http_code} --max-time 10 http://127.0.0.1:$p/)"; done'

Write-Host ""
Write-Host "  crontract /login : $status"
Write-Host "  co-hosted before : $baseline"
Write-Host "  co-hosted after  : $after"
Write-Host ""

if ($status -ne "200") {
    Write-Host "DEPLOY FAILED - app returned $status" -ForegroundColor Red
    Write-Host "  logs: ssh $Remote 'pm2 logs crontract --lines 50 --nostream'" -ForegroundColor Red
    exit 1
}
if ($after -ne $baseline) {
    Write-Host "WARNING - a co-hosted site changed status. Investigate immediately." -ForegroundColor Red
    exit 1
}

Write-Host "Deployed: $Url" -ForegroundColor Green
Write-Host ""
