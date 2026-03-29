# HVAC Field Service App — Living Project Context
> **How to use this doc:** Upload or paste this file at the start of every Claude session.
> Update it at the end of each session or whenever something important changes.
> It is the single source of truth for the project.

---

## 0. Build Status

| Phase | Status | Notes |
|---|---|---|
| **Phase 0** — Schema, migrations, seed data | ✅ Complete | |
| **Phase 1** — Next.js, Supabase connection, database live | ✅ Complete | |
| **Phase 2** — Auth, login/logout, user profiles | ✅ Complete | |
| **Phase 3 — Data** — Customers, locations, diagnosis catalog | ✅ Complete | Wynnefield (80 loc), Sasser (43 loc), 43 diagnosis codes |
| **Phase 3 — Data** — Call history import | ✅ Complete | 1,227 Wynnefield records imported, status = invoiced |
| **Phase 4** — Planning board + Tech job flow (5-step) | ✅ Complete | Planning board live, Tech flow fully wired |
| **Phase 5** — Invoice review queue + admin approval flow | ✅ Complete | 9-card detail page, approval, flag, flat-rate override |
| **Phase 6** — Customers drill-down + tech system editing | ✅ Complete | 4-level browse + inline system field editing in Step 1 |
| **Phase 7** — CRUD UI + type-aware hierarchy | ✅ Complete | Inline editing all levels, Add modals, flat vs nested views |
| **Phase 8** | 🔜 Next | PDF/email integration for invoices |

**Migration log:**
- 001 — Core entities
- 002 — Catalog
- 003 — Jobs
- 004 — RLS (row-level security)
- 005 — Systems extend (group_name, tonnage, system_subtype)
- 006 — Sales tax (tax_rate on locations, invoice breakdown on jobs)
- 007 — Diagnoses repair_code as generated column, drop name field
- 008 — Fix RLS infinite recursion (users/jobs/job_tech policy rewrite)
- 009 — Fix job_tech RLS recursion (is_assigned_to_job() security definer helper)
- 010 — CRUD RLS (insert/update policies for customers, locations, units, systems)

**Known RLS fixes applied directly in Supabase SQL editor (not in migration files):**
- `current_user_role()`, `is_admin()`, and `is_assigned_to_job(uuid)` recreated with `security definer` + `set search_path = public`
- Jobs and job_tech cross-reference policies dropped and rewritten without circular subqueries
- Jobs insert policy: `with check (auth.uid() is not null and current_user_role() in ('admin','owner','dispatcher','tech'))`
- Jobs select/update/delete split into explicit separate policies (replacing `for all`)
- 010 CRUD RLS: insert/update policies for customers, locations, units, systems tables — applied directly in Supabase SQL editor

**Project folder:** `C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app`
**MCP filesystem access:** lsp-app and lsp-app2 (legacy/reference)
**lsp-app2:** Legacy/reference only — wireframes live here at `lsp-app2\wireframes\`
**Stack:** Next.js 16.2.1 (App Router, no src/ dir) + Supabase + Vercel + React 19 + Tailwind v4
**Supabase project ref:** `ifneznpvppgqlfidwysi`
**Claude in Chrome:** Connected — browser automation available in sessions where extension is active
**Styling:** Inline styles only (no Tailwind classes in components). Color palette: `#f5f4f0` bg, `#1a1a18` text, `#e2e1da` borders, `#185fa5` active blue, `#3b6d11` green, `#a32d2d` red, `#888780` muted.
**Dev machine:** Low-spec mini PC — Next.js dev server startup is heavy. Avoid restarting it unnecessarily. If port 3000 is occupied, find and kill the existing node PID first.

---

## 1. Project Summary
A **mobile-first field service app** for a small HVAC team (6–15 technicians).
It replaces a fragmented Smartsheet + QuickBooks Online workflow with a single,
guided tool that handles job intake, field documentation, and invoice generation
with minimal administrative re-entry.

**The core problem it solves:**
Jobs are currently logged in Smartsheet (intake, tracking, docs) and then
manually recreated in QuickBooks Online to generate invoices. This double-entry
is the primary inefficiency the app must eliminate.

**Business context:**
High-speed, cost-conscious multifamily work. The model is flat-rate pricing with
a focus on balancing quality, efficiency, and cost. Techs are in the field all day
working a pre-planned route — the app should never slow them down.

---

## 2. Users & Roles
| Role | Description |
|---|---|
| **Field Tech** | Primary mobile user. Works a pre-planned day, documents work through a guided flow, selects diagnosis codes, captures photos. |
| **Dispatcher / Admin** | Builds the daily plan, monitors job status, reviews completed work, manages the no-diagnosis queue, builds diagnosis codes and bundles. |
| **Owner / Manager** | Reviews and finalizes invoices before submission. Oversees reporting and operations. |

