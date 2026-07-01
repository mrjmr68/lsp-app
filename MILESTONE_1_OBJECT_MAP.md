# Milestone 1 Object Map

Last updated: 2026-06-30

## Business Rules Confirmed

- `+ Add Unit` always creates a new, separately billable service request.
- Parts-needed situations are not billed on the first visit. Billing waits until the return visit is completed.
- v1.0 invoice-ready records are internal only. No QuickBooks sync in this phase.

## Why This Layer Exists

The current app has a mature `jobs` table with planning, technician workflow, repair selection, and invoice behavior already connected to it.

The v1.0 spec uses clearer operating language:

`service request -> service visit -> repair or parts needed -> invoice-ready record`

Milestone 1 introduces that language in the database without destroying or renaming the existing `jobs` table. That lets us build the v1.0 UI while keeping the older routes usable during the transition.

## Current Object Mapping

| v1.0 object | New table | Current source during transition |
| --- | --- | --- |
| Service Request | `service_requests` | one row seeded from each legacy `jobs` row |
| Service Visit | `service_visits` | one initial visit seeded from each legacy `jobs` row |
| Visit Note | `visit_notes` | new fast-update timeline entries |
| Visit Repair | `visit_repairs` | selected repair snapshot for a specific visit |
| Parts Needed | `visit_parts_needed` | simple parts-needed record for Build 1 follow-up |
| Invoice-ready Record | `job_invoice_snapshots` | existing durable invoice snapshot, now linkable to request/visit |

## Legacy `jobs` Transition Rules

- Existing `jobs` records remain readable.
- Each legacy `jobs` record maps to one `service_requests` row through `created_from_legacy_job_id`.
- Each legacy `jobs` record maps to one initial `service_visits` row through `legacy_job_id`.
- New v1.0 flows should create `service_requests` and `service_visits` directly.
- Existing planning and invoice screens can continue reading `jobs` while we move the primary user flow to visits.

## Status Mapping

| Legacy job state | Request status | Visit status |
| --- | --- | --- |
| `intake` / `new` | `intake` | `scheduled` |
| `scheduled` / `assigned` | `scheduled` | `scheduled` |
| `dispatched` / `en_route` | `active` | `en_route` |
| `on_site` / `in_progress` | `active` | `on_site` |
| `completed` | `completed` | `completed` |
| `cancelled` | `cancelled` | `cancelled` |
| parts-needed commercial state | `waiting_parts` | `completed` or current operational state |

## Billing Mapping

| Visit outcome | Billing status | Meaning |
| --- | --- | --- |
| repair completed | `ready_for_invoice` after completion | invoice-ready record can be created |
| parts needed | `blocked_parts_return` | no invoice-ready record until return visit completion |
| closed no action | `not_billable` | close cleanly without invoice |
| not completed | `not_ready` | field work is still open |
| already invoiced | `invoiced` | historical state is preserved |

## Add Unit Rule

When a technician uses `+ Add Unit`:

- create a new `service_requests` row
- set `request_kind = 'add_unit'`
- set `billable = true`
- copy the same `customer_id` and `location_id`
- set the new `unit_id` or `manual_unit`
- create the first `service_visits` row for that new request
- set `origin_visit_id` to the visit where the extra unit was discovered

## Parts Needed Rule

When a technician marks parts needed:

- create one or more `visit_parts_needed` rows
- set the current visit `outcome = 'parts_needed'`
- set the current visit `needs_return_visit = true`
- set the current visit `no_invoice_until_return_complete = true`
- set the current visit `billing_status = 'blocked_parts_return'`
- set the request `status = 'waiting_parts'`

The return visit becomes the billable completion point.

## No QuickBooks Rule

Invoice-ready means a durable internal record exists in the app. It does not mean QuickBooks has been updated, synced, or exported.

For v1.0, QuickBooks remains outside the system boundary.
