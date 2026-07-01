# Legend Service Pros v1.0 Delivery Package

Last updated: 2026-06-30

## 1. Decision

Build v1.0 on top of the current `lsp-app` in this workspace.

Do not restart from a blank repo.
Do not switch to the older `LSP-PM Engine` as the primary codebase.
Do not let Build 1 expand beyond the field-service golden path in the current spec.

## 2. Product Contract

The current product contract comes from [legend_field_service_platform_spec_v0_5.html](C:\Users\matt.raab\Downloads\legend_field_service_platform_spec_v0_5.html).

Build 1 proves this loop in real company use:

`service request -> technician assignment -> today's jobs -> active visit -> note/status -> repair or parts needed -> invoice-ready record`

### Build 1 included scope

- Preserve or migrate existing property, contact, team-member, and relevant historical records.
- Make the `Service Request` and `Service Visit` distinction live in the application.
- Create a fast mobile-first `Home` screen.
- Create a simple `Today's Jobs` screen for assigned service visits.
- Create a `Quick Add Job` flow that can create a request in under 30 seconds.
- Create an `Active Visit` flow with status updates, access notes, basic notes, repair selection, parts-needed option, completion, and `+ Add Unit`.
- Generate a basic invoice-ready record from the completed visit and selected repair(s).
- Provide basic offline protection: cached assigned jobs, local draft saving, queued writes, and visible sync state.

### Explicitly out of scope for Build 1

- Full dispatch/calendar redesign
- Deep analytics
- Automated texting
- Full inventory
- Major-job checklist enforcement
- Voice transcription and AI action execution
- AI diagnostic assistance
- Full offline conflict engine

## 3. Foundation Decision

### Keep

- `Next.js 16 + React 19 + Supabase + Vercel` in [package.json](C:\Users\matt.raab\Documents\LSP Operations\package.json)
- Current auth/session foundation
- Current planning assignment mechanics in [app/planning](C:\Users\matt.raab\Documents\LSP Operations\app\planning)
- Current customer/location/unit/system records in [app/customers](C:\Users\matt.raab\Documents\LSP Operations\app\customers)
- Current repair catalog and seed/import work in [app/catalog](C:\Users\matt.raab\Documents\LSP Operations\app\catalog)
- Current invoice snapshot foundation in [supabase/migrations/027_repair_templates_and_invoice_snapshots.sql](C:\Users\matt.raab\Documents\LSP Operations\supabase\migrations\027_repair_templates_and_invoice_snapshots.sql)

### Re-scope

- The current app shell in [app/components/AppShell.tsx](C:\Users\matt.raab\Documents\LSP Operations\app\components\AppShell.tsx)
- The current root redirect in [app/page.tsx](C:\Users\matt.raab\Documents\LSP Operations\app\page.tsx)
- The technician workflow in [app/jobs/[id]](C:\Users\matt.raab\Documents\LSP Operations\app\jobs\[id])
- The meaning of the current `jobs` object and surrounding lifecycle UI

### Reference only

- [C:\Users\matt.raab\Desktop\LSP-PM Engine](C:\Users\matt.raab\Desktop\LSP-PM%20Engine)

That codebase is a PM/site-survey product on `Prisma + embedded Postgres`. It is useful for ideas, not as the v1.0 shipping base.

## 4. Current-State Audit

### What already exists and is usable

- Authenticated routing and role-based profile loading
- Dispatcher planning board and assignment actions
- Customer/location/unit/system hierarchy
- Technician job workflow with arrival, observation, diagnosis, work, and close steps
- Repair catalog and admin editing surface
- Invoice queue/detail and invoice snapshot persistence
- Supabase migrations for lifecycle, workflows, messages, estimates, parts, and invoice snapshots

### What is mismatched to the spec

#### 1. The app opens into planning, not a field-first home

[app/page.tsx](C:\Users\matt.raab\Documents\LSP Operations\app\page.tsx) currently redirects everyone to `/planning`.

That conflicts with the spec's requirement for a central, mobile-first home screen.

#### 2. The shell is too broad for Build 1

[app/components/AppShell.tsx](C:\Users\matt.raab\Documents\LSP Operations\app\components\AppShell.tsx) exposes a desktop-style top nav with `Planning`, `Jobs`, `Admin`, `Estimates`, `Invoices`, and `Customers`.

That is fine for internal admin use, but not as the primary v1.0 operating surface for techs and owner-techs.

#### 3. The current workflow is denser than the Build 1 golden path

[app/jobs/[id]](C:\Users\matt.raab\Documents\LSP Operations\app\jobs\[id]) already has meaningful workflow logic, but Build 1 wants a shorter loop:

- status
- access
- quick note
- repair or parts needed
- complete
- `+ Add Unit`

The current flow is closer to an expanded internal operating system than a first field-usable mobile flow.

#### 4. The data model is lifecycle-aware but not yet request/visit-explicit

[supabase/migrations/022_job_lifecycle_model.sql](C:\Users\matt.raab\Documents\LSP Operations\supabase\migrations\022_job_lifecycle_model.sql) adds strong lifecycle concepts on `jobs`, but the spec now requires a live distinction between `Service Request` and `Service Visit`.

