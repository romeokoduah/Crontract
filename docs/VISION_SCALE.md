# Crontract — Scaling Thesis & 10 Rounds of Brainstorming

> **Working thesis:** Crontract is not "SAP + Trello for SMEs." That is the *wedge*.
> The company is **the operating system and financial nervous system for the
> 44 million formal SMEs in Africa** — the layer that runs their operations,
> understands their business better than they do, and eventually moves their money.
> That second sentence is the one that raises $100M.

This document is a founder-facing strategy artifact. It is deliberately opinionated.
Read it as "here are ten increasingly deep passes at the same question: *what has to
be true for Crontract to be a billion-dollar company, and what do we build now?*"

---

## The one-paragraph investor story (say this first)

> "Every African SME runs on WhatsApp, paper, and Excel. SAP is $500k and 18 months.
> QuickBooks doesn't understand procurement, HSE, grants, or the informal supply chain.
> Crontract is the single system that runs their entire operation — finance, people,
> projects, procurement, compliance — with zero training, in their currency, for the
> price of a phone plan. We already have the system of record. **Every transaction,
> invoice, payroll run, and purchase order flows through us. That gives us two things
> nobody else has: the data to underwrite these businesses, and the workflow to embed
> financial services inside the work they're already doing.** We're building the
> Rippling + Ramp + Toast of emerging markets, starting from operations and moving
> into the money."

Everything below is in service of making that paragraph *true and defensible*.

---

## Round 1 — Sharpen the wedge until it draws blood

The MVP is broad (16 modules). Breadth is a liability at seed stage and an asset at
scale. Right now it reads as "horizontal ERP," which is the single hardest thing to
sell and fund because you compete with everyone and own no one.

**Reframe: pick ONE beachhead segment and dominate it, keep the rest as "and it also does…".**

The three archetypes already in the seed data are the answer. Rank them by fundability:

| Segment | Why it's a good wedge | Why it's fundable |
|---|---|---|
| **Mining & construction contractors** (HSE-first) | HSE + procurement + assets + compliance is a *legally mandated* workflow. Non-optional software. High willingness to pay. Ghana/West Africa has a dense mining-services economy. | Regulatory tailwind, high ACV ($5–50k), sticky, expandable into payroll + equipment finance. |
| **NGOs / development orgs** (Grants & M&E) | Donor reporting is painful, mandated, and standardized (logframes, indicators, disaggregation). Budgets are large and grant-funded (they *have* money for tools). | Global donor ecosystem (USAID successors, EU, Gates, Mastercard Foundation). Land-and-expand across a donor's grantee network is a built-in distribution channel. |
| **Multi-entity SME groups / startups** (CRM + Finance) | Fastest-growing, most tech-forward, lowest ACV, highest churn. | Volume play, weakest moat. |

**Recommendation:** Lead with **mining/construction contractors** as the paid wedge
(compliance is a gun to the head → they pay), use **NGO/grants** as the
*capital-efficient distribution hack* (one donor onboards 40 grantees), and treat
generic SME as the long-tail PLG funnel. The pitch becomes "we own the hardest,
most-regulated operational workflows in emerging markets, and those workflows are the
on-ramp to everything else."

**Action:** Restructure onboarding so segment choice reconfigures the *entire* product
(nav, defaults, terminology, dashboards, AI prompts), not just default modules.
`businessType` should be a first-class product dimension, not a seed detail.

---

## Round 2 — The real thesis: from System of Record → System of Intelligence → System of Money

A pure "system of record" (where data is entered) is worth a modest multiple. The
value ladder that produces a $100M raise:

```
   System of Record        →   System of Intelligence      →   System of Action        →   System of Money
   (you already have this)      (AI reads everything)           (AI + agents DO things)      (you move the capital)
   "Crontract stores it"        "Crontract understands it"      "Crontract runs it"          "Crontract funds it"
   Sticky, low margin           Differentiated, defensible      10x product, viral          Fintech multiples, moat
```

