interface SendVendorEmailInput {
  to: string
  cc?: string | null
  subject: string
  html: string
}

function splitEmails(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
}

export async function sendVendorEmail(input: SendVendorEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.PARTS_FROM_EMAIL ?? process.env.INVOICE_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL

  if (!apiKey) {
    return { error: 'RESEND_API_KEY is not configured.' }
  }

  if (!fromEmail) {
    return { error: 'PARTS_FROM_EMAIL or INVOICE_FROM_EMAIL is not configured.' }
  }

  const to = splitEmails(input.to)
  const cc = splitEmails(input.cc)

  if (to.length === 0) {
    return { error: 'A vendor email address is required before sending.' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: input.subject,
      html: input.html,
    }),
  })

  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = await response.json()
      detail = body?.message ?? body?.error?.message ?? detail
    } catch {}
    return { error: `Vendor email failed: ${detail}` }
  }

  const body = await response.json()
  return { success: true, id: body?.id as string | undefined }
}
