-- Synthetic QA identities must not inflate student pilot statistics.
-- Existing registrations remain unmarked student identities.
alter table public.student_profiles add column qa_cohort_id uuid;

-- A student may insert only the original registration fields. A special name
-- or direct REST payload cannot mark a real identity as QA and hide its data.
revoke insert on public.student_profiles from authenticated;
grant insert (user_id,name,strand,ignite_year) on public.student_profiles to authenticated;
-- Teacher tooling may classify exact, verified test identity IDs only.
grant update (qa_cohort_id) on public.student_profiles to service_role;
-- Existing ownership RLS, SELECT access, and denial of student UPDATE/DELETE stay intact.
notify pgrst, 'reload schema';
