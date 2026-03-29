'use client'

import { useState } from 'react'
import ObservationWorkspace from './ObservationWorkspace'
import { DiagnosisItem, Job, ObservationCircuitState, ObservedComponentState } from './types'

interface Props {
  job: Job
  diagnoses: DiagnosisItem[]
  selectedDiagnosis: DiagnosisItem | null
  onSelect: (diagnosis: DiagnosisItem | null) => void
  workflowMode: 'diagnosis' | 'adhoc'
  setWorkflowMode: (mode: 'diagnosis' | 'adhoc') => void
  adhocDescription: string
  setAdhocDescription: (value: string) => void
  adhocError: string | null
  arrivedLat: number | null
  arrivedLng: number | null
  tstatMode: string
  setTstatMode: (value: string) => void
  tstatFan: string
  setTstatFan: (value: string) => void
  tempOutdoor: string
  setTempOutdoor: (value: string) => void
  tempOutdoorAuto: number | null
  setTempOutdoorAuto: (value: number | null) => void
  tempReturn: string
  setTempReturn: (value: string) => void
  tempSupply: string
  setTempSupply: (value: string) => void
  observationNotes: string
  setObservationNotes: (value: string) => void
  observationFiles: File[]
  setObservationFiles: (files: File[]) => void
  observationCircuits: ObservationCircuitState[]
  setObservationCircuits: React.Dispatch<React.SetStateAction<ObservationCircuitState[]>>
  activeCircuit: 1 | 2
  setActiveCircuit: (value: 1 | 2) => void
  circuit2Enabled: boolean
  setCircuit2Enabled: React.Dispatch<React.SetStateAction<boolean>>
  linkedSystemId: string | null
  systemName: string
  setSystemName: (value: string) => void
  systemType: string
  setSystemType: (value: string) => void
  servedAreas: string
  setServedAreas: (value: string) => void
  thermostatLocation: string
  setThermostatLocation: (value: string) => void
  equipmentLocation: string
  setEquipmentLocation: (value: string) => void
  systemNotes: string
  setSystemNotes: (value: string) => void
  sharedTonnage: string
  setSharedTonnage: (value: string) => void
  sharedRefrigerant: string
  setSharedRefrigerant: (value: string) => void
  rtuControls: string[]
  setRtuControls: React.Dispatch<React.SetStateAction<string[]>>
  rtuControlsNote: string
  setRtuControlsNote: (value: string) => void
  components: ObservedComponentState[]
  setComponents: React.Dispatch<React.SetStateAction<ObservedComponentState[]>>
  observeSystemError: string | null
}

function filterDiagnoses(list: DiagnosisItem[], query: string) {
  if (!query.trim()) return list
  const lower = query.toLowerCase()
  return list.filter(diagnosis =>
    [diagnosis.repair_code, diagnosis.invoice_description, diagnosis.location, diagnosis.component, diagnosis.action, diagnosis.cat1, diagnosis.cat2]
      .some(field => field?.toLowerCase().includes(lower)),
  )
}

export default function Step3Diagnose(props: Props) {
  const {
    diagnoses,
    selectedDiagnosis,
    onSelect,
    workflowMode,
    setWorkflowMode,
    adhocDescription,
    setAdhocDescription,
    adhocError,
    ...observationProps
  } = props

  const [query, setQuery] = useState('')
  const [showNoMatch, setShowNoMatch] = useState(false)

  const filtered = filterDiagnoses(diagnoses, query)

  return (
    <div>
      <ObservationWorkspace
        {...observationProps}
        showSystemCard={false}
        showRulesOfThumb
      />

      <div style={{ padding: '0 16px 16px', maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setWorkflowMode('diagnosis')}
            style={{
              padding: '8px 14px',
              borderRadius: '999px',
              border: workflowMode === 'diagnosis' ? '1px solid #185fa5' : '1px solid #d3d1c7',
              background: workflowMode === 'diagnosis' ? '#e6f1fb' : '#fff',
              color: workflowMode === 'diagnosis' ? '#185fa5' : '#5f5e5a',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '12px',
            }}
          >
            Diagnosis
          </button>
          <button
            type="button"
            onClick={() => {
              onSelect(null)
              setWorkflowMode('adhoc')
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '999px',
              border: workflowMode === 'adhoc' ? '1px solid #854f0b' : '1px solid #d3d1c7',
              background: workflowMode === 'adhoc' ? '#faeeda' : '#fff',
              color: workflowMode === 'adhoc' ? '#854f0b' : '#5f5e5a',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '12px',
            }}
          >
            Ad-hoc repair
          </button>
        </div>

        {workflowMode === 'diagnosis' ? (
          <>
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search diagnosis codes..."
          style={{
            width: '100%',
            fontSize: '14px',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '1px solid #d3d1c7',
            fontFamily: 'inherit',
            outline: 'none',
            marginBottom: '10px',
            boxSizing: 'border-box',
            background: '#fff',
          }}
        />

        {selectedDiagnosis && (
          <div style={{
            background: '#e6f1fb',
            border: '1px solid #a8c8f0',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '10px',
            fontSize: '12px',
            color: '#185fa5',
          }}>
            Selected: <strong>{selectedDiagnosis.repair_code}</strong>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', maxHeight: '340px', overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: '13px', color: '#888780', padding: '12px 0' }}>
              No codes match "{query}"
            </div>
          )}
          {filtered.map(diagnosis => {
            const active = selectedDiagnosis?.id === diagnosis.id
            return (
              <button
                key={diagnosis.id}
                onClick={() => {
                  setWorkflowMode('diagnosis')
                  onSelect(diagnosis)
                }}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: active ? '1.5px solid #378add' : '1px solid #e2e1da',
                  background: active ? '#f0f7ff' : '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#185fa5', fontFamily: 'monospace', marginBottom: '2px' }}>
                  {diagnosis.repair_code}
                </div>
                <div style={{ fontSize: '12px', color: '#5f5e5a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {diagnosis.invoice_description ?? '-'}
                </div>
              </button>
            )
          })}
        </div>

        {!showNoMatch ? (
          <button
            onClick={() => {
              setShowNoMatch(true)
              onSelect(null)
              setWorkflowMode('adhoc')
            }}
            style={{ fontSize: '12px', color: '#888780', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}
          >
            {'Nothing matches ->'}
          </button>
        ) : (
          <div style={{
            background: '#faeeda',
            border: '1px solid #f5c97a',
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '12px',
            color: '#633806',
          }}>
            <strong>Use the ad-hoc repair path instead.</strong> If no standard code fits, switch to ad-hoc repair and describe the work for owner review.
          </div>
        )}
          </>
        ) : (
          <div style={{
            background: '#fff',
            border: '1px solid #e2e1da',
            borderRadius: '12px',
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a18', marginBottom: '6px' }}>
              Ad-hoc repair
            </div>
            <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.5, marginBottom: '10px' }}>
              Use this when no standard diagnosis fits. The owner will review your ad-hoc repair, price it, and decide whether to keep it one-off or promote it into the catalog later.
            </div>
            <textarea
              rows={4}
              value={adhocDescription}
              onChange={event => setAdhocDescription(event.target.value)}
              placeholder="Describe the repair clearly enough for owner review."
              style={{
                width: '100%',
                fontSize: '13px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #d3d1c7',
                fontFamily: 'inherit',
                resize: 'vertical',
                lineHeight: 1.5,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            {adhocError && (
              <div style={{
                background: '#fcebeb',
                border: '1px solid #f7c1c1',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#a32d2d',
                marginTop: '10px',
              }}>
                {adhocError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
