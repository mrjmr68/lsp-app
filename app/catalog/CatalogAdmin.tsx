'use client'

import { useState, useTransition } from 'react'
import {
  importFullCatalogAction,
  importSeedItemsAction,
  importSeedOperationsAction,
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

interface Props {
  counts: {
    items: number
    diagnoses: number
    bundles: number
    bundleLines: number
  }
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

export default function CatalogAdmin({ counts, canManageCatalog, compact = false }: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ImportResult | null>(null)

  function runImport(action: () => Promise<ImportResult>) {
    setResult(null)
    startTransition(async () => {
      const nextResult = await action()
      setResult(nextResult)
    })
  }

  return (
    <div style={{ maxWidth: compact ? 'unset' : '900px', margin: compact ? '0' : '0 auto', padding: compact ? 0 : '24px 16px 48px' }}>
      {!compact && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1a1a18', marginBottom: '6px' }}>
            Catalog
          </div>
          <div style={{ fontSize: '14px', color: '#5f5e5a', lineHeight: 1.6, maxWidth: '680px' }}>
            Import the seed catalog directly from the repo files in <code>DATA/ITEMS.csv</code> and <code>DATA/Operations - Invoicing - V2.csv</code>.
            The importer is idempotent, so you can safely re-run it as the pricing sheet changes.
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
          Run the full catalog import first. The split buttons are handy later if you only update the item master or only update repair bundles.
        </div>

        {!canManageCatalog && (
          <div style={{
            background: '#fcebeb',
            border: '1px solid #f7c1c1',
            color: '#a32d2d',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '13px',
            marginBottom: '14px',
          }}>
            Catalog management is limited to admin, owner, or dispatcher accounts.
          </div>
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
            style={secondaryButtonStyle}
          >
            Import Items Only
          </button>
          <button
            onClick={() => runImport(importSeedOperationsAction)}
            disabled={!canManageCatalog || isPending}
            style={secondaryButtonStyle}
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
        background: '#fff8ea',
        border: '1px solid #f0d59c',
        borderRadius: '14px',
        padding: '18px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#8a6412', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Notes
        </div>
        <div style={{ fontSize: '13px', color: '#6b531b', lineHeight: 1.7 }}>
          The operations importer handles shorthand names like <code>Standard</code>, <code>Minimal</code>, <code>Rev Valve</code>, and refrigerant quantity rows.
          If the operations sheet references an item that is not in the master item list yet, the importer will create it so the bundle can still be built.
        </div>
      </div>
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

const secondaryButtonStyle = {
  fontSize: '13px',
  padding: '10px 16px',
  borderRadius: '9px',
  border: '1px solid #d3d1c7',
  background: '#fff',
  color: '#1a1a18',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 600,
} as const
