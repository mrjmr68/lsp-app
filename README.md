# Legend Service Pros App (`lsp-app`)

Internal operating system for **Legend Service Pros**, a small HVAC service company. It is not a generic ticketing tool. One job stays one continuous record from the first call through diagnose, parts, partner updates, estimate, return visit, and invoice.

- **Live:** https://lsp-app.vercel.app
- **GitHub:** https://github.com/mrjmr68/lsp-app
- **Supabase project:** `ifneznpvppgqlfidwysi`

Clone this repo locally on Windows at `C:\1\LSP_APP` (see [Local clone](#local-clone-windows)).

---

## What this app is for

The company is small (about five people). The owner, office, and techs all live in the same system.

**Field techs** should feel a trusty sidekick that follows the work: one live job, one sentence, one action. They should not hunt through dashboards.

**Office / owner** plan the day, send estimates, source parts, review invoices, and keep customers, locations, units, and equipment on file.

The north star: first call → diagnose / document → parts → partner updates → invoice, without the tech or the office losing the thread.

---

## Who sees what

| Role | After login | Main job |
|---|---|---|
| `tech` | `/jobs` (Today) | Run the day’s stops |
| `dispatcher` | `/planning` | Board, catalog, customers |
| `admin` | `/planning` | Same as dispatcher, plus users |
| `owner` | `/planning` | Estimates, invoice approval, users |

Login is email + password (Supabase Auth). A common field login is `matt@legsvc.com`. Techs land on Today; everyone else lands on Planning.

---

## How a tech day works (current field UI)

The field UI was rebuilt around a **sidekick**, not a dashboard.

```
Today  →  this job  →  look around  →  write it down  →  extra parts  →  wrap
 /jobs     /jobs/[id]    /observe         /diagnose          /work        /close
```

1. **Today** (`/jobs`) — greeting, the next stop, **Let’s go**. Later jobs are a quiet list. No Done / Recent / Add Job board.
2. **Job home** (`/jobs/[id]`) — one moment at a time:
   - **Head there / on the way** — address, access, maps, call/text, **I’m here**
   - **You’re here** — “What do you see?”
   - **On it** — “What’s going on?”
   - **Almost done** — “How did it go?”
3. **Document** (`/observe`) — readings (what the system is doing) and system (what is installed). Camera OCR on model/serial.
4. **Diagnose** (`/diagnose`) — catalog repair code or ad-hoc description.
5. **Work** (`/work`) — default repair bundle, extra items, post-repair photos.
6. **Wrap** (`/close`) — fixed today (invoice review) or needs an estimate.

Older `/go`, `/arrive`, and `/context` routes redirect back to the job so drive and check-in are not extra destinations.

Shared **install / major-repair** jobs still open `InstallWorkspace` (prep, materials, FO/FI relay board) instead of the solo observe/diagnose screens.

SMS is still a phone `sms:` link, not auto-send. Twilio is not wired yet. Contacts are customer-level, not location-level.

---

## How the office works

Office screens use `OfficeShell` (Planning, Jobs, Admin, Estimates, Invoices, Customers).

| Area | Route | What it does |
|---|---|---|
| Planning | `/planning` | Today’s board: create jobs, assign lead + assist crew, queue order |
| Customers | `/customers` | Customer → location → unit → system records |
| Admin | `/admin` | Catalog (items, diagnoses, repair bundles) and users |
| Estimates | `/estimates` | Owner/admin queue: write, PDF, send, approval, parts, follow-up schedule |
| Invoices | `/invoices` | Owner-only: review completed work, generate PDF, email via Resend, mark invoiced |

Catalog lives under Admin (`/catalog` redirects there).

---

## Data model (keep this straight)

```
Customer → Location → Unit → System
                ↓
              Job  (one continuous record)
```

- **Customer types** change the UI: commercial / facilities stay flatter (hidden default unit); property management / residential show units as first-class.
- **One physical cabinet = one `systems` row.** Grouped equipment uses `group_name` (heat pump CU+AHU, AC/furnace CU+Furnace+Coil).
- A job points at customer, location, unit, system, assigned tech, diagnosis, and commercial state.

Jobs split lifecycle into three fields (legacy `status` is still kept in sync):

| Field | Meaning | Examples |
|---|---|---|
| `job_status` | Where the visit is | `scheduled`, `dispatched`, `on_site`, `completed`, follow-up states |
| `resolution_type` | What kind of work | standard repair, ad-hoc, estimate, parts, install, no action |
| `commercial_state` | Office/money lane | estimate needed/sent, parts, ready to invoice, invoiced |

The field “moment” (`utils/field/moment.ts`) is derived from those fields: up next → heading → on site → working → wrapping → away.

---

## Stack

| Piece | What we use |
|---|---|
| App | Next.js **16.2.1** (App Router), React **19** |
| Auth + data | Supabase (`@supabase/ssr`) |
| Hosting | Vercel — production is https://lsp-app.vercel.app |
| Email | Resend (invoices and parts vendor mail) |
| OCR | `tesseract.js` on model/serial photo capture |
| Styling | Tailwind CSS 4 |

This Next.js version has breaking changes vs older docs. Auth gating lives in `proxy.ts` (not `middleware.ts`). Prefer `./node_modules/.bin/tsc --noEmit` over `npx tsc`.

---

## Repo map

```
app/
  jobs/                 Field Today + job sidekick flow
  planning/             Office board
  customers/            Customer / location / unit records
  estimates/            Estimate queue + detail
  invoices/             Invoice queue + detail
  admin/                Users + catalog hub
  catalog/              Redirects to admin
  login/  auth/         Sign-in and sign-out
  components/           OfficeShell, FieldShell, phone-first field widgets
supabase/migrations/    001_core.sql … 026_job_message_relays.sql
utils/
  field/                Moment engine, maps/SMS, photos
  job-lifecycle.ts      Status / commercial-state helpers
  invoices/  estimates/ PDF + email
  supabase/             Server/browser clients
proxy.ts                Session refresh + login redirect
```

Useful job files:

- `app/jobs/TodayView.tsx` — tech home
- `app/jobs/[id]/SidekickJob.tsx` — one-moment job home
- `app/jobs/[id]/actions.ts` — arrive, observe, diagnose, close, workflows
- `app/jobs/[id]/InstallWorkspace.tsx` — shared crew jobs

---

## Local clone (Windows)

This cloud environment cannot create folders on your PC. On the Windows machine:

```powershell
if (-not (Test-Path C:\1)) { New-Item -ItemType Directory -Path C:\1 | Out-Null }
if (Test-Path C:\1\LSP_APP) {
  git -C C:\1\LSP_APP pull origin main
} else {
  git clone https://github.com/mrjmr68/lsp-app.git C:\1\LSP_APP
}
cd C:\1\LSP_APP
npm install
copy .env.example .env.local
```

Then fill `.env.local` (see below) and run:

```powershell
npm run dev
```

Open http://localhost:3000.

Need Node.js 20+ and Git. If clone asks for credentials, use a GitHub login that can read `mrjmr68/lsp-app`.

---

## Environment variables

Copy `.env.example` to `.env.local`. Never commit secrets.

| Variable | Required for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | App + auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App + auth |
| `RESEND_API_KEY` | Invoice and parts email |
| `INVOICE_FROM_EMAIL` | Invoice sender (verified in Resend) |
| `PARTS_FROM_EMAIL` | Optional; falls back to invoice sender |
| `RESEND_FROM_EMAIL` | Optional fallback sender |

In Vercel, set the same vars. In Supabase Auth, add the Vercel domain to **Site URL** and **Redirect URLs**.

If Resend is missing, owner invoice approval is blocked until email is configured.

---

## Supabase

Apply every file in `supabase/migrations/` in order (`001_core.sql` through `026_job_message_relays.sql`).

Storage buckets that must exist:

- `job-photos` — field capture
- `invoice-pdfs` — generated invoice PDFs

If the live UI shows **Failed to fetch** on login, the usual cause is a paused Supabase project, not a Next.js bug.

---

## Commands

```bash
npm run dev              # local app
./node_modules/.bin/tsc --noEmit
npm run lint
npm run build            # production build (needs env vars)
```

---

## Deploy notes

1. Push to `main` — Vercel deploys https://lsp-app.vercel.app
2. Unique `*.vercel.app` preview hosts have been SSO-locked; use the production URL after merge when you need to *see* a change
3. If a feature is missing live, check in order: GitHub `main` commit → Vercel deploy → env vars pointing at the right Supabase → latest migration applied → the test job actually meets the feature conditions

Invoice approval generates a PDF, stores it in `invoice-pdfs`, marks the job invoiced, and emails the PDF through Resend.

---

## What is solid vs what is still in motion

**Solid (backend / office):** planning, job lifecycle, estimates, parts sourcing email, follow-up scheduling, invoice PDF + email, catalog, customer hierarchy, RLS (evolved over time; some older job reads are broader than ideal).

**Current field UX:** sparse sidekick on Today + job home; document / diagnose / work / wrap still collect the same data, with quieter chrome.

**Not done yet (product, not missing schema):**

- Auto ETA / auto SMS (no Twilio)
- Location-level contacts (contacts are on the customer)
- Partner status as a first-class suggested/auto update (tenant, property, office, vendor, crew)
- Full hub-and-spoke “centers” (context, logistics, crew) as separate rooms — drive/history are folded into the job instead
- Treating leftover files (`JobList.tsx`, `JobChassis.tsx`, `GoClient.tsx`, `ArriveClient.tsx`) as live UI — they are not on the current field path

Do not invent schema unless the UI truly needs it. Prefer additive migrations.

---

## Longer design notes in this repo

These files are background, not always current UI truth:

- `HVAC_App_Project_Context_v9.md` — developer context (some field-file names are stale; the sidekick screens replaced the old stepper)
- `ACTIVE_JOB_HUB_ARCHITECTURE.md` — earlier hub-and-spoke design
- `LSP App — Field UI Design Overview - CL.md` — phone-first step pages (Arrive → Close); the sidekick later collapsed drive/arrive onto the job
- `RELEASE_NOTES_WORKFLOW_FOUNDATION_V1.md` — shared install / relay-board release
