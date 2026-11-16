-- Bind an idempotency key to the entire submission, including its stage.
-- Serialize the key first, then question numbering. Concurrent identical retries
-- preserve the first stored evaluation; changed payloads cannot reuse its ID.
create or replace function public.record_interview_attempt(
 p_student_id uuid,p_request_id uuid,p_question_id text,p_question_text text,
 p_stage text,p_scores jsonb,p_answer text,p_feedback text,p_evaluation jsonb
)
returns uuid language plpgsql security invoker set search_path='' as $$
declare existing public.interview_attempts%rowtype;
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
 perform pg_advisory_xact_lock(hashtextextended(p_student_id::text || ':' || p_question_id,0));
 insert into public.interview_attempts(id,student_id,question_id,question_text,stage,attempt_number,situation_task,personal_actions,result_impact,communication,answer_text,feedback_text,evaluation_json)
 select p_request_id,p_student_id,p_question_id,p_question_text,p_stage,coalesce(max(attempt_number),0)+1,
 (p_scores->>'situationTask')::int,(p_scores->>'personalActions')::int,(p_scores->>'resultImpact')::int,(p_scores->>'professionalCommunication')::int,p_answer,p_feedback,p_evaluation
 from public.interview_attempts where student_id=p_student_id and question_id=p_question_id;
 return p_request_id;
end; $$;
revoke all on function public.record_interview_attempt(uuid,uuid,text,text,text,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_interview_attempt(uuid,uuid,text,text,text,jsonb,text,text,jsonb) to service_role;