#### 5. Offline requirements are not yet first-class

The spec requires cached assigned jobs, local draft saving, queued writes, and visible sync state. The current app is not yet organized around local-first field behavior.

#### 6. Build 1 should stop earlier than the current commercial sprawl

The repo already contains estimates, parts sourcing, invoice approval, and broader admin complexity. Those are useful, but they should sit behind the golden path rather than define it.

## 5. Recommended v1.0 Architecture

### Guiding principle

Keep current data and working routes alive where possible, but introduce a cleaner Build 1 operating model on top of them.

### Data-model strategy

Do not rename or destroy the existing `jobs` table first.

Instead:

- Treat current `jobs` as the legacy operational object to preserve.
- Introduce explicit `service_requests` and `service_visits` tables.
- Link them back to legacy `jobs` during the transition.
- Keep invoice-ready snapshots and repair-template snapshots as durable historical artifacts.

### Recommended new Build 1 tables

- `service_requests`
- `service_visits`
- `visit_notes`
- `visit_repairs`
- `visit_parts_needed`

### Existing tables to continue using

- `customers`
- `locations`
- `units`
- `systems`
- `users`
- `repair_bundles`
- `repair_bundle_lines`
- `job_invoice_snapshots`

### Transitional rules

- Existing `jobs` records remain readable.
- New Build 1 flows should create `service_requests` and a first `service_visit`.
- If necessary, mirror critical status fields back to `jobs` for legacy screens until cutover is complete.
- Historical invoicing records remain in place and are not rewritten.

## 6. Recommended Screen Strategy

### Primary Build 1 screens

#### Home

Purpose: one fast operating entry point for owner-techs and field techs.

Targets:

- `Today's Jobs`
- `Add Job`
- `Update Job`
- `Parts/Waiting`
- `Dashboard`

#### Today's Jobs

Purpose: show assigned visits only.

Visible fields:

- property
- unit
- complaint
- status
- priority
- contact/access indicator
- parts/follow-up flag

#### Quick Add Job

Purpose: create a request in under 30 seconds.

Fields:

- property
- unit
- reported issue
- priority
- optional contact/access note
- assign tech now or leave unassigned

#### Active Visit

Purpose: the field work loop.

Actions:

- en route
- arrived
- access note
- quick note
- select repair
- mark parts needed
- complete
- `+ Add Unit`

### Secondary screens that remain available but are not the product center

- Planning
- Catalog admin
- Customers admin/detail
- Invoice review
- Estimates

## 7. Concrete Gap Map

### Gap A: App shell and landing flow

Current:

- [app/page.tsx](C:\Users\matt.raab\Documents\LSP Operations\app\page.tsx) sends everyone to planning.
- [app/components/AppShell.tsx](C:\Users\matt.raab\Documents\LSP Operations\app\components\AppShell.tsx) is optimized for broad internal navigation.

Needed:

- role-aware landing into `Home`
- mobile-first home tiles/actions
- admin tools available, but not dominant

### Gap B: Request vs visit distinction

Current:

- lifecycle states exist on `jobs`
- assignment and workflow exist, but under a single main object

Needed:

- explicit `service_request`
- explicit `service_visit`
- ability for one request to produce multiple visits
- ability to create `+ Add Unit` visits cleanly

### Gap C: Quick update flow

Current:

- notes/messages exist, but they are embedded in larger screens

Needed:

- an ultra-fast path for note, access, approval, timing, and status changes

### Gap D: Build 1 repair outcome model

Current:

- diagnosis, repair bundles, ad hoc bundles, parts sourcing, and invoices exist

Needed:

- one clean Build 1 outcome per visit:
  - repair selected
  - parts needed
  - closed no action
- invoice-ready record created on completion

### Gap E: Offline behavior

Current:

- standard web app behavior

Needed:

- cached assigned jobs
- local draft persistence
- queued writes
- visible sync badge/state

## 8. Delivery Plan

### Milestone 0: Protect data and create the cutover lane

Goal:

Create a safe branch and preserve all current data structures before Build 1 refactor work starts.

Deliverables:

- full schema audit
- migration plan
- route inventory
- smoke-test baseline
- production backup checklist

Exit criteria:

- we know what exists
- we know what must be preserved
- we know what can be sidelined

### Milestone 1: Make request/visit real

Goal:

Introduce the Build 1 operating model without breaking existing records.

Deliverables:

- migration adding `service_requests` and `service_visits`
- visit statuses and resolution states
- transitional read models or server helpers
- mapping from current `jobs` to Build 1 objects

Exit criteria:

- new service work can be represented as request plus visit
- legacy records remain available

### Milestone 2: Replace the shell with a field-first surface

Goal:

Make the app feel like the product described in the spec.

Deliverables:

- new `Home`
- new `Today's Jobs`
- new mobile nav/footer pattern
- role-aware landing behavior

Exit criteria:

- a tech or owner-tech can log in and operate from the home screen on a phone

