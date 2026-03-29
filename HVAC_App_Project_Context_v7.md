# HVAC Field Service App - Living Project Context
> Use this file at the start of every new session.
> It reflects the current local app state after the observation-flow revamp, admin hub/catalog import work, and recent jobs/invoice fixes.

---

## 0. Current Snapshot

**Project folder:** `C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app`  
**Stack:** Next.js 16.2.1 + React 19 + Supabase + Vercel  
**Supabase project ref:** `ifneznpvppgqlfidwysi`

### Phase status
| Phase | Status | Notes |
|---|---|---|
| Phase 0-7 | Complete | Core schema, auth, planning, tech flow, invoice review, customer/location/unit/system CRUD |
| Phase 8 | In progress | Invoice PDF/email/storage still not fully implemented |
| Current active work | In progress | Live beta readiness, admin/catalog hardening, UI polish, invoice completion |

### Current product state
- Planning board is live and supports drag/drop reassignment plus manual reassignment.
- Jobs tab is live and now includes an `Add Job` button with internal job-entry modal.
- Customer hierarchy remains type-aware:
  - Commercial/facilities = flat UI
  - Property management/residential = nested UI
- Tech flow is fully wired across 5 steps:
  - `Arrive`
  - `Observe`
  - `Diagnose`
  - `Repair`
  - `Close`
- Invoice review queue/detail is live.
- Admin hub is now live and includes:
  - catalog import
  - user editing
- Catalog import is wired against the repo seed files:
  - `DATA/ITEMS.csv`
  - `DATA/Operations - Invoicing - V2.csv`

---

## 1. Key Recent Changes

### Observe / Diagnose revamp
- `Observe` was rebuilt around a tighter mobile-first layout:
  - `System`
  - thermostat settings
  - shared air temperatures
  - per-circuit pressure/temp readings
  - notes/photos
- Shared observation context is now used across both `Observe` and `Diagnose`.
- `Rules of Thumb` moved off `Observe` and now lives on `Diagnose`.
- `system_response` was removed from the active UX and active validation.
- Shared temperature readings are:
  - `outdoor`
  - `return`
  - `supply`
- `delta` is calculated, not manually entered.
- Refrigerant readings are stored per circuit with support for:
  - `Circuit 1`
  - optional `Circuit 2`
- The system details section on `Observe` is now positioned above thermostat settings.

### Observation data model
- Added dedicated per-job circuit storage via `job_observation_circuits`.
- Observation notes/photos are now shared between `Observe` and `Diagnose`.
- Photo buckets in the active flow are now:
  - `observation`
  - `post_repair`

### Arrive / Repair flow updates
- `Arrive` was simplified and now emphasizes:
  - destination
  - access
  - concise equipment summary
  - call context / history
- Step 4 was renamed from `Work` to `Repair`.
- Repair flow now treats the diagnosis as the conclusion and Step 4 as the repair-selection step.
- Repair bundle search was widened so typing in search now looks across the full imported bundle catalog, not just `addon_eligible` quick-add bundles.

### Catalog / admin
- New top-level `Admin` tab replaced the former standalone `Catalog` tab.
- `/catalog` now redirects to `/admin`.
- Admin hub currently includes:
  - `Users` tab
  - `Catalog` tab
- User editing supports:
  - first name
  - last name
  - phone
  - role
  - active/inactive
- Catalog importer is idempotent and handles shorthand/alias mapping from the operations CSV.
- The importer will auto-create missing items referenced by the operations sheet when necessary.

### Jobs tab
- Main `Jobs` tab now has an `Add Job` button.
- It reuses the same internal add-job flow as Planning:
  - customer
  - location
  - unit/free text
  - priority
  - assignee
  - problem description
  - access-needed flag

### Invoices
- Invoice review/detail is still live.
- Imported bundle pricing now has better handling in invoice fetch/approval paths:
  - no longer assumes exactly one bundle row exists per diagnosis
  - now takes the newest matching bundle when multiple rows exist
- Invoice cost review now uses `cost_at_build` where appropriate instead of only relying on current item master cost.
- Profit lines are hidden from the tech-facing repair bundle view and from the internal cost line-item display where they would be confusing.
- Invoice PDF generation, email sending, and saved PDF linking are still not complete.

### Branding / visual direction
- Header and shell are aligned to `Legend Service Pros`.
- Palette direction remains:
  - charcoal / near-black header
  - warm cream / ivory work surfaces
  - champagne / gold accents
- The app is much less generic than before, but visual refinement is still ongoing.

---

## 2. Migration Log

### Existing migrations
- `001_core.sql`
- `002_catalog.sql`
- `003_jobs.sql`
- `004_rls.sql`
- `005_systems_extend.sql`
- `006_sales_tax.sql`
- `007_diagnoses_repair_code.sql`
- `008_fix_rls_recursion.sql`
- `009_fix_job_tech_recursion.sql`
- `010_crud_rls.sql`