**Why this is the whole game:** Because Crontract already sits on the primary
operational + financial data of a business, it can do three things no standalone
fintech or standalone SaaS can:

1. **Underwrite with ground truth.** You see real invoices, real POs, real payroll,
   real receivables aging — not a bank statement. That is a *structurally better credit
   signal* than anyone else in the market has. This is the Shopify Capital / Toast
   Capital / Square playbook, and it is the single highest-margin business you can bolt
   onto operations software.

2. **Embed finance in the workflow, not beside it.** "Approve this PO" becomes "Approve
   this PO — and we'll pay the supplier now and give you 30 days." Payroll run becomes
   payroll *financing*. Invoice becomes *invoice factoring*, one click, at the moment of
   creation. The workflow IS the distribution.

3. **Compound a data moat.** Every workspace makes the AI benchmarks, the fraud models,
   and the credit models better for every other workspace. Horizontal SaaS rarely has
   network effects; *operational-financial data at scale does.*

The $100M story is not "we sell software to SMEs." It's **"we are building the
underwriting and embedded-finance rails for the African formal economy, and operations
software is how we acquire the data and the distribution at near-zero CAC."**

---

## Round 3 — Concrete AI API integrations, mapped module by module

This is the "add AI everywhere it actually creates value" pass. Principle: **AI should
remove data entry, surface risk, and take action — not add a chat box for its own sake.**

Recommended primary model provider: **Anthropic Claude** (strong tool-use/agentic
behavior, long context for document-heavy workflows, good safety posture for
finance/compliance). Use a **model-router abstraction** so you can mix providers by
task and cost (see the technical spec doc). Suggested tiering:

- **Claude Opus / Sonnet** — reasoning, agents, financial analysis, compliance mapping.
- **Claude Haiku / small models** — classification, extraction, routing, cheap high-volume.
- **Embeddings** (Voyage / OpenAI `text-embedding-3` / Cohere) — semantic search, RAG, dedup.
- **OCR / Document AI** (Claude vision, AWS Textract, Google Document AI) — receipts, invoices, IDs.
- **ASR** (Whisper / Deepgram) — meeting transcription, voice-first data entry for field workers.

| Module | AI capability | API / approach | Why it matters for scale |
|---|---|---|---|
| **Global** | **Crontract Copilot** — natural-language command bar over every module ("show me overdue invoices for mining clients and draft reminders") | Claude tool-use over a typed action registry (RAG on the workspace) | The headline demo. This is what makes the whole platform feel 10x. |
| **Finance** | Invoice/receipt/bill capture from photo → structured line items; auto-GL-coding; anomaly & duplicate-payment detection; cash-flow forecasting | Vision OCR → LLM extraction → embeddings for dedup; time-series model for forecast | Kills the #1 SME pain (bookkeeping). Feeds the credit model. |
| **Finance** | Auto-reconciliation (match bank txns ↔ journals ↔ invoices) | Embeddings + LLM matcher | Removes an accountant's whole week. |
| **Procurement** | 3-way match automation; vendor risk scoring; "should-cost" price benchmarking across the network | LLM + cross-tenant aggregates | Data network effect: everyone's prices make everyone's benchmarks smarter. |
| **HSE** | Incident report drafting from a voice note in the field; root-cause suggestion; predictive risk ("this site pattern precedes lost-time injuries") | ASR → LLM; classification model on incident history | Field workers can't type. Voice-first is the unlock. Regulatory value = high ACV. |
| **HSE / Compliance** | Map an uploaded regulation (EPA, GRA, SSNIT, Minerals Commission) to an obligation calendar automatically; deadline extraction; auto-draft filings | Long-context LLM over legal PDFs → structured obligations | Turns "compliance" from a checklist into an autopilot. Massive time saver. |
| **People (HR)** | JD generation, CV screening/ranking, contract drafting, payroll anomaly detection, leave-policy Q&A bot | LLM + embeddings over employee docs | Standard but expected. Table stakes. |
| **Projects/Tasks** | Auto-generate project plan + tasks from a one-line brief; status roll-ups; risk/slip prediction; meeting-notes → action items → assigned tasks | LLM planning + ASR for meetings | The "Trello" side gets an AI PM. |
| **Grants & M&E** | Auto-draft donor reports from indicator data; logframe generation from a concept note; narrative report writing; indicator anomaly flags | Long-context LLM over grant data + templates | Donor reporting is *the* NGO pain. This alone sells the segment. |
| **CRM** | Lead scoring, next-best-action, auto-logged activities, email drafting, deal-risk detection, pipeline forecasting | LLM + embeddings | Standard revenue-team AI. |
| **Documents** | Semantic search across all docs; auto-summary; contract clause extraction & risk flagging; version-diff explanation | RAG (embeddings + vector store) | Turns dead document storage into knowledge. |
| **Meetings** | Live/async transcription, minutes, decisions, action items auto-created as tasks with owners | ASR + LLM | Closes the loop from talk → tracked work. |
| **Social Media** | Post generation, calendar planning, brand-voice tuning, best-time scheduling, reply drafting | LLM | Nice-to-have, PLG-friendly. |
| **Admin/Audit** | Natural-language audit-log queries; suspicious-activity detection; access-review recommendations | LLM over audit stream + anomaly model | Enterprise trust feature. |
| **Reports** | "Ask your business a question" — text-to-SQL over the workspace with guardrails and charts | LLM text-to-SQL against a read replica + semantic layer | Replaces the entire "report builder" backlog item with something better. |

