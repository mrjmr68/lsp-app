'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addJobChecklistItem, addJobMessage, addJobRelayEvent, setJobChecklistItemStatus } from './actions'
import { createClient } from '@/utils/supabase/client'
import {
  EXECUTION_RELAY_STEPS,
  getRelayActorLabel,
  getRelayActorTone,
  getRelayStatus,
  RELAY_STEP_BY_KEY,
} from './types'
import type {
  JobCrewMember,
  JobMessage,
  JobMessageRecord,
  JobRelayEvent,
  JobRelayStepDefinition,
  JobRelayStepKey,
  JobWorkflow,
} from './types'

type ActiveTab = 'prep' | 'execution' | 'messages'

interface Props {
  jobId: string
  workflow: JobWorkflow
  jobMessages: JobMessage[]
  crewMembers: JobCrewMember[]
  currentUserId: string
  activeTab: ActiveTab
}

const shellStyle: React.CSSProperties = {
  padding: '16px',
  maxWidth: '760px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e1da',
  borderRadius: '12px',
  padding: '14px 16px',
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function crewLabel(member: JobCrewMember) {
  return `${member.first_name} ${member.last_name}`.trim()
}

function senderLabel(message: JobMessage) {
  if (message.message_type === 'system') return 'System'
  const first = message.users?.first_name ?? ''
  const last = message.users?.last_name ?? ''
  return [first, last].filter(Boolean).join(' ') || 'Crew'
}

function normalizeMessageRecord(message: JobMessageRecord): JobMessage {
  return {
    ...message,
    users: Array.isArray(message.users) ? message.users[0] ?? null : message.users ?? null,
  }
}

function normalizeMessages(messages: JobMessage[]) {
  return messages.map(message => normalizeMessageRecord(message as JobMessageRecord))
}

function ItemSection({
  title,
  items,
  onToggle,
}: {
  title: string
  items: JobWorkflow['job_workflow_items']
  onToggle: (itemId: string, completed: boolean) => void
}) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#888780' }}>Nothing added yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map(item => (
            <label
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 0',
                borderBottom: '1px solid #f1efe8',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={event => onToggle(item.id, event.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', color: item.completed ? '#5f5e5a' : '#1a1a18', textDecoration: item.completed ? 'line-through' : 'none' }}>
                  {item.label}
                </div>
                {item.details && (
                  <div style={{ fontSize: '12px', color: '#888780', marginTop: '3px' }}>
                    {item.details}
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function RelayBoard({
  currentSteps,
  relayCycle,
  relayHistory,
  isPending,
  onSend,
}: {
  currentSteps: JobRelayStepDefinition[]
  relayCycle: number
  relayHistory: JobRelayEvent[]
  isPending: boolean
  onSend: (stepKey: JobRelayStepKey) => void
}) {
  const activeTone = currentSteps[0] ? getRelayActorTone(currentSteps[0].actor) : getRelayActorTone('shared')
  const relayComplete = currentSteps.length === 0

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
        Execution Relay
      </div>

      <div
        style={{
          borderRadius: '12px',
          border: `1px solid ${activeTone.border}`,
          background: activeTone.bg,
          padding: '14px',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: activeTone.fg, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {relayComplete ? 'Execution complete' : `Ball with ${getRelayActorLabel(currentSteps[0].actor)}`}
            </div>
            <div style={{ fontSize: '19px', fontWeight: 700, color: '#1a1a18', marginTop: '4px' }}>
              {relayComplete ? 'Vac good recorded. Move to closeout when support items are done.' : currentSteps.map(step => step.label).join(' or ')}
            </div>
            <div style={{ fontSize: '13px', color: '#5f5e5a', lineHeight: 1.45, marginTop: '6px' }}>
              {relayComplete ? 'The bell sequence is finished for this execution pass.' : currentSteps[0].prompt}
            </div>
          </div>

          <div
            style={{
              borderRadius: '999px',
              background: '#fff',
              color: activeTone.fg,
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 700,
              border: `1px solid ${activeTone.border}`,
            }}
          >
            Cycle {relayCycle}
          </div>
        </div>

        {!relayComplete && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
            {currentSteps.map(step => (
              <button
                key={step.key}
                type="button"
                onClick={() => onSend(step.key)}
                disabled={isPending}
                style={{
                  borderRadius: '999px',
                  border: 'none',
                  background: '#185fa5',
                  color: '#fff',
                  padding: '11px 14px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {getRelayActorLabel(step.actor)} - {step.shortLabel}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {EXECUTION_RELAY_STEPS.map(step => {
          const latestForStep = [...relayHistory].reverse().find(event => event.step.key === step.key) ?? null
          const isComplete = !!latestForStep
          const isActive = currentSteps.some(currentStep => currentStep.key === step.key)
          const tone = getRelayActorTone(step.actor)

          return (
            <div
              key={step.key}
              style={{
                borderRadius: '10px',
                border: isActive ? `1px solid ${tone.border}` : '1px solid #e2e1da',
                background: isActive ? tone.bg : isComplete ? '#faf8f1' : '#fff',
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a18' }}>
                    {getRelayActorLabel(step.actor)} - {step.label}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6d6b63', marginTop: '3px' }}>
                    {step.kind === 'branch' ? 'Loopback branch' : 'Relay step'}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: isActive ? tone.fg : isComplete ? '#42621c' : '#888780', fontWeight: 700 }}>
                  {isActive ? 'Awaiting tap' : isComplete ? `Done in cycle ${latestForStep.cycle}` : 'Waiting'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function InstallWorkspace({ jobId, workflow, jobMessages, crewMembers, currentUserId, activeTab }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [materialLabel, setMaterialLabel] = useState('')
  const [executionLabel, setExecutionLabel] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [messages, setMessages] = useState<JobMessage[]>(normalizeMessages(jobMessages))
  const [error, setError] = useState<string | null>(null)

  const prepItems = useMemo(
    () => workflow.job_workflow_items.filter(item => item.phase === 'prep').sort((a, b) => a.sort_order - b.sort_order),
    [workflow.job_workflow_items],
  )
  const materialItems = useMemo(
    () => workflow.job_workflow_items.filter(item => item.phase === 'materials').sort((a, b) => a.sort_order - b.sort_order),
    [workflow.job_workflow_items],
  )
  const executionItems = useMemo(
    () => workflow.job_workflow_items.filter(item => item.phase === 'execution').sort((a, b) => a.sort_order - b.sort_order),
    [workflow.job_workflow_items],
  )

  useEffect(() => {
    setMessages(normalizeMessages(jobMessages))
  }, [jobMessages])

  useEffect(() => {
    const supabase = createClient()
    let isActive = true

    async function loadMessages() {
      const { data, error: loadError } = await supabase
        .from('job_messages')
        .select(`
          id, message_type, body, quick_action_key, created_at, user_id,
          relay_step_key, relay_sequence, relay_actor, relay_kind, relay_cycle,
          users!job_messages_user_id_fkey(first_name, last_name)
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true })

      if (!loadError && data && isActive) {
        setMessages(data.map(message => normalizeMessageRecord(message as JobMessageRecord)))
      }
    }

    void loadMessages()

    const channel = supabase
      .channel(`job-workspace-${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_workflow_items',
        filter: `workflow_id=eq.${workflow.id}`,
      }, () => router.refresh())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_messages',
        filter: `job_id=eq.${jobId}`,
      }, () => {
        void loadMessages()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_workflows',
        filter: `job_id=eq.${jobId}`,
      }, () => router.refresh())
      .subscribe()

    return () => {
      isActive = false
      void supabase.removeChannel(channel)
    }
  }, [jobId, router, workflow.id])

  function runAction(task: () => Promise<{ error?: string | null }>, onSuccess?: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await task()
      if (result.error) {
        setError(result.error)
        return
      }
      onSuccess?.()
      router.refresh()
    })
  }

  function renderComposer(title: string, value: string, setValue: (value: string) => void, phase: 'materials' | 'execution') {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          {title}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            value={value}
            onChange={event => setValue(event.target.value)}
            placeholder={phase === 'materials' ? 'Add material to the shared load list' : 'Add support checklist item'}
            style={{
              flex: 1,
              minWidth: '220px',
              borderRadius: '8px',
              border: '1px solid #d3d1c7',
              padding: '10px 12px',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={() => runAction(() => addJobChecklistItem(jobId, phase, value), () => setValue(''))}
            disabled={isPending || !value.trim()}
            style={{
              borderRadius: '8px',
              border: 'none',
              background: '#185fa5',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isPending || !value.trim() ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Add
          </button>
        </div>
      </div>
    )
  }

  const relayMessages = useMemo(
    () => messages
      .filter((message): message is JobMessage & { relay_step_key: JobRelayStepKey } =>
        message.message_type === 'relay' && !!message.relay_step_key,
      )
      .slice()
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)),
    [messages],
  )

  const relayHistory = useMemo<JobRelayEvent[]>(
    () =>
      relayMessages.map(message => ({
        step: RELAY_STEP_BY_KEY[message.relay_step_key],
        cycle: message.relay_cycle ?? 1,
      })),
    [relayMessages],
  )

  const relayStatus = useMemo(() => getRelayStatus(relayMessages), [relayMessages])

  const currentRelaySteps = useMemo(
    () => relayStatus.activeStepKeys.map(stepKey => RELAY_STEP_BY_KEY[stepKey]),
    [relayStatus.activeStepKeys],
  )

  const recentRelayMessages = useMemo(
    () =>
      relayMessages
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 6),
    [relayMessages],
  )

  const noteMessages = useMemo(
    () =>
      messages
        .filter(message => message.message_type === 'text' || message.message_type === 'system')
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [messages],
  )

  const showExecutionBoard = activeTab === 'execution' || activeTab === 'messages'

  return (
    <div style={shellStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Shared Workflow
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a18', marginTop: '4px' }}>
              {workflow.workflow_type === 'install' ? 'Install' : 'Major Repair'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {crewMembers.map(member => (
              <span
                key={`${member.id}-${member.assignment_role}`}
                style={{
                  borderRadius: '999px',
                  background: member.id === currentUserId ? '#e6f1fb' : '#f1efe8',
                  color: '#1a1a18',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {crewLabel(member)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'prep' && (
        <>
          <ItemSection
            title="Travel Prep"
            items={prepItems}
            onToggle={(itemId, completed) => runAction(() => setJobChecklistItemStatus(itemId, completed))}
          />
          <ItemSection
            title="Materials"
            items={materialItems}
            onToggle={(itemId, completed) => runAction(() => setJobChecklistItemStatus(itemId, completed))}
          />
          {renderComposer('Add Material', materialLabel, setMaterialLabel, 'materials')}
        </>
      )}

      {showExecutionBoard && (
        <>
          <RelayBoard
            currentSteps={currentRelaySteps}
            relayCycle={relayStatus.cycle}
            relayHistory={relayHistory}
            isPending={isPending}
            onSend={stepKey => runAction(() => addJobRelayEvent(jobId, stepKey))}
          />

          <ItemSection
            title="Support Checklist"
            items={executionItems}
            onToggle={(itemId, completed) => runAction(() => setJobChecklistItemStatus(itemId, completed))}
          />
          {renderComposer('Add Support Item', executionLabel, setExecutionLabel, 'execution')}

          <div style={cardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              Relay History
            </div>
            {recentRelayMessages.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#888780' }}>No bell exchanges yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentRelayMessages.map(message => {
                  const step = message.relay_step_key ? RELAY_STEP_BY_KEY[message.relay_step_key] : null
                  const tone = getRelayActorTone(step?.actor ?? 'shared')
                  return (
                    <div
                      key={message.id}
                      style={{
                        borderRadius: '10px',
                        border: `1px solid ${tone.border}`,
                        background: tone.bg,
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: tone.fg }}>
                          {getRelayActorLabel(step?.actor ?? 'shared')} - {message.body}
                        </span>
                        <span style={{ fontSize: '11px', color: '#6d6b63' }}>
                          {formatTimestamp(message.created_at)}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6d6b63' }}>
                        {senderLabel(message)} / Cycle {message.relay_cycle ?? 1}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              Crew Notes
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                value={messageBody}
                onChange={event => setMessageBody(event.target.value)}
                placeholder="Add an exception or field note"
                style={{
                  flex: 1,
                  minWidth: '220px',
                  borderRadius: '8px',
                  border: '1px solid #d3d1c7',
                  padding: '10px 12px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={() => runAction(() => addJobMessage(jobId, messageBody), () => setMessageBody(''))}
                disabled={isPending || !messageBody.trim()}
                style={{
                  borderRadius: '8px',
                  border: 'none',
                  background: '#185fa5',
                  color: '#fff',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isPending || !messageBody.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Send
              </button>
            </div>

            {activeTab === 'messages' && (
              <div style={{ fontSize: '12px', color: '#6d6b63', marginTop: '10px' }}>
                This tab mirrors the execution board for now so the relay, support checklist, and notes stay on one surface.
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              Notes & System Activity
            </div>
            {noteMessages.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#888780' }}>No notes or system events yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {noteMessages.map(message => (
                  <div
                    key={message.id}
                    style={{
                      borderRadius: '10px',
                      border: '1px solid #e2e1da',
                      background: message.message_type === 'system' ? '#f4f2ec' : '#f8fbff',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: message.message_type === 'system' ? '#5f5e5a' : '#1a1a18' }}>
                        {message.message_type === 'system' ? 'System' : 'Note'} / {senderLabel(message)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#888780' }}>
                        {formatTimestamp(message.created_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#1a1a18', lineHeight: 1.5 }}>
                      {message.body}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {error && (
        <div style={{
          background: '#fcebeb',
          border: '1px solid #f7c1c1',
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '13px',
          color: '#a32d2d',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
