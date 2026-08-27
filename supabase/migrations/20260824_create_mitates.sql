create table public.mitates (
  id uuid primary key default gen_random_uuid(),

  couple_id uuid not null
    references public.couples(id)
    on delete restrict,

  consultation_id uuid not null
    references public.consultations(id)
    on delete cascade,

  title text not null,
  event_summary text not null,

  consultant_states jsonb not null,
  respondent_states jsonb not null,
  suggestions jsonb not null,

  created_at timestamptz not null default now(),

  constraint mitates_consultation_id_key
    unique (consultation_id),

  constraint mitates_consultant_states_is_array
    check (
      jsonb_typeof(consultant_states) = 'array'
      and jsonb_array_length(consultant_states) = 3
    ),

  constraint mitates_respondent_states_is_array
    check (
      jsonb_typeof(respondent_states) = 'array'
      and jsonb_array_length(respondent_states) = 3
    ),

  constraint mitates_suggestions_is_array
    check (
      jsonb_typeof(suggestions) = 'array'
      and jsonb_array_length(suggestions) = 3
    ),

  constraint mitates_suggestions_labels
    check (
      suggestions -> 0 ->> 'label' = 'A'
      and suggestions -> 1 ->> 'label' = 'B'
      and suggestions -> 2 ->> 'label' = 'C'
    )
);

create index mitates_created_at_idx
  on public.mitates (created_at desc);

create index mitates_couple_id_created_at_idx
  on public.mitates (couple_id, created_at desc);

create index mitates_consultation_id_idx
  on public.mitates (consultation_id);

alter table public.mitates enable row level security;

revoke all on public.mitates from anon;
revoke all on public.mitates from authenticated;

grant all on public.mitates to service_role;
