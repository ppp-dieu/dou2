-- Server-only partner RPCs for a LINE LIFF app that does not use Supabase Auth.
-- Run this file once in the Supabase SQL Editor before deploying the app changes.

drop function if exists public.issue_couple_invite();
drop function if exists public.join_couple_with_code(text);
drop function if exists public.end_couple_relationship();

create or replace function public.issue_couple_invite_for_user(
  actor_user_id uuid
)
returns table (
  couple_id uuid,
  code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_code text;
  expiration_time timestamptz;
  target_couple_id uuid;
  existing_code text;
  existing_expiration timestamptz;
begin
  if actor_user_id is null or not exists (
    select 1 from public.users as u where u.id = actor_user_id
  ) then
    raise exception 'ユーザーが見つかりません';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_user_id::text, 0)
  );

  if exists (
    select 1
    from public.couples as c
    where c.status = 'connected'
      and (c.member_a_id = actor_user_id or c.member_b_id = actor_user_id)
  ) then
    raise exception 'すでにパートナーと連携しています';
  end if;

  select c.id, c.invite_code, c.invite_code_expires_at
  into target_couple_id, existing_code, existing_expiration
  from public.couples as c
  where c.status = 'pending' and c.member_a_id = actor_user_id
  order by c.created_at desc
  limit 1
  for update;

  if target_couple_id is not null
    and existing_code is not null
    and existing_expiration > now()
  then
    return query select target_couple_id, existing_code, existing_expiration;
    return;
  end if;

  loop
    generated_code := upper(
      substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)
    );
    exit when not exists (
      select 1 from public.couples as c where c.invite_code = generated_code
    );
  end loop;

  expiration_time := now() + interval '24 hours';

  if target_couple_id is null then
    insert into public.couples (
      member_a_id,
      status,
      invite_code,
      invite_code_expires_at,
      invite_code_issued_by
    )
    values (
      actor_user_id,
      'pending',
      generated_code,
      expiration_time,
      actor_user_id
    )
    returning id into target_couple_id;
  else
    update public.couples as c
    set
      invite_code = generated_code,
      invite_code_expires_at = expiration_time,
      invite_code_issued_by = actor_user_id,
      updated_at = now()
    where c.id = target_couple_id;
  end if;

  return query select target_couple_id, generated_code, expiration_time;
end;
$$;

create or replace function public.join_couple_with_code_for_user(
  actor_user_id uuid,
  input_code text
)
returns table (
  couple_id uuid,
  connected_time timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text := upper(btrim(input_code));
  target_couple_id uuid;
  inviter_user_id uuid;
  connection_time timestamptz := now();
begin
  if actor_user_id is null or not exists (
    select 1 from public.users as u where u.id = actor_user_id
  ) then
    raise exception 'ユーザーが見つかりません';
  end if;

  if normalized_code is null or normalized_code = '' then
    raise exception '連携コードを入力してください';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_user_id::text, 0)
  );

  select c.id, c.member_a_id
  into target_couple_id, inviter_user_id
  from public.couples as c
  where c.invite_code = normalized_code
    and c.status = 'pending'
    and c.invite_code_expires_at > now()
  for update;

  if target_couple_id is null then
    raise exception '連携コードが無効または期限切れです';
  end if;

  if inviter_user_id = actor_user_id then
    raise exception '自分が発行したコードは使用できません';
  end if;

  if exists (
    select 1
    from public.couples as c
    where c.status in ('pending', 'connected')
      and (c.member_a_id = actor_user_id or c.member_b_id = actor_user_id)
  ) then
    raise exception 'すでに有効な連携または招待があります';
  end if;

  update public.couples as c
  set
    member_b_id = actor_user_id,
    status = 'connected',
    invite_code = null,
    invite_code_expires_at = null,
    invite_code_issued_by = null,
    connected_at = connection_time,
    updated_at = connection_time
  where c.id = target_couple_id;

  return query select target_couple_id, connection_time;
end;
$$;

create or replace function public.end_couple_relationship_for_user(
  actor_user_id uuid
)
returns table (
  couple_id uuid,
  ended_time timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_couple_id uuid;
  end_time timestamptz := now();
begin
  if actor_user_id is null then
    raise exception 'ユーザーが見つかりません';
  end if;

  select c.id
  into target_couple_id
  from public.couples as c
  where c.status = 'connected'
    and (c.member_a_id = actor_user_id or c.member_b_id = actor_user_id)
  order by c.created_at desc
  limit 1
  for update;

  if target_couple_id is null then
    raise exception '連携中のパートナーが見つかりません';
  end if;

  update public.couples as c
  set status = 'ended', ended_at = end_time, updated_at = end_time
  where c.id = target_couple_id;

  return query select target_couple_id, end_time;
end;
$$;

revoke all on function public.issue_couple_invite_for_user(uuid)
  from public, anon, authenticated;
revoke all on function public.join_couple_with_code_for_user(uuid, text)
  from public, anon, authenticated;
revoke all on function public.end_couple_relationship_for_user(uuid)
  from public, anon, authenticated;

grant execute on function public.issue_couple_invite_for_user(uuid)
  to service_role;
grant execute on function public.join_couple_with_code_for_user(uuid, text)
  to service_role;
grant execute on function public.end_couple_relationship_for_user(uuid)
  to service_role;