**Team size:** 6–15 field technicians
**Current users in DB:** Matt Raab (owner)

---

## 3. Existing Tools
| Tool | Current Use | Future Role |
|---|---|---|
| **Smartsheet** | Call intake, job tracking, field documentation | Replace |
| **QuickBooks Online** | Manual invoice creation from Smartsheet data | Keep — admin manually re-enters finalized invoice data. No API integration planned at this time. |

---

## 4. Core App Pillars
1. **Job Intake** — Web form (primary), dispatcher internal form, or tech-direct entry
2. **Field Guidance** — Tech works through a guided 5-step job flow with observation data, diagnosis selection, and photo documentation
3. **Field Documentation** — Structured observation data, photos at three points (arrival, fault evidence, post-repair), notes
4. **Invoicing** — Flat-rate pricing, pre-built bundles. No pricing shown to techs. Management reviews and finalizes all invoices before submission.

---

## 5. Pricing & Invoice Model
- **Flat rate pricing** — no per-item markup
- Invoices contain **no itemized detail** — only a detailed boilerplate description per diagnosis
- All costs (equipment, parts, materials, labor) are entered **at cost**
- **Profit is a single line item** in each repair bundle
- A **Diagnosis** ties to one **Repair Bundle** containing all **Items** that make up the repair
- **Additional work** — on the Work step, techs can add any other bundle or individual catalog item beyond the primary bundle. These are recorded in `Job_AddOn` (not merged into the primary bundle) so management can review them separately on the invoice
- **No-diagnosis close-out** — tech selects items used and writes a description; job closes flagged as a new diagnosis request. Admin decides whether to invoice as a one-off or promote to a full diagnosis in the catalog.
- **Pricing is never shown to techs** — the Work screen shows item names and quantities only. All dollar amounts are admin-side only and are never synced to tech devices.
- **Placeholder items** — big-ticket variable items (heat pumps, compressors, motors, coils) are stored with `unit_cost = $0` in the Item catalog. When a job containing a placeholder item enters invoice review, the admin is prompted to enter the actual cost for that job before approval is unlocked. These costs are recorded on the job but do not update the Item catalog.
- **Bill-to is set once at customer setup** — the `bill_to_parent` flag on the Customer record controls invoice routing for all invoices for that account. Admin cannot override per invoice.
- **Invoice approval flow** — admin reviews, optionally overrides flat rate, approves. On approval: invoice is emailed to the billing address, PDF is saved to Supabase Storage linked to the job record, and a browser download is triggered for a local copy.
- **Variance alert** — the invoice review screen shows this invoice vs. the running average for that diagnosis code (count of jobs, avg, range, % delta). Sourced from job history. 1,227 historical Wynnefield records provide the baseline.
- **Sales tax** — NC sales tax rate varies by county. `tax_rate` is stored on each Location record (set once at setup). At invoice creation, the rate is copied onto the Job record and locked — rate changes never affect historical invoices. Invoice fields: `invoice_subtotal`, `tax_rate`, `invoice_tax`, `invoice_total`. Legacy field `invoice_amount` retained for historical records with total only.

---

## 6. Job Model — Planning & Assignment

**No scheduled appointment times.** Techs work jobs in the order that makes geographic and logistical sense. There are no time slots. Job ordering is maintained via `queue_position` (integer per tech per day). The planning board is the primary planning and management tool — it works all day, not just mornings. Mid-day changes (reassignments, reorders, new jobs) are negotiated between techs directly and reflected live in the same board, which is usable on mobile.

**Multi-visit jobs.** Some jobs require more than one visit. The key timestamps are tracked through Job_Event (every `arrived` event records a visit with timestamp and GPS). The planned date is `job_date` on the Job record. There is no separate "2nd visit date" field — the sequence of `arrived` events in Job_Event serves as the complete visit history.

**Access confirmation.** Some distant or secured sites require someone to be present with a key. These jobs are flagged `access_confirmation_needed` at intake (visible on the planning board as a dispatcher reminder). `access_confirmed` is a simple manual checkbox — the dispatcher checks it off when they've made the call. No automation.

**Multiple techs per job.** A job can have more than one tech. The primary tech owns the job flow in the app and is named on the invoice. Additional techs are added manually as helpers via the `Job_Tech` junction table — from the planning board or from within the job on their device.

**Reassignment permissions:**
| Action | Who can do it |
|---|---|
| Pull an unassigned job onto my day | Any tech |
| Push one of my own jobs to another tech | Any tech |
| Move a job between two other techs | Dispatcher / admin only |

**Job flow states per tech per day:**
Done (faded, struck through) → Active (on-site, live timer) → Queued (upcoming, in queue order) → Unassigned (new jobs in the rail at the bottom).

---

