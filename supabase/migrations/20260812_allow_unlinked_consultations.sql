-- Allow a consultation to start before the consultant connects a partner.
-- The application fills these references after the couple is connected.

alter table public.consultations
  alter column couple_id drop not null,
  alter column respondent_user_id drop not null;

comment on column public.consultations.couple_id is
  'The connected couple. NULL until the consultant connects a partner.';

comment on column public.consultations.respondent_user_id is
  'The partner who responds. NULL until the consultant connects a partner.';
