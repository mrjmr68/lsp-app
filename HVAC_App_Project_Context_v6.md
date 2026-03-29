# HVAC Field Service App - Living Project Context
> Use this file at the start of every new session.
> It reflects the current local app state after recent planning, customer-system, and tech-flow updates.

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
| Current active work | In progress | Planning-board reliability, branding/UI polish, reactive system capture on Observe |

### Current product state
- Planning board is live and now supports drag/drop and reassignment logic in code.
- Customer hierarchy is type-aware:
  - Commercial/facilities = flat UI
  - Property management/residential = nested UI
- Tech flow is fully wired across 5 steps.
- Invoice review queue/detail is live.
- System capture is now significantly more advanced on the `Observe` step.

---

## 1. Key Recent Changes

### Planning board / assignees
- Added auth-to-profile sync so authenticated Supabase users can be backfilled into `public.users`.
- Planning board now loads assignable users through RPCs instead of assuming `public.users` is already populated.
- Assignment scope remains: all active roles in `public.users` with role in:
  - `tech`
  - `dispatcher`
  - `admin`
  - `owner`
- Planning board UI now includes:
  - drag/drop lane reassignment
  - manual reassignment
  - visible assignment failure banner
- Reassignment logic moved toward RPC-based assignment for reliability under RLS.

### System capture / customer hierarchy
- Added type-first system capture in customer workflows.
- Added support for richer system context:
  - `served_areas`
  - `thermostat_location`
  - `equipment_location`
  - `controls_notes`
  - derived `manufacture_date`
- Apartment/unit contexts no longer require a forced system name.
- `Make` is dropdown-based.
- Manual `Install Date` entry was removed from the active UX.

### Tech flow / Observe step
- `Observe` now supports creating or editing linked system data directly from the job.
- Multi-component system UI is now reactive:
  - `Heat Pump` = `Condensing Unit` + `Air Handler`
  - `AC / Furnace` = `Condensing Unit` + `Furnace` + `Coil`
  - `RTU` = main RTU + checklist-style controls/add-ons
- Shared system fields were split out from component fields:
  - `Heat Pump`: shared `System Tonnage`, shared `System Refrigerant`
  - `AC / Furnace`: shared `System Tonnage` and `System Refrigerant` for refrigeration-side components
  - `Furnace` has its own `BTU rating`
- Apartment-style jobs now suppress commercial context fields:
  - `served_areas`
  - `thermostat_location`
  - `equipment_location / access`
- Observe equipment/system details are now collapsed by default and only shown when the tech clicks to expand.

### Arrive step cleanup
- Arrive header/context now reads lighter.
- Arrive system summary is intentionally concise, e.g. `Goodman Heat Pump`.
- Prior service history is now separated into its own white card/window.

### Branding / visual direction
- Header and shell were updated to reflect `Legend Service Pros` branding direction.
- Palette is moving toward:
  - charcoal / black header
  - warm cream backgrounds
  - champagne / gold accents
- The product still needs more visual refinement, but the UI is no longer using the earlier generic placeholder feel.

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

### Newer migrations added during current work
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
  - adds `assign_job_planning(...)` RPC for planning-board assignment/reassignment
- `015_jobs_read_authenticated.sql`
  - broadens job read visibility for authenticated users so reassigned jobs do not disappear from planning views
- `016_system_component_ratings.sql`
  - adds `heating_capacity_btu` to `systems`

### Important note
The local codebase now expects migrations `011` through `016` to exist.  
Before testing planning reassignment or the newest multi-component Observe flow, confirm these migrations are applied in Supabase.

---

## 3. Architecture / Workflow Rules

### Customer hierarchy
Database structure remains:
- `Customer -> Location -> Unit -> System`

UI behavior remains type-aware:
- `commercial`, `facilities_provider`:
  - flat UI
  - systems shown directly at location level
  - hidden default unit behind the scenes
- `property_management`, `residential`:
  - nested UI
  - location shows units
  - unit detail shows merged unit+system presentation

### System model
One physical cabinet = one `systems` row.  
Related equipment is grouped via `group_name`.

Examples:
- Heat pump:
  - `CU`
  - `AHU`
  - same `group_name`
