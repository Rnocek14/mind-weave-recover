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
          profile_id: string | null
          type: string
          user_id: string
          value: number | null
        }
        Insert: {
          awarded_at?: string | null
          id?: string
          profile_id?: string | null
          type: string
          user_id: string
          value?: number | null
        }
        Update: {
          awarded_at?: string | null
          id?: string
          profile_id?: string | null
          type?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "achievements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      adaptation_anomalies: {
        Row: {
          anomaly_type: string
          created_at: string
          detail: string | null
          evidence: Json | null
          exercise_slug: string | null
          id: string
          session_id: string | null
          severity: string
          trial_index: number | null
          user_id: string
        }
        Insert: {
          anomaly_type: string
          created_at?: string
          detail?: string | null
          evidence?: Json | null
          exercise_slug?: string | null
          id?: string
          session_id?: string | null
          severity?: string
          trial_index?: number | null
          user_id: string
        }
        Update: {
          anomaly_type?: string
          created_at?: string
          detail?: string | null
          evidence?: Json | null
          exercise_slug?: string | null
          id?: string
          session_id?: string | null
          severity?: string
          trial_index?: number | null
          user_id?: string
        }
        Relationships: []
      }
      adaptation_events: {
        Row: {
          adaptation_type: string
          confidence: string
          created_at: string
          evidence: Json
          exercise_slug: string | null
          id: string
          layer: string
          profile_id: string | null
          session_id: string | null
          trial_index: number | null
          trigger_condition: string | null
          trigger_rule_id: string | null
          trigger_type: string
          user_id: string
          value_after: Json | null
          value_before: Json | null
        }
        Insert: {
          adaptation_type: string
          confidence: string
          created_at?: string
          evidence?: Json
          exercise_slug?: string | null
          id?: string
          layer: string
          profile_id?: string | null
          session_id?: string | null
          trial_index?: number | null
          trigger_condition?: string | null
          trigger_rule_id?: string | null
          trigger_type: string
          user_id: string
          value_after?: Json | null
          value_before?: Json | null
        }
        Update: {
          adaptation_type?: string
          confidence?: string
          created_at?: string
          evidence?: Json
          exercise_slug?: string | null
          id?: string
          layer?: string
          profile_id?: string | null
          session_id?: string | null
          trial_index?: number | null
          trigger_condition?: string | null
          trigger_rule_id?: string | null
          trigger_type?: string
          user_id?: string
          value_after?: Json | null
          value_before?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "adaptation_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adaptation_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      adaptation_trial_logs: {
        Row: {
          correct: boolean | null
          created_at: string
          cue_dependency: number | null
          cue_level: number | null
          difficulty: number
          difficulty_change_direction: string | null
          difficulty_change_from: number | null
          difficulty_change_reason: string | null
          difficulty_change_to: number | null
          escalation_block_reason: string | null
          escalation_blocked: boolean
          exercise_slug: string
          fatigue: string | null
          frustration: string | null
          id: string
          narration: string | null
          reaction_time_ms: number | null
          recommended_action: string | null
          session_id: string | null
          success_rate: number | null
          trial_index: number
          trials_at_level: number | null
          user_id: string
        }
        Insert: {
          correct?: boolean | null
          created_at?: string
          cue_dependency?: number | null
          cue_level?: number | null
          difficulty: number
          difficulty_change_direction?: string | null
          difficulty_change_from?: number | null
          difficulty_change_reason?: string | null
          difficulty_change_to?: number | null
          escalation_block_reason?: string | null
          escalation_blocked?: boolean
          exercise_slug: string
          fatigue?: string | null
          frustration?: string | null
          id?: string
          narration?: string | null
          reaction_time_ms?: number | null
          recommended_action?: string | null
          session_id?: string | null
          success_rate?: number | null
          trial_index: number
          trials_at_level?: number | null
          user_id: string
        }
        Update: {
          correct?: boolean | null
          created_at?: string
          cue_dependency?: number | null
          cue_level?: number | null
          difficulty?: number
          difficulty_change_direction?: string | null
          difficulty_change_from?: number | null
          difficulty_change_reason?: string | null
          difficulty_change_to?: number | null
          escalation_block_reason?: string | null
          escalation_blocked?: boolean
          exercise_slug?: string
          fatigue?: string | null
          frustration?: string | null
          id?: string
          narration?: string | null
          reaction_time_ms?: number | null
          recommended_action?: string | null
          session_id?: string | null
          success_rate?: number | null
          trial_index?: number
          trials_at_level?: number | null
          user_id?: string
        }
        Relationships: []
      }
      adaptive_decision_logs: {
        Row: {
          adaptations: Json
          assessment_age_days: number | null
          avg_accuracy: number | null
          avg_reaction_time_ms: number | null
          confidence_level: string
          id: string
          log_date: string
          logged_at: string
          profile_id: string | null
          reasoning: string[]
          rules_data: Json
          rules_fired: string[]
          semantic_error_rate: number | null
          timeout_rate: number | null
          trial_count: number
          user_id: string
          utterance_count: number
        }
        Insert: {
          adaptations?: Json
          assessment_age_days?: number | null
          avg_accuracy?: number | null
          avg_reaction_time_ms?: number | null
          confidence_level: string
          id?: string
          log_date?: string
          logged_at?: string
          profile_id?: string | null
          reasoning?: string[]
          rules_data?: Json
          rules_fired?: string[]
          semantic_error_rate?: number | null
          timeout_rate?: number | null
          trial_count?: number
          user_id: string
          utterance_count?: number
        }
        Update: {
          adaptations?: Json
          assessment_age_days?: number | null
          avg_accuracy?: number | null
          avg_reaction_time_ms?: number | null
          confidence_level?: string
          id?: string
          log_date?: string
          logged_at?: string
          profile_id?: string | null
          reasoning?: string[]
          rules_data?: Json
          rules_fired?: string[]
          semantic_error_rate?: number | null
          timeout_rate?: number | null
          trial_count?: number
          user_id?: string
          utterance_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_decision_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_assessments: {
        Row: {
          assessed_at: string
          assessment_version: string
          attention_score: number | null
          can_match_patterns: boolean | null
          can_orient: boolean | null
          can_tap: boolean | null
          clinical_snapshot: Json | null
          completed: boolean | null
          confidence_score: number | null
          created_at: string | null
          id: string
          motor_score: number | null
          needs_retry: boolean | null
          profile_id: string | null
          retry_reason: string | null
          trial_data: Json | null
          understands_cause_effect: boolean | null
          user_id: string
          vision_score: number | null
        }
        Insert: {
          assessed_at?: string
          assessment_version?: string
          attention_score?: number | null
          can_match_patterns?: boolean | null
          can_orient?: boolean | null
          can_tap?: boolean | null
          clinical_snapshot?: Json | null
          completed?: boolean | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          motor_score?: number | null
          needs_retry?: boolean | null
          profile_id?: string | null
          retry_reason?: string | null
          trial_data?: Json | null
          understands_cause_effect?: boolean | null
          user_id: string
          vision_score?: number | null
        }
        Update: {
          assessed_at?: string
          assessment_version?: string
          attention_score?: number | null
          can_match_patterns?: boolean | null
          can_orient?: boolean | null
          can_tap?: boolean | null
          clinical_snapshot?: Json | null
          completed?: boolean | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          motor_score?: number | null
          needs_retry?: boolean | null
          profile_id?: string | null
          retry_reason?: string | null
          trial_data?: Json | null
          understands_cause_effect?: boolean | null
          user_id?: string
          vision_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "capability_assessments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_context_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          note_date: string
          profile_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          note_date?: string
          profile_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          note_date?: string
          profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_context_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_notes: {
        Row: {
          created_at: string
          document_date: string
          document_title: string | null
          extracted_profile: Json | null
          id: string
          note_type: string
          notes: string | null
          parsed_at: string | null
          parser_version: string | null
          parsing_confidence: string | null
          profile_id: string | null
          raw_text: string
          requires_review: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          scan_details: Json | null
          source_system: string | null
          uploaded_at: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_date: string
          document_title?: string | null
          extracted_profile?: Json | null
          id?: string
          note_type: string
          notes?: string | null
          parsed_at?: string | null
          parser_version?: string | null
          parsing_confidence?: string | null
          profile_id?: string | null
          raw_text: string
          requires_review?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scan_details?: Json | null
          source_system?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_date?: string
          document_title?: string | null
          extracted_profile?: Json | null
          id?: string
          note_type?: string
          notes?: string | null
          parsed_at?: string | null
          parser_version?: string | null
          parsing_confidence?: string | null
          profile_id?: string | null
          raw_text?: string
          requires_review?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scan_details?: Json | null
          source_system?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
        Relationships: [
          {
            foreignKeyName: "clinical_profile_corrections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_profile_versions: {
        Row: {
          change_reason: string | null
          changes_from_previous: Json | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          overall_confidence: string | null
          profile_data: Json
          profile_id: string | null
          source_note_id: string | null
          source_type: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
          validation_status: string | null
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          changes_from_previous?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          overall_confidence?: string | null
          profile_data?: Json
          profile_id?: string | null
          source_note_id?: string | null
          source_type: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string | null
          version_number: number
        }
        Update: {
          change_reason?: string | null
          changes_from_previous?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          overall_confidence?: string | null
          profile_data?: Json
          profile_id?: string | null
          source_note_id?: string | null
          source_type?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinical_profile_versions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_profile_versions_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinician_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          clinician_id: string
          id: string
          notes: string | null
          patient_user_id: string
          profile_id: string
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          clinician_id: string
          id?: string
          notes?: string | null
          patient_user_id: string
          profile_id: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          clinician_id?: string
          id?: string
          notes?: string | null
          patient_user_id?: string
          profile_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinician_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinician_overrides: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          clinician_id: string
          created_at: string
          expires_at: string | null
          id: string
          override_type: string
          profile_id: string
          reason: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string
          suggested_at: string | null
          suggested_by: string | null
          target_slug: string | null
          user_id: string
          value_after: Json
          value_before: Json | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          clinician_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          override_type: string
          profile_id: string
          reason?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          suggested_at?: string | null
          suggested_by?: string | null
          target_slug?: string | null
          user_id: string
          value_after?: Json
          value_before?: Json | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          clinician_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          override_type?: string
          profile_id?: string
          reason?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          suggested_at?: string | null
          suggested_by?: string | null
          target_slug?: string | null
          user_id?: string
          value_after?: Json
          value_before?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "clinician_overrides_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinician_session_notes: {
        Row: {
          clinician_id: string
          created_at: string
          id: string
          note_text: string
          note_type: string
          profile_id: string | null
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinician_id: string
          created_at?: string
          id?: string
          note_text: string
          note_type?: string
          profile_id?: string | null
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinician_id?: string
          created_at?: string
          id?: string
          note_text?: string
          note_type?: string
          profile_id?: string | null
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinician_session_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinician_session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_conversation_summaries: {
        Row: {
          avg_score: number | null
          created_at: string
          exercise_summaries: Json | null
          id: string
          maya_summary: string | null
          metadata: Json | null
          primary_domain: string | null
          session_id: string | null
          top_struggles: string[] | null
          top_wins: string[] | null
          total_popup_exercises: number | null
          user_id: string
        }
        Insert: {
          avg_score?: number | null
          created_at?: string
          exercise_summaries?: Json | null
          id?: string
          maya_summary?: string | null
          metadata?: Json | null
          primary_domain?: string | null
          session_id?: string | null
          top_struggles?: string[] | null
          top_wins?: string[] | null
          total_popup_exercises?: number | null
          user_id: string
        }
        Update: {
          avg_score?: number | null
          created_at?: string
          exercise_summaries?: Json | null
          id?: string
          maya_summary?: string | null
          metadata?: Json | null
          primary_domain?: string | null
          session_id?: string | null
          top_struggles?: string[] | null
          top_wins?: string[] | null
          total_popup_exercises?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_conversation_summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cognitive_domain_scores: {
        Row: {
          computed_at: string
          confidence: string
          domain_slug: string
          domain_version: number
          fatigue_sensitivity: number | null
          granularity: string
          id: string
          profile_id: string | null
          profile_key: string | null
          score: number
          score_components: Json
          transfer_components: Json | null
          transfer_index: number | null
          trial_count: number
          user_id: string
          window_end: string
          window_start: string
        }
        Insert: {
          computed_at?: string
          confidence?: string
          domain_slug: string
          domain_version?: number
          fatigue_sensitivity?: number | null
          granularity?: string
          id?: string
          profile_id?: string | null
          profile_key?: string | null
          score: number
          score_components?: Json
          transfer_components?: Json | null
          transfer_index?: number | null
          trial_count?: number
          user_id: string
          window_end: string
          window_start: string
        }
        Update: {
          computed_at?: string
          confidence?: string
          domain_slug?: string
          domain_version?: number
          fatigue_sensitivity?: number | null
          granularity?: string
          id?: string
          profile_id?: string | null
          profile_key?: string | null
          score?: number
          score_components?: Json
          transfer_components?: Json | null
          transfer_index?: number | null
          trial_count?: number
          user_id?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "cognitive_domain_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_readiness: {
        Row: {
          checkin_date: string
          created_at: string
          fatigue_limited_practice: boolean | null
          fatigue_rating: number
          id: string
          mood_rating: number | null
          notes: string | null
          pain_level: number | null
          profile_id: string
          sleep_quality: number | null
          user_id: string
        }
        Insert: {
          checkin_date?: string
          created_at?: string
          fatigue_limited_practice?: boolean | null
          fatigue_rating: number
          id?: string
          mood_rating?: number | null
          notes?: string | null
          pain_level?: number | null
          profile_id: string
          sleep_quality?: number | null
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          fatigue_limited_practice?: boolean | null
          fatigue_rating?: number
          id?: string
          mood_rating?: number | null
          notes?: string | null
          pain_level?: number | null
          profile_id?: string
          sleep_quality?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_readiness_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          profile_id: string | null
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
          profile_id?: string | null
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
          profile_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dismissed_flags_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dose_logs: {
        Row: {
          created_at: string
          domain_slug: string
          dose_value: number
          id: string
          intensity_score: number | null
          log_date: string
          metadata: Json | null
          notes: string | null
          profile_id: string
          quality_score: number | null
          session_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain_slug: string
          dose_value: number
          id?: string
          intensity_score?: number | null
          log_date?: string
          metadata?: Json | null
          notes?: string | null
          profile_id: string
          quality_score?: number | null
          session_id?: string | null
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain_slug?: string
          dose_value?: number
          id?: string
          intensity_score?: number | null
          log_date?: string
          metadata?: Json | null
          notes?: string | null
          profile_id?: string
          quality_score?: number | null
          session_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dose_logs_domain_slug_fkey"
            columns: ["domain_slug"]
            isOneToOne: false
            referencedRelation: "recovery_domains"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "dose_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dose_targets: {
        Row: {
          created_at: string
          domain_slug: string
          effective_from: string
          effective_until: string | null
          id: string
          prescribed_by: string | null
          profile_id: string
          target_frequency: string
          target_value: number
          user_id: string
        }
        Insert: {
          created_at?: string
          domain_slug: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          prescribed_by?: string | null
          profile_id: string
          target_frequency?: string
          target_value: number
          user_id: string
        }
        Update: {
          created_at?: string
          domain_slug?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          prescribed_by?: string | null
          profile_id?: string
          target_frequency?: string
          target_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dose_targets_domain_slug_fkey"
            columns: ["domain_slug"]
            isOneToOne: false
            referencedRelation: "recovery_domains"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "dose_targets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          acoustic_metrics: Json | null
          adaptations_active: Json | null
          attempt_id: string | null
          attempt_number: number | null
          audio_mime_type: string | null
          audio_storage_path: string | null
          browser_transcript: string | null
          classification_confidence: number | null
          clinician_override_at: string | null
          clinician_override_by: string | null
          clinician_override_note: string | null
          clinician_validity_override: string | null
          counts_toward_score: boolean
          created_at: string | null
          cue_level: number | null
          cue_trigger: string | null
          cue_type_given: string | null
          cue_was_effective: boolean | null
          engagement_flags: Json | null
          error_classification: Json | null
          error_type: string | null
          exercise_slug: string | null
          id: string
          inputs: Json | null
          needs_review: boolean | null
          outputs: Json | null
          phonological_similarity: number | null
          reaction_time_ms: number | null
          recording_duration_ms: number | null
          round: number
          score: number | null
          semantic_similarity: number | null
          session_id: string
          task_parameters: Json | null
          time_to_success_after_cue_ms: number | null
          trial_index: number | null
          validity_confidence: number | null
          validity_label: string | null
          validity_reason: string | null
          validity_signals: Json | null
          whisper_confidence: number | null
          whisper_transcript: string | null
        }
        Insert: {
          acoustic_metrics?: Json | null
          adaptations_active?: Json | null
          attempt_id?: string | null
          attempt_number?: number | null
          audio_mime_type?: string | null
          audio_storage_path?: string | null
          browser_transcript?: string | null
          classification_confidence?: number | null
          clinician_override_at?: string | null
          clinician_override_by?: string | null
          clinician_override_note?: string | null
          clinician_validity_override?: string | null
          counts_toward_score?: boolean
          created_at?: string | null
          cue_level?: number | null
          cue_trigger?: string | null
          cue_type_given?: string | null
          cue_was_effective?: boolean | null
          engagement_flags?: Json | null
          error_classification?: Json | null
          error_type?: string | null
          exercise_slug?: string | null
          id?: string
          inputs?: Json | null
          needs_review?: boolean | null
          outputs?: Json | null
          phonological_similarity?: number | null
          reaction_time_ms?: number | null
          recording_duration_ms?: number | null
          round: number
          score?: number | null
          semantic_similarity?: number | null
          session_id: string
          task_parameters?: Json | null
          time_to_success_after_cue_ms?: number | null
          trial_index?: number | null
          validity_confidence?: number | null
          validity_label?: string | null
          validity_reason?: string | null
          validity_signals?: Json | null
          whisper_confidence?: number | null
          whisper_transcript?: string | null
        }
        Update: {
          acoustic_metrics?: Json | null
          adaptations_active?: Json | null
          attempt_id?: string | null
          attempt_number?: number | null
          audio_mime_type?: string | null
          audio_storage_path?: string | null
          browser_transcript?: string | null
          classification_confidence?: number | null
          clinician_override_at?: string | null
          clinician_override_by?: string | null
          clinician_override_note?: string | null
          clinician_validity_override?: string | null
          counts_toward_score?: boolean
          created_at?: string | null
          cue_level?: number | null
          cue_trigger?: string | null
          cue_type_given?: string | null
          cue_was_effective?: boolean | null
          engagement_flags?: Json | null
          error_classification?: Json | null
          error_type?: string | null
          exercise_slug?: string | null
          id?: string
          inputs?: Json | null
          needs_review?: boolean | null
          outputs?: Json | null
          phonological_similarity?: number | null
          reaction_time_ms?: number | null
          recording_duration_ms?: number | null
          round?: number
          score?: number | null
          semantic_similarity?: number | null
          session_id?: string
          task_parameters?: Json | null
          time_to_success_after_cue_ms?: number | null
          trial_index?: number | null
          validity_confidence?: number | null
          validity_label?: string | null
          validity_reason?: string | null
          validity_signals?: Json | null
          whisper_confidence?: number | null
          whisper_transcript?: string | null
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
      exercise_skips: {
        Row: {
          clinical_snapshot: Json | null
          created_at: string | null
          exercise_slug: string
          from_lesson: boolean | null
          id: string
          profile_id: string | null
          session_id: string | null
          skip_reason: string | null
          skipped_at: string
          user_id: string
        }
        Insert: {
          clinical_snapshot?: Json | null
          created_at?: string | null
          exercise_slug: string
          from_lesson?: boolean | null
          id?: string
          profile_id?: string | null
          session_id?: string | null
          skip_reason?: string | null
          skipped_at?: string
          user_id: string
        }
        Update: {
          clinical_snapshot?: Json | null
          created_at?: string | null
          exercise_slug?: string
          from_lesson?: boolean | null
          id?: string
          profile_id?: string | null
          session_id?: string | null
          skip_reason?: string | null
          skipped_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_skips_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_skips_session_id_fkey"
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
      functional_checkins: {
        Row: {
          caregiver_burden: number | null
          checkin_date: string
          communication_of_needs: number | null
          conversational_participation: number | null
          created_at: string
          id: string
          independence_level: number | null
          notes: string | null
          profile_id: string | null
          rated_by: string | null
          user_id: string
        }
        Insert: {
          caregiver_burden?: number | null
          checkin_date?: string
          communication_of_needs?: number | null
          conversational_participation?: number | null
          created_at?: string
          id?: string
          independence_level?: number | null
          notes?: string | null
          profile_id?: string | null
          rated_by?: string | null
          user_id: string
        }
        Update: {
          caregiver_burden?: number | null
          checkin_date?: string
          communication_of_needs?: number | null
          conversational_participation?: number | null
          created_at?: string
          id?: string
          independence_level?: number | null
          notes?: string | null
          profile_id?: string | null
          rated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "functional_checkins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      functional_goals: {
        Row: {
          archived_at: string | null
          baseline_status: string
          created_at: string
          created_by: string | null
          goal_text: string
          id: string
          profile_id: string | null
          target_date: string | null
          target_domain: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          baseline_status?: string
          created_at?: string
          created_by?: string | null
          goal_text: string
          id?: string
          profile_id?: string | null
          target_date?: string | null
          target_domain: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          baseline_status?: string
          created_at?: string
          created_by?: string | null
          goal_text?: string
          id?: string
          profile_id?: string | null
          target_date?: string | null
          target_domain?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "functional_goals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_progress_ratings: {
        Row: {
          confidence_level: number | null
          goal_id: string
          id: string
          notes: string | null
          rated_at: string
          rated_by: string | null
          status: string
        }
        Insert: {
          confidence_level?: number | null
          goal_id: string
          id?: string
          notes?: string | null
          rated_at?: string
          rated_by?: string | null
          status: string
        }
        Update: {
          confidence_level?: number | null
          goal_id?: string
          id?: string
          notes?: string | null
          rated_at?: string
          rated_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_ratings_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "functional_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_rates: {
        Row: {
          accuracy_slope: number | null
          calculated_at: string | null
          confidence_score: number | null
          domain: string
          end_accuracy: number | null
          end_date: string
          id: string
          profile_id: string | null
          rt_slope: number | null
          start_accuracy: number | null
          start_date: string
          time_window_days: number
          trial_count: number
          user_id: string
        }
        Insert: {
          accuracy_slope?: number | null
          calculated_at?: string | null
          confidence_score?: number | null
          domain: string
          end_accuracy?: number | null
          end_date: string
          id?: string
          profile_id?: string | null
          rt_slope?: number | null
          start_accuracy?: number | null
          start_date: string
          time_window_days: number
          trial_count?: number
          user_id: string
        }
        Update: {
          accuracy_slope?: number | null
          calculated_at?: string | null
          confidence_score?: number | null
          domain?: string
          end_accuracy?: number | null
          end_date?: string
          id?: string
          profile_id?: string | null
          rt_slope?: number | null
          start_accuracy?: number | null
          start_date?: string
          time_window_days?: number
          trial_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_rates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outcome_predictions: {
        Row: {
          clinical_context: Json
          created_at: string | null
          id: string
          prediction_data: Json
          profile_id: string | null
          user_id: string
        }
        Insert: {
          clinical_context: Json
          created_at?: string | null
          id?: string
          prediction_data: Json
          profile_id?: string | null
          user_id: string
        }
        Update: {
          clinical_context?: Json
          created_at?: string | null
          id?: string
          prediction_data?: Json
          profile_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcome_predictions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string | null
          id: string
          labels: string[] | null
          name: string
          profile_id: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          labels?: string[] | null
          name: string
          profile_id?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          labels?: string[] | null
          name?: string
          profile_id?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      physical_daily_metrics: {
        Row: {
          active_minutes: number | null
          created_at: string
          id: string
          import_id: string | null
          last_sync_at: string | null
          metric_date: string
          profile_id: string
          resting_hr: number | null
          sleep_minutes: number | null
          source: string
          steps: number | null
          updated_at: string
          user_id: string
          workout_minutes: number | null
        }
        Insert: {
          active_minutes?: number | null
          created_at?: string
          id?: string
          import_id?: string | null
          last_sync_at?: string | null
          metric_date: string
          profile_id: string
          resting_hr?: number | null
          sleep_minutes?: number | null
          source?: string
          steps?: number | null
          updated_at?: string
          user_id: string
          workout_minutes?: number | null
        }
        Update: {
          active_minutes?: number | null
          created_at?: string
          id?: string
          import_id?: string | null
          last_sync_at?: string | null
          metric_date?: string
          profile_id?: string
          resting_hr?: number | null
          sleep_minutes?: number | null
          source?: string
          steps?: number | null
          updated_at?: string
          user_id?: string
          workout_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "physical_daily_metrics_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_merge_conflicts: {
        Row: {
          conflicts: Json
          created_at: string
          existing_profile_version_id: string | null
          id: string
          new_note_id: string | null
          new_parsed_profile: Json
          profile_id: string | null
          resolution_choice: Json | null
          resolution_status: string
          resolved_at: string | null
          resolved_by: string | null
          user_id: string
        }
        Insert: {
          conflicts?: Json
          created_at?: string
          existing_profile_version_id?: string | null
          id?: string
          new_note_id?: string | null
          new_parsed_profile?: Json
          profile_id?: string | null
          resolution_choice?: Json | null
          resolution_status?: string
          resolved_at?: string | null
          resolved_by?: string | null
          user_id: string
        }
        Update: {
          conflicts?: Json
          created_at?: string
          existing_profile_version_id?: string | null
          id?: string
          new_note_id?: string | null
          new_parsed_profile?: Json
          profile_id?: string | null
          resolution_choice?: Json | null
          resolution_status?: string
          resolved_at?: string | null
          resolved_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_merge_conflicts_existing_profile_version_id_fkey"
            columns: ["existing_profile_version_id"]
            isOneToOne: false
            referencedRelation: "clinical_profile_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_merge_conflicts_new_note_id_fkey"
            columns: ["new_note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_merge_conflicts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accessibility_prefs: Json | null
          aphasia_type: string | null
          avatar_url: string | null
          birthdate: string | null
          capability_profile_id: string | null
          caregiver_mode_enabled: boolean | null
          chronicity_tag: string | null
          clinical_profile: Json | null
          consent_version: number | null
          created_at: string | null
          daily_cap_minutes: number | null
          daily_goal_minutes: number | null
          display_name: string | null
          enforce_dose_caps: boolean | null
          goals: string[] | null
          hand_bias: string | null
          id: string
          is_active: boolean | null
          laterality: string | null
          primary_territory: string | null
          profile_created_at: string | null
          profile_name: string
          profile_notes: string | null
          runtime_config: Json | null
          session_cap_minutes: number | null
          stroke_date: string | null
          stroke_mechanism_tag: string | null
          user_id: string
        }
        Insert: {
          accessibility_prefs?: Json | null
          aphasia_type?: string | null
          avatar_url?: string | null
          birthdate?: string | null
          capability_profile_id?: string | null
          caregiver_mode_enabled?: boolean | null
          chronicity_tag?: string | null
          clinical_profile?: Json | null
          consent_version?: number | null
          created_at?: string | null
          daily_cap_minutes?: number | null
          daily_goal_minutes?: number | null
          display_name?: string | null
          enforce_dose_caps?: boolean | null
          goals?: string[] | null
          hand_bias?: string | null
          id?: string
          is_active?: boolean | null
          laterality?: string | null
          primary_territory?: string | null
          profile_created_at?: string | null
          profile_name: string
          profile_notes?: string | null
          runtime_config?: Json | null
          session_cap_minutes?: number | null
          stroke_date?: string | null
          stroke_mechanism_tag?: string | null
          user_id: string
        }
        Update: {
          accessibility_prefs?: Json | null
          aphasia_type?: string | null
          avatar_url?: string | null
          birthdate?: string | null
          capability_profile_id?: string | null
          caregiver_mode_enabled?: boolean | null
          chronicity_tag?: string | null
          clinical_profile?: Json | null
          consent_version?: number | null
          created_at?: string | null
          daily_cap_minutes?: number | null
          daily_goal_minutes?: number | null
          display_name?: string | null
          enforce_dose_caps?: boolean | null
          goals?: string[] | null
          hand_bias?: string | null
          id?: string
          is_active?: boolean | null
          laterality?: string | null
          primary_territory?: string | null
          profile_created_at?: string | null
          profile_name?: string
          profile_notes?: string | null
          runtime_config?: Json | null
          session_cap_minutes?: number | null
          stroke_date?: string | null
          stroke_mechanism_tag?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_capability_profile_id_fkey"
            columns: ["capability_profile_id"]
            isOneToOne: false
            referencedRelation: "capability_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          acknowledgement_notes: string | null
          alert_type: string
          created_at: string
          description: string | null
          domain_slug: string | null
          id: string
          profile_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
          trigger_data: Json | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledgement_notes?: string | null
          alert_type: string
          created_at?: string
          description?: string | null
          domain_slug?: string | null
          id?: string
          profile_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
          trigger_data?: Json | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledgement_notes?: string | null
          alert_type?: string
          created_at?: string
          description?: string | null
          domain_slug?: string | null
          id?: string
          profile_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
          trigger_data?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_alerts_domain_slug_fkey"
            columns: ["domain_slug"]
            isOneToOne: false
            referencedRelation: "recovery_domains"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "recovery_alerts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_domains: {
        Row: {
          created_at: string
          display_name: string
          dose_unit: string
          icon_name: string | null
          id: string
          is_active: boolean
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          display_name: string
          dose_unit?: string
          icon_name?: string | null
          id?: string
          is_active?: boolean
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          dose_unit?: string
          icon_name?: string | null
          id?: string
          is_active?: boolean
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      recovery_score_snapshots: {
        Row: {
          accuracy_score: number | null
          component_details: Json | null
          confidence_level: string
          consistency_score: number | null
          created_at: string
          cue_independence_score: number | null
          endurance_score: number | null
          error_quality_score: number | null
          id: string
          latency_score: number | null
          profile_id: string | null
          recovery_score: number
          score_version: string
          session_count: number
          snapshot_date: string
          trial_count: number
          user_id: string
        }
        Insert: {
          accuracy_score?: number | null
          component_details?: Json | null
          confidence_level?: string
          consistency_score?: number | null
          created_at?: string
          cue_independence_score?: number | null
          endurance_score?: number | null
          error_quality_score?: number | null
          id?: string
          latency_score?: number | null
          profile_id?: string | null
          recovery_score: number
          score_version?: string
          session_count?: number
          snapshot_date?: string
          trial_count?: number
          user_id: string
        }
        Update: {
          accuracy_score?: number | null
          component_details?: Json | null
          confidence_level?: string
          consistency_score?: number | null
          created_at?: string
          cue_independence_score?: number | null
          endurance_score?: number | null
          error_quality_score?: number | null
          id?: string
          latency_score?: number | null
          profile_id?: string | null
          recovery_score?: number
          score_version?: string
          session_count?: number
          snapshot_date?: string
          trial_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_score_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_summaries: {
        Row: {
          ai_summary: string
          confidence_score: number | null
          created_at: string
          data_snapshot: Json
          generated_at: string
          generation_duration_ms: number | null
          id: string
          key_insights: string[]
          model_used: string | null
          profile_id: string | null
          replaces_summary_id: string | null
          summary_type: string
          trial_count_at_generation: number | null
          user_id: string
          version: number
        }
        Insert: {
          ai_summary: string
          confidence_score?: number | null
          created_at?: string
          data_snapshot?: Json
          generated_at?: string
          generation_duration_ms?: number | null
          id?: string
          key_insights?: string[]
          model_used?: string | null
          profile_id?: string | null
          replaces_summary_id?: string | null
          summary_type: string
          trial_count_at_generation?: number | null
          user_id: string
          version?: number
        }
        Update: {
          ai_summary?: string
          confidence_score?: number | null
          created_at?: string
          data_snapshot?: Json
          generated_at?: string
          generation_duration_ms?: number | null
          id?: string
          key_insights?: string[]
          model_used?: string | null
          profile_id?: string | null
          replaces_summary_id?: string | null
          summary_type?: string
          trial_count_at_generation?: number | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recovery_summaries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_summaries_replaces_summary_id_fkey"
            columns: ["replaces_summary_id"]
            isOneToOne: false
            referencedRelation: "recovery_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_snapshots: {
        Row: {
          best_cue_level: number | null
          best_score: number | null
          created_at: string
          id: string
          last_cue_level: number | null
          last_practiced_at: string | null
          last_score: number | null
          profile_id: string | null
          session_count: number | null
          snapshot_date: string
          topic: string | null
          user_id: string
          word: string
        }
        Insert: {
          best_cue_level?: number | null
          best_score?: number | null
          created_at?: string
          id?: string
          last_cue_level?: number | null
          last_practiced_at?: string | null
          last_score?: number | null
          profile_id?: string | null
          session_count?: number | null
          snapshot_date?: string
          topic?: string | null
          user_id: string
          word: string
        }
        Update: {
          best_cue_level?: number | null
          best_score?: number | null
          created_at?: string
          id?: string
          last_cue_level?: number | null
          last_practiced_at?: string | null
          last_score?: number | null
          profile_id?: string | null
          session_count?: number | null
          snapshot_date?: string
          topic?: string | null
          user_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          caregiver_notes: string | null
          duration_sec: number | null
          ended_at: string | null
          ended_reason: string | null
          engagement_summary: Json | null
          id: string
          mood_rating: number | null
          plan: Json | null
          profile_id: string | null
          started_at: string | null
          summary: Json | null
          user_id: string
        }
        Insert: {
          caregiver_notes?: string | null
          duration_sec?: number | null
          ended_at?: string | null
          ended_reason?: string | null
          engagement_summary?: Json | null
          id?: string
          mood_rating?: number | null
          plan?: Json | null
          profile_id?: string | null
          started_at?: string | null
          summary?: Json | null
          user_id: string
        }
        Update: {
          caregiver_notes?: string | null
          duration_sec?: number | null
          ended_at?: string | null
          ended_reason?: string | null
          engagement_summary?: Json | null
          id?: string
          mood_rating?: number | null
          plan?: Json | null
          profile_id?: string | null
          started_at?: string | null
          summary?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shadow_events: {
        Row: {
          analysis_data: Json | null
          asr_confidence: number | null
          attempt_id: string | null
          created_at: string
          cue_type_candidate: string | null
          domain: string | null
          environment: string | null
          id: string
          interaction_mode: string | null
          latency_ms: number | null
          model_version: string | null
          outcome_correct: boolean | null
          outcome_error_type: string | null
          profile_id: string | null
          review_status: string
          session_id: string | null
          source_type: string
          system_action: string | null
          system_confidence: number | null
          system_guess: string | null
          target_phrase: string | null
          target_word: string | null
          task_data: Json | null
          task_type: string
          trigger_reason: string | null
          user_id: string
          user_self_recovered: boolean | null
          user_spoke: boolean | null
          user_transcript: string | null
        }
        Insert: {
          analysis_data?: Json | null
          asr_confidence?: number | null
          attempt_id?: string | null
          created_at?: string
          cue_type_candidate?: string | null
          domain?: string | null
          environment?: string | null
          id?: string
          interaction_mode?: string | null
          latency_ms?: number | null
          model_version?: string | null
          outcome_correct?: boolean | null
          outcome_error_type?: string | null
          profile_id?: string | null
          review_status?: string
          session_id?: string | null
          source_type?: string
          system_action?: string | null
          system_confidence?: number | null
          system_guess?: string | null
          target_phrase?: string | null
          target_word?: string | null
          task_data?: Json | null
          task_type: string
          trigger_reason?: string | null
          user_id: string
          user_self_recovered?: boolean | null
          user_spoke?: boolean | null
          user_transcript?: string | null
        }
        Update: {
          analysis_data?: Json | null
          asr_confidence?: number | null
          attempt_id?: string | null
          created_at?: string
          cue_type_candidate?: string | null
          domain?: string | null
          environment?: string | null
          id?: string
          interaction_mode?: string | null
          latency_ms?: number | null
          model_version?: string | null
          outcome_correct?: boolean | null
          outcome_error_type?: string | null
          profile_id?: string | null
          review_status?: string
          session_id?: string | null
          source_type?: string
          system_action?: string | null
          system_confidence?: number | null
          system_guess?: string | null
          target_phrase?: string | null
          target_word?: string | null
          task_data?: Json | null
          task_type?: string
          trigger_reason?: string | null
          user_id?: string
          user_self_recovered?: boolean | null
          user_spoke?: boolean | null
          user_transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shadow_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shadow_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      speech_profile_snapshots: {
        Row: {
          computed_at: string
          created_at: string
          cue_efficacy_by_type: Json | null
          error_type_distribution: Json | null
          id: string
          phoneme_difficulty_map: Json | null
          phoneme_token_count: number | null
          profile_id: string
          trial_count_at_computation: number
          trials_with_gop_data: number | null
          trials_with_nonzero_accuracy: number | null
          trials_with_phonemes: number | null
          user_id: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          cue_efficacy_by_type?: Json | null
          error_type_distribution?: Json | null
          id?: string
          phoneme_difficulty_map?: Json | null
          phoneme_token_count?: number | null
          profile_id: string
          trial_count_at_computation: number
          trials_with_gop_data?: number | null
          trials_with_nonzero_accuracy?: number | null
          trials_with_phonemes?: number | null
          user_id: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          cue_efficacy_by_type?: Json | null
          error_type_distribution?: Json | null
          id?: string
          phoneme_difficulty_map?: Json | null
          phoneme_token_count?: number | null
          profile_id?: string
          trial_count_at_computation?: number
          trials_with_gop_data?: number | null
          trials_with_nonzero_accuracy?: number | null
          trials_with_phonemes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speech_profile_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      standardized_assessments: {
        Row: {
          assessed_by: string | null
          assessment_date: string
          assessment_type: string
          created_at: string | null
          id: string
          notes: string | null
          profile_id: string | null
          scores: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assessed_by?: string | null
          assessment_date: string
          assessment_type: string
          created_at?: string | null
          id?: string
          notes?: string | null
          profile_id?: string | null
          scores?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assessed_by?: string | null
          assessment_date?: string
          assessment_type?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          profile_id?: string | null
          scores?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standardized_assessments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thought_decision_logs: {
        Row: {
          id: string
          log_date: string
          logged_at: string
          narrowing_levels_used: number[] | null
          outcome_did_speak: boolean | null
          outcome_latency_ms: number | null
          outcome_stuck_type: string | null
          outcome_utterance_complete: boolean | null
          previous_stuck_type: string | null
          profile_id: string | null
          prompt_difficulty_tier: number | null
          prompt_id: string | null
          prompt_intent_type: string | null
          prompt_text: string
          prompt_theme: string | null
          selection_reason: string
          session_attempt_count: number | null
          session_avg_latency_ms: number | null
          session_completion_count: number | null
          session_id: string | null
          stuck_type_history: string[] | null
          user_id: string
        }
        Insert: {
          id?: string
          log_date?: string
          logged_at?: string
          narrowing_levels_used?: number[] | null
          outcome_did_speak?: boolean | null
          outcome_latency_ms?: number | null
          outcome_stuck_type?: string | null
          outcome_utterance_complete?: boolean | null
          previous_stuck_type?: string | null
          profile_id?: string | null
          prompt_difficulty_tier?: number | null
          prompt_id?: string | null
          prompt_intent_type?: string | null
          prompt_text: string
          prompt_theme?: string | null
          selection_reason: string
          session_attempt_count?: number | null
          session_avg_latency_ms?: number | null
          session_completion_count?: number | null
          session_id?: string | null
          stuck_type_history?: string[] | null
          user_id: string
        }
        Update: {
          id?: string
          log_date?: string
          logged_at?: string
          narrowing_levels_used?: number[] | null
          outcome_did_speak?: boolean | null
          outcome_latency_ms?: number | null
          outcome_stuck_type?: string | null
          outcome_utterance_complete?: boolean | null
          previous_stuck_type?: string | null
          profile_id?: string | null
          prompt_difficulty_tier?: number | null
          prompt_id?: string | null
          prompt_intent_type?: string | null
          prompt_text?: string
          prompt_theme?: string | null
          selection_reason?: string
          session_attempt_count?: number | null
          session_avg_latency_ms?: number | null
          session_completion_count?: number | null
          session_id?: string | null
          stuck_type_history?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thought_decision_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thought_decision_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      thought_prompts: {
        Row: {
          created_at: string
          difficulty_tier: number
          id: string
          intent_type: string
          is_active: boolean
          narrowing_steps: Json
          prompt_text: string
          theme: string
          time_anchor: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          difficulty_tier?: number
          id?: string
          intent_type: string
          is_active?: boolean
          narrowing_steps?: Json
          prompt_text: string
          theme: string
          time_anchor?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          difficulty_tier?: number
          id?: string
          intent_type?: string
          is_active?: boolean
          narrowing_steps?: Json
          prompt_text?: string
          theme?: string
          time_anchor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_adaptation_profiles: {
        Row: {
          avg_response_latency_ms: number | null
          created_at: string
          cue_dependency_score: number | null
          cue_dependency_trend: string | null
          data_confidence: string
          dominant_error_type: string | null
          engagement_baseline: Json
          error_type_distribution: Json
          id: string
          last_computed_at: string
          latency_trend_pct: number | null
          plateau_domains: string[]
          plateau_flag: boolean
          profile_id: string
          recommended_cue_bias: string | null
          trial_count_window: number
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          avg_response_latency_ms?: number | null
          created_at?: string
          cue_dependency_score?: number | null
          cue_dependency_trend?: string | null
          data_confidence?: string
          dominant_error_type?: string | null
          engagement_baseline?: Json
          error_type_distribution?: Json
          id?: string
          last_computed_at?: string
          latency_trend_pct?: number | null
          plateau_domains?: string[]
          plateau_flag?: boolean
          profile_id: string
          recommended_cue_bias?: string | null
          trial_count_window?: number
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          avg_response_latency_ms?: number | null
          created_at?: string
          cue_dependency_score?: number | null
          cue_dependency_trend?: string | null
          data_confidence?: string
          dominant_error_type?: string | null
          engagement_baseline?: Json
          error_type_distribution?: Json
          id?: string
          last_computed_at?: string
          latency_trend_pct?: number | null
          plateau_domains?: string[]
          plateau_flag?: boolean
          profile_id?: string
          recommended_cue_bias?: string | null
          trial_count_window?: number
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
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
      user_speech_profiles: {
        Row: {
          avg_stall_duration_ms: number | null
          baseline_pause_frequency: number | null
          baseline_wpm: number | null
          common_stall_markers: string[] | null
          common_substitutions: Json | null
          created_at: string | null
          cue_efficacy_by_category: Json | null
          cue_efficacy_by_type: Json | null
          effortful_speech_rate: number | null
          error_type_distribution: Json | null
          id: string
          known_circumlocutions: Json | null
          last_computed_at: string | null
          most_challenging_categories: Json | null
          phoneme_difficulty_map: Json | null
          phoneme_token_count: number | null
          profile_id: string
          trial_count_at_computation: number | null
          trials_with_gop_data: number | null
          trials_with_nonzero_accuracy: number | null
          trials_with_phonemes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_stall_duration_ms?: number | null
          baseline_pause_frequency?: number | null
          baseline_wpm?: number | null
          common_stall_markers?: string[] | null
          common_substitutions?: Json | null
          created_at?: string | null
          cue_efficacy_by_category?: Json | null
          cue_efficacy_by_type?: Json | null
          effortful_speech_rate?: number | null
          error_type_distribution?: Json | null
          id?: string
          known_circumlocutions?: Json | null
          last_computed_at?: string | null
          most_challenging_categories?: Json | null
          phoneme_difficulty_map?: Json | null
          phoneme_token_count?: number | null
          profile_id: string
          trial_count_at_computation?: number | null
          trials_with_gop_data?: number | null
          trials_with_nonzero_accuracy?: number | null
          trials_with_phonemes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_stall_duration_ms?: number | null
          baseline_pause_frequency?: number | null
          baseline_wpm?: number | null
          common_stall_markers?: string[] | null
          common_substitutions?: Json | null
          created_at?: string | null
          cue_efficacy_by_category?: Json | null
          cue_efficacy_by_type?: Json | null
          effortful_speech_rate?: number | null
          error_type_distribution?: Json | null
          id?: string
          known_circumlocutions?: Json | null
          last_computed_at?: string | null
          most_challenging_categories?: Json | null
          phoneme_difficulty_map?: Json | null
          phoneme_token_count?: number | null
          profile_id?: string
          trial_count_at_computation?: number | null
          trials_with_gop_data?: number | null
          trials_with_nonzero_accuracy?: number | null
          trials_with_phonemes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_speech_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      utterance_analyses: {
        Row: {
          alignment_data: Json | null
          analysis_priority: number | null
          analysis_status: string | null
          analysis_version: string | null
          asr_confidence: number | null
          asr_warning_flags: string[] | null
          attempt_id: string
          attempt_number: number | null
          audio_meta: Json | null
          audio_storage_path: string | null
          avg_pause_duration_ms: number | null
          category: string | null
          classification_confidence: number | null
          clinician_override_at: string | null
          clinician_override_by: string | null
          clinician_override_note: string | null
          clinician_validity_override: string | null
          coherence_score: number | null
          counts_toward_score: boolean
          created_at: string | null
          cue_trigger: string | null
          cue_type_given: string | null
          cue_was_effective: boolean | null
          did_speak: boolean | null
          effortful_speech: boolean | null
          error_message: string | null
          error_type: string | null
          evaluation_model: string | null
          exercise_slug: string | null
          fluency_available: boolean | null
          fluency_unavailable_reason: string | null
          gop_data: Json | null
          human_labels: Json | null
          id: string
          is_correct: boolean | null
          latency_ms: number | null
          latency_to_first_word_ms: number | null
          locked_at: string | null
          locked_by: string | null
          momentum_components: Json | null
          momentum_score: number | null
          narrowing_level_used: number | null
          narrowing_trigger: string | null
          next_retry_at: string | null
          pause_count: number | null
          phonological_similarity: number | null
          prompt_intent_type: string | null
          prompt_theme: string | null
          pron_request_id: string | null
          pronunciation_error_message: string | null
          pronunciation_error_stage: string | null
          pronunciation_status: string | null
          pronunciation_timings_ms: Json | null
          reasoning: string | null
          recording_duration_ms: number | null
          retry_count: number | null
          review_status: string | null
          semantic_similarity: number | null
          session_id: string | null
          speech_rate_wpm: number | null
          speech_ratio: number | null
          stuck_type: string | null
          target_word: string
          time_to_success_after_cue_ms: number | null
          total_pause_ms: number | null
          transcript: string | null
          transcript_source: string | null
          trial_index: number | null
          updated_at: string | null
          user_id: string
          utterance_complete: boolean | null
          validity_confidence: number | null
          validity_label: string | null
          validity_reason: string | null
          validity_signals: Json | null
        }
        Insert: {
          alignment_data?: Json | null
          analysis_priority?: number | null
          analysis_status?: string | null
          analysis_version?: string | null
          asr_confidence?: number | null
          asr_warning_flags?: string[] | null
          attempt_id: string
          attempt_number?: number | null
          audio_meta?: Json | null
          audio_storage_path?: string | null
          avg_pause_duration_ms?: number | null
          category?: string | null
          classification_confidence?: number | null
          clinician_override_at?: string | null
          clinician_override_by?: string | null
          clinician_override_note?: string | null
          clinician_validity_override?: string | null
          coherence_score?: number | null
          counts_toward_score?: boolean
          created_at?: string | null
          cue_trigger?: string | null
          cue_type_given?: string | null
          cue_was_effective?: boolean | null
          did_speak?: boolean | null
          effortful_speech?: boolean | null
          error_message?: string | null
          error_type?: string | null
          evaluation_model?: string | null
          exercise_slug?: string | null
          fluency_available?: boolean | null
          fluency_unavailable_reason?: string | null
          gop_data?: Json | null
          human_labels?: Json | null
          id?: string
          is_correct?: boolean | null
          latency_ms?: number | null
          latency_to_first_word_ms?: number | null
          locked_at?: string | null
          locked_by?: string | null
          momentum_components?: Json | null
          momentum_score?: number | null
          narrowing_level_used?: number | null
          narrowing_trigger?: string | null
          next_retry_at?: string | null
          pause_count?: number | null
          phonological_similarity?: number | null
          prompt_intent_type?: string | null
          prompt_theme?: string | null
          pron_request_id?: string | null
          pronunciation_error_message?: string | null
          pronunciation_error_stage?: string | null
          pronunciation_status?: string | null
          pronunciation_timings_ms?: Json | null
          reasoning?: string | null
          recording_duration_ms?: number | null
          retry_count?: number | null
          review_status?: string | null
          semantic_similarity?: number | null
          session_id?: string | null
          speech_rate_wpm?: number | null
          speech_ratio?: number | null
          stuck_type?: string | null
          target_word: string
          time_to_success_after_cue_ms?: number | null
          total_pause_ms?: number | null
          transcript?: string | null
          transcript_source?: string | null
          trial_index?: number | null
          updated_at?: string | null
          user_id: string
          utterance_complete?: boolean | null
          validity_confidence?: number | null
          validity_label?: string | null
          validity_reason?: string | null
          validity_signals?: Json | null
        }
        Update: {
          alignment_data?: Json | null
          analysis_priority?: number | null
          analysis_status?: string | null
          analysis_version?: string | null
          asr_confidence?: number | null
          asr_warning_flags?: string[] | null
          attempt_id?: string
          attempt_number?: number | null
          audio_meta?: Json | null
          audio_storage_path?: string | null
          avg_pause_duration_ms?: number | null
          category?: string | null
          classification_confidence?: number | null
          clinician_override_at?: string | null
          clinician_override_by?: string | null
          clinician_override_note?: string | null
          clinician_validity_override?: string | null
          coherence_score?: number | null
          counts_toward_score?: boolean
          created_at?: string | null
          cue_trigger?: string | null
          cue_type_given?: string | null
          cue_was_effective?: boolean | null
          did_speak?: boolean | null
          effortful_speech?: boolean | null
          error_message?: string | null
          error_type?: string | null
          evaluation_model?: string | null
          exercise_slug?: string | null
          fluency_available?: boolean | null
          fluency_unavailable_reason?: string | null
          gop_data?: Json | null
          human_labels?: Json | null
          id?: string
          is_correct?: boolean | null
          latency_ms?: number | null
          latency_to_first_word_ms?: number | null
          locked_at?: string | null
          locked_by?: string | null
          momentum_components?: Json | null
          momentum_score?: number | null
          narrowing_level_used?: number | null
          narrowing_trigger?: string | null
          next_retry_at?: string | null
          pause_count?: number | null
          phonological_similarity?: number | null
          prompt_intent_type?: string | null
          prompt_theme?: string | null
          pron_request_id?: string | null
          pronunciation_error_message?: string | null
          pronunciation_error_stage?: string | null
          pronunciation_status?: string | null
          pronunciation_timings_ms?: Json | null
          reasoning?: string | null
          recording_duration_ms?: number | null
          retry_count?: number | null
          review_status?: string | null
          semantic_similarity?: number | null
          session_id?: string | null
          speech_rate_wpm?: number | null
          speech_ratio?: number | null
          stuck_type?: string | null
          target_word?: string
          time_to_success_after_cue_ms?: number | null
          total_pause_ms?: number | null
          transcript?: string | null
          transcript_source?: string | null
          trial_index?: number | null
          updated_at?: string | null
          user_id?: string
          utterance_complete?: boolean | null
          validity_confidence?: number | null
          validity_label?: string | null
          validity_reason?: string | null
          validity_signals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "utterance_analyses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_session_summaries: {
        Row: {
          avg_confidence: number | null
          created_at: string
          fallback_chips_used: number
          fallback_type_used: number
          first_attempt_accept_rate: number | null
          id: string
          mic_starts: number
          mic_successes: number
          preview_accepted: number
          preview_edited: number
          preview_retried: number
          recognition_success_rate: number | null
          session_id: string | null
          text_turns: number
          topic_id: string | null
          total_turns: number
          tts_plays: number
          user_id: string
          voice_adoption_rate: number | null
          voice_turns: number
        }
        Insert: {
          avg_confidence?: number | null
          created_at?: string
          fallback_chips_used?: number
          fallback_type_used?: number
          first_attempt_accept_rate?: number | null
          id?: string
          mic_starts?: number
          mic_successes?: number
          preview_accepted?: number
          preview_edited?: number
          preview_retried?: number
          recognition_success_rate?: number | null
          session_id?: string | null
          text_turns?: number
          topic_id?: string | null
          total_turns?: number
          tts_plays?: number
          user_id: string
          voice_adoption_rate?: number | null
          voice_turns?: number
        }
        Update: {
          avg_confidence?: number | null
          created_at?: string
          fallback_chips_used?: number
          fallback_type_used?: number
          first_attempt_accept_rate?: number | null
          id?: string
          mic_starts?: number
          mic_successes?: number
          preview_accepted?: number
          preview_edited?: number
          preview_retried?: number
          recognition_success_rate?: number | null
          session_id?: string | null
          text_turns?: number
          topic_id?: string | null
          total_turns?: number
          tts_plays?: number
          user_id?: string
          voice_adoption_rate?: number | null
          voice_turns?: number
        }
        Relationships: [
          {
            foreignKeyName: "voice_session_summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_heartbeats: {
        Row: {
          last_seen: string
          meta: Json
          status: string
          worker_id: string
        }
        Insert: {
          last_seen?: string
          meta?: Json
          status?: string
          worker_id: string
        }
        Update: {
          last_seen?: string
          meta?: Json
          status?: string
          worker_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      cluster_learning_rates: {
        Row: {
          avg_accuracy_slope: number | null
          avg_confidence: number | null
          avg_rt_slope: number | null
          chronicity: string | null
          cluster_key: string | null
          domain: string | null
          hemisphere: string | null
          last_updated: string | null
          lesion_zone: string | null
          median_accuracy_slope: number | null
          median_rt_slope: number | null
          p25_accuracy_slope: number | null
          p75_accuracy_slope: number | null
          sd_accuracy_slope: number | null
          stroke_mechanism: string | null
          time_window_days: number | null
          total_trials: number | null
          user_count: number | null
        }
        Relationships: []
      }
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
      v_adaptation_event_summary: {
        Row: {
          cue_escalations: number | null
          difficulty_changes: number | null
          event_date: string | null
          exercise_slug: string | null
          frustration_stepdowns: number | null
          last_event_at: string | null
          profile_id: string | null
          sessions_touched: number | null
          total_events: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adaptation_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_view_cluster_analytics: { Args: never; Returns: boolean }
      claim_speech_analysis_jobs: {
        Args: { p_batch_size?: number; p_worker_id: string }
        Returns: {
          analysis_version: string
          attempt_id: string
          audio_storage_path: string
          target_word: string
          transcript: string
        }[]
      }
      clinician_adjust_difficulty: {
        Args: {
          p_clinician_id: string
          p_direction?: string
          p_exercise_slug?: string
          p_profile_id: string
          p_user_id: string
        }
        Returns: Json
      }
      clinician_approve_override: {
        Args: {
          p_clinician_id: string
          p_override_id: string
          p_profile_id: string
          p_user_id: string
        }
        Returns: Json
      }
      clinician_assign_practice: {
        Args: {
          p_clinician_id: string
          p_notes?: string
          p_profile_id: string
          p_user_id: string
        }
        Returns: Json
      }
      clinician_reduce_dose: {
        Args: {
          p_clinician_id: string
          p_domain_slug?: string
          p_profile_id: string
          p_reduction_pct?: number
          p_user_id: string
        }
        Returns: Json
      }
      clinician_reject_override: {
        Args: {
          p_clinician_id: string
          p_override_id: string
          p_profile_id: string
          p_reason?: string
          p_user_id: string
        }
        Returns: Json
      }
      clinician_reverse_override: {
        Args: {
          p_clinician_id: string
          p_override_id: string
          p_profile_id: string
          p_reason?: string
          p_user_id: string
        }
        Returns: Json
      }
      clinician_review_cueing: {
        Args: {
          p_clinician_id: string
          p_new_cue_level?: number
          p_profile_id: string
          p_user_id: string
        }
        Returns: Json
      }
      clinician_schedule_outreach: {
        Args: {
          p_clinician_id: string
          p_profile_id: string
          p_reason?: string
          p_user_id: string
        }
        Returns: Json
      }
      clinician_suggest_override: {
        Args: {
          p_override_type: string
          p_profile_id: string
          p_reason?: string
          p_suggested_by: string
          p_target_slug?: string
          p_user_id: string
          p_value_after?: Json
        }
        Returns: Json
      }
      close_stale_sessions: { Args: never; Returns: number }
      create_profile_version: {
        Args: {
          p_change_reason?: string
          p_created_by?: string
          p_profile_data: Json
          p_source_note_id?: string
          p_source_type: string
          p_user_id: string
        }
        Returns: string
      }
      end_session_server: {
        Args: { p_session_id: string; p_summary: Json }
        Returns: undefined
      }
      get_active_clinical_profile: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_active_profile: {
        Args: never
        Returns: {
          accessibility_prefs: Json | null
          aphasia_type: string | null
          avatar_url: string | null
          birthdate: string | null
          capability_profile_id: string | null
          caregiver_mode_enabled: boolean | null
          chronicity_tag: string | null
          clinical_profile: Json | null
          consent_version: number | null
          created_at: string | null
          daily_cap_minutes: number | null
          daily_goal_minutes: number | null
          display_name: string | null
          enforce_dose_caps: boolean | null
          goals: string[] | null
          hand_bias: string | null
          id: string
          is_active: boolean | null
          laterality: string | null
          primary_territory: string | null
          profile_created_at: string | null
          profile_name: string
          profile_notes: string | null
          runtime_config: Json | null
          session_cap_minutes: number | null
          stroke_date: string | null
          stroke_mechanism_tag: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
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
      get_cluster_learning_rates: {
        Args: never
        Returns: {
          avg_accuracy_slope: number | null
          avg_confidence: number | null
          avg_rt_slope: number | null
          chronicity: string | null
          cluster_key: string | null
          domain: string | null
          hemisphere: string | null
          last_updated: string | null
          lesion_zone: string | null
          median_accuracy_slope: number | null
          median_rt_slope: number | null
          p25_accuracy_slope: number | null
          p75_accuracy_slope: number | null
          sd_accuracy_slope: number | null
          stroke_mechanism: string | null
          time_window_days: number | null
          total_trials: number | null
          user_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "cluster_learning_rates"
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
      get_resumable_session: {
        Args: never
        Returns: {
          id: string
          plan: Json
          started_at: string
          summary: Json
        }[]
      }
      get_session_summary: {
        Args: { p_session_id: string }
        Returns: {
          accuracy: number
          avg_cue_level: number
          avg_rt_ms: number
          background_noise_count: number
          cue_reduction: number
          end_difficulty: number
          error_breakdown: Json
          filler_count: number
          flagged_count: number
          median_rt_ms: number
          no_response_count: number
          start_difficulty: number
          timeout_count: number
          total_trials: number
          valid_trials: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assigned_clinician: {
        Args: { _clinician_id: string; _profile_id: string }
        Returns: boolean
      }
      merge_profile_pref: {
        Args: { p_key: string; p_subkey: string; p_value: Json }
        Returns: undefined
      }
      refresh_cluster_assignments: { Args: never; Returns: undefined }
      release_stale_speech_locks: { Args: never; Returns: number }
      setup_admin_user: { Args: { admin_email: string }; Returns: boolean }
      submit_speech_analysis_result: {
        Args: {
          p_alignment_data?: Json
          p_asr_warning_flags?: string[]
          p_attempt_id: string
          p_error_message?: string
          p_gop_data?: Json
          p_speech_ratio?: number
          p_success: boolean
          p_worker_id: string
        }
        Returns: boolean
      }
      switch_active_profile: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      telemetry_bucketed: {
        Args: { _window: string }
        Returns: {
          adaptation_event_count: number
          bucket_start: string
          exercise_slug: string
          total: number
          with_adaptations: number
          with_error_type: number
          with_signal: number
        }[]
      }
      upsert_worker_heartbeat: {
        Args: { p_meta?: Json; p_status?: string; p_worker_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "caregiver"
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
      app_role: ["admin", "moderator", "user", "caregiver"],
    },
  },
} as const
