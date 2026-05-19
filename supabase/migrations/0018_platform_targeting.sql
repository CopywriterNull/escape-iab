-- Migration 0018 — per-merchant platform targeting.
--
-- Default posture: Instagram only. Operators can opt merchants into Threads,
-- Facebook/Messenger, or Discord from dashboard settings.

alter table public.merchants
  add column if not exists escape_instagram boolean not null default true,
  add column if not exists escape_threads boolean not null default false,
  add column if not exists escape_facebook boolean not null default false,
  add column if not exists escape_messenger boolean not null default false,
  add column if not exists escape_discord boolean not null default false;

update public.merchants
set
  escape_instagram = coalesce(escape_instagram, true),
  escape_threads = coalesce(escape_threads, false),
  escape_facebook = coalesce(escape_facebook, false),
  escape_messenger = coalesce(escape_messenger, false),
  escape_discord = coalesce(escape_discord, false);

alter table public.escape_events
  drop constraint if exists escape_events_iab_kind_check;

alter table public.escape_events
  add constraint escape_events_iab_kind_check
  check (iab_kind in (
    'instagram',
    'threads',
    'facebook',
    'messenger',
    'tiktok',
    'snapchat',
    'pinterest',
    'discord',
    'line',
    'wechat',
    'webview'
  ));