## 7. Job Intake Rules
- **Web form** — customer selects their company, then either picks a location from a dropdown or types the unit manually. Requires a submitter email address.
- **Dispatcher internal form** — fast internal form for dispatcher use. Fields: customer (search), location, unit, system, problem description, priority, assign techs (multi-select with primary designation), access confirmation flag. Skips the customer-facing web form entirely.
- **Tech-direct** — tech enters the job directly into the app.
- All three paths create a **Job** directly — no separate intake queue or review step.
- **Parent accounts** must not appear as selectable customers on the web form — billing entities only.
- **Residential one-off intake** — dispatcher selects "Residential / One-off" instead of picking from the customer list. Enters name, address, phone on the spot. App creates the customer (type=residential), location, and unit (type=main) records automatically in the background. Job is created against them immediately. Data lands in the same tables — invoices and history work identically to any other customer.

---

## 8. Customer Hierarchy
| Level | Example | Role |
|---|---|---|
| **Parent account** | Greystar Management, CBRE Facilities | Holds the contract, receives the invoice |
| **Child account** | Oakwood Commons, CityMD — Elm St | Where work happens |
| **Standalone** | Joe's Diner, Smith Residence | Bills directly — no parent |

- A `Customer` record can optionally point to a parent customer via a self-referencing FK
- A `bill_to_parent` flag controls invoice routing — set once at customer setup, not per invoice
- Jobs are always created against the child customer — never a parent
- Hierarchy is one level deep only: parent → child. No grandparent accounts.

**Current customers in database:**
- **Wynnefield Properties** — property_management, 80 locations (apartment communities)
- **Sasser Companies** — commercial, 43 locations (FastMed urgent care clinics)

---

## 9. Property Hierarchy — Type-Aware

The database schema is always **Customer → Location → Unit → System**, but the **UI adapts based on customer type** to hide unnecessary levels:

### Flat hierarchy (Commercial + Facilities Provider)
**UI shows: Location → Systems directly**
- No unit layer visible in the UI
- A hidden "Default" unit is auto-created behind the scenes to maintain the FK chain
- Location detail page shows editable system cards directly
- "Add System" modal creates system under the hidden default unit
- Example: Sasser Companies → Burlington → RTU-1, RTU-2, AHU-Main

### Nested hierarchy (Property Management + Residential)
**UI shows: Location → Units (each with one system inline)**
- Unit detail page shows a merged card: unit fields on top, system fields below (no separate "SYSTEMS" section)
- "Add Unit" modal is a combined form with unit fields + optional system fields
- Example: Wynnefield Properties → Abbey Crossing → Apt 101 (with PTAC info inline)

### Type → hierarchy mapping
| Customer type | Hierarchy | Location shows | Unit detail |
|---|---|---|---|
| `commercial` | Flat | Systems directly | N/A (not navigated to) |
| `facilities_provider` | Flat | Systems directly | N/A (not navigated to) |
| `property_management` | Nested | Units list | Merged unit + system card |
| `residential` | Nested | Units list | Merged unit + system card |

### How flat works behind the scenes
- `createSystemForLocation` server action finds the first existing unit for the location (or creates a hidden "Default" unit with `unit_type = 'main'`)
- Systems are created under that hidden unit
- The location page flattens all systems across hidden units: `units.flatMap(u => u.systems.map(s => ({ ...s, _unitId: u.id })))`
- `_unitId` is tracked so inline system edits can call `updateSystemFromCustomers` with the correct unit FK

### How nested works
- `createUnitWithSystem` server action creates both unit and system in one call
- Form fields use prefixed names to avoid conflicts: `unit_name`, `unit_type`, `unit_notes` for unit; `sys_name`, `sys_subtype`, `sys_make`, etc. for system
- System fields are optional — a unit can be created without system info
- Unit detail shows "No system info on record" + "Add system info" button if no system exists

**System component model:**
A logical HVAC system is made up of one or more physical cabinets (components). Each cabinet is its own System record. Related cabinets are linked by `group_name` within the same unit.

Examples:
- Residential heat pump: AHU + CU, both with `group_name = "Heat Pump"`
- RTU: single record, `system_subtype = "RTU"`, no group needed
- Server room split: AHU + MS-Cond, both with `group_name = "Server Room"`

`system_subtype` values: `RTU`, `AHU`, `CU`, `MS-Head`, `MS-Cond`, `PTAC`
`unit_type` values: `apartment`, `suite`, `floor`, `main`

**Unit pre-population strategy:**
- Wynnefield units: imported from call history (units that have had service calls). New units created on the fly during job intake.
- Sasser units: one `Main` unit per location (hidden in flat UI). Systems added per job as discovered.
- Sasser system data (RTU specs, PM schedules) is a separate data collection project — sourced from Smartsheet, Airtable, and field records.

---

## 10. Data Model — Complete Table List

### App Config
System-wide constants. Single row. Editable by owner/admin only.

