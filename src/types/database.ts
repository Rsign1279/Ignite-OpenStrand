import type { Profile } from "@/lib/validation";
export type Database = {
  public: {
    Tables: {
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
