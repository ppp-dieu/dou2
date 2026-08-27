-- Final, user-confirmed consultation results.
-- AI-generated candidates are not stored in this table.

create table public.consultation_results (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null
    references public.consultations (id) on update cascade on delete cascade,
  role text not null,
  event text not null,
  feelings text[] not null,
  wish text not null,
  created_at timestamptz not null default now(),

  constraint consultation_results_role_check
    check (role in ('consultant', 'respondent')),
  constraint consultation_results_event_not_blank_check
    check (btrim(event) <> ''),
  constraint consultation_results_feelings_not_empty_check
    check (
      cardinality(feelings) > 0
      and array_position(feelings, null) is null
      and array_position(feelings, '') is null
    ),
  constraint consultation_results_wish_not_blank_check
    check (btrim(wish) <> ''),
  constraint consultation_results_one_per_role_key
    unique (consultation_id, role),
  constraint consultation_results_matching_answers_fkey
    foreign key (consultation_id, role)
    references public.consultation_answers (consultation_id, role)
    on update cascade
    on delete cascade
);

comment on table public.consultation_results is
  'The final user-confirmed result for one role in a consultation.';
comment on column public.consultation_results.event is
  'The final user-confirmed description of what happened.';
comment on column public.consultation_results.feelings is
  'The final user-confirmed set of feelings.';
comment on column public.consultation_results.wish is
  'The final user-confirmed wish, displayed in the application as the future section.';
comment on column public.consultation_results.created_at is
  'The time the user confirmed and sent the result to their partner.';

create function public.prevent_consultation_result_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'consultation results cannot be updated after creation';
end;
$$;

create trigger consultation_results_prevent_update
before update on public.consultation_results
for each row
execute function public.prevent_consultation_result_update();

alter table public.consultation_results enable row level security;

revoke all on table public.consultation_results
  from anon, authenticated, service_role;

grant select, insert on table public.consultation_results to service_role;

revoke all on function public.prevent_consultation_result_update()
  from public, anon, authenticated, service_role;
