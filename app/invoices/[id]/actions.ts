'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/utils/auth/roles'
import { buildInvoiceEmailHtml, buildInvoicePdf } from '@/utils/invoices/document'
import { sendInvoiceEmail } from '@/utils/invoices/email'

async function requireInvoiceOwner() {
  return requireRole('owner')
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : (value ?? null)
}

async function nextInvoiceNumber(supabase: Awaited<ReturnType<typeof requireInvoiceOwner>>['supabase']) {
  const year = new Date().getFullYear()
  const { data: latest, error } = await supabase
    .from('jobs')
    .select('invoice_number')
    .like('invoice_number', `INV-${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { error: error.message, invoiceNumber: null as string | null }
  }

  const latestNumber = latest?.invoice_number ?? null
  const latestSeq = latestNumber ? Number(latestNumber.split('-').at(-1) ?? '0') : 0
  const seq = String(latestSeq + 1).padStart(4, '0')
  return { invoiceNumber: `INV-${year}-${seq}`, error: null as string | null }
}

export async function savePlaceholderCost(
  jobId: string,
  itemId: string,
  actualCost: number,
) {
  const { supabase, user, error } = await requireInvoiceOwner()
  if (error || !user) return { error: error ?? 'Not authenticated' }

  const { data: existing } = await supabase
    .from('job_placeholder_costs')
    .select('id')
    .eq('job_id', jobId)
    .eq('item_id', itemId)
    .maybeSingle()

  if (existing) {
    const { error: updateError } = await supabase
      .from('job_placeholder_costs')
      .update({ actual_cost: actualCost, entered_by: user.id })
      .eq('id', existing.id)

    if (updateError) return { error: updateError.message }
  } else {
    const { error: insertError } = await supabase
      .from('job_placeholder_costs')
      .insert({
        job_id: jobId,
        item_id: itemId,
        actual_cost: actualCost,
        entered_by: user.id,
      })

    if (insertError) return { error: insertError.message }
  }

  revalidatePath(`/invoices/${jobId}`)
  return { success: true }
}

export async function saveAdminNotes(jobId: string, notes: string) {
  const { supabase, error } = await requireInvoiceOwner()
  if (error) return { error }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({ admin_notes: notes || null })
    .eq('id', jobId)

  if (updateError) return { error: updateError.message }
  return { success: true }
}

export async function saveFlatRateOverride(jobId: string, override: number | null) {
  const { supabase, error } = await requireInvoiceOwner()
  if (error) return { error }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({ flat_rate_override: override })
    .eq('id', jobId)

  if (updateError) return { error: updateError.message }
  return { success: true }
}

export async function flagForReview(jobId: string, flagged: boolean) {
  const { supabase, error } = await requireInvoiceOwner()
  if (error) return { error }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({ flagged_for_review: flagged })
    .eq('id', jobId)

  if (updateError) return { error: updateError.message }
  revalidatePath(`/invoices/${jobId}`)
  revalidatePath('/invoices')
  return { success: true }
}

export async function approveInvoice(
  jobId: string,
  data: { sendToEmail: string; ccEmail: string },
) {
  const { supabase, user, error: authError } = await requireInvoiceOwner()
  if (authError || !user) return { error: authError ?? 'Not authenticated' }

  if (!data.sendToEmail.trim()) {
    return { error: 'A billing email address is required before approving the invoice.' }
  }
  if (!process.env.RESEND_API_KEY) {
    return { error: 'RESEND_API_KEY is not configured.' }
  }
  if (!process.env.INVOICE_FROM_EMAIL && !process.env.RESEND_FROM_EMAIL) {
    return { error: 'INVOICE_FROM_EMAIL is not configured.' }
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id, diagnosis_id, flat_rate_override, location_id, job_date, manual_unit,
      problem_description,
      customers!jobs_customer_id_fkey(id, name, billing_email, bill_to_parent, parent_id),
      locations!jobs_location_id_fkey(id, name, tax_rate),
      units!jobs_unit_id_fkey(id, name),
      diagnoses!jobs_diagnosis_id_fkey(repair_code, invoice_description, repair_notes),
      users!jobs_actual_tech_fkey(first_name, last_name)
    `)
    .eq('id', jobId)
    .single()

  if (jobError || !job) return { error: jobError?.message ?? 'Job not found' }

  const { data: adhocBundle, error: adhocBundleError } = await supabase
    .from('job_adhoc_bundles')
    .select('id, tech_description')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (adhocBundleError) return { error: adhocBundleError.message }

  const { data: addOns, error: addOnError } = await supabase
    .from('job_addons')
    .select('type, quantity, repair_bundles(name, flat_rate), items(name, unit_cost)')
    .eq('job_id', jobId)

  if (addOnError) return { error: addOnError.message }

  const customer = Array.isArray(job.customers) ? job.customers[0] ?? null : job.customers
  const location = Array.isArray(job.locations) ? job.locations[0] ?? null : job.locations
  const unit = Array.isArray(job.units) ? job.units[0] ?? null : job.units
  const diagnosis = Array.isArray(job.diagnoses) ? job.diagnoses[0] ?? null : job.diagnoses
  const tech = Array.isArray(job.users) ? job.users[0] ?? null : job.users

  let parentCustomer: { id: string; name: string; billing_email: string | null } | null = null
  if (customer?.bill_to_parent && customer.parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from('customers')
      .select('id, name, billing_email')
      .eq('id', customer.parent_id)
      .maybeSingle()

    if (parentError) return { error: parentError.message }
    parentCustomer = parent
  }

  let primaryCharge = 0
  let primaryLabel = 'Service'
  let descriptionTitle = 'Service performed'
  let descriptionBody = job.problem_description ?? ''

  if (job.flat_rate_override != null) {
    primaryCharge = job.flat_rate_override
  }

  if (job.diagnosis_id) {
    const { data: bundles, error: bundleError } = await supabase
      .from('repair_bundles')
      .select('flat_rate')
      .eq('diagnosis_id', job.diagnosis_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (bundleError) return { error: bundleError.message }

    const bundle = bundles?.[0] ?? null
    if (job.flat_rate_override == null) {
      primaryCharge = bundle?.flat_rate ?? 0
    }

    primaryLabel = diagnosis?.repair_code ?? 'Repair service'
    descriptionTitle = diagnosis?.invoice_description ?? diagnosis?.repair_code ?? 'Repair service'
    descriptionBody = diagnosis?.repair_notes ?? job.problem_description ?? ''
  } else if (adhocBundle) {
    primaryLabel = 'Ad-hoc repair'
    descriptionTitle = 'Ad-hoc repair service'
    descriptionBody = adhocBundle.tech_description
  }

  const hasAdhocBundle = !!adhocBundle
  if (!job.diagnosis_id && !hasAdhocBundle) {
    return { error: 'This job cannot be invoiced until it has a diagnosis or an ad-hoc repair.' }
  }
  if (!job.diagnosis_id && hasAdhocBundle && job.flat_rate_override == null) {
    return { error: 'Enter a flat-rate override before approving an ad-hoc repair.' }
  }

  const addOnCharges = (addOns ?? []).reduce((sum: number, addOn) => {
    const addOnBundle = firstRelation(addOn.repair_bundles)
    const addOnItem = firstRelation(addOn.items)
    if (addOn.type === 'bundle') return sum + (addOnBundle?.flat_rate ?? 0)
    return sum + (addOnItem?.unit_cost ?? 0) * addOn.quantity
  }, 0)

  const subtotal = primaryCharge + addOnCharges
  const taxRate = location?.tax_rate ?? 0
  const tax = Math.round(subtotal * taxRate * 100) / 100
  const total = Math.round((subtotal + tax) * 100) / 100

  const lineItems = [
    { label: primaryLabel, amount: primaryCharge },
    ...(addOns ?? []).map(addOn => ({
      label: addOn.type === 'bundle'
        ? (firstRelation(addOn.repair_bundles)?.name ?? 'Additional bundle')
        : (firstRelation(addOn.items)?.name ?? 'Additional item'),
      amount: addOn.type === 'bundle'
        ? (firstRelation(addOn.repair_bundles)?.flat_rate ?? 0)
        : (firstRelation(addOn.items)?.unit_cost ?? 0) * addOn.quantity,
    })),
  ]

  const approvedAt = new Date().toISOString()
  const billTo = parentCustomer ?? customer
  const documentBase = {
    invoiceDate: formatDate(approvedAt),
    fromName: 'Legend Service Pros',
    fromCityState: 'Greensboro, NC',
    billToName: billTo?.name ?? customer?.name ?? 'Customer',
    billToEmail: billTo?.billing_email ?? null,
    customerName: customer?.name ?? 'Customer',
    locationName: location?.name ?? 'Location',
    unitLabel: job.manual_unit ?? unit?.name ?? '—',
    techName: tech ? `${tech.first_name} ${tech.last_name}` : '—',
    serviceDate: formatDate(job.job_date),
    descriptionTitle,
    descriptionBody,
    lineItems,
    subtotal,
    taxRate,
    tax,
    total,
  }

  let invoiceNumber: string | null = null
  let invoicePdfPath: string | null = null
  let pdfBytes: Uint8Array | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const numberResult = await nextInvoiceNumber(supabase)
    if (numberResult.error || !numberResult.invoiceNumber) {
      return { error: numberResult.error ?? 'Failed to allocate invoice number.' }
    }

    invoiceNumber = numberResult.invoiceNumber
    invoicePdfPath = `${new Date().getFullYear()}/${safeSegment(invoiceNumber)}.pdf`
    pdfBytes = buildInvoicePdf({
      ...documentBase,
      invoiceNumber,
    })

    const { error: uploadError } = await supabase.storage
      .from('invoice-pdfs')
      .upload(invoicePdfPath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      const uploadMessage = uploadError.message.toLowerCase()
      if (uploadMessage.includes('duplicate') || uploadMessage.includes('already exists')) {
        continue
      }
      return { error: `Invoice PDF upload failed: ${uploadError.message}` }
    }

    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'invoiced',
        invoice_number: invoiceNumber,
        invoice_subtotal: subtotal,
        tax_rate: taxRate,
        invoice_tax: tax,
        invoice_total: total,
        invoice_amount: total,
        invoice_pdf_path: invoicePdfPath,
        approved_at: approvedAt,
        approved_by: user.id,
        needs_admin_review: false,
      })
      .eq('id', jobId)

    if (updateError) {
      const updateMessage = updateError.message.toLowerCase()
      if (updateMessage.includes('duplicate') || updateMessage.includes('unique')) {
        continue
      }
      return { error: updateError.message }
    }

    break
  }

  if (!invoiceNumber || !invoicePdfPath || !pdfBytes) {
    return { error: 'Failed to finalize the invoice number after multiple attempts.' }
  }

  const emailResult = await sendInvoiceEmail({
    to: data.sendToEmail,
    cc: data.ccEmail,
    subject: `Invoice ${invoiceNumber} from Legend Service Pros`,
    html: buildInvoiceEmailHtml({
      ...documentBase,
      invoiceNumber,
    }),
    pdfBytes,
    pdfFileName: `${invoiceNumber}.pdf`,
  })

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${jobId}`)
  revalidatePath('/planning')

  if (emailResult.error) {
    return {
      success: true,
      invoiceNumber,
      warning: `Invoice approved and PDF saved, but email delivery failed. ${emailResult.error}`,
    }
  }

  return { success: true, invoiceNumber }
}
