import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import AppShell from '@/app/components/AppShell'
import { createClient } from '@/utils/supabase/server'
import { firstRelation, SupabaseRelation } from '@/utils/supabase/relations'
import {
  addUnitFromVisit,
  completeVisit,
  markVisitPartsNeeded,
  saveVisitNote,
  selectVisitRepair,
  updateVisitStatus,
} from './actions'

type VisitRequest = {
  id: string
  customer_id: string
  location_id: string
  request_kind: string
  priority: string
  problem_description: string | null
  manual_unit: string | null
  access_notes: string | null
  status: string
  customers: SupabaseRelation<{ name: string }>
  locations: SupabaseRelation<{ name: string; access_notes: string | null }>
  units: SupabaseRelation<{ name: string }>
}

type UserRelation = {
  first_name: string
  last_name: string
  role: string
}

type Visit = {
  id: string
  service_request_id: string
  legacy_job_id: string | null
  status: 'scheduled' | 'en_route' | 'on_site' | 'completed' | 'cancelled'
  outcome: string | null
  billing_status: string
  assigned_tech: string | null
  scheduled_date: string | null
  queue_position: number | null
  access_confirmed: boolean
  access_confirmation_needed: boolean
  needs_return_visit: boolean
  departed_at: string | null
  arrived_at: string | null
  completed_at: string | null
  service_requests: SupabaseRelation<VisitRequest>
  assigned_user: SupabaseRelation<UserRelation>
}

type VisitNote = {
  id: string
  note_type: string
  body: string
  created_at: string
  users: SupabaseRelation<{ first_name: string; last_name: string }>
}

type VisitRepair = {
  id: string
  repair_code: string | null
  description_title: string
  customer_description: string | null
  flat_rate_amount: number | null
  selected_at: string
}

type VisitPart = {
  id: string
  part_name: string
  part_number: string | null
  quantity: number
  notes: string | null
  created_at: string
}

type RepairBundle = {
  id: string
  name: string
  flat_rate: number | null
  variable_pricing: boolean | null
  diagnoses: SupabaseRelation<{ repair_code: string | null }>
}

type Tech = {
  id: string
  first_name: string
  last_name: string
  role: string
}

function fmtDateTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function nameFromUser(user: UserRelation | { first_name: string; last_name: string } | null) {
  if (!user) return 'Unassigned'
  return `${user.first_name} ${user.last_name}`.trim()
}

function badge(label: string, tone: 'dark' | 'green' | 'gold' | 'blue' | 'red' | 'plain' = 'plain') {
  const colors = {
    dark: { bg: '#202329', fg: '#fff8df', border: '#111318' },
    green: { bg: '#e5f3df', fg: '#255b2f', border: '#b9d8ad' },
    gold: { bg: '#fff0cf', fg: '#735019', border: '#e4ca91' },
    blue: { bg: '#e1edf7', fg: '#234d6f', border: '#afcbe0' },
    red: { bg: '#f2e0dc', fg: '#783326', border: '#ddb8af' },
    plain: { bg: '#f1eee6', fg: '#4b4b46', border: '#d8d1c4' },
  }[tone]

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: 24,
      padding: '3px 8px',
      borderRadius: 6,
      border: `1px solid ${colors.border}`,
      background: colors.bg,
      color: colors.fg,
      fontSize: 12,
      fontWeight: 900,
      textTransform: 'capitalize',
    }}>
      {label.replaceAll('_', ' ')}
    </span>
  )
}

function sectionStyle(): CSSProperties {
  return {
    border: '1px solid #d7d0c1',
    background: 'rgba(255, 253, 248, 0.78)',
    borderRadius: 8,
    padding: 16,
    display: 'grid',
    gap: 12,
    boxShadow: '0 10px 22px rgba(43, 46, 52, 0.05)',
  }
}

const inputStyle: CSSProperties = {
  width: '100%',
  fontSize: 14,
  padding: '10px 11px',
  borderRadius: 8,
  border: '1px solid #d2cbbd',
  background: '#fffdf8',
  color: '#202329',
  fontFamily: 'inherit',
}

