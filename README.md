# Legend Service Pros App

Internal field-service app for planning, technician workflow, customer/system management, and invoice approval.

## Stack

- Next.js 16.2.1
- React 19
- Supabase
- Vercel

## Local setup

1. Copy `.env.example` to `.env.local`
2. Fill in the required values
3. Install dependencies
4. Run `npm run dev`

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `INVOICE_FROM_EMAIL`

`INVOICE_FROM_EMAIL` should be a verified sender in Resend.

## Supabase requirements

Apply migrations through:

- [001_core.sql](C:/Users/Matt/Desktop/ALL%20MATTS%20PROJECTS/lsp-app/supabase/migrations/001_core.sql)
- [020_invoice_pdf_storage.sql](C:/Users/Matt/Desktop/ALL%20MATTS%20PROJECTS/lsp-app/supabase/migrations/020_invoice_pdf_storage.sql)

Important buckets/policies:

- `job-photos`
- `invoice-pdfs`

## Vercel deploy checklist

1. Create the Vercel project from this app.
2. Add all required env vars in Vercel.
3. In Supabase Auth, add your Vercel domain to:
   - Site URL
   - Redirect URLs
4. Apply all database migrations in the target Supabase project.
5. Verify Resend domain/sender setup for `INVOICE_FROM_EMAIL`.
6. Deploy a preview build first.
7. Run a full smoke test:
   - login
   - planning assignment
   - tech close-out with photos
   - owner invoice approval
   - PDF creation
   - email delivery

## Invoice delivery

Invoice approval now:

- generates a PDF
- saves it to Supabase Storage
- marks the job invoiced
- emails the PDF through Resend

If email configuration is missing, invoice approval is blocked until env vars are configured.

## Useful commands

```bash
npm run dev
npx tsc --noEmit
npm run lint
```
