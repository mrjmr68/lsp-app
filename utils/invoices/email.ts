interface SendInvoiceEmailInput {
  to: string
  cc?: string | null
  subject: string
  html: string
  pdfBytes: Uint8Array
  pdfFileName: string
}

function splitEmails(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
}

export async function sendInvoiceEmail(input: SendInvoiceEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.INVOICE_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL

  if (!apiKey) {
    return { error: 'RESEND_API_KEY is not configured.' }
  }

  if (!fromEmail) {
    return { error: 'INVOICE_FROM_EMAIL is not configured.' }
  }

  const to = splitEmails(input.to)
  const cc = splitEmails(input.cc)

  if (to.length === 0) {
    return { error: 'A billing email address is required before sending the invoice.' }
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
      attachments: [
        {
          filename: input.pdfFileName,
          content: Buffer.from(input.pdfBytes).toString('base64'),
        },
      ],
    }),
  })

  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = await response.json()
      detail = body?.message ?? body?.error?.message ?? detail
    } catch {}
    return { error: `Invoice email failed: ${detail}` }
  }

  const body = await response.json()
  return { success: true, id: body?.id as string | undefined }
}
