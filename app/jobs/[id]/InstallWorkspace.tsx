'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addJobChecklistItem, addJobMessage, addJobQuickAction, setJobChecklistItemStatus } from './actions'
import { JobCrewMember, JobMessage, JobWorkflow } from './types'
import { WORKFLOW_QUICK_ACTIONS } from '@/utils/job-workflows'
import { createClient } from '@/utils/supabase/client'

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

export default function InstallWorkspace({ jobId, workflow, jobMessages, crewMembers, currentUserId, activeTab }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [materialLabel, setMaterialLabel] = useState('')
  const [executionLabel, setExecutionLabel] = useState('')
  const [messageBody, setMessageBody] = useState('')
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
    const supabase = createClient()
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
      }, () => router.refresh())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_workflows',
        filter: `job_id=eq.${jobId}`,
      }, () => router.refresh())
      .subscribe()

    return () => {
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
            placeholder={phase === 'materials' ? 'Add material to the shared load list' : 'Add execution step'}
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

      {activeTab === 'execution' && (
        <>
          <ItemSection
            title="Execution"
            items={executionItems}
            onToggle={(itemId, completed) => runAction(() => setJobChecklistItemStatus(itemId, completed))}
          />
          {renderComposer('Add Execution Step', executionLabel, setExecutionLabel, 'execution')}
        </>
      )}

      {activeTab === 'messages' && (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              Quick Check-Ins
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {WORKFLOW_QUICK_ACTIONS.map(action => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => runAction(() => addJobQuickAction(jobId, action.key, action.label))}
                  disabled={isPending}
                  style={{
                    borderRadius: '999px',
                    border: '1px solid #d3d1c7',
                    background: '#fff',
                    color: '#1a1a18',
                    padding: '9px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              New Message
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                value={messageBody}
                onChange={event => setMessageBody(event.target.value)}
                placeholder="Send a crew update"
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
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              Activity
            </div>
            {jobMessages.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#888780' }}>No messages yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {jobMessages.map(message => (
                  <div key={message.id} style={{ borderBottom: '1px solid #f1efe8', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a18' }}>
                        {senderLabel(message)}
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