### Newer migrations expected by current code
- `011_user_profile_sync.sql`
  - `ensure_user_profile`
  - `handle_auth_user_created`
  - `backfill_missing_user_profiles`
  - `list_assignable_users`
- `012_system_context.sql`
  - adds `served_areas`, `thermostat_location`, `equipment_location`, `controls_notes`, `manufacture_date`, `manufacture_date_source`
- `013_jobs_crud_rls.sql`
  - broadens authenticated insert/update behavior on `jobs`
- `014_assign_job_rpc.sql`
  - adds `assign_job_planning(...)`
- `015_jobs_read_authenticated.sql`
  - broadens authenticated job visibility
- `016_system_component_ratings.sql`
  - adds `heating_capacity_btu` to `systems`
- `017_job_observation_circuits.sql`
  - adds `job_observation_circuits`
- `018_catalog_insert_rls.sql`
  - adds explicit insert RLS policies for:
    - `diagnoses`
    - `items`
    - `repair_bundles`
    - `repair_bundle_lines`

### Important note
The local codebase now expects migrations `011` through `018` to exist.  
Before testing planning reassignment, observation-circuit persistence, or catalog import, confirm these migrations are applied in Supabase.

---

## 3. Architecture / Workflow Rules

### Customer hierarchy
Database structure remains:
- `Customer -> Location -> Unit -> System`

UI behavior remains type-aware:
- `commercial`, `facilities_provider`
  - flat UI
  - systems shown directly at location level
  - hidden default unit behind the scenes
- `property_management`, `residential`
  - nested UI
  - location shows units
  - unit detail shows merged unit+system presentation

### System model
One physical cabinet = one `systems` row.  
Related equipment is grouped via `group_name`.

Examples:
- Heat pump
  - `CU`
  - `AHU`
  - same `group_name`
- AC/furnace
  - `CU`
  - `Furnace`
  - `Coil`
  - same `group_name`
- RTU
  - usually one system row
  - controls still tracked in notes/checklist style

### Tech flow rules
- Step 1 `Arrive`
  - lighter destination/context presentation
  - concise make + system type summary when equipment exists
  - problem/history grouped into call-context section
- Step 2 `Observe`
  - owns shared observation capture
  - owns linked-system create/edit behavior
  - supports 1-2 refrigerant circuits
- Step 3 `Diagnose`
  - shows shared observation context and `Rules of Thumb`
  - diagnosis search sits below that shared context
- Step 4 `Repair`
  - repair bundle/add-on selection
  - diagnosis is no longer treated as the repair decision itself
- Step 5 `Close`
  - summarizes observations, circuits, repair add-ons, and photo counts
- Pricing still must never be exposed to techs as customer-facing billing logic.

---

## 4. Current Observe-Step Behavior

### Shared observation fields
- `tstat_mode`
- `tstat_fan`
- `temp_outdoor`
- `temp_return`
- `temp_supply`
- derived `delta`
- `arrival_notes` as the backing store for shared notes

### Circuit observation fields
For each supported circuit:
- `suction_pressure`
- `suction_line_temp`
- `liquid_pressure`
- `liquid_line_temp`

### Supported templates
- `Heat Pump`
  - components:
    - `Condensing Unit`
    - `Air Handler`
  - shared:
    - `System Tonnage`
    - `System Refrigerant`

- `AC / Furnace`
  - components:
    - `Condensing Unit`
    - `Furnace`
    - `Coil`
  - shared:
    - `System Tonnage`
    - `System Refrigerant`
  - furnace-specific:
    - `BTU rating`

- `RTU`
  - component:
    - `RTU`
  - add-on checklist:
    - `Zone Controller`
    - `Economizer`
    - `Smoke Detector`
    - `VFD`
    - `BAS Interface`

### Conversion behavior
- If an existing linked system is simple or incorrectly typed, changing to a multi-component type should convert it into the proper structure rather than forcing a rebuild.

### Apartment suppression
For apartment/unit-style jobs, suppress:
- `served_areas`
- `thermostat_location`
- `equipment_location / access`

### Delta behavior
- Cooling uses `return - supply`
- Heat and emergency heat use `supply - return`

---

## 5. Catalog Import Behavior

### Source files
- `DATA/ITEMS.csv`
- `DATA/Operations - Invoicing - V2.csv`

### What the importer does
- Imports item master rows into `items`
- Imports repair rows into `diagnoses`
- Imports bundle rows into `repair_bundles`
- Imports bundle lines into `repair_bundle_lines`

### Special handling already in code
- Operations CSV uses a descriptive preamble row above the true header; importer skips that correctly.
- `repair_code` on `diagnoses` is treated as generated by the database, not hand-written.
- Common shorthand aliases are mapped automatically, including examples like:
  - `Standard`
  - `Minimal`
  - `Rev Valve`
  - `Press Switch`
