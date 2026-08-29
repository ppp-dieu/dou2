alter table public.consultations
  add column reminder_24h_sent_at timestamptz null,
  add column reminder_7d_sent_at timestamptz null;

comment on column public.consultations.reminder_24h_sent_at is
  'The time the unanswered-consultation reminder due after 24 hours was sent.';

comment on column public.consultations.reminder_7d_sent_at is
  'The time the unanswered-consultation reminder due after 7 days was sent.';