- AC/furnace:
  - `CU`
  - `Furnace`
  - `Coil`
  - same `group_name`
- RTU:
  - usually one system row
  - controls tracked in notes/checklist style for now

### Tech flow rules
- Step 1 `Arrive`:
  - simplified equipment summary
  - editable key equipment fields
  - prior service history separate from system card
- Step 2 `Observe`:
  - now owns system creation/editing during job work
  - multi-component templates are reactive to `System Type`
  - detailed equipment editor is collapsed by default
- Pricing still must never be exposed to techs.

---

## 4. Current Observe-Step Behavior

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
  - plus checklist add-ons:
    - `Zone Controller`
    - `Economizer`
    - `Smoke Detector`
    - `VFD`
    - `BAS Interface`
  - free-form controls note

### Conversion behavior
- If an existing linked system is simple or incorrectly typed, changing to a multi-component type should convert it into the correct component structure rather than forcing the user to rebuild from scratch.

### Apartment suppression
For apartment/unit-style jobs, suppress:
- `served_areas`
- `thermostat_location`
- `equipment_location / access`

---

## 5. Rules of Thumb

Current state:
- Observe rules-of-thumb panel is still simple but improved.
- It now tries to read from the relevant refrigeration-side component and its metering device rather than always trusting the first visible component.

Future intended direction:
- rules-of-thumb should continue becoming more configuration-aware
- side-kick diagnostic mode should eventually send structured job/system/measurement context to ChatGPT for tricky cases
- this should remain assistive, not an autonomous diagnosis engine

---

## 6. Planning Board Status

### What exists in code now
- Add Job modal
- Tech lanes
- Drag/drop reassignment
- Manual reassignment
- Diagnostic banner for planning update failures
- RPC-backed assignment path

### Things to verify in live testing
- drag/drop reassignment persists correctly
- manual reassignment persists correctly
- reassigned jobs remain visible after move

Because planning behavior was recently stabilized via new RLS/RPC migrations, this area should always be re-verified after environment changes.

---

## 7. Branding / UI Direction

Brand reference: `Legend Service Pros`

### Current direction
- darker charcoal header
- warm ivory / cream work surfaces
- champagne / gold accents
- less generic admin-tool feel

### Still wanted
- stronger contrast overall
- tighter brand consistency across all major screens
- more purposeful typography / hierarchy
- continued cleanup of tech screens so they feel fast and field-first

---

## 8. Known Open Work

### Product / feature work
- Invoice PDF generation is still not fully wired.
- Invoice email sending is still not fully wired.
- Invoice PDF storage/linking is still not fully wired.
- In-app user management/admin editing UI still needs to be built.

### UX / polish
- More contrast and visual polish still needed.
- Continue mobile-first cleanup of Arrive/Observe/Diagnose/Work screens.
- Continue tightening planning-board interactions and feedback.

### Diagnostic intelligence
- Expand rules-of-thumb logic
- Add side-kick diagnostic mode powered by ChatGPT using structured field/job/system inputs

---

## 9. Important Files

### Planning
- [page.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\planning\page.tsx)
- [PlanningBoard.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\planning\PlanningBoard.tsx)
- [actions.ts](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\planning\actions.ts)

### Tech flow
- [page.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\page.tsx)
- [JobFlow.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\JobFlow.tsx)
- [Step1Arrive.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\Step1Arrive.tsx)
- [Step2Observe.tsx](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\Step2Observe.tsx)
- [actions.ts](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\actions.ts)
- [types.ts](C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app\app\jobs\[id]\types.ts)

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

### Recent known non-blocking issue
- Repo-wide lint is not clean because of pre-existing unrelated issues elsewhere in the project.

### Supabase auth dev note
- Hosted password recovery emails can hit Supabase rate limits quickly in dev.
- Manual password reset through the Supabase dashboard may be needed when testing locally.

---

## 11. Recommended Next Priorities

1. Re-verify planning reassignment end-to-end after all migrations are applied.
2. Continue tech-flow polish, especially mobile readability and spacing.
3. Improve rules-of-thumb logic and start designing the AI side-kick diagnostic mode.
4. Resume Phase 8 invoice PDF/email/storage integration.