| Key | Value | Notes |
|---|---|---|
| `labor_cost_per_hour` | $90 | Drives bundle cost calculations |
| `travel_time_hours` | 0.5 | Pricing constant — not a scheduling estimate |
| `refrigerant_cost_per_lb` | $15 | R-410A baseline |
| `profit_per_hour_target` | $100 | Used in bundle build |

---

### Customer
| Field | Notes |
|---|---|
| ID | Primary key |
| Parent account | FK → Customer (self-reference). Empty for top-level accounts. |
| Name | Company or individual name |
| Type | residential, commercial, property_management, facilities_provider |
| Billing address | Where invoices are mailed |
| Billing email | Who receives invoices |
| Billing phone | Accounts payable contact |
| Bill to parent | Route invoices to parent account? Set once at setup. |
| Notes | Anything the team should know |
| Created | When the record was added |

---

### Location
| Field | Notes |
|---|---|
| ID | Primary key |
| Customer | FK → Customer |
| Name | Friendly name (e.g. "Abbey Crossing", "Burlington") |
| Street address | |
| City | |
| State | |
| Zip | |
| Access notes | Gate codes, parking, key box, door combinations, etc. |
| Tax rate | NC county sales tax rate as decimal (e.g. 0.0475). Set once at location setup. Inherited by jobs. |
| Created | When the record was added |

---

### Unit
| Field | Notes |
|---|---|
| ID | Primary key |
| Location | FK → Location |
| Name | Unit number, suite name, or "Main" |
| Unit type | apartment, suite, floor, main |
| Notes | Anything specific to this unit |
| Created | When the record was added |

---

### System
One physical HVAC cabinet. Multiple system records make up a logical system when linked by `group_name`.

| Field | Notes |
|---|---|
| ID | Primary key |
| Unit | FK → Unit |
| Name | Friendly label (e.g. "RTU-1", "AHU - Apt 101") |
| System subtype | RTU, AHU, CU, MS-Head, MS-Cond, PTAC |
| Group name | Links related cabinets within a unit (e.g. "Heat Pump A"). Standalone RTUs leave this blank. |
| Tonnage | Nominal capacity in tons (1.5, 2, 3, 5, 10, etc.) |
| Make | Manufacturer |
| Model | Model number |
| Serial number | Unit serial number |
| Refrigerant type | R-410A, R-22, R-32, or other. Drives rules of thumb on Observe screen. |
| Metering device | TXV, fixed orifice, or other. Drives superheat targets on Observe screen. |
| Install date | When this cabinet was installed |
| Notes | Known issues, quirks, service history |
| Created | When the record was added |

---

### Job
| Field | Notes |
|---|---|
| ID | Primary key |
| Customer | FK → Customer (child account — never a parent) |
| Location | FK → Location |
| Unit | FK → Unit (optional — may be manual entry) |
| System | FK → System |
| Diagnosis | FK → Diagnosis. Empty on ad-hoc / no-diagnosis path. |
| Assigned tech | FK → User. Set at planning time. |
| Actual tech | FK → User. Set at job start. Appears on invoice. |
| How it came in | web_form, dispatcher, tech_direct |
| Submitter email | Required on web form submissions |
| Manual unit | Free-text when unit isn't in the system yet |
| Status | new, assigned, en_route, in_progress, completed, closed_no_diagnosis, cancelled, invoiced |
| Priority | routine, urgent, emergency |
| Job date | Date planned. No time component — no appointment times. |
| Queue position | Integer — tech's ordered queue for that job_date |
| Access confirmation needed | Boolean — site requires key holder present |
| Access confirmed | Boolean — dispatcher checks off after making the call |
| New diagnosis requested | Boolean — set when job closes via ad-hoc path |
| Needs admin review | Auto-set on close without standard diagnosis |
| Flagged for review | Set by admin to hold invoice for follow-up |
| Invoice number | INV-YYYY-NNNN format, set on approval |
| Flat rate override | Admin can override the bundle flat rate at invoice review |
| Problem description | What was reported or noted on arrival |
| Arrived at | First arrival timestamp |
| Completed at | When job was closed |
| Created | When job was entered |
| Tstat mode | cool, heat, em_heat, fan_only, off |
| Tstat fan | auto, on |
| System response | running_normal, not_running, short_cycling, fault_lockout, fan_only |
| Temp outdoor | Outdoor ambient (auto-filled from weather API, tech-editable) |
| Temp outdoor auto | Raw weather API value stored separately |
| Temp return | Return air |
| Temp supply | Supply air |
| Arrival notes | Free-text observations |
| Invoice subtotal | Pre-tax invoice amount |
| Tax rate | Copied from location at invoice creation and locked |
| Invoice tax | Calculated tax amount |
| Invoice total | Final billed amount |
| Invoice amount | Legacy field — total only, for historical records |
| Admin notes | Internal — never shown on invoice |
| Invoice PDF path | Supabase Storage path |
| Approved at | When invoice was approved |
| Approved by | FK → User |

