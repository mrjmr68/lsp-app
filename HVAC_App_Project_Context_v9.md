# HVAC Field Service App - Developer Context v9
> This document is for future developers, not just for preserving history.
> Start here before making product, schema, workflow, or deployment changes.
> This file supersedes `HVAC_App_Project_Context_v8.md`.

---

## 1. Purpose

This app is not a generic ticketing tool. It is being shaped into an internal operating system for a small HVAC service business.

The long-term automation goal is:
- reduce owner/admin time spent on scheduling, field coordination, repair selection, estimates, invoicing, and follow-up work
- preserve one continuous operational record from the initiating call through final resolution

The most important current product truth:
- one job should remain the continuous record from intake through estimate, parts, follow-up work, execution, and final invoice

The newest major product shift:
- the next major UI direction is an `active job hub` for all field jobs
- the current stepper-style field UI is no longer considered the long-term execution model

---

## 2. Current Snapshot

**Project folder:** `C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app`  
**GitHub repo:** `https://github.com/mrjmr68/lsp-app`  
**Live app:** `https://lsp-app.vercel.app`  
**Stack:** Next.js 16.2.1 + React 19 + Supabase + Vercel + Resend  
**Supabase project ref:** `ifneznpvppgqlfidwysi`

### Current release milestone

The current codebase now includes:
- lifecycle/commercial-state foundation
- multi-tech planning
- estimate lane
- parts sourcing
- same-job follow-up scheduling
- final invoice integration
- relay-board v1 for shared install / major-repair jobs

### Important recent note

After the workflow-foundation release commit, a Vercel TypeScript blocker on jobs/planning relation casts was fixed and pushed separately. Vercel type-checking is now clean on the current `main` branch.

---

## 3. How To Read The System

Think of the system in 5 layers:

1. **Planning / Intake**
- create jobs
- assign lead tech and assist crew
- define the initial operational path

2. **Active Field Jobs**
- current standard service-call execution
- current shared install / major-repair execution
- future active-job hub for all field jobs

3. **Commercial / Estimate / Parts / Follow-up**
- estimate creation and review
- parts sourcing and vendor outreach
- same-job follow-up scheduling

4. **Admin / Catalog / Users**
- catalog import and editing
- user management
- operational controls

5. **Invoice / Finalization**
- owner review
- final invoice generation
- PDF storage and delivery

Future work should usually be framed in terms of which layer it belongs to.

---

## 4. Product Model: Current Truth

### Customer hierarchy

The database model remains:
- `Customer -> Location -> Unit -> System`

UI behavior remains type-aware:
- `commercial`, `facilities_provider`
  - flatter UI
  - hidden default unit behind the scenes
- `property_management`, `residential`
  - nested UI
  - units are first-class in the experience

### System model

One physical cabinet = one `systems` row.

Grouped equipment uses `group_name`.

Examples:
- heat pump:
  - `CU`
  - `AHU`
- AC / furnace:
  - `CU`
  - `Furnace`
  - `Coil`

### Lifecycle model

The `jobs` model now separates:
- `job_status`
- `resolution_type`
- `commercial_state`

Legacy `status` still exists and is kept in sync for compatibility with older surfaces.

### Current field execution truth

Field execution currently exists in two patterns:

1. **Standard one-shot jobs**
- still use the legacy step flow
- arrive -> observe -> diagnose -> repair -> close

2. **Shared install / major-repair jobs**
- use the relay/checklist workspace
- shared prep/materials/execution behavior
- live relay-based handoffs between crew members

These two patterns are both transitional. The product direction is for both to converge into the future active-job hub.

---

## 5. Current Workflow Features In Code

### Standard service workflow

Still implemented in:
- `app/jobs/[id]/JobFlow.tsx`
- `app/jobs/[id]/Step1Arrive.tsx`
- `app/jobs/[id]/Step2Observe.tsx`
- `app/jobs/[id]/Step3Diagnose.tsx`
- `app/jobs/[id]/Step4Work.tsx`
- `app/jobs/[id]/Step5Close.tsx`

### Shared install / major-repair workflow

Currently implemented in:
- `app/jobs/[id]/InstallWorkspace.tsx`
- `app/jobs/[id]/JobFlow.tsx`
- `app/jobs/[id]/Step1Arrive.tsx`
- `app/jobs/[id]/Step5Close.tsx`
- `app/jobs/[id]/actions.ts`
- `app/jobs/[id]/types.ts`
- `utils/job-workflows.ts`

