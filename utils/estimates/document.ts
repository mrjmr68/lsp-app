export interface EstimateDocumentLine {
  label: string
  amount: number
}

export interface EstimateDocumentData {
  estimateNumber: string
  estimateDate: string
  fromName: string
  fromCityState: string
  billToName: string
  billToEmail: string | null
  customerName: string
  locationName: string
  unitLabel: string
  techName: string
  serviceDate: string
  summaryTitle: string
  summaryBody: string
  lineItems: EstimateDocumentLine[]
  subtotal: number
  taxRate: number
  tax: number
  total: number
}

function fmtMoney(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function escapePdfText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrapText(value: string, width: number) {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= width) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

function line(text: string, size = 11) {
  return { text, size }
}

export function buildEstimatePdf(data: EstimateDocumentData) {
  const rows: Array<{ text: string; size: number }> = [
    line(data.fromName, 18),
    line(data.fromCityState, 11),
    line(''),
    line(`Estimate #: ${data.estimateNumber}`, 12),
    line(`Estimate Date: ${data.estimateDate}`, 12),
    line(`Service Visit: ${data.serviceDate}`, 12),
    line(''),
    line('Prepared For', 13),
    line(data.billToName, 11),
    line(data.billToEmail ?? '-', 11),
    line(''),
    line('Job Summary', 13),
    line(`Customer: ${data.customerName}`),
    line(`Location: ${data.locationName}`),
    line(`Unit: ${data.unitLabel}`),
    line(`Tech: ${data.techName}`),
    line(''),
    line(data.summaryTitle, 13),
    ...wrapText(data.summaryBody || '-', 84).map(entry => line(entry)),
    line(''),
    line('Proposed Charges', 13),
    ...data.lineItems.flatMap(item => wrapText(`${item.label} .... ${fmtMoney(item.amount)}`, 84).map(entry => line(entry))),
    line(''),
    line(`Subtotal: ${fmtMoney(data.subtotal)}`, 12),
    line(`Tax (${(data.taxRate * 100).toFixed(2)}%): ${fmtMoney(data.tax)}`, 12),
    line(`Estimated Total: ${fmtMoney(data.total)}`, 14),
    line(''),
    line('This estimate is valid for 30 days.', 11),
    line('Thank you for trusting Legend Service Pros.', 11),
  ]

  const pageHeight = 792
  const topMargin = 54
  const bottomMargin = 54
  const defaultLeading = 16
  const pageBodyHeight = pageHeight - topMargin - bottomMargin
  const linesPerPage = Math.max(1, Math.floor(pageBodyHeight / defaultLeading))
  const pages: Array<Array<{ text: string; size: number }>> = []

  for (let index = 0; index < rows.length; index += linesPerPage) {
    pages.push(rows.slice(index, index + linesPerPage))
  }

  const objects: string[] = []
  const pageObjectNumbers: number[] = []

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')
  objects.push('2 0 obj\n<< /Type /Pages /Kids __PAGE_KIDS__ /Count __PAGE_COUNT__ >>\nendobj')
  objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj')
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj')

  let nextObjectNumber = 5

  for (const pageRows of pages) {
    const pageObjectNumber = nextObjectNumber++
    const contentObjectNumber = nextObjectNumber++
    pageObjectNumbers.push(pageObjectNumber)

    const contentLines = ['BT', '/F1 11 Tf', `72 ${pageHeight - topMargin} Td`]
    let previousSize = 11

    pageRows.forEach((row, index) => {
      const fontName = row.size >= 13 ? '/F2' : '/F1'
      if (index > 0) {
        contentLines.push(`${defaultLeading} TL`, 'T*')
      }
      if (row.size !== previousSize || index === 0) {
        contentLines.push(`${fontName} ${row.size} Tf`)
        previousSize = row.size
      }
      contentLines.push(`(${escapePdfText(row.text)}) Tj`)
    })

    contentLines.push('ET')
    const contentStream = contentLines.join('\n')

    objects.push(
      `${pageObjectNumber} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>\nendobj`,
    )
    objects.push(
      `${contentObjectNumber} 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`,
    )
  }

  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjectNumbers.map(number => `${number} 0 R`).join(' ')}] /Count ${pageObjectNumbers.length} >>\nendobj`

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]

  for (const object of objects) {
    offsets.push(pdf.length)
    pdf += `${object}\n`
  }

  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return new Uint8Array(Buffer.from(pdf, 'utf-8'))
}