**Cross-cutting AI infrastructure to build once:**

- **A typed *action registry*** (every mutation the app can do, described as a tool) so
  the Copilot can *act*, not just chat. This is the single most important AI investment.
- **A RAG/semantic layer** per workspace (vector store, strict tenant isolation).
- **A model router + cost/latency budget + eval harness** (prompt regression tests,
  golden datasets, guardrails — critical for finance/compliance where hallucination is
  a liability).
- **Human-in-the-loop everywhere money or law is involved.** AI drafts, human approves.
  This is both a safety requirement and a trust selling point.

---

## Round 4 — Platform architecture that survives 10,000 tenants

The current single-Next.js-app + Prisma + Postgres design is **correct for now** — do
not prematurely microservice it. But scaling to fundable numbers requires deliberate
evolution. Priority order:

1. **Enforce tenant isolation at the database, not just the app.** Ship
   **PostgreSQL Row-Level Security** now (it's on the roadmap — promote it to P0). A
   single cross-tenant leak is an extinction event for a system holding financial data.
   App-layer filtering + RLS defense-in-depth is non-negotiable for enterprise deals and
   SOC 2.
2. **Event backbone.** Introduce an **outbox pattern + event bus** (start with Postgres
   outbox → a worker; graduate to Kafka/Redpanda only when volume demands). Every
   mutation already writes an audit log — turn that into a real event stream. This
   backbone powers: webhooks, AI pipelines, notifications, analytics, and the future
   fintech ledger. It is the spine of the whole company.
3. **Background job queue (BullMQ/Redis)** — promote from Phase 4 to now. Depreciation,
   report generation, AI batch jobs, email, OCR, embeddings — all async. Don't do heavy
   work in request handlers.
4. **A proper double-entry ledger service** as a distinct, boring, correct module. When
   you move real money you cannot bolt accounting on later. Design the finance core as an
   immutable, append-only ledger *now* even before embedded finance ships.
5. **Read replicas + a semantic/analytics layer** for reporting and text-to-SQL, so
   heavy analytical queries never touch the transactional path.
6. **Data residency & sharding strategy** by region (Ghana, Nigeria, Kenya, francophone
   West Africa). Regulators increasingly require in-country data. Design tenant→region
   mapping early so you can honor it without re-platforming.
7. **API-first + webhooks + public API keys** (Phase 3 items) — promote, because
   partners and the ecosystem (below) depend on it.

**Guardrail:** resist rewriting. The monolith + queue + outbox + RLS + read replica gets
you to Series B. Microservices are an organizational tool for 100+ engineers, not a
performance requirement at your stage.

---

## Round 5 — The killer feature: "Crontract Copilot" (agentic operations)

If you build one flagship thing this year, build this. It's the difference between "nice
SME tool" and "holy-grail demo that VCs forward to their partners."

**What it is:** a natural-language, permission-aware, *action-taking* agent that lives in
a command bar (⌘K) and a chat panel across the whole product. Because Crontract owns the
schema, the permissions, and the audit log, the agent can:

- **Answer:** "What's my cash position and which clients are overdue?"
- **Analyze:** "Why did procurement costs spike in Q2?" (text-to-SQL + narrative).
- **Draft:** "Write the Q2 report for the Mastercard Foundation grant."
- **Act (with approval):** "Create POs for these three requisitions and route for
  approval." "Onboard this new hire — create the employee, assign a manager, start the
  compliance training clock." "Chase every invoice >30 days overdue with a polite email."

**Why it's defensible:** the agent is only as good as (a) the breadth of typed actions it
can call and (b) the quality of the underlying data model and permissions. Crontract has
16 modules of both. A horizontal AI assistant (ChatGPT, a Slack bot) can't touch a
company's procurement approvals or post a journal entry. **The moat is the action
registry × the permission system × the data.**

**Build sequence:**
1. Read-only Q&A over one module (Finance) with strict tenant RAG — ship in weeks.
2. Text-to-SQL reporting over a read replica with a semantic layer — replaces the report
   builder backlog.
3. Typed action registry + human-approval gating → single-step actions.
4. Multi-step agentic workflows (plan → confirm → execute → audit) with full audit-log
   trails on every AI action. *Every AI action writes to the audit log* — this is both
   compliance and a trust feature you can sell.

**Positioning line:** "Crontract is the only business software in Africa you can *talk
to and it does the work.*"

---

## Round 6 — Monetization, pricing, and the unit-economics story a $100M round needs

You cannot raise $100M on per-seat SaaS at African SME price points alone — the TAM math
doesn't close on seats. The raise is justified by **three stacked revenue engines**:

**1) Subscription (the base, the data-acquisition cost).**
- Tiered by segment + modules + seats, priced in local currency, mobile-money billing.
- Deliberately cheap (land). Think "$15–60/user/mo equivalent," heavily discounted vs
  the value, because the subscription's real job is to *acquire the data and the
  distribution*, not to be the whole business.
