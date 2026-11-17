-- Independent STAR scores. Earlier scores and their original meaning stay intact.
set local lock_timeout = '5s';
alter table public.interview_attempts
 add column situation integer check (situation between 0 and 3),
 add column task integer check (task between 0 and 3),
 add column action integer check (action between 0 and 3),
 add column result integer check (result between 0 and 3),
 alter column situation_task drop not null,
 alter column personal_actions drop not null,
 alter column result_impact drop not null,
 alter column communication drop not null;
alter table public.interview_attempts add constraint interview_attempts_score_format check (
 (situation is not null and task is not null and action is not null and result is not null
  and situation_task is null and personal_actions is null and result_impact is null and communication is null)
 or
 (situation is null and task is null and action is null and result is null
  and situation_task is not null and personal_actions is not null and result_impact is not null and communication is not null)
);
-- PostgreSQL 17 recomputes the generated total without removing the column.
alter table public.interview_attempts alter column total_score set expression as
 (coalesce(situation+task+action+result, situation_task+personal_actions+result_impact+communication));

-- Keep old in-flight submissions compatible while new deployments adopt STAR.
-- Preserve the request and question locks, append-only access, and retry behavior.
create or replace function public.record_interview_attempt(
 p_student_id uuid,p_request_id uuid,p_question_id text,p_question_text text,
 p_stage text,p_scores jsonb,p_answer text,p_feedback text,p_evaluation jsonb
)
returns uuid language plpgsql security invoker set search_path='' as $$
declare existing public.interview_attempts%rowtype; is_star boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('request:' || p_request_id::text,0));
 select * into existing from public.interview_attempts where id=p_request_id;
 if found then
  if existing.student_id is distinct from p_student_id
    or existing.question_id is distinct from p_question_id
    or existing.question_text is distinct from p_question_text
    or existing.stage is distinct from p_stage
    or existing.answer_text is distinct from p_answer then
   raise exception 'Request ID conflict' using errcode='23505';
  end if;
  return p_request_id;
 end if;
 if jsonb_typeof(p_scores) is distinct from 'object' then
  raise exception 'Invalid score format' using errcode='22023';
 end if;
 is_star := p_scores ?& array['situation','task','action','result'];
 if (not is_star and not (p_scores ?& array['situationTask','personalActions','resultImpact','professionalCommunication']))
   or (select count(*) from jsonb_object_keys(p_scores)) <> 4
   or exists (select 1 from jsonb_each(p_scores) where jsonb_typeof(value) <> 'number' or value::text !~ '^[0-3]$')
   or p_evaluation->'scores' is distinct from p_scores then
  raise exception 'Invalid score format' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_student_id::text || ':' || p_question_id,0));
 insert into public.interview_attempts(
  id,student_id,question_id,question_text,stage,attempt_number,
  situation,task,action,result,situation_task,personal_actions,result_impact,communication,
  answer_text,feedback_text,evaluation_json
 )
 select p_request_id,p_student_id,p_question_id,p_question_text,p_stage,coalesce(max(attempt_number),0)+1,
 case when is_star then (p_scores->>'situation')::int end,
 case when is_star then (p_scores->>'task')::int end,
 case when is_star then (p_scores->>'action')::int end,
 case when is_star then (p_scores->>'result')::int end,
 case when not is_star then (p_scores->>'situationTask')::int end,
 case when not is_star then (p_scores->>'personalActions')::int end,
 case when not is_star then (p_scores->>'resultImpact')::int end,
 case when not is_star then (p_scores->>'professionalCommunication')::int end,
 p_answer,p_feedback,p_evaluation || jsonb_build_object('total',(select sum((value::text)::int) from jsonb_each(p_scores)))
 from public.interview_attempts where student_id=p_student_id and question_id=p_question_id;
 return p_request_id;
end; $$;
revoke all on function public.record_interview_attempt(uuid,uuid,text,text,text,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_interview_attempt(uuid,uuid,text,text,text,jsonb,text,text,jsonb) to service_role;
