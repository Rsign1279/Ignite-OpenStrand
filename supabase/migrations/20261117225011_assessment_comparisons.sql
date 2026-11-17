-- Persist exactly the comparison shown to the student; never regenerate a saved result.
set local lock_timeout = '5s';
create table public.interview_comparisons (
 post_attempt_id uuid primary key references public.interview_attempts(id) on delete cascade,
 pre_attempt_id uuid not null references public.interview_attempts(id) on delete cascade,
 student_id uuid not null references public.student_profiles(user_id) on delete cascade,
 comparison_json jsonb not null,
 review_version text not null check (length(review_version) between 1 and 300),
 created_at timestamptz not null default now(),
 check (pre_attempt_id <> post_attempt_id),
 constraint interview_comparisons_json_shape check (
  case
   when jsonb_typeof(comparison_json) is distinct from 'object' then false
   when jsonb_typeof(comparison_json->'improvements') is distinct from 'array' then false
   when jsonb_array_length(comparison_json->'improvements') <> 2 then false
   when jsonb_typeof(comparison_json->'improvements'->0) is distinct from 'string' then false
   when jsonb_typeof(comparison_json->'improvements'->1) is distinct from 'string' then false
   when jsonb_typeof(comparison_json->'nextStep') is distinct from 'string' then false
   else comparison_json - array['improvements','nextStep'] = '{}'::jsonb
    and length(comparison_json->'improvements'->>0) between 1 and 600
    and length(comparison_json->'improvements'->>1) between 1 and 600
    and length(comparison_json->>'nextStep') between 1 and 600
  end
 )
);
create index interview_comparisons_student_date on public.interview_comparisons(student_id,created_at);
create index interview_comparisons_pre_attempt on public.interview_comparisons(pre_attempt_id);
alter table public.interview_comparisons enable row level security;
revoke all on public.interview_comparisons from public,anon,authenticated,service_role;
grant select,insert on public.interview_comparisons to service_role;

-- These checks also protect direct service-role inserts, not only RPC callers.
create function public.validate_interview_comparison()
returns trigger language plpgsql security invoker set search_path='' as $$
declare pre_attempt public.interview_attempts%rowtype; post_attempt public.interview_attempts%rowtype;
begin
 select * into pre_attempt from public.interview_attempts where id=new.pre_attempt_id;
 if not found then raise exception 'The saved first answer is unavailable' using errcode='23503'; end if;
 select * into post_attempt from public.interview_attempts where id=new.post_attempt_id;
 if not found then raise exception 'The saved second answer is unavailable' using errcode='23503'; end if;
 if pre_attempt.student_id is distinct from new.student_id
  or post_attempt.student_id is distinct from new.student_id
  or pre_attempt.stage is distinct from 'pre'
  or post_attempt.stage is distinct from 'post'
  or pre_attempt.question_id is distinct from post_attempt.question_id
  or pre_attempt.question_text is distinct from post_attempt.question_text then
  raise exception 'Comparison must use the same student and question with saved first and second answers' using errcode='23514';
 end if;
 if post_attempt.evaluation_json ? 'pre_request_id'
  and post_attempt.evaluation_json->>'pre_request_id' is distinct from new.pre_attempt_id::text then
  raise exception 'The second answer belongs to a different first answer' using errcode='23514';
 end if;
 if jsonb_typeof(post_attempt.evaluation_json->'improvementArea') is distinct from 'string'
  or new.comparison_json->>'nextStep' is distinct from post_attempt.evaluation_json->>'improvementArea' then
  raise exception 'Comparison next step must match the saved second answer feedback' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function public.validate_interview_comparison() from public,anon,authenticated;
grant execute on function public.validate_interview_comparison() to service_role;
create trigger validate_interview_comparison_before_insert
 before insert on public.interview_comparisons
 for each row execute function public.validate_interview_comparison();