---

### Job Tech
| Field | Notes |
|---|---|
| ID | Primary key |
| Job | FK → Job |
| User | FK → User |
| Role | primary, assist |
| Assigned at | When added |

---

### Job Event
Append-only log. Provides complete visit history for multi-visit jobs.

| Field | Notes |
|---|---|
| ID | Primary key |
| Job | FK → Job |
| Tech | FK → User |
| Event type | claimed, departed, arrived, completed, reassigned, helper_added, cancelled |
| Timestamp | When it occurred |
| GPS lat/lng | Tech's location at event time |
| Note | Optional — used on reassigned events |

---

### Job AddOn
| Field | Notes |
|---|---|
| ID | Primary key |
| Job | FK → Job |
| Type | bundle or item |
| Bundle | FK → Repair Bundle |
| Item | FK → Item |
| Quantity | |
| Added by | FK → User |
| Created | When added |

---

### Job AdHoc Bundle
| Field | Notes |
|---|---|
| ID | Primary key |
| Job | FK → Job |
| Tech description | Free-text — what the tech found and did |
| Reviewed by admin | Boolean |
| Admin action | one_off or promoted |
| Promoted diagnosis | FK → Diagnosis |
| Created | When added |

---

### Job Placeholder Cost
| Field | Notes |
|---|---|
| ID | Primary key |
| Job | FK → Job |
| Item | FK → Item (the placeholder) |
| Actual cost | Entered by admin at invoice review |
| Entered by | FK → User |
| Created | When entered |

---

### Diagnosis
Catalog of repair codes. 43 codes total.

| Field | Notes |
|---|---|
| ID | Primary key |
| Location | AHU, CU, SYS, FU, REF, DUCT |
| Component | Capacitor, Coil, Motor, etc. |
| Action | Replace, Reset, Repair, Clean, etc. |
| Cat 1 | Sub-classifier level 1 (e.g. Leak) |
| Cat 2 | Sub-classifier level 2 (e.g. Easy, In Wall) |
| Cat 3 | Sub-classifier level 3 (rarely used) |
| Repair code | **Generated column** — auto-built via `build_repair_code()` immutable function. Never set manually. |
| Repair notes | Brief tech-facing steps shown on Work screen |
| Invoice description | Full QB-ready boilerplate for customer invoice |
| Variable pricing | Boolean — flat rate cannot be known in advance |
| One shot | Boolean — resolvable in a single visit |
| Est. work hours | Estimated on-site labor hours |
| Historic price | Baseline from pre-app history |
| Active | Whether techs can select this code |
| Created | When added |

**Note:** `name` field was dropped — `repair_code` is the display label. `repair_code` is a Postgres generated column built by the `public.build_repair_code()` immutable function.

---

### Repair Bundle
| Field | Notes |
|---|---|
| ID | Primary key |
| Diagnosis | FK → Diagnosis |
| Name | Internal label |
| Flat rate | Customer charge |
| Add-on eligible | Can be added as additional work on another job |
| Add-on description | Short invoice description when used as add-on |
| Notes | Internal |
| Created | When added |

---

### Repair Bundle Line
| Field | Notes |
|---|---|
| ID | Primary key |
| Bundle | FK → Repair Bundle |
| Item | FK → Item |
| Quantity | |
| Cost at time of build | Locked at bundle creation |

---

### Item
| Field | Notes |
|---|---|
| ID | Primary key |
| Name | e.g. "R-410A Refrigerant", "Standard Labor Hour", "Profit" |
| Type | equipment, part, material_bundle, labor, profit |
| Unit cost | Current cost. $0 for placeholder items. |
| Is placeholder | Boolean — requires admin cost entry at invoice review |
| Unit | each, hour, lb, ft, etc. |
| A la carte eligible | Can tech add this outside of any bundle? |
| Active | Whether still in use |
| Created | When added |

---

## 11. Tech Stack — Confirmed

| Layer | Choice | Reason |
|---|---|---|
| **Frontend** | Next.js 16.2.1 (React 19, App Router, no src/ dir) | Responsive web app |
| **Backend / DB** | Supabase | Auth, Postgres, Storage, Edge Functions |
| **Offline** | PWA + service worker cache | Handles field signal gaps |
| **Hosting** | Vercel | One-command deploy, native Next.js support |
| **Styling** | Tailwind v4 installed but inline styles used exclusively | No Tailwind classes in components |

**Key file locations:**
- Supabase client (browser): `utils/supabase/client.ts`
- Supabase client (server): `utils/supabase/server.ts`
- Auth middleware: `middleware.ts`
- App shell (nav): `app/components/AppShell.tsx`
- Dev server config: `.claude/launch.json`

