-- ============================================================
-- Migration 006: Sales tax
--
-- tax_rate on locations — stored per location since NC sales tax
-- varies by county. Set once at location setup. Inherited by jobs.
-- e.g. 0.0475 = 4.75%, 0.0700 = 7.00%
--
-- Invoice fields on jobs — replaces single invoice_amount with
-- proper subtotal / tax / total breakdown.
-- invoice_amount is retained as a nullable legacy field for any
-- historical records that only have a total figure.
-- ============================================================

-- Add tax rate to locations
alter table public.locations
  add column tax_rate numeric(5,4);

comment on column public.locations.tax_rate is
  'NC county sales tax rate as a decimal. e.g. 0.0475 for 4.75%. Set once at location setup.';

-- Extend jobs invoice fields
alter table public.jobs
  add column invoice_subtotal numeric(8,2),
  add column tax_rate         numeric(5,4),
  add column invoice_tax      numeric(8,2),
  add column invoice_total    numeric(8,2);

comment on column public.jobs.tax_rate is
  'Copied from location.tax_rate at invoice creation. Stored on job so rate changes do not affect historical invoices.';

comment on column public.jobs.invoice_subtotal is
  'Pre-tax invoice amount.';

comment on column public.jobs.invoice_tax is
  'Tax amount. Calculated as invoice_subtotal * tax_rate.';

comment on column public.jobs.invoice_total is
  'Final billed amount. invoice_subtotal + invoice_tax.';
