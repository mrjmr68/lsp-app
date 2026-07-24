# LSP App — Field UI Design Overview

## What We're Changing and Why

After one day in the field, five clear problems surfaced. The data and backend are solid — this is purely a UI and flow rebuild.

---

## The Core Problem

The current app was built like a desktop dashboard that happens to run on a phone. When a tech is standing in a 95-degree mechanical room with work gloves on, they're confronted with a 6-tab navigation bar, a job screen buried under two layers of headers, and a single massive form with 30+ fields all visible at once. The result: techs skip the app and pick up the phone instead.

The redesign starts from a simple premise: **the right screen shows exactly one thing at a time, in the order the tech needs it.**

---

## Design Principles

**1. One job at a time, one step at a time**
A tech in the field is doing one thing. The app should reflect that. Each step in the job workflow becomes its own full-screen page, not a section on a scrolling form.

**2. The header shrinks when the work starts**
The full company navigation (Planning, Jobs, Admin, Estimates, Invoices, Customers) is appropriate when you're in the office deciding what to do. Once a tech is inside a job, all of that goes away. The only things visible are: which job, how long they've been there, and where they are in the process.

**3. Talk to the office, not just log data**
Right now when a tech marks themselves on-site, nothing is communicated — a GPS coordinate is recorded silently. The redesign adds a simple message at check-in: "Tell the office where you are." One tap to confirm the default message, or edit it. The office sees it immediately.

**4. The phone camera is a tool, not a decoration**
Techs spend 30 seconds trying to read a model number off a dusty coil in a dark closet and then mistype it. A camera button next to the model and serial fields opens the phone camera, reads the label automatically, and fills in the field in uppercase. Keyboard also defaults to capitals for these fields.

**5. Less is more on every screen**
The observation step (recording what the system is doing) currently shows everything — temperatures, pressures, equipment details, system configuration — all at once. The redesign splits this into two focused views: **Readings** (what the system is doing right now) and **System** (what equipment is installed). Readings comes first because that's what the tech checks first.

---

## How the Job Flow Works (New)

Every job moves through five pages. Each page has one job.

```
JOB LIST  →  ARRIVE  →  OBSERVE  →  DIAGNOSE  →  REPAIR  →  CLOSE
```

### Arrive
*"Get to the right place and let the office know you're there."*

- Shows destination, access instructions, equipment on-site
- One big button: **On-Site** (captures location automatically)
- After tapping: message composer appears, pre-filled with arrival note, one tap to send
- Service history available via an expandable "Context" section — collapsed by default

### Observe
*"What is this system doing right now?"*

Two tabs:

- **Readings** (default) — thermostat settings, temperatures in/out, refrigerant pressures. The ~8 numbers that tell the story.
- **System** — make, model, serial number, tonnage. Fill this in once; it stays forever. Model and serial have a camera OCR button.

### Diagnose
*"What is wrong with it?"*

- Search or scroll through repair codes
- Select the one that fits, or describe an ad-hoc repair if nothing matches
- Observation data stays accessible in a collapsible panel

### Repair
*"What did you do to fix it?"*

- Select the repair bundle that matches the diagnosis
- Add any extra items or labor
- Upload a photo of the completed work

### Close
*"Wrap it up."*

- Summary of everything recorded
- Choose path: direct to invoice, or send an estimate first
- Shared crew workflow check if applicable

---

## Header Design (Job Screens)

On all five job pages, the header is stripped down to:

```
← Jobs     Riverstone · Apt 4B · Heat Pump          00:14:23
───────────────────────────────────────────────────────────────
Arrive ✓    Observe ✓    Diagnose    Repair    Close
```

- **Back arrow** goes to the job list
- **Job title** — customer, location, unit — one line
- **Timer** — how long since check-in, counts up in amber
- **Step bar** — five steps, completed ones show a checkmark, current one is highlighted

No company logo. No six-tab nav. No sign-out button. Nothing that isn't about the job in front of you.

---

## What Stays the Same

- Everything in Planning, Admin, Estimates, Invoices, and Customers — those screens are unchanged
- The full navigation bar appears normally on all of those screens
- All the data the app collects — readings, photos, diagnoses, parts, invoices — same as today
- The backend, database, and all integrations are untouched

---

## What's New in Summary

| Before | After |
|---|---|
| One giant job page with all 5 steps | Five separate pages, one step each |
| Full 6-tab nav bar inside job flow | Minimal header: back + job name + timer + step bar |
| Check-in records GPS silently | Check-in opens message composer, notifies office |
| Model/serial: plain text, lowercase | Camera OCR + auto-uppercase keyboard |
| Observation: 30+ fields all at once | Readings tab (8 fields) + System tab (equipment details) |

---

## Out of Scope for This Pass

- No changes to how jobs are created or assigned (Planning board)
- No changes to estimates, invoices, or customer records
- No new backend features — all data is already being captured
- No native app — this remains a mobile web app, accessed via browser on the tech's phone