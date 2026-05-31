'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useState, useTransition } from 'react'
import {
  importFullCatalogAction,
  importSeedItemsAction,
  importSeedOperationsAction,
  updateAppConfigAction,
  updateRepairTemplateAction,
} from './actions'

type ImportResult =
  | {
      success: true
      label: string
      importedRows: number
      itemsCreated: number
      itemsUpdated: number
      itemsAutoCreated: number
      diagnosesCreated: number
      diagnosesUpdated: number
      bundlesCreated: number
      bundlesUpdated: number
      bundleLinesImported: number
      autoCreatedItemNames: string[]
    }
  | {
      success: false
      error: string
    }

type AppConfigValues = {
  labor_cost_per_hour: number
  travel_time_hours: number
  refrigerant_cost_per_lb: number
  profit_per_hour_target: number
}

type RepairTemplate = {
  id: string
  location: string
  component: string
  action: string
  repair_code: string
  invoice_description: string | null
  repair_notes: string | null
  variable_pricing: boolean
  one_shot: boolean
  active: boolean
  repair_bundles: {
    id: string
    flat_rate: number | null
    travel_time_hours: number | null
    work_time_hours: number | null
    total_time_hours: number | null
    labor_cost: number | null
    part_material_cost: number | null
    profit_amount: number | null
    profit_per_hour: number | null
    margin_percent: number | null
    refrigerant_lbs: number | null
    refrigerant_cost: number | null
    materials_label: string | null
    material_cost: number | null
    pricing_notes: string | null
  } | null
}

interface Props {
  counts: {
    items: number
    diagnoses: number
    bundles: number
    bundleLines: number
  }
  appConfig: AppConfigValues | null
  templates: RepairTemplate[]
  canManageCatalog: boolean
  compact?: boolean
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e1da',
      borderRadius: '12px',
      padding: '16px',
    }}>
      <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a18' }}>
        {value}
      </div>
    </div>
  )
}

function numberDraft(value: number | null | undefined) {
  return value == null ? '' : String(value)
}

