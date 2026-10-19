-- Explicitly requested staff-only answer/feedback review. Browser clients cannot write scores.
create table public.interview_attempts (
 id uuid primary key,
 student_id uuid not null references public.student_profiles(user_id) on delete cascade,
 question_id text not null check(length(question_id) between 1 and 100),
 question_text text not null check(length(question_text) between 1 and 500),
 stage text not null check(stage in ('pre','post')),
 attempt_number integer not null check(attempt_number > 0),
 situation_task integer not null check(situation_task between 0 and 3),
 personal_actions integer not null check(personal_actions between 0 and 3),
 result_impact integer not null check(result_impact between 0 and 3),
 communication integer not null check(communication between 0 and 3),
 total_score integer generated always as (situation_task+personal_actions+result_impact+communication) stored,
 created_at timestamptz not null default now(),
 answer_text text check(length(answer_text)<=16000),
 feedback_text text check(length(feedback_text)<=2000),
 evaluation_json jsonb,
 is_legacy boolean not null default false,
 unique(student_id,question_id,attempt_number)
);
create index interview_attempts_student_date on public.interview_attempts(student_id,created_at);
create index interview_attempts_date on public.interview_attempts(created_at);
alter table public.interview_attempts enable row level security;
revoke all on public.interview_attempts from anon,authenticated;
grant select on public.interview_attempts to authenticated;
grant select,insert on public.interview_attempts to service_role;
create policy "Students read own attempts" on public.interview_attempts for select to authenticated
 using ((select auth.uid())=student_id and coalesce((select auth.jwt()->>'is_anonymous'),'false')='true');
-- Retry-safe append with a per-student/question transaction lock; client supplies only request ID.
create function public.record_interview_attempt(p_student_id uuid,p_request_id uuid,p_question_id text,p_question_text text,p_stage text,p_scores jsonb,p_answer text,p_feedback text,p_evaluation jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare existing_student uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_student_id::text || ':' || p_question_id,0));
 select student_id into existing_student from public.interview_attempts where id=p_request_id;
 if found then
  if existing_student<>p_student_id then raise exception 'Request ID conflict'; end if;
  return p_request_id;
 end if;
 insert into public.interview_attempts(id,student_id,question_id,question_text,stage,attempt_number,situation_task,personal_actions,result_impact,communication,answer_text,feedback_text,evaluation_json)
 select p_request_id,p_student_id,p_question_id,p_question_text,p_stage,coalesce(max(attempt_number),0)+1,
 (p_scores->>'situationTask')::int,(p_scores->>'personalActions')::int,(p_scores->>'resultImpact')::int,(p_scores->>'professionalCommunication')::int,p_answer,p_feedback,p_evaluation
 from public.interview_attempts where student_id=p_student_id and question_id=p_question_id;
 return p_request_id;
end; $$;
revoke all on function public.record_interview_attempt(uuid,uuid,text,text,text,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_interview_attempt(uuid,uuid,text,text,text,jsonb,text,text,jsonb) to service_role;
-- Preserve existing numeric results. Their original answer/date was not retained; mark explicitly.
insert into public.interview_attempts(id,student_id,question_id,question_text,stage,attempt_number,situation_task,personal_actions,result_impact,communication,created_at,is_legacy)
select gen_random_uuid(),r.user_id,case when p.strand='education' then 'education-primary-v1' else 'general-primary-v1' end,
case when p.strand='education' then 'Tell me about a time when a lesson, activity, project, or plan did not go as expected. What did you do?' else 'Tell me about a time when a project, task, activity, or plan did not go as expected. What did you do?' end,
s.stage,case when s.stage='pre' or r.pre_scores is null then 1 else 2 end,
(s.scores->>'situationTask')::int,(s.scores->>'personalActions')::int,(s.scores->>'resultImpact')::int,(s.scores->>'professionalCommunication')::int,r.updated_at,true
from public.learning_results r join public.student_profiles p on p.user_id=r.user_id
cross join lateral (values ('pre',r.pre_scores),('post',r.post_scores)) as s(stage,scores)
where s.scores is not null;