**Next.js 16 conventions:**
- Always read `node_modules/next/dist/docs/` before writing new Next.js code
- `params` is a Promise — always `const { id } = await params`
- Server actions in `'use server'` files with `revalidatePath()` for cache invalidation
- Server `page.tsx` loads data, passes to client component with `as any` cast at FK join boundaries
- **`'use server'` files can ONLY export async functions** — non-async helpers (like `isFlat()`) cause "Server Actions must be async functions" errors. Inline helper logic in the consuming file instead.

**Supabase patterns:**
- FK join hints required: `customers!jobs_customer_id_fkey(...)`, `users!jobs_actual_tech_fkey(...)`, etc.
- Self-referential joins (customers parent): do a separate query for parent name rather than nested join

**Supabase Storage** is used for:
- Invoice PDFs — saved on approval, linked to job record
- Job photos — `job-photos` bucket, path `{jobId}/{type}/{ts}-{filename}` (type = arrival, fault, post_repair)

**Row-level security:** Techs see only their own jobs. Dispatcher, admin, owner see everything. CRUD insert/update policies added in migration 010.

---

## 12. App File Structure

```
app/
  layout.tsx                    — root layout
  page.tsx                      — root redirect
  auth/callback/route.ts        — Supabase auth callback
  auth/signout/route.ts         — sign out handler
  login/page.tsx                — login page
  components/AppShell.tsx       — sticky header nav (Planning, Jobs, Invoices, Customers)
  planning/
    page.tsx                    — server: today's jobs, techs, customers, locations
    PlanningBoard.tsx           — client: tech lanes, drag/drop, job cards, add job modal
    actions.ts                  — addJob server action
  jobs/
    page.tsx                    — server: tech day list
    JobList.tsx                 — client: my queue + unassigned pull
    [id]/
      page.tsx                  — server: job + service history + catalogs (no pricing)
      JobFlow.tsx               — client: 5-step shell, context bar, timer, step nav
      Step1Arrive.tsx           — system info (inline editable), access notes, GPS arrival
      Step2Observe.tsx          — tstat mode/fan/response, temps, delta-T, weather API, photos
      Step3Diagnose.tsx         — diagnosis search/select, fault/post-repair photos
      Step4Work.tsx             — primary bundle view + add-on work
      Step5Close.tsx            — summary + complete job button
      actions.ts                — markArrived, saveObservations, setDiagnosis, addJobAddOn,
                                   removeJobAddOn, closeJob, updateSystem
      types.ts                  — tech flow types (no pricing fields)
  customers/
    page.tsx                    — server: all customers + location counts
    CustomersList.tsx           — client: search bar, type pills, click → detail
    actions.ts                  — 8 server actions: createCustomer, updateCustomer,
                                   createLocation, updateLocation, createUnit, updateUnit,
                                   createSystem, updateSystemFromCustomers,
                                   createSystemForLocation, createUnitWithSystem
    [customerId]/
      page.tsx                  — server: customer + locations (with unit+system counts)
      CustomerDetail.tsx        — client: inline-editable info card, conditional location counts
                                   (systems for flat, units for nested), Add Location modal
      [locationId]/
        page.tsx                — server: location + units + systems, type detection, flat flattening
        LocationDetail.tsx      — client: inline-editable location card, type-aware content:
                                   FLAT: editable system cards + Add System modal
                                   NESTED: unit rows + combined Add Unit+System modal
        [unitId]/
          page.tsx              — server: unit + systems, customerType prop
          UnitDetail.tsx        — client: merged unit+system card (inline-editable),
                                   Add System modal if no system exists
  invoices/
    page.tsx                    — server: queue (status=completed + needs_admin_review)
    InvoiceQueue.tsx            — client: card-per-job, pills (pending/flagged/needs cost)
    types.ts                    — 15 interfaces WITH pricing fields (admin-only)
    [id]/
      page.tsx                  — server: 8 queries (job, bundle, addons, placeholder costs,
                                   parent customer, variance, photos, app config)
      InvoiceDetail.tsx         — client: 9-card review UI + confirmation modal
      actions.ts                — savePlaceholderCost, saveAdminNotes, saveFlatRateOverride,
                                   flagForReview, approveInvoice
```

---

## 13. UI — Built Screens

### Planning Board (`/planning`) — ✅ Live
Dispatcher's day-view command center. Sticky sub-topbar with date, metrics, and + Add Job button. Tech columns scroll horizontally. Job cards show customer, location, unit, problem/diagnosis, status pill, priority pill, access key badge. Unassigned jobs rail at the bottom.

**Add Job modal** — fully wired:
- Customer, Location (cascades), Unit (free text), Priority, Assign to, Problem description, Access confirmation flag
- Server action inserts job, auto-sets queue_position, revalidates page

