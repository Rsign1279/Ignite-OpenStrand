create table public.student_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 80),
 strand text not null check (strand in ('technology','health-sciences','law-public-policy','aviation','culinary','engineering','construction','education','business','digital-media')),
 ignite_year integer not null check (ignite_year in (1,2))
);
alter table public.student_profiles enable row level security;
revoke all on public.student_profiles from anon, authenticated;
grant select, insert on public.student_profiles to authenticated;
grant select on public.student_profiles to service_role;
create policy "Students read own profile" on public.student_profiles for select to authenticated using ((select auth.uid()) = user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'true');
create policy "Students insert own profile" on public.student_profiles for insert to authenticated with check ((select auth.uid()) = user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'true');
-- Staff access uses a server-verified email allow-list before a server-only service role query.
-- No client role can update or delete a profile; there are no interview content tables.
