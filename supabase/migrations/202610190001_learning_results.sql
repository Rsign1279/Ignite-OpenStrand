-- Learning results explicitly requested by the program owner. No answer or audio columns.
create table public.learning_results (
 user_id uuid primary key references public.student_profiles(user_id) on delete cascade,
 pre_scores jsonb check (pre_scores is null or jsonb_typeof(pre_scores) = 'object'),
 post_scores jsonb check (post_scores is null or jsonb_typeof(post_scores) = 'object'),
 transfer_star jsonb check (transfer_star is null or jsonb_typeof(transfer_star) = 'object'),
 updated_at timestamptz not null default now(),
 completed_at timestamptz
);
alter table public.learning_results enable row level security;
revoke all on public.learning_results from anon, authenticated;
grant select, insert, update on public.learning_results to service_role;
-- No browser policies: only server-generated evaluations can be saved or read by staff.
