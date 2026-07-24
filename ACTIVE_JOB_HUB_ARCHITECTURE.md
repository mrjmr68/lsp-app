# Active Job Hub Architecture

## 1. Title + Intent

This document describes the proposed architecture for the next field experience in LSP-APP.

It applies to **all active field jobs**, not just installs and major repairs. The goal is to replace the current step-heavy field execution model with a simpler, guided, mobile-first hub that works for both solo service calls and shared crew jobs.

---

## 2. Why The Current UI Must Change

Field testing made the problem clear:
- messaging / check-in is not working well enough in practice
- the screens feel too crowded
- the header is too heavy and eats too much space
- the app needs to be more guided and context-aware
- techs need fewer overloaded screens and more focused pages

The problem is no longer primarily the database structure. The bigger issue is that the field UI is asking techs to manage too much in one place.

---

## 3. Core Architectural Principle

The next field experience should follow three simple rules:

1. One active-job shell for every field job.
2. One adaptive hub framework, not separate apps for solo and shared work.
3. The home screen can change based on job type and moment, but the shell stays consistent.

This keeps the product teachable. A tech should learn one field environment, not a different tool for each workflow type.

---

## 4. The Centers

### Hub Home
The landing page after arrival. It should show the next best action and the most important live information for that job right now.

### Context Center
Where the tech quickly understands where they are going and what they are walking into: access, contacts, unit/system context, and service history.

### Documentation Center
The capture space for notes, photos, readings, and supporting evidence. This is where field documentation should feel fast and natural on a phone.

### Diagnosis Center
The place to think through the work. It should support expert reasoning, symptom interpretation, readings, and AI-guided troubleshooting without overwhelming the user.

### Planning Center
A lightweight onsite handoff and planning surface. It is not meant to become a full office-grade planning system in this phase.

### Logistics Center
The field operations lane for missing parts, missing tools, supply runs, and head-out readiness. It should be quick to open and easy for anyone on the crew to add to.

### Crew Center
The live coordination surface for shared jobs. It exists only when the job genuinely needs crew coordination.

---

## 5. Solo Job Behavior

Solo one-shot jobs should use:
- the same active-job shell
- the same hub concept
- no crew board

The hub home for a solo job should focus on:
- what the tech should do next
- fast access to context
- fast access to docs
- fast access to diagnosis
- planning or logistics only when relevant

The point is not to mimic shared-job complexity. The point is to keep the solo tech inside the same mental model without showing irrelevant coordination UI.

---

## 6. Shared Job Behavior

Shared install and major-repair jobs should use the same shell and hub structure, but their home screen should include live coordination as the primary operational module.

The intended crew pattern is:
- one person sends a broadcast request
- the rest of the crew sees it
- the first valid response clears it
- the requester gets confirmation and knows it is safe to proceed

Freeform notes should still exist, but they should stay secondary to live request/response coordination.

---

## 7. Coordination Model

The coordination model should stay simple at the product level:
- coordination is about safe-to-proceed requests and acknowledgements
- presence and check-in still matter
- location can exist, but it is not the core primitive

The real primitive is:
- "I need confirmation before I proceed."

That is the behavior the interface should center, especially on shared execution work.

---

## 8. Documentation and Capture Philosophy

The documentation center should hold:
- notes
- photos
- readings
- before/after evidence

Capture should be phone-first.

OCR should focus first on:
- model
- serial

Manual entry should support uppercase-friendly behavior so techs can correct or confirm captured data quickly. The goal is to make field capture feel faster than skipping it.

---

## 9. Logistics Philosophy

Logistics should not be treated like a back-office afterthought.

It needs:
- a dedicated page
- easy access from the hub home
- support for any crew member adding a need

This is where the app should track:
- missing parts
- missing tools
- supply runs
- head-out readiness

For shared jobs, this page should feel like an operational support lane. For solo jobs, it should still exist, but appear only when needed.

---

## 10. What This Is Not

This architecture is:
- not a generic message-feed redesign
- not a schema-first rewrite
- not a separate field app for each workflow type
- not a full office planning or invoicing redesign

It is a field UX reset.

---

## 11. Transitional Reality

Today, the codebase still contains:
- the standard stepper flow for one-shot service work
- the relay/checklist workspace for shared install / major-repair work

Those surfaces are still useful, but they should now be treated as transitional. Future field work should migrate behavior into the active-job hub rather than continuing to deepen the stepper model.

The destination is a single active-job experience that can adapt to the job in front of the tech without making the app feel crowded, slow, or confusing.