export default function CatalogAdmin({
  counts,
  appConfig,
  templates,
  canManageCatalog,
  compact = false,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ImportResult | null>(null)
  const [query, setQuery] = useState('')
  const [configDraft, setConfigDraft] = useState<AppConfigValues>(() => ({
    labor_cost_per_hour: appConfig?.labor_cost_per_hour ?? 90,
    travel_time_hours: appConfig?.travel_time_hours ?? 0.5,
    refrigerant_cost_per_lb: appConfig?.refrigerant_cost_per_lb ?? 15,
    profit_per_hour_target: appConfig?.profit_per_hour_target ?? 100,
  }))
  const [configMessage, setConfigMessage] = useState<string | null>(null)

  function runImport(action: () => Promise<ImportResult>) {
    setResult(null)
    startTransition(async () => {
      const nextResult = await action()
      setResult(nextResult)
    })
  }

  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return templates
    return templates.filter(template => [
      template.repair_code,
      template.location,
      template.component,
      template.action,
      template.invoice_description ?? '',
    ].some(value => value.toLowerCase().includes(needle)))
  }, [query, templates])

  function saveConfig() {
    setConfigMessage(null)
    startTransition(async () => {
      const response = await updateAppConfigAction(configDraft)
      setConfigMessage(response.success ? 'Pricing constants saved.' : (response.error ?? 'Save failed.'))
    })
  }

  return (
    <div style={{ maxWidth: compact ? 'unset' : '1100px', margin: compact ? '0' : '0 auto', padding: compact ? 0 : '24px 16px 48px' }}>
      {!compact && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1a1a18', marginBottom: '6px' }}>
            Catalog
          </div>
          <div style={{ fontSize: '14px', color: '#5f5e5a', lineHeight: 1.6, maxWidth: '760px' }}>
            Import the seed catalog once, then manage pricing constants and repair templates directly in the app.
            Historical invoices should come from durable snapshots, while the template catalog stays editable for future work.
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <StatCard label="Items" value={counts.items} />
        <StatCard label="Diagnoses" value={counts.diagnoses} />
        <StatCard label="Bundles" value={counts.bundles} />
        <StatCard label="Bundle Lines" value={counts.bundleLines} />
      </div>

      <div style={{
        background: '#fff',
        border: '1px solid #e2e1da',
        borderRadius: '14px',
        padding: '18px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Import Controls
        </div>
        <div style={{ fontSize: '14px', color: '#5f5e5a', lineHeight: 1.6, marginBottom: '14px' }}>
          The importer is idempotent, so you can re-run it safely when the seed CSV changes. After import, use the editor below for app-managed pricing.
        </div>

        {!canManageCatalog && (
          <RoleBanner text="Catalog management is limited to admin, owner, or dispatcher accounts." />
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => runImport(importFullCatalogAction)}
            disabled={!canManageCatalog || isPending}
            style={primaryButtonStyle(!canManageCatalog || isPending)}
          >
            {isPending ? 'Importing...' : 'Run Full Catalog Import'}
          </button>
          <button
            onClick={() => runImport(importSeedItemsAction)}
            disabled={!canManageCatalog || isPending}
            style={secondaryButtonStyle(!canManageCatalog || isPending)}
          >
            Import Items Only
          </button>
          <button
            onClick={() => runImport(importSeedOperationsAction)}
            disabled={!canManageCatalog || isPending}
            style={secondaryButtonStyle(!canManageCatalog || isPending)}
          >
            Import Bundles Only
          </button>
        </div>
      </div>

      {result && (
        <div style={{
          background: result.success ? '#eef6e7' : '#fcebeb',
          border: `1px solid ${result.success ? '#cfe1bb' : '#f7c1c1'}`,
          borderRadius: '14px',
          padding: '18px',
          marginBottom: '16px',
        }}>
          {result.success ? (
            <>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#244d08', marginBottom: '8px' }}>
                {result.label} complete
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                <SummaryRow label="Rows processed" value={result.importedRows} />
                <SummaryRow label="Items created" value={result.itemsCreated} />
                <SummaryRow label="Items updated" value={result.itemsUpdated} />
                <SummaryRow label="Auto-created items" value={result.itemsAutoCreated} />
                <SummaryRow label="Diagnoses created" value={result.diagnosesCreated} />
                <SummaryRow label="Diagnoses updated" value={result.diagnosesUpdated} />
                <SummaryRow label="Bundles created" value={result.bundlesCreated} />
                <SummaryRow label="Bundles updated" value={result.bundlesUpdated} />
                <SummaryRow label="Bundle lines imported" value={result.bundleLinesImported} />
              </div>
              {result.autoCreatedItemNames.length > 0 && (
                <div style={{ fontSize: '13px', color: '#355b17', lineHeight: 1.6 }}>
                  Auto-created catalog items: {result.autoCreatedItemNames.join(', ')}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#a32d2d', marginBottom: '6px' }}>
                Import failed
              </div>
              <div style={{ fontSize: '13px', color: '#712b13', lineHeight: 1.6 }}>
                {result.error}
              </div>
            </>
          )}
        </div>
      )}

      <div style={{
        background: '#fff',
        border: '1px solid #e2e1da',
        borderRadius: '14px',
        padding: '18px',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Pricing Constants
            </div>
            <div style={{ fontSize: '14px', color: '#5f5e5a', lineHeight: 1.6 }}>
              These defaults mirror the spreadsheet assumptions and support future pricing audits.
            </div>
          </div>
          <button
            onClick={saveConfig}
            disabled={!canManageCatalog || isPending}
            style={primaryButtonStyle(!canManageCatalog || isPending)}
          >
            Save constants
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
          <Field label="Labor Cost / Hour">
            <input
              value={String(configDraft.labor_cost_per_hour)}
              onChange={event => setConfigDraft(current => ({ ...current, labor_cost_per_hour: Number(event.target.value || 0) }))}
              disabled={!canManageCatalog || isPending}
              style={inputStyle}
            />
          </Field>
          <Field label="Travel Time Hours">
            <input
              value={String(configDraft.travel_time_hours)}
              onChange={event => setConfigDraft(current => ({ ...current, travel_time_hours: Number(event.target.value || 0) }))}
              disabled={!canManageCatalog || isPending}
              style={inputStyle}
            />
          </Field>
          <Field label="Refrigerant Cost / LB">
            <input
              value={String(configDraft.refrigerant_cost_per_lb)}
              onChange={event => setConfigDraft(current => ({ ...current, refrigerant_cost_per_lb: Number(event.target.value || 0) }))}
              disabled={!canManageCatalog || isPending}
              style={inputStyle}
            />
          </Field>
          <Field label="Profit Target / Hour">
            <input
              value={String(configDraft.profit_per_hour_target)}
              onChange={event => setConfigDraft(current => ({ ...current, profit_per_hour_target: Number(event.target.value || 0) }))}
              disabled={!canManageCatalog || isPending}
              style={inputStyle}
            />
          </Field>
        </div>

        {configMessage && (
          <div style={{ fontSize: '13px', color: configMessage.includes('saved') ? '#355b17' : '#8b2c2c', marginTop: '12px' }}>
            {configMessage}
          </div>
        )}
      </div>

      <div style={{
        background: '#fff',
        border: '1px solid #e2e1da',
        borderRadius: '14px',
        padding: '18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Repair Templates
            </div>
            <div style={{ fontSize: '14px', color: '#5f5e5a', lineHeight: 1.6 }}>
              Search and edit the imported repair templates directly in the app. Showing the first {templates.length} templates loaded for admin editing.
            </div>
          </div>
          <div style={{ minWidth: '240px', flex: '1 1 260px' }}>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search repair code, location, component..."
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredTemplates.map(template => (
            <RepairTemplateEditor
              key={template.id}
              template={template}
              canManageCatalog={canManageCatalog}
            />
          ))}
          {filteredTemplates.length === 0 && (
            <div style={{ fontSize: '13px', color: '#888780' }}>
              No repair templates matched that search.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RepairTemplateEditor({
  template,
  canManageCatalog,
}: {
  template: RepairTemplate
  canManageCatalog: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    repairCode: template.repair_code,
    invoiceDescription: template.invoice_description ?? '',
    repairNotes: template.repair_notes ?? '',
    variablePricing: template.variable_pricing,
    oneShot: template.one_shot,
    active: template.active,
    flatRate: numberDraft(template.repair_bundles?.flat_rate),
    travelTimeHours: numberDraft(template.repair_bundles?.travel_time_hours),
    workTimeHours: numberDraft(template.repair_bundles?.work_time_hours),
    totalTimeHours: numberDraft(template.repair_bundles?.total_time_hours),
    laborCost: numberDraft(template.repair_bundles?.labor_cost),
    partMaterialCost: numberDraft(template.repair_bundles?.part_material_cost),
    profitAmount: numberDraft(template.repair_bundles?.profit_amount),
    profitPerHour: numberDraft(template.repair_bundles?.profit_per_hour),
    marginPercent: numberDraft(template.repair_bundles?.margin_percent != null ? template.repair_bundles.margin_percent * 100 : null),
    refrigerantLbs: numberDraft(template.repair_bundles?.refrigerant_lbs),
    refrigerantCost: numberDraft(template.repair_bundles?.refrigerant_cost),
    materialsLabel: template.repair_bundles?.materials_label ?? '',
    materialCost: numberDraft(template.repair_bundles?.material_cost),
    pricingNotes: template.repair_bundles?.pricing_notes ?? '',
  })

  function saveTemplate() {
    setMessage(null)
    startTransition(async () => {
      const response = await updateRepairTemplateAction({
        diagnosisId: template.id,
        bundleId: template.repair_bundles?.id ?? null,
        repairCode: draft.repairCode,
        invoiceDescription: draft.invoiceDescription,
        repairNotes: draft.repairNotes,
        variablePricing: draft.variablePricing,
        oneShot: draft.oneShot,
        active: draft.active,
        flatRate: draft.flatRate,
        travelTimeHours: draft.travelTimeHours,
        workTimeHours: draft.workTimeHours,
        totalTimeHours: draft.totalTimeHours,
        laborCost: draft.laborCost,
        partMaterialCost: draft.partMaterialCost,
        profitAmount: draft.profitAmount,
        profitPerHour: draft.profitPerHour,
        marginPercent: draft.marginPercent,
        refrigerantLbs: draft.refrigerantLbs,
        refrigerantCost: draft.refrigerantCost,
        materialsLabel: draft.materialsLabel,
        materialCost: draft.materialCost,
        pricingNotes: draft.pricingNotes,
      })
      setMessage(response.success ? 'Saved.' : (response.error ?? 'Save failed.'))
    })
  }

  return (
    <div style={{
      border: '1px solid #e2e1da',
      borderRadius: '12px',
      padding: '16px',
      background: '#fcfbf8',
    }}>
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a18' }}>
            {template.repair_code}
          </div>
          <div style={{ fontSize: '12px', color: '#6a685f', marginTop: '4px' }}>
            {template.location} / {template.component} / {template.action}
          </div>
        </div>
        <button
          onClick={saveTemplate}
          disabled={!canManageCatalog || isPending}
          style={primaryButtonStyle(!canManageCatalog || isPending)}
        >
          {isPending ? 'Saving...' : 'Save template'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' }}>
        <Field label="Repair Code">
          <input value={draft.repairCode} onChange={event => setDraft(current => ({ ...current, repairCode: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Flat Rate">
          <input value={draft.flatRate} onChange={event => setDraft(current => ({ ...current, flatRate: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Travel Hours">
          <input value={draft.travelTimeHours} onChange={event => setDraft(current => ({ ...current, travelTimeHours: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Work Hours">
          <input value={draft.workTimeHours} onChange={event => setDraft(current => ({ ...current, workTimeHours: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Total Hours">
          <input value={draft.totalTimeHours} onChange={event => setDraft(current => ({ ...current, totalTimeHours: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Labor Cost">
          <input value={draft.laborCost} onChange={event => setDraft(current => ({ ...current, laborCost: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Parts + Material Cost">
          <input value={draft.partMaterialCost} onChange={event => setDraft(current => ({ ...current, partMaterialCost: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Profit Amount">
          <input value={draft.profitAmount} onChange={event => setDraft(current => ({ ...current, profitAmount: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Profit / Hour">
          <input value={draft.profitPerHour} onChange={event => setDraft(current => ({ ...current, profitPerHour: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Margin %">
          <input value={draft.marginPercent} onChange={event => setDraft(current => ({ ...current, marginPercent: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Refrigerant Lbs">
          <input value={draft.refrigerantLbs} onChange={event => setDraft(current => ({ ...current, refrigerantLbs: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Refrigerant Cost">
          <input value={draft.refrigerantCost} onChange={event => setDraft(current => ({ ...current, refrigerantCost: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Materials Label">
          <input value={draft.materialsLabel} onChange={event => setDraft(current => ({ ...current, materialsLabel: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Material Cost">
          <input value={draft.materialCost} onChange={event => setDraft(current => ({ ...current, materialCost: event.target.value }))} style={inputStyle} disabled={!canManageCatalog || isPending} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '10px' }}>
        <Field label="Customer Invoice Description">
          <textarea value={draft.invoiceDescription} onChange={event => setDraft(current => ({ ...current, invoiceDescription: event.target.value }))} style={textareaStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Tech Repair Notes">
          <textarea value={draft.repairNotes} onChange={event => setDraft(current => ({ ...current, repairNotes: event.target.value }))} style={textareaStyle} disabled={!canManageCatalog || isPending} />
        </Field>
        <Field label="Pricing Notes">
          <textarea value={draft.pricingNotes} onChange={event => setDraft(current => ({ ...current, pricingNotes: event.target.value }))} style={textareaStyle} disabled={!canManageCatalog || isPending} />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={checkboxStyle}>
          <input type="checkbox" checked={draft.variablePricing} onChange={event => setDraft(current => ({ ...current, variablePricing: event.target.checked }))} disabled={!canManageCatalog || isPending} />
          Variable pricing
        </label>
        <label style={checkboxStyle}>
          <input type="checkbox" checked={draft.oneShot} onChange={event => setDraft(current => ({ ...current, oneShot: event.target.checked }))} disabled={!canManageCatalog || isPending} />
          One-shot repair
        </label>
        <label style={checkboxStyle}>
          <input type="checkbox" checked={draft.active} onChange={event => setDraft(current => ({ ...current, active: event.target.checked }))} disabled={!canManageCatalog || isPending} />
          Active
        </label>
      </div>

      {message && (
        <div style={{ fontSize: '13px', color: message === 'Saved.' ? '#355b17' : '#8b2c2c', marginTop: '12px' }}>
          {message}
        </div>
      )}
    </div>
  )
}

function RoleBanner({ text }: { text: string }) {
  return (
    <div style={{
      background: '#fcebeb',
      border: '1px solid #f7c1c1',
      color: '#a32d2d',
      borderRadius: '10px',
      padding: '12px 14px',
      fontSize: '13px',
      marginBottom: '14px',
    }}>
      {text}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.55)', borderRadius: '10px', padding: '10px 12px' }}>
      <div style={{ fontSize: '11px', color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a18' }}>
        {value}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function primaryButtonStyle(disabled: boolean) {
  return {
    fontSize: '13px',
    padding: '10px 16px',
    borderRadius: '9px',
    border: '1px solid #185fa5',
    background: disabled ? '#b4b2a9' : '#185fa5',
    color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
  } as const
}

function secondaryButtonStyle(disabled: boolean) {
  return {
    fontSize: '13px',
    padding: '10px 16px',
    borderRadius: '9px',
    border: '1px solid #d3d1c7',
    background: disabled ? '#f3f1eb' : '#fff',
    color: disabled ? '#888780' : '#1a1a18',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
  } as const
}

const inputStyle: CSSProperties = {
  width: '100%',
  fontSize: '13px',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid #d3d1c7',
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '88px',
  resize: 'vertical',
}

const checkboxStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  color: '#1a1a18',
}
