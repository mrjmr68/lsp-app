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
| **Phase 3 — Data** — Customers, locations, diagnosis catalog | ✅ Complete | Wynnefield (80 loc), Sasser (43 loc), 41 diagnosis codes |
| **Phase 3 — Data** — Call history import | ✅ Complete | 1,227 Wynnefield records imported, status = invoiced |
| **Phase 4** — First UI screens | 🔄 In progress | Planning board live, Add Job working |

**Migration log:**
- 001 — Core entities
- 002 — Catalog
- 003 — Jobs
- 004 — RLS (row-level security)
- 005 — Systems extend (group_name, tonnage, system_subtype)
- 006 — Sales tax (tax_rate on locations, invoice breakdown on jobs)
- 007 — Diagnoses repair_code as generated column, drop name field
- 008 — Fix RLS infinite recursion (users/jobs/job_tech policy rewrite)

**Known RLS fixes applied directly in Supabase SQL editor (not in migration files):**
- `current_user_role()` and `is_admin()` functions recreated with `security definer` + `set search_path = public` to break users↔jobs recursion loop
- Jobs and job_tech cross-reference policies dropped and rewritten without circular subqueries
- Jobs insert policy added: `with check (auth.uid() is not null and current_user_role() in ('admin','owner','dispatcher','tech'))`
- Jobs select/update/delete split into explicit separate policies (replacing `for all`)