### Milestone 3: Ship the fast intake/update loop

Goal:

Make daily office and field updates painless.

Deliverables:

- `Quick Add Job`
- `Quick Update Job`
- `+ Add Unit`
- assignment handoff into today's queue

Exit criteria:

- a request can be created in under 30 seconds
- a live job can be updated without entering the full visit flow

### Milestone 4: Finish Active Visit and invoice-ready output

Goal:

Close the main service loop cleanly.

Deliverables:

- simplified `Active Visit`
- repair selection
- parts-needed outcome
- visit completion
- invoice-ready snapshot generation

Exit criteria:

- completed visit always produces a stable billing output or a clean follow-up state

### Milestone 5: Offline and pilot hardening

Goal:

Make the app trustworthy for the field.

Deliverables:

- assigned-job cache
- local drafts
- queued writes
- visible sync status
- mobile layout polish
- pilot test scripts

Exit criteria:

- work survives refresh, relogin, and temporary connectivity loss

### Milestone 6: Launch

Goal:

Put v1.0 in real team hands with supportable operations.

Deliverables:

- staging signoff
- pilot rollout
- production cutover checklist
- support triage plan

Exit criteria:

- the team can use the app for real calls
- the top failure modes have been rehearsed

## 9. Concrete Build Backlog

### Workstream A: Data and server actions

1. Add Build 1 request/visit tables and policies.
2. Create server helpers to load a visit-centered queue.
3. Create request creation and visit creation actions.
4. Add visit-note and quick-update actions.
5. Add visit-repair and parts-needed actions.
6. Add invoice-ready snapshot generation from visit completion.

### Workstream B: Home and navigation

1. Replace root landing behavior.
2. Introduce a phone-first home screen.
3. Replace the broad top-nav-first shell with a more focused role-aware shell.
4. Keep admin routes accessible but secondary.

### Workstream C: Technician flow

1. Convert the current five-step flow into a tighter Build 1 visit flow.
2. Preserve existing good logic from [app/jobs/[id]/actions.ts](C:\Users\matt.raab\Documents\LSP Operations\app\jobs\[id]\actions.ts).
3. Add `+ Add Unit` from the active visit context.
4. Add a clear parts-needed finish state.

### Workstream D: Office speed tools

1. Pull quick intake out of the planning board into a dedicated fast form.
2. Build quick update for phone-call facts and access changes.
3. Keep dispatcher planning as a secondary coordination tool.

### Workstream E: Reliability and rollout

1. Add local persistence for unsynced drafts.
2. Add sync status feedback.
3. Create smoke tests for login, add job, assign, open visit, repair, parts-needed, and completion.
4. Create a production launch checklist.

## 10. First 12 Coding Tickets

1. Add a `docs/build-1-object-map` equivalent in code comments or notes so old `jobs` and new request/visit concepts stay aligned during refactor.
2. Add `service_requests` migration.
3. Add `service_visits` migration.
4. Add `visit_notes` and `visit_repairs` migrations.
5. Add `visit_parts_needed` migration.
6. Create server loaders for `Home` and `Today's Jobs`.
7. Replace [app/page.tsx](C:\Users\matt.raab\Documents\LSP Operations\app\page.tsx) redirect behavior.
8. Build `Home` route and focused shell.
9. Build `Quick Add Job`.
10. Build `Quick Update Job`.
11. Simplify active visit UI around the spec actions.
12. Generate invoice-ready records from visit completion.

## 11. Launch Readiness Gates

v1.0 does not launch until all of the following are true:

- A request can be created in under 30 seconds.
- A request can be assigned to a technician.
- A technician can open the assigned visit from `Today's Jobs`.
- A technician can add a note and change status.
- A technician can select a repair or mark parts needed.
- A technician can use `+ Add Unit` onsite and create a separately billable path.
- A completed visit produces an invoice-ready record.
- The mobile UI works without horizontal scrolling.
- Data survives refresh, logout/login, and temporary connectivity loss.
- Legacy records remain available or are migrated safely.

## 12. Recommended Rollout Strategy

### Stage 1: Local and staging

- finalize schema
- run smoke tests against real-ish seed data
- verify auth, storage, and email config

### Stage 2: Owner-only pilot

- use it yourself for live or simulated calls
- force the full Build 1 loop repeatedly
- log every point of hesitation

### Stage 3: Small-team pilot

- give 1 to 2 technicians the new home/today/visit flow
- keep office/admin tools available behind the scenes
- do daily review of friction and missing states

### Stage 4: Full internal rollout

- cut remaining daily users over
- preserve fallback visibility into legacy records
- reserve a rapid-fix window after rollout

## 13. Recommendation for the Next Working Session

Start Milestone 0 and Milestone 1 immediately.

The next implementation move should be:

1. define the Build 1 object map from current `jobs` to `service_requests` and `service_visits`
2. add the new schema
3. build the new `Home` and `Today's Jobs` shell
4. then refactor intake and active visit against that model

This sequence gives the project a real shipping lane instead of another broad rebuild.
