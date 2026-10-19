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
export type Database = {
  public: {
    Tables: {
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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
