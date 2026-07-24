# HVAC Field Service App - Developer Context v8
> This document is for future developers, not just for preserving history.
> Start here before making product, schema, workflow, or deployment changes.
> This file supersedes `HVAC_App_Project_Context_v7.md`.

---

## 0. Purpose

This app is not a generic ticketing tool. It is being shaped into an internal operating system for a small HVAC service business.

The core automation goal is:
- reduce owner/admin time spent on scheduling, field coordination, repair selection, estimates, invoicing, and follow-up work
- preserve one continuous operational record from the initiating call through final resolution

The most important product insight that changed after v7:
- a job does **not** always end as a standard repair or ad-hoc repair
- a job can resolve into:
  - standard repair
  - ad-hoc repair
  - repair estimate
  - parts sourcing
  - major repair
  - install / changeout
  - closed / no further action

This means the long-term architecture needs to support a **job lifecycle**, not just a 5-step tech visit.

---

## 1. Current Snapshot

**Project folder:** `C:\Users\Matt\Desktop\ALL MATTS PROJECTS\lsp-app`  
**GitHub repo:** `https://github.com/mrjmr68/lsp-app`  
**Live app:** `https://lsp-app.vercel.app`  
**Stack:** Next.js 16.2.1 + React 19 + Supabase + Vercel + Resend  
**Supabase project ref:** `ifneznpvppgqlfidwysi`

### Current product state
- Planning board is live.
- Jobs tab is live.
- Admin hub is live.
- Customer/location/unit/system management is live.
- Standard tech flow is live.
- Owner invoice review/approval is live.
- Invoice PDF generation + storage + email delivery are implemented.
- Shared crew workflow for installs / major repairs has been added in the local codebase and pushed to GitHub.

### Current local code milestone
Recent major additions beyond v7:
- invoice pipeline completed
- deployment/README hardening
- recent closed jobs view
- mobile shell cleanup
- shared install / major-repair workflow
- job-based crew messaging with quick buttons
- planning support for workflow type at job creation

### Important deployment note
The live app will not show the shared workflow feature unless the target Supabase project has migration `021_job_workflows_and_messages.sql` applied.

---

## 2. How To Read The System

Think of the system in 4 layers:

1. **Planning / Intake**
- create jobs
- assign lead tech
- now beginning to support workflow type and multi-tech planning

2. **Field Workflow**
- service flow:
  - Arrive
  - Observe
  - Diagnose
  - Repair
  - Close
- shared crew workflow for install / major repair:
  - shared materials checklist
  - shared prep checklist
  - shared execution checklist
  - shared crew message feed
  - shared closeout checklist

3. **Admin / Catalog / Users**
- catalog import
- user editing
- operational admin controls

4. **Invoice / Closeout**
- owner review
- PDF generation
- email send
- invoice storage

Future work should usually be framed in terms of which layer it belongs to.

---

## 3. Product Model: Current Truth

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

### Existing service-call logic
Standard service jobs still use the current 5-step flow.

That flow is now reasonably stable for:
- arrival/context
- observation capture
- diagnosis selection
- repair bundle selection
- closeout to owner review

### New shared-workflow logic
Install and major-repair work is beginning to use a **shared crew workflow**.

Current intent:
- owner/admin/dispatcher can start an `Install` or `Major Repair` workflow from `Arrive`
- whole crew shares:
  - materials checklist
  - prep checklist
  - execution checklist
  - crew message feed
  - closeout checklist

### Important product direction
The business wants the **same job** to remain the continuous record of the initiating call.

That means future design should prefer:
- one job
- multiple lifecycle stages
- one final invoice

over:
- spawning unrelated child jobs for each phase

That design decision is not fully implemented yet, but it is now the intended direction.

---

## 4. Current Workflow Features In Code

### Standard service workflow
Implemented in:
- `app/jobs/[id]/JobFlow.tsx`
- `Step1Arrive.tsx`
- `Step2Observe.tsx`
- `Step3Diagnose.tsx`
- `Step4Work.tsx`
- `Step5Close.tsx`

### Shared install / major-repair workflow
Implemented in:
- `app/jobs/[id]/InstallWorkspace.tsx`
- `app/jobs/[id]/Step1Arrive.tsx`
- `app/jobs/[id]/JobFlow.tsx`
- `app/jobs/[id]/Step5Close.tsx`
- `app/jobs/[id]/actions.ts`
- `utils/job-workflows.ts`

Current shared workflow features:
- start workflow from Arrive
- workflow types:
  - `install`
  - `major_repair`
- shared checklist items for:
  - `prep`
  - `materials`
  - `execution`
  - `closeout`
- quick crew message buttons:
  - `Power Off`
  - `Nitrogen - Braze`
  - `Nitrogen - Test`
  - `Lineset Purge`
  - `Vacuum Started`
  - `Vacuum Passed`
  - `Power On`
  - `Charge Started`
  - `Startup Complete`
- realtime refresh wiring for messages and workflow items

### Current limitation
This is a first vertical slice, not the full lifecycle model.

It does **not** yet cover:
- repair estimate generation from diagnosis
- parts sourcing workflow
- vendor email flow
- approval-to-follow-up lifecycle
- same-job estimate/parts/install state transitions

---

## 5. Database / Migration Truth

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

### Migration 019
Adds:
- invoice role protections
- ad-hoc bundle hardening

