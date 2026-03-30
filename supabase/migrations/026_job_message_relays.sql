-- ============================================================
-- Migration 026: Relay metadata for shared workflow job messages
-- Adds the execution bell-sequence contract without rewriting 021.
-- ============================================================

alter table public.job_messages
  add column if not exists relay_step_key text,
  add column if not exists relay_sequence integer,
  add column if not exists relay_actor text,
  add column if not exists relay_kind text,
  add column if not exists relay_cycle integer;

alter table public.job_messages
  drop constraint if exists job_messages_message_type_check;

alter table public.job_messages
  add constraint job_messages_message_type_check
  check (message_type in ('text', 'quick_action', 'system', 'relay'));

alter table public.job_messages
  drop constraint if exists job_messages_relay_actor_check;

alter table public.job_messages
  add constraint job_messages_relay_actor_check
  check (
    relay_actor is null
    or relay_actor in ('field_outside', 'field_inside', 'shared')
  );

alter table public.job_messages
  drop constraint if exists job_messages_relay_kind_check;

alter table public.job_messages
  add constraint job_messages_relay_kind_check
  check (
    relay_kind is null
    or relay_kind in ('step', 'branch')
  );

alter table public.job_messages
  drop constraint if exists job_messages_relay_step_key_check;

alter table public.job_messages
  add constraint job_messages_relay_step_key_check
  check (
    relay_step_key is null
    or relay_step_key in (
      'recovery_complete',
      'ready_to_purge',
      'ok_to_purge',
      'ready_to_braze',
      'nitrogen_flowing',
      'ready_to_test',
      'test_on',
      'leak_here',
      'test_holding',
      'vac_pulling',
      'vac_good'
    )
  );

alter table public.job_messages
  drop constraint if exists job_messages_relay_payload_check;

alter table public.job_messages
  add constraint job_messages_relay_payload_check
  check (
    message_type <> 'relay'
    or (
      relay_step_key is not null
      and relay_sequence is not null
      and relay_actor is not null
      and relay_kind is not null
      and relay_cycle is not null
    )
  );

create index if not exists job_messages_job_relay_created_idx
  on public.job_messages(job_id, message_type, created_at desc);
