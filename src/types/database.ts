import type {
  Profile,
  Evaluation,
  StoredScores,
  Comparison,
} from "@/lib/validation";
export type LearningResult = {
  user_id: string;
  pre_scores: StoredScores | null;
  post_scores: StoredScores | null;
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
  stage: "pre" | "post" | "practice";
  attempt_number: number;
  situation: number | null;
  task: number | null;
  action: number | null;
  result: number | null;
  situation_task: number | null;
  personal_actions: number | null;
  result_impact: number | null;
  communication: number | null;
  total_score: number;
  created_at: string;
  answer_text: string | null;
  feedback_text: string | null;
  is_legacy: boolean;
  evaluation_json:
    | (Omit<Evaluation, "scores"> & {
        scores: StoredScores;
        scoring_version?: string;
      })
    | null;
};
export type ComparisonRow = {
  post_attempt_id: string;
  pre_attempt_id: string;
  student_id: string;
  comparison_json: Comparison;
  review_version: string;
  created_at: string;
};
export type Database = {
  public: {
    Tables: {
      interview_comparisons: {
        Row: ComparisonRow;
        Insert: Omit<ComparisonRow, "created_at"> & { created_at?: string };
        Update: never;
        Relationships: [];
      };
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
        Row: Profile & { user_id: string; qa_cohort_id: string | null };
        Insert: Profile & { user_id: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      refresh_interview_summary: {
        Args: { p_student_id: string };
        Returns: undefined;
      };
      find_interview_comparison: {
        Args: {
          p_student_id: string;
          p_post_attempt_id: string;
          p_pre_attempt_id: string;
        };
        Returns: Comparison | null;
      };
      record_interview_comparison: {
        Args: {
          p_student_id: string;
          p_post_attempt_id: string;
          p_pre_attempt_id: string;
          p_comparison: Comparison;
          p_review_version: string;
        };
        Returns: Comparison;
      };
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