### Migration 020
Adds:
- invoice PDF storage support

### Migration 021
Adds:
- `jobs.workflow_type`
- `job_workflows`
- `job_workflow_items`
- `job_messages`
- `can_access_job_workspace(...)`
- realtime publication wiring for workflow tables

### Current schema tensions to be aware of
- `jobs` is still doing too much
- `status` is still closer to a service-call model than a true lifecycle model
- `job_tech` exists and should become more important
- shared workflow has begun, but estimate/parts/follow-up lifecycle is not yet represented in the schema

---

## 6. Auth / Roles / Access

Roles:
- `tech`
- `dispatcher`
- `admin`
- `owner`

Important current behavior:
- invoice approval is owner-focused
- shared workflow start on Arrive is currently visible to:
  - `owner`
  - `admin`
  - `dispatcher`
- shared workflow participation is intended for assigned crew

Important developer note:
- RLS in this repo evolved over time
- some older job access is broad/authenticated for expediency
- new shared-workspace data should be treated more carefully

Use `can_access_job_workspace(job_id)` as the mental model for new shared-workflow data.

---

## 7. Deployment / Environment Truth

### Required environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `INVOICE_FROM_EMAIL`

### Storage buckets expected
- `job-photos`
- `invoice-pdfs`

### Current deployment dependencies
- Vercel project must point at the same GitHub repo
- Supabase Auth URL configuration must include the Vercel domain
- Resend sender must be verified

### Important deployment mismatch to watch
If code is pushed but the feature is missing live, check these in order:
1. latest GitHub commit is actually deployed in Vercel
2. correct Supabase project is being used by Vercel env vars
3. latest migration has been applied
4. the job/data you are testing actually meets the feature conditions

---

## 8. What Is Stable vs Unsettled

### Stable enough to build on
- planning board core
- customer hierarchy model
- standard observation/diagnosis/repair flow
- invoice PDF/email/storage pipeline
- admin catalog/user tools

### In-progress but real
- shared install / major-repair workflow
- multi-tech thinking using `job_tech`
- workflow type selection at planning/create time

### Still unsettled
- full job lifecycle/state model
- estimate path
- parts sourcing / vendor communication
- same-job follow-up execution model
- when and how follow-up work is scheduled within the same job
- exact semantics of closed vs cancelled vs completed vs invoiced in the new lifecycle

Future developers should assume these unsettled areas require design validation before schema work.

---

## 9. Immediate Product Direction

The next meaningful architecture step is **not** more UI polish.

It is a lifecycle redesign.

### Intended direction
One job remains the record of the originating customer issue.

That job may progress through:
- diagnosis
- estimate
- approval
- parts sourcing
- follow-up work
- final completion
- final invoice

### Recommended future separation
Keep these concepts separate:

1. **Job status**
- where the job is operationally

2. **Resolution type**
- what the job became
- examples:
  - `standard_repair`
  - `adhoc_repair`
  - `repair_estimate`
  - `major_repair`
  - `install`
  - `monitor_only`

3. **Crew model**
- lead tech
- assist techs

4. **Commercial state**
- estimate needed
- approval pending
- parts ordered
- ready to schedule

Do not overload one field to carry all of that.

---

## 10. Recommended Next Implementation Order

If a future developer picks this up, the recommended order is:

1. **Finalize the lifecycle/status model**
- make it generic enough for repairs and installs
- do not hard-code “changeout only” language into shared states

2. **Multi-tech job creation**
- allow selecting up to 4 techs at create time
- one lead tech
- assistants stored in `job_tech`

3. **Repair estimate path**
- create estimate data model
- build PDF generation
- allow owner/admin approval workflow

4. **Parts sourcing path**
- parts-needed lines
- ordered/not-ordered tracking
- vendor + ETA
- optional vendor email send

5. **Same-job follow-up scheduling**
- continue the same originating job into execution phases

6. **Invoice integration with lifecycle**
- ensure major repair / install resolution paths invoice cleanly at the end

---

## 11. Known Developer Traps

1. **Do not assume the live database matches local code**
- always confirm migrations

2. **Do not treat install workflow as complete architecture**
- it is a first slice, not the final lifecycle system

3. **Do not assume standard service statuses are sufficient**
- they are already being outgrown

4. **Do not ignore `job_tech`**
- multi-tech support should build on it, not around it

5. **Do not begin a new session from memory alone**
- use this file plus current migrations/code

6. **This Next.js version has breaking changes**
- read the local docs in `node_modules/next/dist/docs/` before changing framework-level behavior

---

## 12. Session Startup Checklist

At the start of a new development session:

1. Read this file.
2. Check `git status`.
3. Confirm which Supabase project is being targeted.
4. Confirm latest migrations are applied.
5. Verify whether the task is about:
   - standard service workflow
   - shared crew workflow
   - lifecycle redesign
   - invoicing
   - planning/admin
6. If the task touches lifecycle/status/schema, re-check the unsettled-direction notes above before implementing.

---

## 13. Short Summary For The Next Developer

The app started as a service workflow + invoicing tool.

It is now becoming a full job-lifecycle system.

The most important current truth is:
- keep one job as the continuous record
- support branching outcomes from diagnosis
- use shared crew workflow for bigger follow-up work
- do not confuse “what stage the job is in” with “what kind of resolution the job became”

If you understand that, you will make much better decisions in this codebase.
