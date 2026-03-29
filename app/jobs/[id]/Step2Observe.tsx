'use client'

import { Job, ObservationCircuitState, ObservedComponentState } from './types'
import ObservationWorkspace from './ObservationWorkspace'

interface Props {
  job: Job
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

export default function Step2Observe(props: Props) {
  return (
    <ObservationWorkspace
      {...props}
      showSystemCard
      showRulesOfThumb={false}
    />
  )
}