- Refrigerant rows are interpreted from quantity + total cost rows.
- Missing referenced items can be auto-created if the operations sheet uses an item not present in the master item list.

### Current admin access rules
- Catalog import access:
  - `admin`
  - `owner`
  - `dispatcher`
- User editing access:
  - `admin`
  - `owner`

---

## 6. Planning / Jobs Status

### Planning board
What exists in code now:
- Add Job modal
- tech lanes
- drag/drop reassignment
- manual reassignment
- diagnostic failure banner
- RPC-backed assignment path

### Jobs tab
What exists in code now:
- active job card
- queued jobs
- done jobs
- unassigned jobs pull-in
- Add Job button/modal

### Things to re-verify in live testing
- drag/drop reassignment persists correctly
- manual reassignment persists correctly
- reassigned jobs remain visible after move
- jobs-tab Add Job creates and refreshes correctly

---

## 7. Branding / UI Direction

Brand reference: `Legend Service Pros`

### Current direction
- darker charcoal header
- warm ivory / cream surfaces
- champagne / gold accents
- less generic admin-tool feel

### Still wanted
- stronger contrast overall
- tighter visual hierarchy
- more intentional typography
- continued field-first mobile cleanup
- bolder polish across Arrive / Observe / Diagnose / Repair / Invoices / Admin

---

## 8. Known Open Work

### Product / feature work
- Invoice PDF generation still not wired
- Invoice email sending still not wired
- Invoice PDF storage / job linking still not wired
- Catalog import needs more live-data validation after repeated reimports
- Repair bundle add-on strategy still needs refinement beyond search-based discovery

### UX / polish
- More contrast and visual refinement still needed
- Continue mobile-first cleanup across all major screens
- Continue polishing Admin and Invoice screens

### Deployment / live beta
- Vercel hosting setup still needs to be finalized
- Supabase auth redirect URLs still need to be confirmed for hosted use
- Team beta smoke test still needs to be run end-to-end

### Diagnostic intelligence
- Expand `Rules of Thumb`
- Add future side-kick diagnostic mode using structured job/system/measurement context

---

## 9. Important Files

### Planning
- [page.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\planning\page.tsx)
- [PlanningBoard.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\planning\PlanningBoard.tsx)
- [actions.ts](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\planning\actions.ts)

### Jobs / tech flow
- [page.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\page.tsx)
- [JobList.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\JobList.tsx)
- [page.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\page.tsx)
- [JobFlow.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\JobFlow.tsx)
- [Step1Arrive.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\Step1Arrive.tsx)
- [Step2Observe.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\Step2Observe.tsx)
- [Step3Diagnose.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\Step3Diagnose.tsx)
- [Step4Work.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\Step4Work.tsx)
- [Step5Close.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\Step5Close.tsx)
- [ObservationWorkspace.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\ObservationWorkspace.tsx)
- [actions.ts](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\actions.ts)
- [types.ts](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\types.ts)

### Invoices
- [page.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\invoices\page.tsx)
- [page.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\invoices\[id]\page.tsx)
- [InvoiceDetail.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\invoices\[id]\InvoiceDetail.tsx)
- [actions.ts](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\invoices\[id]\actions.ts)

### Admin / catalog
- [page.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\admin\page.tsx)
- [AdminHub.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\admin\AdminHub.tsx)
- [actions.ts](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\admin\actions.ts)
- [CatalogAdmin.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\catalog\CatalogAdmin.tsx)
- [actions.ts](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\catalog\actions.ts)
- [import.ts](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\utils\catalog\import.ts)

### Customers / systems
- [actions.ts](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\customers\actions.ts)
- [LocationDetail.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\customers\[customerId]\[locationId]\LocationDetail.tsx)
- [UnitDetail.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\customers\[customerId]\[locationId]\[unitId]\UnitDetail.tsx)

### Shared helpers
- [systems.ts](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\utils\hvac\systems.ts)
- [AppShell.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\components\AppShell.tsx)

---

## 10. Testing Notes

### Helpful local checks
- `npx tsc --noEmit`

### High-value manual checks
- Observe/Diagnose shared observation persistence
- Circuit 2 enable/disable behavior
- Repair bundle search on imported data
- Invoice flat-rate totals after imported bundle selection
- Jobs-tab Add Job flow
- Admin user editing permissions
- Catalog full import rerun behavior

### Supabase auth dev note
- Hosted password recovery emails can hit rate limits quickly in dev.
- Manual password reset through the Supabase dashboard may still be needed when testing locally.

---

## 11. Recommended Next Priorities

1. Finish Phase 8 invoice PDF/email/storage integration.
2. Get the app hosted on Vercel for internal team beta.
3. Re-verify catalog import and invoice pricing end-to-end using real imported repair bundles.
4. Continue visual polish, especially mobile experience and overall contrast.
5. Expand rules-of-thumb logic and design the future AI diagnostic side-kick.
