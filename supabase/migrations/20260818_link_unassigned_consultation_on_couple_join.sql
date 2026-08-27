-- Connect each new couple member's latest unassigned in-progress consultation
-- in the same transaction that establishes the couple relationship.

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
    where c.status = 'connected'
      and (c.member_a_id = actor_user_id or c.member_b_id = actor_user_id)
  ) then
    raise exception 'すでにパートナーと連携しています';
  end if;

  update public.couples as c
  set
    status = 'ended',
    invite_code = null,
    invite_code_expires_at = null,
    invite_code_issued_by = null,
    ended_at = connection_time,
    updated_at = connection_time
  where c.status = 'pending'
    and c.member_a_id = actor_user_id
    and c.id <> target_couple_id;

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

  -- The application currently reads the latest in-progress consultation for a
  -- consultant, but does not enforce one active consultation in the database.
  -- Therefore, link at most that latest consultation for each new member.
  with couple_members (user_id) as (
    values (inviter_user_id), (actor_user_id)
  ),
  latest_unassigned as (
    select selected_consultation.id
    from couple_members
    cross join lateral (
      select consultation.id
      from public.consultations as consultation
      where consultation.consultant_user_id = couple_members.user_id
        and consultation.status = 'in_progress'
        and consultation.couple_id is null
        and consultation.respondent_user_id is null
      order by consultation.started_at desc, consultation.id desc
      limit 1
      for update
    ) as selected_consultation
  )
  update public.consultations as consultation
  set
    couple_id = target_couple_id,
    respondent_user_id = case
      when consultation.consultant_user_id = inviter_user_id then actor_user_id
      else inviter_user_id
    end
  from latest_unassigned
  where consultation.id = latest_unassigned.id
    and consultation.couple_id is null
    and consultation.respondent_user_id is null;

  return query select target_couple_id, connection_time;
end;
$$;

revoke all on function public.join_couple_with_code_for_user(uuid, text)
  from public, anon, authenticated;
grant execute on function public.join_couple_with_code_for_user(uuid, text)
  to service_role;
