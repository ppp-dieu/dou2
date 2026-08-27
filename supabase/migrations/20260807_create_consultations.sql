-- Consultation storage for the LINE LIFF app.
-- The application uses a server-side Supabase client, so these tables do not
-- expose direct anon/authenticated access.

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null
    references public.couples (id) on update cascade on delete restrict,
  consultant_user_id uuid not null
    references public.users (id) on update cascade on delete restrict,
  respondent_user_id uuid not null
    references public.users (id) on update cascade on delete restrict,
  status text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.consultation_answers (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null
    references public.consultations (id) on update cascade on delete cascade,
  role text not null,
  qa_pairs jsonb not null,
  completed_at timestamptz not null default now(),

  constraint consultation_answers_role_check
    check (role in ('consultant', 'respondent')),
  constraint consultation_answers_four_qa_pairs_check
    check (
      jsonb_typeof(qa_pairs) = 'array'
      and jsonb_array_length(qa_pairs) = 4
    ),
  constraint consultation_answers_one_per_role_key
    unique (consultation_id, role)
);

create index consultations_couple_started_at_idx
  on public.consultations (couple_id, started_at desc);

create index consultations_consultant_user_id_idx
  on public.consultations (consultant_user_id);

create index consultations_respondent_user_id_idx
  on public.consultations (respondent_user_id);

comment on table public.consultations is
  'A consultation between the two users belonging to a couple.';
comment on column public.consultations.status is
  'Application-defined workflow state; values are intentionally not fixed by the database yet.';
comment on table public.consultation_answers is
  'The four AI question-and-answer pairs submitted by one consultation role.';
comment on column public.consultation_answers.qa_pairs is
  'A JSON array containing exactly four question-and-answer objects.';

alter table public.consultations enable row level security;
alter table public.consultation_answers enable row level security;

revoke all on table public.consultations
  from anon, authenticated;
revoke all on table public.consultation_answers
  from anon, authenticated;

grant all on table public.consultations to service_role;
grant all on table public.consultation_answers to service_role;