- **AI as an upsell tier** ("Crontract Intelligence") — usage-metered or premium seat.

**2) Financial services (the margin, the $100M justification).** This is where fintech
multiples live:
- **Embedded payments** — pay suppliers, collect from customers, run payroll → take rate
  on volume (the Toast/Square model). You already generate the invoices and POs.
- **Working-capital / invoice financing / BNPL for B2B** — underwritten by the
  operational data you uniquely hold. Highest margin, biggest moat.
- **Payroll advance / earned-wage access.** You run payroll → you can advance it.
- **Insurance & equipment finance** for the mining/construction segment (contextual,
  workflow-embedded).
- **Spend/expense cards** (the Ramp/Brex model) tied to the approval + budget engine you
  already have.

**3) Ecosystem / platform (the long-term optionality).**
- App marketplace + revenue share, partner integrations, verticalized templates,
  accountant/consultant partner program (they resell and implement).

**The narrative math investors want to see:** low-CAC SaaS acquires businesses and their
data → that data underwrites financial products at structurally better loss rates than
banks → financial revenue per account is 5–20x subscription revenue → blended margins and
retention look like fintech, not SaaS. *That* is a $100M-round story: "operations is the
CAC engine, finance is the profit engine, data is the moat between them."

---

## Round 7 — Go-to-market: the actually-hard part

African B2B SaaS dies from distribution, not product. Fund the GTM as seriously as the
engineering.

- **Segment-led, not geography-led first.** Own mining/construction contractors in Ghana
  end-to-end (references, case studies, regulator relationships) before spreading thin.
