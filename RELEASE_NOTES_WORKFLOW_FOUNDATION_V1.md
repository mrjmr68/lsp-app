# Workflow Foundation + Relay Board v1

Release date target: March 30, 2026

## Summary

This release establishes the first end-to-end job lifecycle foundation beyond standard same-day service.

The core shift is that one job now stays the continuous system of record from intake through estimate review, parts sourcing, follow-up scheduling, field execution, and final invoice. In parallel, the shared install / major-repair workspace now uses a structured FO/FI relay execution board instead of the earlier generic messaging direction.

## Included in this release

### Lifecycle and commercial state foundation

- Added explicit `job_status`, `resolution_type`, and `commercial_state` lifecycle fields.
- Preserved legacy `status` sync so existing surfaces can transition safely.
- Added shared lifecycle metadata helpers for planning, jobs, estimates, and invoices.

### Multi-tech planning

- Planning supports a lead tech plus assist crew at creation time.
- Planning detail tools can manage assist crew after creation.

### Estimate lane

- Tech closeout can route a diagnosed job into estimate review instead of direct invoice.
- Added same-job estimate storage, review UI, and PDF generation.
- Added estimate queue and estimate detail management surfaces.

### Parts sourcing

- Added job-level parts requests with per-line part needs.
- Added vendor email draft/send flow.
- Added parts state transitions from approved estimate to ordered parts to ready-to-schedule.

### Same-job follow-up scheduling

- `ready_to_schedule` jobs can be booked back into the schedule without creating a second job.
- Scheduling stamps date, crew, queue position, and returns the job to operational flow.
- Arrival on a scheduled revisit now promotes the job into `follow_up_active`.

### Final invoice integration

- Invoice review now carries estimate context into final approval.
- Customer-facing invoice summary prefers the saved estimate scope when present.
- Invoice review surfaces estimate number and parts trail for same-job follow-up work.

### Shared install / major-repair relay board v1

- Shared execution surface uses a single relay-board model for FO/FI handoff.
- Relay sequence:
  - `FO Recovery complete`
  - `FI Ready to purge`
  - `FO OK to purge`
  - `FI Ready to braze`
  - `FO Nitrogen flowing`
  - `FI Ready to test`
  - `FO Test on`
  - branch to `FO/FI Leak here` looping back to `FI Ready to braze`
  - or `FO Test holding`
  - `FO Vac pulling`
  - `FO Vac good`
- Relay writes are state-validated and cycle-aware.
- Work is intentionally isolated to:
  - `app/jobs/[id]/InstallWorkspace.tsx`
  - `app/jobs/[id]/actions.ts`
  - `app/jobs/[id]/types.ts`
  - `supabase/migrations/026_job_message_relays.sql`

## Migrations in this release

Apply in order if not already present on the target database:

- `022_job_lifecycle_model.sql`
- `023_planning_multi_tech.sql`
- `024_job_estimates.sql`
- `025_job_parts_sourcing.sql`
- `026_job_message_relays.sql`

## Verification status

Completed:

- Targeted ESLint passes on the touched estimate, invoice, and relay surfaces.
- Filtered type-checking for the relay lane passed.
- Release migrations are present in the repo through `026`.

Known existing blockers outside this release scope:

- `npm run build` is still blocked by external Google Fonts fetch failures for `Geist` and `Geist Mono` in `app/layout.tsx`.
- Full-repo `npx tsc --noEmit` still reports pre-existing relation-typing issues in:
  - `app/jobs/[id]/page.tsx`
  - `app/jobs/page.tsx`
  - `app/planning/page.tsx`

These blockers are not introduced by this release slice and should be tracked as repo-hardening follow-up work.

## Recommended release framing

Position this as:

- workflow foundation release
- shared relay board v1
- same-job commercial path release

Do not position it as:

- final workflow architecture
- final polished install/major-repair execution system
- repo-hardening / type-cleanup release

## Post-release follow-up

- Fix full-repo relation typing on jobs and planning pages.
- Resolve the `next/font` build blocker in `app/layout.tsx`.
- Integrate relay board state more cleanly into outer navigation once the execution-board contract settles.
- Continue refining invoice and customer communications polish on top of the now-connected lifecycle.