create function public.find_interview_comparison(p_student_id uuid,p_post_attempt_id uuid,p_pre_attempt_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.interview_comparisons%rowtype;
begin
 select * into existing from public.interview_comparisons
 where post_attempt_id=p_post_attempt_id and student_id=p_student_id;
 if not found then return null; end if;
 if existing.pre_attempt_id is distinct from p_pre_attempt_id then
  raise exception 'Comparison request conflict' using errcode='23505';
 end if;
 return existing.comparison_json;
end; $$;
revoke all on function public.find_interview_comparison(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.find_interview_comparison(uuid,uuid,uuid) to service_role;

create function public.record_interview_comparison(
 p_student_id uuid,p_post_attempt_id uuid,p_pre_attempt_id uuid,p_comparison jsonb,p_review_version text
)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.interview_comparisons%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('comparison:' || p_post_attempt_id::text,0));
 select * into existing from public.interview_comparisons where post_attempt_id=p_post_attempt_id;
 if found then
  if existing.student_id is distinct from p_student_id or existing.pre_attempt_id is distinct from p_pre_attempt_id then
   raise exception 'Comparison request conflict' using errcode='23505';
  end if;
  return existing.comparison_json;
 end if;
 insert into public.interview_comparisons(post_attempt_id,pre_attempt_id,student_id,comparison_json,review_version)
 values(p_post_attempt_id,p_pre_attempt_id,p_student_id,p_comparison,p_review_version);
 return p_comparison;
end; $$;
revoke all on function public.record_interview_comparison(uuid,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.record_interview_comparison(uuid,uuid,uuid,jsonb,text) to service_role;

-- Bind the first answer before comparison generation, so provider failures cannot change the baseline.
create or replace function public.record_interview_attempt(
 p_student_id uuid,p_request_id uuid,p_question_id text,p_question_text text,
 p_stage text,p_scores jsonb,p_answer text,p_feedback text,p_evaluation jsonb
)
returns uuid language plpgsql security invoker set search_path='' as $$
declare existing public.interview_attempts%rowtype; is_star boolean; pre_reference uuid;
begin
 if p_evaluation ? 'pre_request_id' then
  if p_stage is distinct from 'post' or jsonb_typeof(p_evaluation->'pre_request_id') is distinct from 'string' then
   raise exception 'Invalid first answer reference' using errcode='23514';
  end if;
  begin
   pre_reference := (p_evaluation->>'pre_request_id')::uuid;
  exception when invalid_text_representation then
   raise exception 'Invalid first answer reference' using errcode='23514';
  end;
  p_evaluation := jsonb_set(p_evaluation,'{pre_request_id}',to_jsonb(pre_reference::text));
 end if;
 perform pg_advisory_xact_lock(hashtextextended('request:' || p_request_id::text,0));
 select * into existing from public.interview_attempts where id=p_request_id;
 if found then
  if existing.student_id is distinct from p_student_id
    or existing.question_id is distinct from p_question_id
    or existing.question_text is distinct from p_question_text
    or existing.stage is distinct from p_stage
    or existing.answer_text is distinct from p_answer
    or existing.evaluation_json->>'pre_request_id' is distinct from p_evaluation->>'pre_request_id' then
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
 if p_stage='post' then
  if split_part(coalesce(p_evaluation->>'scoring_version',''),'|',1)='ignite-star-rubric-v3' and pre_reference is null then
   raise exception 'STAR v3 second answers require a saved first answer' using errcode='23514';
  end if;
  if pre_reference is not null and not exists (
   select 1 from public.interview_attempts
   where id=pre_reference and student_id=p_student_id and stage='pre'
    and question_id=p_question_id and question_text=p_question_text
  ) then
   raise exception 'Second answer must use the same student and question as its first answer' using errcode='23514';
  end if;
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

-- Replays and partial-failure recovery must never roll back the latest summary.
create function public.refresh_interview_summary(p_student_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare first_scores jsonb; second_scores jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('summary:' || p_student_id::text,0));
 select evaluation_json->'scores' into first_scores from public.interview_attempts
 where student_id=p_student_id and stage='pre'
 order by created_at desc,attempt_number desc,id desc limit 1;
 select evaluation_json->'scores' into second_scores from public.interview_attempts
 where student_id=p_student_id and stage='post'
 order by created_at desc,attempt_number desc,id desc limit 1;
 if first_scores is null and second_scores is null then return; end if;
 insert into public.learning_results(user_id,pre_scores,post_scores,updated_at)
 values(p_student_id,first_scores,second_scores,now())
 on conflict(user_id) do update set
 pre_scores=coalesce(excluded.pre_scores,learning_results.pre_scores),
 post_scores=coalesce(excluded.post_scores,learning_results.post_scores),
 updated_at=excluded.updated_at;
end; $$;
revoke all on function public.refresh_interview_summary(uuid) from public,anon,authenticated;
grant execute on function public.refresh_interview_summary(uuid) to service_role;