const buttonStyle: CSSProperties = {
  minHeight: 40,
  borderRadius: 7,
  border: '1px solid #111318',
  background: '#202329',
  color: '#fff8df',
  fontWeight: 900,
  padding: '0 12px',
  cursor: 'pointer',
}

export default async function VisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error: pageError } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: visit, error: visitError } = await supabase
    .from('service_visits')
    .select(`
      id,
      service_request_id,
      legacy_job_id,
      status,
      outcome,
      billing_status,
      assigned_tech,
      scheduled_date,
      queue_position,
      access_confirmed,
      access_confirmation_needed,
      needs_return_visit,
      departed_at,
      arrived_at,
      completed_at,
      service_requests!service_visits_service_request_id_fkey (
        id,
        customer_id,
        location_id,
        request_kind,
        priority,
        problem_description,
        manual_unit,
        access_notes,
        status,
        customers!service_requests_customer_id_fkey ( name ),
        locations!service_requests_location_id_fkey ( name, access_notes ),
        units!service_requests_unit_id_fkey ( name )
      ),
      assigned_user:users!service_visits_assigned_tech_fkey (
        first_name,
        last_name,
        role
      )
    `)
    .eq('id', id)
    .single()

  if (visitError) {
    console.error('Visit query error:', visitError.message, visitError.details, visitError.hint)
  }
  if (!visit) return notFound()

  const [
    { data: notes },
    { data: repairs },
    { data: parts },
    { data: repairBundles },
    { data: techs },
  ] = await Promise.all([
    supabase
      .from('visit_notes')
      .select('id, note_type, body, created_at, users!visit_notes_user_id_fkey(first_name, last_name)')
      .eq('service_visit_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('visit_repairs')
      .select('id, repair_code, description_title, customer_description, flat_rate_amount, selected_at')
      .eq('service_visit_id', id)
      .order('selected_at', { ascending: false }),
    supabase
      .from('visit_parts_needed')
      .select('id, part_name, part_number, quantity, notes, created_at')
      .eq('service_visit_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('repair_bundles')
      .select('id, name, flat_rate, variable_pricing, diagnoses!repair_bundles_diagnosis_id_fkey(repair_code)')
      .order('name')
      .limit(200),
    supabase.rpc('list_assignable_users'),
  ])

  const normalizedVisit = visit as Visit
  const request = firstRelation(normalizedVisit.service_requests)
  const customer = firstRelation(request?.customers)
  const location = firstRelation(request?.locations)
  const unit = firstRelation(request?.units)
  const assignedUser = firstRelation(normalizedVisit.assigned_user)
  const selectedRepairs = (repairs ?? []) as VisitRepair[]
  const neededParts = (parts ?? []) as VisitPart[]
  const availableBundles = (repairBundles ?? []) as RepairBundle[]
  const assignableTechs = (techs ?? []) as Tech[]
  const isCompleted = normalizedVisit.status === 'completed' || normalizedVisit.status === 'cancelled'

  return (
    <AppShell>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '22px 14px 44px' }}>
        <header style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
          <Link href="/today" style={{ color: '#5d584f', fontSize: 13, fontWeight: 900, textDecoration: 'none' }}>
            Back to Today
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {badge(normalizedVisit.status, normalizedVisit.status === 'on_site' ? 'gold' : normalizedVisit.status === 'en_route' ? 'blue' : normalizedVisit.status === 'completed' ? 'green' : 'plain')}
                {badge(normalizedVisit.billing_status, normalizedVisit.billing_status === 'ready_for_invoice' ? 'green' : normalizedVisit.billing_status === 'blocked_parts_return' ? 'gold' : 'plain')}
                {request?.request_kind === 'add_unit' && badge('add unit', 'blue')}
              </div>
              <h1 style={{ margin: 0, color: '#202329', fontSize: 32, lineHeight: 1.05 }}>
                {location?.name ?? 'Unknown property'} <span style={{ color: '#68645d' }}>- {unit?.name ?? request?.manual_unit ?? 'No unit'}</span>
              </h1>
              <p style={{ margin: '8px 0 0', color: '#5d584f', lineHeight: 1.5, maxWidth: 720 }}>
                {request?.problem_description ?? 'No issue description recorded.'}
              </p>
              <p style={{ margin: '5px 0 0', color: '#6a655c', fontSize: 13, fontWeight: 800 }}>
                {customer?.name ?? 'Unknown customer'}
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13, color: '#5d584f', lineHeight: 1.5 }}>
              <div style={{ fontWeight: 900, color: '#202329' }}>{nameFromUser(assignedUser)}</div>
              <div>{normalizedVisit.scheduled_date ?? 'No date'}{normalizedVisit.queue_position ? ` - stop ${normalizedVisit.queue_position}` : ''}</div>
              {normalizedVisit.legacy_job_id && (
                <Link href={`/jobs/${normalizedVisit.legacy_job_id}`} style={{ color: '#245f93', fontWeight: 800 }}>
                  Legacy workflow
                </Link>
              )}
            </div>
          </div>
        </header>

        {pageError && (
          <div style={{ border: '1px solid #e0b8ae', background: '#fff0ec', color: '#7a3125', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 14, fontWeight: 800 }}>
            {pageError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 14 }}>
          <main style={{ display: 'grid', gap: 14 }}>
            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Status</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['scheduled', 'en_route', 'on_site'] as const).map(status => (
                  <form key={status} action={updateVisitStatus.bind(null, normalizedVisit.id, status)}>
                    <button
                      type="submit"
                      disabled={isCompleted}
                      style={{
                        ...buttonStyle,
                        background: normalizedVisit.status === status ? '#202329' : '#fffdf8',
                        color: normalizedVisit.status === status ? '#fff8df' : '#202329',
                        borderColor: normalizedVisit.status === status ? '#111318' : '#d2cbbd',
                      }}
                    >
                      {status.replaceAll('_', ' ')}
                    </button>
                  </form>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, color: '#5d584f', fontSize: 13 }}>
                <div>Departed: {fmtDateTime(normalizedVisit.departed_at)}</div>
                <div>Arrived: {fmtDateTime(normalizedVisit.arrived_at)}</div>
                <div>Completed: {fmtDateTime(normalizedVisit.completed_at)}</div>
              </div>
            </section>

            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Notes & Access</h2>
              <form action={saveVisitNote} style={{ display: 'grid', gap: 10 }}>
                <input type="hidden" name="visit_id" value={normalizedVisit.id} />
                <textarea name="body" rows={3} placeholder="Quick note..." style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }} />
                <input name="access_notes" placeholder="Access note or gate code..." style={inputStyle} defaultValue={request?.access_notes ?? location?.access_notes ?? ''} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                  <select name="access_confirmed" defaultValue="" style={inputStyle}>
                    <option value="">Access confirmation unchanged</option>
                    <option value="confirmed">Access confirmed</option>
                    <option value="not_confirmed">Access not confirmed</option>
                  </select>
                  <button type="submit" style={buttonStyle}>Save note</button>
                </div>
              </form>
            </section>

            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Repair Selection</h2>
              <form action={selectVisitRepair} style={{ display: 'grid', gap: 10 }}>
                <input type="hidden" name="visit_id" value={normalizedVisit.id} />
                <select name="repair_bundle_id" required style={inputStyle} disabled={isCompleted}>
                  <option value="">Choose repair template</option>
                  {availableBundles.map(bundle => {
                    const diagnosis = firstRelation(bundle.diagnoses)
                    return (
                      <option key={bundle.id} value={bundle.id}>
                        {diagnosis?.repair_code ? `${diagnosis.repair_code} - ` : ''}{bundle.name}{bundle.flat_rate ? ` ($${bundle.flat_rate})` : ''}
                      </option>
                    )
                  })}
                </select>
                <button type="submit" disabled={isCompleted} style={buttonStyle}>Add repair</button>
              </form>

              {selectedRepairs.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {selectedRepairs.map(repair => (
                    <div key={repair.id} style={{ border: '1px solid #e1dacc', borderRadius: 7, padding: 10, background: '#fffdf8' }}>
                      <div style={{ fontWeight: 900 }}>{repair.repair_code ?? repair.description_title}</div>
                      <div style={{ color: '#5d584f', fontSize: 13, marginTop: 3 }}>{repair.customer_description ?? repair.description_title}</div>
                      <div style={{ color: '#5d584f', fontSize: 12, marginTop: 5 }}>{repair.flat_rate_amount ? `$${repair.flat_rate_amount}` : 'Price review needed'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: '#6a655c', fontSize: 13 }}>No repair selected yet.</p>
              )}
            </section>

            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Parts Needed</h2>
              <form action={markVisitPartsNeeded} style={{ display: 'grid', gap: 10 }}>
                <input type="hidden" name="visit_id" value={normalizedVisit.id} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                  <input name="part_name" placeholder="Part needed" style={inputStyle} disabled={isCompleted} />
                  <input name="quantity" type="number" min="1" step="1" defaultValue="1" style={inputStyle} disabled={isCompleted} />
                </div>
                <input name="part_number" placeholder="Part number if known" style={inputStyle} disabled={isCompleted} />
                <textarea name="notes" rows={2} placeholder="Vendor, model, measurements, notes..." style={{ ...inputStyle, resize: 'vertical' }} disabled={isCompleted} />
                <button type="submit" disabled={isCompleted} style={{ ...buttonStyle, background: '#735019' }}>Mark parts needed</button>
              </form>

              {neededParts.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {neededParts.map(part => (
                    <div key={part.id} style={{ border: '1px solid #e1dacc', borderRadius: 7, padding: 10, background: '#fffdf8' }}>
                      <div style={{ fontWeight: 900 }}>{part.quantity} x {part.part_name}</div>
                      <div style={{ color: '#5d584f', fontSize: 13 }}>{part.part_number ?? 'No part number'}{part.notes ? ` - ${part.notes}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>

          <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Complete Visit</h2>
              <form action={completeVisit} style={{ display: 'grid', gap: 10 }}>
                <input type="hidden" name="visit_id" value={normalizedVisit.id} />
                <select name="outcome" defaultValue="repair_completed" style={inputStyle} disabled={isCompleted}>
                  <option value="repair_completed">Repair completed - invoice ready</option>
                  <option value="closed_no_action">Close with no billable action</option>
                </select>
                <button type="submit" disabled={isCompleted} style={{ ...buttonStyle, background: '#255b2f' }}>
                  Complete visit
                </button>
              </form>
              <p style={{ margin: 0, color: '#6a655c', fontSize: 13, lineHeight: 1.45 }}>
                Parts-needed visits are held from billing until the return visit is completed.
              </p>
            </section>

            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>+ Add Unit</h2>
              <form action={addUnitFromVisit} style={{ display: 'grid', gap: 10 }}>
                <input type="hidden" name="origin_visit_id" value={normalizedVisit.id} />
                <input name="unit" placeholder="New unit" style={inputStyle} />
                <textarea name="problem_description" rows={3} placeholder="Issue for the added unit" style={{ ...inputStyle, resize: 'vertical' }} />
                <select name="assigned_tech" defaultValue={normalizedVisit.assigned_tech ?? ''} style={inputStyle}>
                  <option value="">Unassigned</option>
                  {assignableTechs.map(tech => (
                    <option key={tech.id} value={tech.id}>{nameFromUser(tech)}</option>
                  ))}
                </select>
                <button type="submit" style={buttonStyle}>Create billable unit visit</button>
              </form>
            </section>

            <section style={sectionStyle()}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Timeline</h2>
              {((notes ?? []) as VisitNote[]).length === 0 ? (
                <p style={{ margin: 0, color: '#6a655c', fontSize: 13 }}>No visit notes yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 9 }}>
                  {((notes ?? []) as VisitNote[]).map(note => {
                    const noteUser = firstRelation(note.users)
                    return (
                      <div key={note.id} style={{ borderBottom: '1px solid #e7dfd0', paddingBottom: 8 }}>
                        <div style={{ fontSize: 12, color: '#6a655c', fontWeight: 800 }}>
                          {note.note_type} - {nameFromUser(noteUser)} - {fmtDateTime(note.created_at)}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', marginTop: 4, color: '#2d3035', fontSize: 13, lineHeight: 1.45 }}>{note.body}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