- **Distribution hacks that beat cold sales:**
  - **Donor/prime-contractor networks (NGO wedge):** land one donor or one prime, and its
    entire grantee/subcontractor network onboards. Built-in multi-tenant expansion.
  - **Accountants & audit firms as a channel.** They touch every SME. A partner/reseller
    program with revenue share turns them into a sales force.
  - **Regulators & industry associations** (Ghana Chamber of Mines, GRA, EPA). If
    compliance filing runs through Crontract, adoption is top-down.
  - **Supply-chain pull.** When a big buyer runs procurement on Crontract, it pulls its
    suppliers on (they need to transact with it) — B2B network effect.
- **PLG for the long tail:** free tier, self-serve onboarding (the "<5 min, zero
  training" promise is a real GTM weapon — protect it obsessively), viral loops via
  invitations, shared documents, and vendor/customer portals.
- **Land-and-expand motion:** start with one painful module (HSE, or grants reporting),
  expand to finance, then to embedded finance. Net revenue retention >120% is the metric
  that makes SaaS investors comfortable and is very achievable with this module breadth.

---

## Round 8 — Moat & defensibility (why won't Zoho/SAP/a local clone kill you?)

Enumerate the moats explicitly — investors will:

1. **Data network effects.** Cross-tenant (privacy-safe, aggregated) benchmarks for
   should-cost pricing, vendor risk, salary bands, fraud patterns, credit models. Every
   customer improves the product for every other. Incumbents built for the West don't
   have emerging-market operational data.
2. **The embedded-finance data moat.** Once you underwrite with ground-truth operational
   data, your loss rates beat banks and neobanks, and that advantage *compounds*. A new
   entrant has no data to underwrite with.
3. **Workflow lock-in + switching costs.** Payroll, compliance filings, approval chains,
   and financial history don't get ripped out. The more modules adopted, the higher NRR
   and the lower churn.
4. **Localization depth as a barrier.** Ghana SSNIT/PAYE/Tier-2-3 payroll, GRA e-VAT,
   EPA/Minerals-Commission compliance, GHS/NGN/multi-currency, mobile-money rails,
   offline-first for poor connectivity, French/Twi/Hausa. Global incumbents won't build
   this; it's death-by-a-thousand-details and it's your home turf.
5. **AI action registry × permissions.** As above — the agent's ability to *do* work is
   proportional to your schema and RBAC breadth, which took years to build.
6. **Regulatory/compliance trust.** Being the system of record for audits and filings
   makes you infrastructure, not an app.

**Threats to name honestly:** local fintechs (Flutterwave, Moniepoint, Paystack) moving
up into SMB software; Zoho's aggressive emerging-market pricing; the risk of being "wide
but shallow" (mitigated by Round 1's wedge focus); regulatory risk on the lending side
(mitigate via bank/MFI partnerships and licenses per market).

---

## Round 9 — Enterprise-readiness & trust: the boring work that unlocks big checks

Nobody wires $100M into a platform holding financial data without this. Fund it early;
it's a moat *and* a sales unlock, not overhead.

- **Security & compliance certifications:** SOC 2 Type II (start the clock now), then
  ISO 27001. GDPR + local data-protection acts (Ghana Data Protection Act, Nigeria NDPR).
  These directly gate enterprise and donor deals.
- **Data protection:** RLS (Round 4), encryption at rest + in transit, field-level
  encryption for PII/salary, secrets management, key rotation, per-tenant data export &
  deletion (right-to-be-forgotten), configurable data residency.
- **AuthN/AuthZ maturity:** SSO (SAML/OIDC), SCIM provisioning, 2FA/TOTP, session
  management, IP allowlists, granular RBAC (you have this — extend to ABAC where needed).
- **Reliability:** SLAs, status page, DR/backup strategy with tested restores, RPO/RPO
  targets, multi-AZ, on-call. Financial data means "lose it once, lose the company."
- **AI governance:** model cards, prompt-injection defenses (critical — the agent has
  tool access and a hostile document could try to trigger actions), guardrails, PII
  redaction before it hits any model, per-tenant opt-out of training, human-approval gates
  on all money/legal actions, and — key selling point — **every AI action is audit-logged
  and reversible.**
- **Financial-services compliance:** KYC/KYB, AML/CFT, transaction monitoring, and the
  right licenses/bank partnerships per market before any lending or payments go live.

---

## Round 10 — The fundraising narrative & the 18-month plan to justify $100M

**How the $100M actually gets raised (be realistic about the ladder):**
$100M is a **Series B/C**, not a seed. Sequence:

1. **Pre-seed/Seed ($1–4M):** Prove the wedge. Paying mining/construction contractors +
   one anchor NGO network. Ship Copilot (read-only + text-to-SQL) and 2–3 killer AI
   features. Metric goal: undeniable retention and NRR in one segment.
2. **Series A ($8–20M):** Expand modules within the wedge, launch **AI Intelligence tier**
   as revenue, launch **first embedded-finance product** (invoice financing OR payments)
   in one country with a bank/MFI partner. Prove: financial-revenue-per-account and early
   loss-rate advantage from operational-data underwriting.
3. **Series B/C ($50–100M+):** Geographic expansion (Nigeria, Kenya, francophone WA),
   scale the lending/payments book, prove the flywheel: *ops product acquires accounts at
   low CAC → data underwrites finance → finance revenue >> SaaS revenue → data moat
   deepens.* $100M funds the balance sheet for lending + multi-market GTM + the AI/data
   platform. This is the Toast/Rippling/Nubank-of-SME-ops story.

**The 5 metrics investors will underwrite the $100M on:**
1. Net revenue retention (>120%, driven by module + AI + finance expansion).
2. CAC payback (should be <12 months, aided by the distribution hacks in Round 7).
3. Financial-services revenue per active business + **loss rates vs. incumbents** (the
   proof the data moat is real).
4. AI engagement (% of workflows touched by Copilot) as a leading indicator of stickiness.
5. Logo/revenue concentration by segment and geography (proof of repeatable expansion).

**18-month execution roadmap (opinionated ordering):**

*Months 0–6 — Be undeniable in one segment:*
- Promote to P0: RLS, background queue, event outbox, email (Resend), file storage (S3),
  global search. Ship the "boring correct" finance ledger core.
- Ship **Copilot v1** (Finance Q&A + text-to-SQL reporting) — the demo that raises money.
- Ship 3 flagship AI features: receipt/invoice OCR→GL, HSE voice-report, grants
  auto-report. Start SOC 2.

*Months 6–12 — Turn on the flywheel:*
- Action registry + agentic Copilot v2 (act with approval, fully audited).
- Launch **AI Intelligence paid tier.** Launch **embedded payments** (supplier payments +
  collections) with a partner. Multi-currency, mobile-money billing. Data-residency plumbing.
- Partner/reseller channel (accountants) + first NGO-network land-and-expand.

*Months 12–18 — Prove the finance engine:*
- Launch **invoice financing / working-capital** underwritten by operational data in one
  market with a bank/MFI. Instrument loss rates.
- Expand to a second country. SOC 2 Type II done. Public API + marketplace beta.
- Now the deck says: "SaaS acquires the account, AI makes it 10x stickier, embedded
  finance monetizes at fintech multiples, and the data underneath makes all three
  compound." → raise the big round.

---

## The single most important thing

Do **not** try to do all of this at once. The failure mode for Crontract is exactly the
thing that makes it impressive: **breadth.** The winning move is to be *ruthlessly deep in
one segment*, ship the *one* AI feature that makes people say "how did this exist before,"
and architect the boring foundations (RLS, ledger, event backbone, audit-logged AI
actions) so that when the flywheel — ops data → AI → embedded finance → more data — starts
turning, nothing has to be rebuilt.

Own the operations. Understand the business. Then move the money.

---

*See `docs/AI_INTEGRATION_SPEC.md` for the concrete technical architecture: model router,
action registry, RAG/tenant isolation, eval harness, and the schema additions that make
the AI layer real.*
