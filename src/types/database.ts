import type { Profile, Evaluation } from "@/lib/validation";
export type LearningResult = {
  user_id: string;
  pre_scores: Evaluation["scores"] | null;
  post_scores: Evaluation["scores"] | null;
  transfer_star: {
    situation: boolean;
    task: boolean;
    action: boolean;
    result: boolean;
  } | null;
  updated_at: string;
  completed_at: string | null;
};
export type AttemptRow = {
  id: string;
  student_id: string;
  question_id: string;
  question_text: string;
  stage: "pre" | "post";
  attempt_number: number;
  situation_task: number;
  personal_actions: number;
  result_impact: number;
  communication: number;
  total_score: number;
  created_at: string;
  answer_text: string | null;
  feedback_text: string | null;
  is_legacy: boolean;
  evaluation_json: Evaluation | null;
};
export type Database = {
  public: {
    Tables: {
      interview_attempts: {
        Row: AttemptRow;
        Insert: Omit<AttemptRow, "total_score">;
        Update: never;
        Relationships: [];
      };
      learning_results: {
        Row: LearningResult;
        Insert: Partial<LearningResult> & { user_id: string };
        Update: Partial<LearningResult>;
        Relationships: [];
      };
      student_profiles: {
        Row: Profile & { user_id: string };
        Insert: Profile & { user_id: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      record_interview_attempt: {
        Args: {
          p_student_id: string;
          p_request_id: string;
          p_question_id: string;
          p_question_text: string;
          p_stage: string;
          p_scores: Evaluation["scores"];
          p_answer: string;
          p_feedback: string;
          p_evaluation: Evaluation;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