**Project folder:** `C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app`
**MCP filesystem access:** lsp-app and lsp-app2 (legacy/reference)
**lsp-app2:** Legacy/reference only — wireframes live here at `lsp-app2\wireframes\`
**Stack:** Next.js (no src/ dir) + Supabase + Vercel
**Supabase project ref:** `ifneznpvppgqlfidwysi`
**Claude in Chrome:** Connected — browser automation available in sessions where extension is active

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

## 9. Property Hierarchy
**Customer → Location → Unit → System**

| Level | Description | Examples |
|---|---|---|
| **Customer** | Who pays | Wynnefield Properties, Sasser Companies |
| **Location** | The physical property | Abbey Crossing, Sasser - Burlington |
| **Unit** | The addressable space within the property | Apt 417, Suite 3B, Main |
| **System** | One physical HVAC cabinet | AHU, CU, RTU |

- A **house** has one Location, one Unit ("Main"), and one or more Systems
- A **commercial building** has one Location, one or more Units, and one or more Systems
- An **apartment community** has one Location, many Units, typically one System per unit
- `Unit.unit_type` values: apartment, suite, floor, main

**System component model:**
A logical HVAC system is made up of one or more physical cabinets (components). Each cabinet is its own System record. Related cabinets are linked by `group_name` within the same unit.

Examples:
- Residential heat pump: AHU + CU, both with `group_name = "Heat Pump"`
- RTU: single record, `system_subtype = "RTU"`, no group needed
- Server room split: AHU + MS-Cond, both with `group_name = "Server Room"`

`system_subtype` values: `RTU`, `AHU`, `CU`, `MS-Head`, `MS-Cond`, `PTAC`

**Unit pre-population strategy:**
- Wynnefield units: imported from call history (units that have had service calls). New units created on the fly during job intake.
- Sasser units: one `Main` unit per location. Systems added per job as discovered.
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
| Problem description | What was reported or noted on arrival |
| Arrived at | First arrival timestamp |
| Completed at | When job was closed |
| Created | When job was entered |
| Tstat mode | cool, heat, em_heat, fan_only, off |
| Tstat fan | auto, on |
| System response | running_normal, not_running, short_cycling, fault_lockout, fan_only |
| Temp outdoor | Outdoor ambient °F (auto-filled from weather API, tech-editable) |
| Temp outdoor auto | Raw weather API value stored separately |
| Temp return | Return air °F |
| Temp supply | Supply air °F |
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
Catalog of repair codes. 41 codes loaded + 2 added manually for system changeouts.

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

**Note:** `name` field was dropped — `repair_code` is the display label. `repair_code` is a Postgres generated column built by the `public.build_repair_code()` immutable function (required because trim/regexp_replace are not considered immutable in generated column context).

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
| À la carte eligible | Can tech add this outside of any bundle? |
| Active | Whether still in use |
| Created | When added |

---

## 11. Tech Stack — Confirmed

| Layer | Choice | Reason |
|---|---|---|
| **Frontend** | Next.js (React, no src/ dir) | Responsive web app |
| **Backend / DB** | Supabase | Auth, Postgres, Storage, Edge Functions |
| **Offline** | PWA + service worker cache | Handles field signal gaps |
| **Hosting** | Vercel | One-command deploy, native Next.js support |

**Key file locations:**
- Supabase client (browser): `utils/supabase/client.ts`
- Supabase client (server): `utils/supabase/server.ts`
- Auth middleware: `middleware.ts`
- App shell (nav): `app/components/AppShell.tsx`
- Planning board page (server): `app/planning/page.tsx`
- Planning board UI (client): `app/planning/PlanningBoard.tsx`
- Planning board server actions: `app/planning/actions.ts`
- Import scripts: `DATA/import-call-history.mjs`, `DATA/verify-import.mjs`
- Wireframes (reference): `lsp-app2/wireframes/` (dispatcher-planning.html, tech-job-flow.html, admin-invoice-review.html)

**Supabase Storage** is used for:
- Invoice PDFs — saved on approval, linked to job record
- Job photos — uploaded async, never block job close

**Row-level security:** Techs see only their own jobs. Dispatcher, admin, owner see everything.

---

## 12. UI — Built Screens

### Planning Board (`/planning`) — ✅ Live
The dispatcher's day-view command center. Sticky sub-topbar with date, metrics, and + Add Job button. Tech columns scroll horizontally. Job cards show customer, location, unit, problem/diagnosis, status pill, priority pill, access key badge. Unassigned jobs rail at the bottom. Click any card to open the detail panel.

**Add Job modal** — fully wired to Supabase:
- Customer dropdown (all customers)
- Location dropdown (cascades from customer — filters client-side)
- Unit (free text)
- Priority (routine / urgent / emergency)
- Assign to (all active users)
- Problem description
- Access confirmation checkbox
- Server action inserts job, auto-sets queue_position, revalidates page

**Stub buttons** (UI present, not yet wired):
- Detail panel: View full job, Reassign, Add second tech
- Unassigned rail: Assign to tech (dropdown shows but doesn't save)

**Next to build on this screen:**
- Wire the unassigned rail assign action to Supabase
- Wire the Reassign button
- Wire access_confirmed checkbox toggle

---

## 13. Tech Mobile Job Flow

The tech's primary interface is a **5-step guided job screen**. The job context bar (customer, system, on-site timer, travel stats) is frozen at the top throughout all steps.

### Step 1 — Arrive
- System details: make, model, serial, type, install date
- Problem as reported
- Full service history for this system

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

## 14. No-Diagnosis / Ad-Hoc Bundle Flow

**Tech side:**
1. Writes description of what was found and done (required)
2. Builds ad-hoc bundle from item catalog
3. Job closes flagged as `new_diagnosis_requested = true`

**Admin side:**
- Job appears in queue with ⚠️ badge
- Admin can: invoice as one-off, or promote to a new catalog diagnosis
- If promoted: admin fills in the diagnosis fields, links the job, existing invoice description auto-populates

---

## 15. PM Visits (Preventive Maintenance)

PM visits for Sasser/FastMed locations are entered as standard Jobs, invoiced with a PM bundle. The PM report is a default PDF showing all completed checklist steps, any deficiencies found, and small repairs completed — with photos. Delivered at job close via the same invoice approval flow as regular repairs.

PM scheduling: each location's RTUs are visited quarterly. Jobs are created by the dispatcher as scheduled. No automated scheduling in v1.

Sasser system data (RTU specs, filter sizes, belt sizes, tonnage per unit) is a separate data collection project — sourced from Smartsheet, Airtable, and field records. Will be imported once collected and normalized.

---

## 16. Historical Data Import

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

## 17. Diagnosis Catalog

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
SYS - TOTAL - Change Out - Attic/Crawl AHU  ← added manually
SYS - TOTAL - Change Out - Wall Mount        ← added manually
```