**Stub buttons** (UI present, not yet wired):
- Detail panel: View full job, Reassign, Add second tech
- Unassigned rail: Assign to tech (dropdown shows but doesn't save)

---

### Tech Job Flow (`/jobs/[id]`) — ✅ Live
5-step guided flow. Context bar (customer, system, on-site timer) frozen at top throughout.

**Step 1 — Arrive** ✅
- System info card — all fields **inline editable** (tap any field to edit):
  - Text: Make, Model, Serial Number
  - Select: Refrigerant Type, Metering Device
  - Numeric: Tonnage (step 0.5)
  - Date: Install Date
  - Null fields show `— tap to add`; saves on blur/change via `updateSystem` server action
- Access notes (yellow warning card), problem as reported, service history
- GPS-enabled arrive button → sets status = in_progress

**Step 2 — Observe** ✅
- Thermostat mode + fan (required to advance)
- System response chip (required to advance)
- Temps: outdoor (weather API auto-fill, tech-editable), return, supply
- Delta-T live calc (green 16–22°F, amber otherwise)
- Rules-of-thumb panel (refrigerant + metering device driven)
- Arrival photos, arrival notes

**Step 3 — Diagnose** ✅
- Searchable diagnosis code list (matches repair code, description, taxonomy)
- Fault evidence + post-repair photo slots on selection
- Ad-hoc path for no-match

**Step 4 — Work** ✅
- Primary bundle read-only (items + quantities, no pricing)
- Additional work: searchable catalog, Bundles | Items tabs → writes to Job_AddOn

**Step 5 — Close** ✅
- Full summary, confirm closes job → status = completed, admin review queue

---

### Invoice Queue (`/invoices`) — ✅ Live
Admin view. Card per completed job. Pills: pending / flagged / needs cost entry. Click → detail.

### Invoice Detail (`/invoices/[id]`) — ✅ Live
9-card review page:
1. **Blocker** (conditional) — placeholder items needing cost, blocks approval
2. **Variance** — this invoice vs. historical avg for same diagnosis
3. **Job summary** — customer, unit, system, tech, duration, photos
4. **Field observations** — temps, delta-T, mode/fan/response chips
5. **Diagnosis & bundle** — dx code, internal cost table, profit row, flat rate override
6. **Bill to** — parent or standalone, billing email (read-only)
7. **Customer invoice preview** — white card: from/to, invoice meta, description, total
8. **Admin notes** — textarea, saves on blur
9. **Action bar** — flag for follow-up + approve & finalize → confirmation modal

**PDF/email on approval:** Stubbed with console.log — wire in Phase 8.

---

### Customers (`/customers`) — ✅ Live — Full CRUD + Type-Aware Hierarchy

**All levels support inline editing** (tap any field to edit, saves on blur) and **Add modals** for creating new records.

| Level | URL | Content |
|---|---|---|
| 1 | `/customers` | All customers, searchable, type pills, location count, + Add Customer |
| 2 | `/customers/[id]` | Inline-editable customer info (name, type, parent, billing fields, notes), locations list with conditional counts, + Add Location |
| 3 (flat) | `/customers/[id]/[locId]` | Inline-editable location info, editable system cards directly on page, + Add System |
| 3 (nested) | `/customers/[id]/[locId]` | Inline-editable location info, unit rows with system counts, + Add Unit (combined form with optional system) |
| 4 (nested) | `/customers/[id]/[locId]/[unitId]` | Merged unit+system card — unit fields on top, divider, system fields below. All inline-editable. + Add System if none exists. |

**Conditional counts on location rows:**
- Commercial/facilities → shows system count (summed across hidden units)
- Property management/residential → shows unit count

**Server actions in `customers/actions.ts`:**
- `createCustomer`, `updateCustomer` — standard CRUD
- `createLocation`, `updateLocation` — standard CRUD
- `createUnit`, `updateUnit` — standard CRUD
- `createSystem`, `updateSystemFromCustomers` — standard CRUD (revalidates both unit and location paths)
- `createSystemForLocation` — flat hierarchy: finds/creates hidden default unit, creates system under it
- `createUnitWithSystem` — nested hierarchy: creates unit + optional system in one action (prefixed form fields)

Breadcrumb navigation at every level. System subtype badges color-coded by type.

---

## 14. Tech Mobile Job Flow — Step Detail

### Step 1 — Arrive
- System details: **all fields inline editable** (make, model, serial, tonnage, refrigerant, metering, install date)
- Problem as reported
- Full service history for this system
- GPS arrive button

### Step 2 — Observe
- Thermostat mode + fan (required before advancing)
- System response chip (required before advancing)
- Temperatures: Outdoor (auto-filled from weather API) | Return air | Supply air
- Delta-T live calculation, color-coded green (16–22°F) or amber
- Rules of thumb panel (driven by refrigerant type, metering device, outdoor/return temps)
- Arrival photos (optional) and arrival notes

**Refrigerant targets:**
| | R-410A | R-22 | R-32 |
|---|---|---|---|
| Suction pressure | 115–130 PSI | 58–68 PSI | 170–195 PSI |
| Discharge pressure | 380–430 PSI | 225–265 PSI | 480–540 PSI |
| Superheat (TXV) | 8–12°F | 8–12°F | 6–10°F |
| Superheat (fixed orifice) | 10–18°F | 10–18°F | 10–15°F |

Rules of thumb are a contained, isolated client-side module — update targets by editing that module only.

### Step 3 — Diagnose
- Searchable list of active diagnosis codes
- Search matches repair code, invoice description, and taxonomy fields
- Selecting a code reveals photo slots (fault evidence + post-repair)
- "Nothing matches" path → ad-hoc bundle flow

### Step 4 — Work
- Primary bundle shown read-only (items + quantities)
- Repair notes shown as tech reference
- Additional work: searchable catalog, Bundles | Items tabs, written to Job_AddOn

### Step 5 — Close
- Summary of all job data
- Confirm closes job: status = completed, triggers admin review queue
- Explicit note: "Moves to admin review. Management finalizes and submits the invoice."

**No pricing shown anywhere in the tech flow. No signature capture.**

---

## 15. No-Diagnosis / Ad-Hoc Bundle Flow

**Tech side:**
1. Writes description of what was found and done (required)
2. Builds ad-hoc bundle from item catalog
3. Job closes flagged as `new_diagnosis_requested = true`

**Admin side:**
- Job appears in queue with badge
- Admin can: invoice as one-off, or promote to a new catalog diagnosis
- If promoted: admin fills in the diagnosis fields, links the job, existing invoice description auto-populates

---

## 16. PM Visits (Preventive Maintenance)

PM visits for Sasser/FastMed locations are entered as standard Jobs, invoiced with a PM bundle. The PM report is a default PDF showing all completed checklist steps, any deficiencies found, and small repairs completed — with photos. Delivered at job close via the same invoice approval flow as regular repairs.

PM scheduling: each location's RTUs are visited quarterly. Jobs are created by the dispatcher as scheduled. No automated scheduling in v1.

Sasser system data (RTU specs, filter sizes, belt sizes, tonnage per unit) is a separate data collection project — sourced from Smartsheet, Airtable, and field records. Will be imported once collected and normalized.

---

## 17. Historical Data Import

**Status:** ✅ Complete — 1,227 Wynnefield records imported.

**What was imported:**
- All Wynnefield Properties call history, April–September 2025
- Status = `invoiced` on all records
- `invoice_subtotal`, `tax_rate`, `invoice_tax`, `invoice_total` populated
- `invoice_amount` (legacy field) also populated for compatibility
- Unmatched diagnosis codes stored in `admin_notes` prefixed with `[Import]`
- `manual_unit` used for unit (no unit FK on historical records)
- `how_it_came_in = 'dispatcher'` on all historical records

**Import scripts** (in `DATA/` folder):
- `import-call-history.mjs` — main import script
- `verify-import.mjs` — verification script

**Sasser history:** Not yet imported.

---

## 18. Diagnosis Catalog

43 codes total (41 original + 2 added manually for system changeouts). Repair code is auto-generated from taxonomy fields via `build_repair_code()`.

```
AHU - Capacitor - Replace
AHU - Coil - Clean
AHU - Coil - Defrost & Clean
AHU - Cond Lines - Clear
AHU - Control Board - Replace
AHU - Drain Pan - Replace
AHU - Evap Coil - Replace
AHU - Limit / Sequencer - Replace
AHU - Motor - Replace - Forward
AHU - Motor - Replace - Transverse
CU - Capacitor - Replace
CU - Compressor - Replace
CU - Condenser Coil - Replace
CU - Contactor - Replace
CU - Control Board - Replace
CU - Control Board - Reset
CU - Motor - Replace
CU - Power - Cross Wired
CU - Pres Switch - Replace
CU - Rev Valve - Replace
CU - TXV - Replace
FU - Draft Inducer - Replace
FU - Gas Valve - Replace
SYS - Attic/Crawl AHU - Change Out
SYS - Ducts - Reset - Fire Damper
SYS - LV - Repair - Heat Strip
SYS - LV - Repair - Rev Valve
SYS - LV - Repair - Short
SYS - LV - Repair - Thermostat
SYS - MIN - None
SYS - MIN - Reser Power - AHU
SYS - MIN - Reset - Fire Stat
SYS - MIN - Reset Power - CU
SYS - MIN - Set - Thermostat
SYS - REF - Repair - Leak - Easy
SYS - REF - Repair - Leak - In Wall
SYS - REF - Repair - Leak - NLF
SYS - REF - Repair - Leak - Pump Down
SYS - REF - Repair - Leak - Recover
SYS - REF - Repair - Restriction
SYS - Thermostat - Replace
SYS - TOTAL - Change Out - Attic/Crawl AHU
SYS - TOTAL - Change Out - Wall Mount
```