Current shared-workflow behavior includes:
- shared prep/materials/execution support
- structured FO/FI relay board v1
- crew notes as a secondary lane
- realtime refresh wiring

### Same-job lifecycle path now in code

Beyond the field execution surfaces, the same-job lifecycle now extends through:
- estimate creation and review
- estimate PDF generation
- parts sourcing and vendor email workflow
- same-job follow-up scheduling
- invoice review with estimate context carried forward

### Current architectural note

The active-job hub architecture is now the target direction, but it is not implemented yet. Current field execution should be treated as a transitional surface, not the final field UX.

---

## 6. Database / Migration Truth

### Migrations currently expected by local code

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
- `011_user_profile_sync.sql`
- `012_system_context.sql`
- `013_jobs_crud_rls.sql`
- `014_assign_job_rpc.sql`
- `015_jobs_read_authenticated.sql`
- `016_system_component_ratings.sql`
- `017_job_observation_circuits.sql`
- `018_catalog_insert_rls.sql`
- `019_invoice_owner_and_adhoc.sql`
- `020_invoice_pdf_storage.sql`
- `021_job_workflows_and_messages.sql`
- `022_job_lifecycle_model.sql`
- `023_planning_multi_tech.sql`
- `024_job_estimates.sql`
- `025_job_parts_sourcing.sql`
- `026_job_message_relays.sql`

### Current schema guidance

For the next design pass:
- the current data structure is considered acceptable
- future work should prefer additive schema changes only if the new UI truly requires them
- the main gap is UI/interaction architecture, not schema architecture

Important schema tensions still to keep in mind:
- `jobs` still carries a lot of responsibility
- legacy `status` still exists for compatibility
- `job_tech` matters more now for crew-aware execution
- shared workflow data is useful, but the UI around it is not final

---

## 7. Auth / Roles / Access

Roles:
- `tech`
- `dispatcher`
- `admin`
- `owner`

Important current behavior:
- invoice approval remains owner-focused
- shared workflow start on Arrive is currently available to:
  - `owner`
  - `admin`
  - `dispatcher`
- shared workflow participation is intended for the assigned crew

Important developer note:
- RLS evolved over time
- some older job access remains broader than ideal for expediency
- new shared-workspace behavior should continue to use `can_access_job_workspace(job_id)` as the mental model

---

## 8. Deployment / Environment Truth

### Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `INVOICE_FROM_EMAIL`

### Storage buckets expected

- `job-photos`
- `invoice-pdfs`

### Deployment mismatch checklist

If code is pushed but the feature is missing or behaving differently live, check these in order:
1. latest GitHub commit is actually deployed in Vercel
2. correct Supabase project is being used by Vercel env vars
3. latest migration has been applied
4. the job/data being tested actually meets the feature conditions

### Current build note

Vercel type-checking is now clean on the current branch. Local sandboxed builds may still fail on external Google Fonts fetches for `Geist` / `Geist Mono` in `app/layout.tsx`, which is an environment-specific build annoyance rather than the current live deployment blocker.

---

## 9. Active Product Direction

The old framing of “shared workflow is the main next step” is no longer enough.

Current field feedback indicates:
- field UI must be rebuilt from first principles
- the interface is too crowded
- the header is too heavy on active job pages
- techs need focused, mobile-first, context-aware screens
- the app should rely on more individual pages and fewer expanding surfaces
- OCR model/serial capture should become a first-class field tool
- live crew coordination should be request/response based, not generic messaging
- the same hub structure should serve both one-shot and shared jobs

In short:
- the data structure is usable
- the field interaction model is not

---

## 10. Immediate Design Target

The near-term target is an **active-job hub** for every field job.

That target means:
- dedicated job shell
- route-based focused pages instead of a stepper
- one shared hub structure across job types

Planned centers:
- hub home
- context
- documentation
- diagnosis
- planning
- logistics
- crew center for shared jobs only

Important behavior rules:
- solo jobs use the same hub structure but do not show crew coordination
- shared jobs use the same hub structure, with live crew coordination surfaced where it matters
- planning remains intentionally high level in this phase

This should be treated as the primary product direction for the next major field UX pass.
