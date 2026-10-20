-- Unlimited scored practice uses the same rubric and protected attempt history.
alter table public.interview_attempts drop constraint interview_attempts_stage_check;
alter table public.interview_attempts add constraint interview_attempts_stage_check check (stage in ('pre','post','practice'));
