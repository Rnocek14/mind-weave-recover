export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          awarded_at: string | null
          id: string
          type: string
          user_id: string
          value: number | null
        }
        Insert: {
          awarded_at?: string | null
          id?: string
          type: string
          user_id: string
          value?: number | null
        }
        Update: {
          awarded_at?: string | null
          id?: string
          type?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_cluster_assignments"
            referencedColumns: ["user_id"]
          },
        ]
      }
      clinical_profile_corrections: {
        Row: {
          clinical_note_excerpt: string | null
          confidence_before: string | null
          corrected_value: Json
          correction_reason: string | null
          corrector_role: string | null
          created_at: string | null
          field_name: string
          id: string
          original_value: Json
          parser_version: string | null
          profile_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clinical_note_excerpt?: string | null
          confidence_before?: string | null
          corrected_value: Json
          correction_reason?: string | null
          corrector_role?: string | null
          created_at?: string | null
          field_name: string
          id?: string
          original_value: Json
          parser_version?: string | null
          profile_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clinical_note_excerpt?: string | null
          confidence_before?: string | null
          corrected_value?: Json
          correction_reason?: string | null
          corrector_role?: string | null
          created_at?: string | null
          field_name?: string
          id?: string
          original_value?: Json
          parser_version?: string | null
          profile_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dismissed_flags: {
        Row: {
          dismissed_at: string | null
          dismissed_by: string | null
          flag_details: Json
          flag_severity: string
          flag_type: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          dismissed_at?: string | null
          dismissed_by?: string | null
          flag_details?: Json
          flag_severity: string
          flag_type: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          dismissed_at?: string | null
          dismissed_by?: string | null
          flag_details?: Json
          flag_severity?: string
          flag_type?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      engagement_interventions: {
        Row: {
          created_at: string | null
          id: string
          intervention: string
          session_id: string
          trigger_data: Json | null
          trigger_type: string
          user_action: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          intervention: string
          session_id: string
          trigger_data?: Json | null
          trigger_type: string
          user_action?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          intervention?: string
          session_id?: string
          trigger_data?: Json | null
          trigger_type?: string
          user_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_interventions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_events: {
        Row: {
          created_at: string | null
          cue_level: number | null
          engagement_flags: Json | null
          error_type: string | null
          exercise_slug: string | null
          id: string
          inputs: Json | null
          outputs: Json | null
          reaction_time_ms: number | null
          round: number
          score: number | null
          session_id: string
          task_parameters: Json | null
        }
        Insert: {
          created_at?: string | null
          cue_level?: number | null
          engagement_flags?: Json | null
          error_type?: string | null
          exercise_slug?: string | null
          id?: string
          inputs?: Json | null
          outputs?: Json | null
          reaction_time_ms?: number | null
          round: number
          score?: number | null
          session_id: string
          task_parameters?: Json | null
        }
        Update: {
          created_at?: string | null
          cue_level?: number | null
          engagement_flags?: Json | null
          error_type?: string | null
          exercise_slug?: string | null
          id?: string
          inputs?: Json | null
          outputs?: Json | null
          reaction_time_ms?: number | null
          round?: number
          score?: number | null
          session_id?: string
          task_parameters?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_events_exercise_slug_fkey"
            columns: ["exercise_slug"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "exercise_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          category: string
          metadata: Json | null
          slug: string
          title: string
        }
        Insert: {
          category: string
          metadata?: Json | null
          slug: string
          title: string
        }
        Update: {
          category?: string
          metadata?: Json | null
          slug?: string
          title?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          created_at: string | null
          id: string
          labels: string[] | null
          name: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          labels?: string[] | null
          name: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          labels?: string[] | null
          name?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_cluster_assignments"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          accessibility_prefs: Json | null
          caregiver_mode_enabled: boolean | null
          clinical_profile: Json | null
          consent_version: number | null
          created_at: string | null
          daily_cap_minutes: number | null
          daily_goal_minutes: number | null
          display_name: string | null
          enforce_dose_caps: boolean | null
          goals: string[] | null
          hand_bias: string | null
          session_cap_minutes: number | null
          stroke_date: string | null
          user_id: string
        }
        Insert: {
          accessibility_prefs?: Json | null
          caregiver_mode_enabled?: boolean | null
          clinical_profile?: Json | null
          consent_version?: number | null
          created_at?: string | null
          daily_cap_minutes?: number | null
          daily_goal_minutes?: number | null
          display_name?: string | null
          enforce_dose_caps?: boolean | null
          goals?: string[] | null
          hand_bias?: string | null
          session_cap_minutes?: number | null
          stroke_date?: string | null
          user_id: string
        }
        Update: {
          accessibility_prefs?: Json | null
          caregiver_mode_enabled?: boolean | null
          clinical_profile?: Json | null
          consent_version?: number | null
          created_at?: string | null
          daily_cap_minutes?: number | null
          daily_goal_minutes?: number | null
          display_name?: string | null
          enforce_dose_caps?: boolean | null
          goals?: string[] | null
          hand_bias?: string | null
          session_cap_minutes?: number | null
          stroke_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          duration_sec: number | null
          ended_at: string | null
          engagement_summary: Json | null
          id: string
          mood_rating: number | null
          plan: Json | null
          started_at: string | null
          summary: Json | null
          user_id: string
        }
        Insert: {
          duration_sec?: number | null
          ended_at?: string | null
          engagement_summary?: Json | null
          id?: string
          mood_rating?: number | null
          plan?: Json | null
          started_at?: string | null
          summary?: Json | null
          user_id: string
        }
        Update: {
          duration_sec?: number | null
          ended_at?: string | null
          engagement_summary?: Json | null
          id?: string
          mood_rating?: number | null
          plan?: Json | null
          started_at?: string | null
          summary?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_cluster_assignments"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_cluster_assignments: {
        Row: {
          chronicity: string | null
          cluster_key: string | null
          hemisphere: string | null
          lesion_zone: string | null
          months_since_stroke: number | null
          stroke_date: string | null
          stroke_mechanism: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      end_session_server: {
        Args: { p_session_id: string; p_summary: Json }
        Returns: undefined
      }
      get_cluster_assignments: {
        Args: never
        Returns: {
          chronicity: string | null
          cluster_key: string | null
          hemisphere: string | null
          lesion_zone: string | null
          months_since_stroke: number | null
          stroke_date: string | null
          stroke_mechanism: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "user_cluster_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_exercise_stats_last7d: {
        Args: { slug: string; uid: string }
        Returns: {
          avg_accuracy: number
          median_rt: number
          trial_count: number
        }[]
      }
      get_session_summary: {
        Args: { p_session_id: string }
        Returns: {
          accuracy: number
          avg_cue_level: number
          avg_rt_ms: number
          cue_reduction: number
          end_difficulty: number
          error_breakdown: Json
          median_rt_ms: number
          start_difficulty: number
          timeout_count: number
          total_trials: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      merge_profile_pref: {
        Args: { p_key: string; p_subkey: string; p_value: Json }
        Returns: undefined
      }
      refresh_cluster_assignments: { Args: never; Returns: undefined }
      setup_admin_user: { Args: { admin_email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
