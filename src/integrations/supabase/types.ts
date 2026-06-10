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
      adaptation_anomaly_detector_runs: {
        Row: {
          anomalies_skipped_dup: number
          anomalies_written: number
          checklist_version: string
          finished_at: string | null
          id: string
          notes: string | null
          started_at: string
          trials_scanned: number
        }
        Insert: {
          anomalies_skipped_dup?: number
          anomalies_written?: number
          checklist_version?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          trials_scanned?: number
        }
        Update: {
          anomalies_skipped_dup?: number
          anomalies_written?: number
          checklist_version?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          trials_scanned?: number
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
      adaptation_trial_log_anomalies: {
        Row: {
          checklist_version: string
          created_at: string
          detector_run_id: string | null
          exercise_slug: string | null
          expected: Json
          id: string
          observed: Json
          resolution_note: string | null
          resolved_at: string | null
          rule_id: string
          scope: string
          scope_ref_hash: string
          session_id: string | null
          severity: string
          trial_log_id: string | null
          updated_at: string
          user_id: string | null
          window_label: string | null
        }
        Insert: {
          checklist_version?: string
          created_at?: string
          detector_run_id?: string | null
          exercise_slug?: string | null
          expected?: Json
          id?: string
          observed?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          rule_id: string
          scope: string
          scope_ref_hash: string
          session_id?: string | null
          severity: string
          trial_log_id?: string | null
          updated_at?: string
          user_id?: string | null
          window_label?: string | null
        }
        Update: {
          checklist_version?: string
          created_at?: string
          detector_run_id?: string | null
          exercise_slug?: string | null
          expected?: Json
          id?: string
          observed?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          rule_id?: string
          scope?: string
          scope_ref_hash?: string
          session_id?: string | null
          severity?: string
          trial_log_id?: string | null
          updated_at?: string
          user_id?: string | null
          window_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adaptation_trial_log_anomalies_trial_log_id_fkey"
            columns: ["trial_log_id"]
            isOneToOne: false
            referencedRelation: "adaptation_trial_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      adaptation_trial_logs: {
        Row: {
          archetype: string | null
          correct: boolean | null
          created_at: string
          cue_dependency: number | null
          cue_level: number | null
          difficulty: number
          difficulty_change_direction: string | null
          difficulty_change_from: number | null
          difficulty_change_reason: string | null
          difficulty_change_to: number | null
          dominant_axis: string | null
          escalation_block_reason: string | null
          escalation_blocked: boolean
          exercise_slug: string
          fatigue: string | null
          frustration: string | null
          graded_score: number | null
          id: string
          narration: string | null
          profile_id: string | null
          reaction_time_ms: number | null
          recommended_action: string | null
          scaffold_level: number | null
          score_vector: Json | null
          session_id: string | null
          signal_granularity: string | null
          success_rate: number | null
          trial_index: number
          trial_mode: string | null
          trials_at_level: number | null
          user_id: string
        }
        Insert: {
          archetype?: string | null
          correct?: boolean | null
          created_at?: string
          cue_dependency?: number | null
          cue_level?: number | null
          difficulty: number
          difficulty_change_direction?: string | null
          difficulty_change_from?: number | null
          difficulty_change_reason?: string | null
          difficulty_change_to?: number | null
          dominant_axis?: string | null
          escalation_block_reason?: string | null
          escalation_blocked?: boolean
          exercise_slug: string
          fatigue?: string | null
          frustration?: string | null
          graded_score?: number | null
          id?: string
          narration?: string | null
          profile_id?: string | null
          reaction_time_ms?: number | null
          recommended_action?: string | null
          scaffold_level?: number | null
          score_vector?: Json | null
          session_id?: string | null
          signal_granularity?: string | null
          success_rate?: number | null
          trial_index: number
          trial_mode?: string | null
          trials_at_level?: number | null
          user_id: string
        }
        Update: {
          archetype?: string | null
          correct?: boolean | null
          created_at?: string
          cue_dependency?: number | null
          cue_level?: number | null
          difficulty?: number
          difficulty_change_direction?: string | null
          difficulty_change_from?: number | null
          difficulty_change_reason?: string | null
          difficulty_change_to?: number | null
          dominant_axis?: string | null
          escalation_block_reason?: string | null
          escalation_blocked?: boolean
          exercise_slug?: string
          fatigue?: string | null
          frustration?: string | null
          graded_score?: number | null
          id?: string
          narration?: string | null
          profile_id?: string | null
          reaction_time_ms?: number | null
          recommended_action?: string | null
          scaffold_level?: number | null
          score_vector?: Json | null
          session_id?: string | null
          signal_granularity?: string | null
          success_rate?: number | null
          trial_index?: number
          trial_mode?: string | null
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
      care_account_members: {
        Row: {
          care_account_id: string
          created_at: string
          id: string
          invited_email: string | null
          member_role: Database["public"]["Enums"]["care_account_member_role"]
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          care_account_id: string
          created_at?: string
          id?: string
          invited_email?: string | null
          member_role: Database["public"]["Enums"]["care_account_member_role"]
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          care_account_id?: string
          created_at?: string
          id?: string
          invited_email?: string | null
          member_role?: Database["public"]["Enums"]["care_account_member_role"]
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_account_members_care_account_id_fkey"
            columns: ["care_account_id"]
            isOneToOne: false
            referencedRelation: "care_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      care_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["care_account_type"]
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          payer_external_ref: string | null
          payer_member_id: string | null
          subscription_status: string
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["care_account_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          payer_external_ref?: string | null
          payer_member_id?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["care_account_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          payer_external_ref?: string | null
          payer_member_id?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      caregiver_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          caregiver_id: string
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
          caregiver_id: string
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
          caregiver_id?: string
          id?: string
          notes?: string | null
          patient_user_id?: string
          profile_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: []
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
      clinical_progression_state: {
        Row: {
          consecutive_struggle_sessions: number
          consecutive_success_sessions: number
          created_at: string
          current_level: number
          exercise_slug: string
          id: string
          last_session_id: string | null
          last_updated_at: string
          profile_id: string
          progress_pct: number
          stable_level: number
          support_baseline: number
          user_id: string
        }
        Insert: {
          consecutive_struggle_sessions?: number
          consecutive_success_sessions?: number
          created_at?: string
          current_level?: number
          exercise_slug: string
          id?: string
          last_session_id?: string | null
          last_updated_at?: string
          profile_id: string
          progress_pct?: number
          stable_level?: number
          support_baseline?: number
          user_id: string
        }
        Update: {
          consecutive_struggle_sessions?: number
          consecutive_success_sessions?: number
          created_at?: string
          current_level?: number
          exercise_slug?: string
          id?: string
          last_session_id?: string | null
          last_updated_at?: string
          profile_id?: string
          progress_pct?: number
          stable_level?: number
          support_baseline?: number
          user_id?: string
        }
        Relationships: []
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
          profile_id: string | null
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
          profile_id?: string | null
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
          profile_id?: string | null
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
      consent_documents: {
        Row: {
          audio_url: string | null
          body_md: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          id: string
          plain_summary: string | null
          title: string
          version: number
        }
        Insert: {
          audio_url?: string | null
          body_md: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          plain_summary?: string | null
          title: string
          version: number
        }
        Update: {
          audio_url?: string | null
          body_md?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          plain_summary?: string | null
          title?: string
          version?: number
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          capacity_confirmed_at: string | null
          capacity_confirmed_by: string | null
          consent_document_id: string | null
          consent_type: string
          consent_version: number
          created_at: string
          document_text_snapshot: string
          enrollment_id: string | null
          id: string
          ip_hash: string | null
          signed_at: string
          signed_name: string
          surrogate_relationship: string | null
          surrogate_signed_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          capacity_confirmed_at?: string | null
          capacity_confirmed_by?: string | null
          consent_document_id?: string | null
          consent_type?: string
          consent_version: number
          created_at?: string
          document_text_snapshot: string
          enrollment_id?: string | null
          id?: string
          ip_hash?: string | null
          signed_at?: string
          signed_name: string
          surrogate_relationship?: string | null
          surrogate_signed_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          capacity_confirmed_at?: string | null
          capacity_confirmed_by?: string | null
          consent_document_id?: string | null
          consent_type?: string
          consent_version?: number
          created_at?: string
          document_text_snapshot?: string
          enrollment_id?: string | null
          id?: string
          ip_hash?: string | null
          signed_at?: string
          signed_name?: string
          surrogate_relationship?: string | null
          surrogate_signed_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_consent_document_id_fkey"
            columns: ["consent_document_id"]
            isOneToOne: false
            referencedRelation: "consent_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "study_enrollments"
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
      eligibility_screenings: {
        Row: {
          criterion_key: string
          criterion_kind: string
          criterion_label: string
          enrollment_id: string
          id: string
          met: boolean
          notes: string | null
          screened_at: string
          screened_by: string
        }
        Insert: {
          criterion_key: string
          criterion_kind: string
          criterion_label: string
          enrollment_id: string
          id?: string
          met: boolean
          notes?: string | null
          screened_at?: string
          screened_by: string
        }
        Update: {
          criterion_key?: string
          criterion_kind?: string
          criterion_label?: string
          enrollment_id?: string
          id?: string
          met?: boolean
          notes?: string | null
          screened_at?: string
          screened_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_screenings_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "study_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_interventions: {
        Row: {
          created_at: string | null
          id: string
          intervention: string
          profile_id: string | null
          session_id: string
          trigger_data: Json | null
          trigger_type: string
          user_action: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          intervention: string
          profile_id?: string | null
          session_id: string
          trigger_data?: Json | null
          trigger_type: string
          user_action?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          intervention?: string
          profile_id?: string | null
          session_id?: string
          trigger_data?: Json | null
          trigger_type?: string
          user_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_interventions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          profile_id: string | null
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
          profile_id?: string | null
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
          profile_id?: string | null
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
            foreignKeyName: "exercise_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
      mastery_health_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_key: string
          context: Json | null
          fired_at: string
          id: string
          metric_key: string
          metric_value: number | null
          severity: string
          threshold_value: number | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_key: string
          context?: Json | null
          fired_at?: string
          id?: string
          metric_key: string
          metric_value?: number | null
          severity: string
          threshold_value?: number | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_key?: string
          context?: Json | null
          fired_at?: string
          id?: string
          metric_key?: string
          metric_value?: number | null
          severity?: string
          threshold_value?: number | null
        }
        Relationships: []
      }
      mastery_health_snapshots: {
        Row: {
          captured_at: string
          id: string
          metadata: Json | null
          metric_key: string
          metric_value: number | null
        }
        Insert: {
          captured_at?: string
          id?: string
          metadata?: Json | null
          metric_key: string
          metric_value?: number | null
        }
        Update: {
          captured_at?: string
          id?: string
          metadata?: Json | null
          metric_key?: string
          metric_value?: number | null
        }
        Relationships: []
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
      probe_results: {
        Row: {
          correct: boolean
          created_at: string
          cues_needed: number
          error_type: string | null
          id: string
          probe_word: string
          profile_id: string | null
          reaction_time_ms: number | null
          session_id: string | null
          target_difficulty: number
          user_id: string
        }
        Insert: {
          correct?: boolean
          created_at?: string
          cues_needed?: number
          error_type?: string | null
          id?: string
          probe_word: string
          profile_id?: string | null
          reaction_time_ms?: number | null
          session_id?: string | null
          target_difficulty?: number
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          cues_needed?: number
          error_type?: string | null
          id?: string
          probe_word?: string
          profile_id?: string | null
          reaction_time_ms?: number | null
          session_id?: string | null
          target_difficulty?: number
          user_id?: string
        }
        Relationships: []
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
          care_account_id: string | null
          caregiver_mode_enabled: boolean | null
          chronicity_tag: string | null
          clinical_profile: Json | null
          consent_version: number | null
          created_at: string | null
          daily_cap_minutes: number | null
          daily_goal_minutes: number | null
          display_name: string | null
          enforce_dose_caps: boolean | null
          field_confidence: Json
          goals: string[] | null
          hand_bias: string | null
          id: string
          is_active: boolean | null
          laterality: string | null
          onboarding_completed_at: string | null
          primary_territory: string | null
          profile_created_at: string | null
          profile_kind: string
          profile_name: string
          profile_notes: string | null
          profile_source: string | null
          runtime_config: Json | null
          session_cap_minutes: number | null
          stroke_date: string | null
          stroke_mechanism_tag: string | null
          user_id: string | null
        }
        Insert: {
          accessibility_prefs?: Json | null
          aphasia_type?: string | null
          avatar_url?: string | null
          birthdate?: string | null
          capability_profile_id?: string | null
          care_account_id?: string | null
          caregiver_mode_enabled?: boolean | null
          chronicity_tag?: string | null
          clinical_profile?: Json | null
          consent_version?: number | null
          created_at?: string | null
          daily_cap_minutes?: number | null
          daily_goal_minutes?: number | null
          display_name?: string | null
          enforce_dose_caps?: boolean | null
          field_confidence?: Json
          goals?: string[] | null
          hand_bias?: string | null
          id?: string
          is_active?: boolean | null
          laterality?: string | null
          onboarding_completed_at?: string | null
          primary_territory?: string | null
          profile_created_at?: string | null
          profile_kind?: string
          profile_name: string
          profile_notes?: string | null
          profile_source?: string | null
          runtime_config?: Json | null
          session_cap_minutes?: number | null
          stroke_date?: string | null
          stroke_mechanism_tag?: string | null
          user_id?: string | null
        }
        Update: {
          accessibility_prefs?: Json | null
          aphasia_type?: string | null
          avatar_url?: string | null
          birthdate?: string | null
          capability_profile_id?: string | null
          care_account_id?: string | null
          caregiver_mode_enabled?: boolean | null
          chronicity_tag?: string | null
          clinical_profile?: Json | null
          consent_version?: number | null
          created_at?: string | null
          daily_cap_minutes?: number | null
          daily_goal_minutes?: number | null
          display_name?: string | null
          enforce_dose_caps?: boolean | null
          field_confidence?: Json
          goals?: string[] | null
          hand_bias?: string | null
          id?: string
          is_active?: boolean | null
          laterality?: string | null
          onboarding_completed_at?: string | null
          primary_territory?: string | null
          profile_created_at?: string | null
          profile_kind?: string
          profile_name?: string
          profile_notes?: string | null
          profile_source?: string | null
          runtime_config?: Json | null
          session_cap_minutes?: number | null
          stroke_date?: string | null
          stroke_mechanism_tag?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_capability_profile_id_fkey"
            columns: ["capability_profile_id"]
            isOneToOne: false
            referencedRelation: "capability_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_care_account_id_fkey"
            columns: ["care_account_id"]
            isOneToOne: false
            referencedRelation: "care_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      progression_events: {
        Row: {
          created_at: string
          evidence_met: boolean | null
          exercise_slug: string
          id: string
          leveled_up: boolean
          mastery_verdict: string | null
          metadata: Json
          next_level: number | null
          next_progress_pct: number | null
          next_support_baseline: number | null
          prev_level: number | null
          prev_progress_pct: number | null
          prev_support_baseline: number | null
          profile_id: string
          progress_delta: number | null
          session_id: string | null
          source: string
          trial_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          evidence_met?: boolean | null
          exercise_slug: string
          id?: string
          leveled_up?: boolean
          mastery_verdict?: string | null
          metadata?: Json
          next_level?: number | null
          next_progress_pct?: number | null
          next_support_baseline?: number | null
          prev_level?: number | null
          prev_progress_pct?: number | null
          prev_support_baseline?: number | null
          profile_id: string
          progress_delta?: number | null
          session_id?: string | null
          source?: string
          trial_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          evidence_met?: boolean | null
          exercise_slug?: string
          id?: string
          leveled_up?: boolean
          mastery_verdict?: string | null
          metadata?: Json
          next_level?: number | null
          next_progress_pct?: number | null
          next_support_baseline?: number | null
          prev_level?: number | null
          prev_progress_pct?: number | null
          prev_support_baseline?: number | null
          profile_id?: string
          progress_delta?: number | null
          session_id?: string | null
          source?: string
          trial_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      qa_runs: {
        Row: {
          build_sha: string | null
          device_label: string | null
          id: string
          note: string | null
          recorded_at: string
          result: string
          role: string | null
          scenario_id: string
          step_id: string
          user_id: string
        }
        Insert: {
          build_sha?: string | null
          device_label?: string | null
          id?: string
          note?: string | null
          recorded_at?: string
          result: string
          role?: string | null
          scenario_id: string
          step_id: string
          user_id: string
        }
        Update: {
          build_sha?: string | null
          device_label?: string | null
          id?: string
          note?: string | null
          recorded_at?: string
          result?: string
          role?: string | null
          scenario_id?: string
          step_id?: string
          user_id?: string
        }
        Relationships: []
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
      recovery_trajectory: {
        Row: {
          breakthrough_domains: string[]
          computed_at: string
          domain_scores: Json
          id: string
          model_version: string
          overall_mastery: number | null
          plateau_domains: string[]
          profile_id: string
          user_id: string
          velocity_30d: number | null
        }
        Insert: {
          breakthrough_domains?: string[]
          computed_at?: string
          domain_scores?: Json
          id?: string
          model_version?: string
          overall_mastery?: number | null
          plateau_domains?: string[]
          profile_id: string
          user_id: string
          velocity_30d?: number | null
        }
        Update: {
          breakthrough_domains?: string[]
          computed_at?: string
          domain_scores?: Json
          id?: string
          model_version?: string
          overall_mastery?: number | null
          plateau_domains?: string[]
          profile_id?: string
          user_id?: string
          velocity_30d?: number | null
        }
        Relationships: []
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
      role_invitations: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          note?: string | null
          role: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      role_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          note: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          note?: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          note?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      skill_mastery_history: {
        Row: {
          confidence: string
          created_at: string
          cue_independence: number | null
          fatigue_adjusted_score: number | null
          id: string
          mastery_score: number
          model_version: string
          plateau_flag: boolean
          profile_id: string
          skill_slug: string
          trials_in_week: number
          user_id: string
          velocity_per_week: number | null
          week_start: string
        }
        Insert: {
          confidence: string
          created_at?: string
          cue_independence?: number | null
          fatigue_adjusted_score?: number | null
          id?: string
          mastery_score: number
          model_version?: string
          plateau_flag?: boolean
          profile_id: string
          skill_slug: string
          trials_in_week?: number
          user_id: string
          velocity_per_week?: number | null
          week_start: string
        }
        Update: {
          confidence?: string
          created_at?: string
          cue_independence?: number | null
          fatigue_adjusted_score?: number | null
          id?: string
          mastery_score?: number
          model_version?: string
          plateau_flag?: boolean
          profile_id?: string
          skill_slug?: string
          trials_in_week?: number
          user_id?: string
          velocity_per_week?: number | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_mastery_history_skill_slug_fkey"
            columns: ["skill_slug"]
            isOneToOne: false
            referencedRelation: "skill_nodes"
            referencedColumns: ["slug"]
          },
        ]
      }
      skill_nodes: {
        Row: {
          created_at: string
          description: string | null
          difficulty_band: number
          domain: string
          exercise_slugs: string[]
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          difficulty_band?: number
          domain: string
          exercise_slugs?: string[]
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          difficulty_band?: number
          domain?: string
          exercise_slugs?: string[]
          slug?: string
        }
        Relationships: []
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
      studies: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ended_at: string | null
          engine_version_pin: string | null
          exclusion_criteria: Json
          id: string
          inclusion_criteria: Json
          name: string
          pi_clinician_id: string | null
          scorer_version_pin: string | null
          started_at: string | null
          status: string
          target_enrollment: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ended_at?: string | null
          engine_version_pin?: string | null
          exclusion_criteria?: Json
          id?: string
          inclusion_criteria?: Json
          name: string
          pi_clinician_id?: string | null
          scorer_version_pin?: string | null
          started_at?: string | null
          status?: string
          target_enrollment?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ended_at?: string | null
          engine_version_pin?: string | null
          exclusion_criteria?: Json
          id?: string
          inclusion_criteria?: Json
          name?: string
          pi_clinician_id?: string | null
          scorer_version_pin?: string | null
          started_at?: string | null
          status?: string
          target_enrollment?: number | null
        }
        Relationships: []
      }
      study_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string
          enrolled_at: string | null
          enrolled_by: string | null
          id: string
          profile_id: string
          status: string
          study_id: string
          user_id: string
          withdrawal_reason: string | null
          withdrawn_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          enrolled_at?: string | null
          enrolled_by?: string | null
          id?: string
          profile_id: string
          status?: string
          study_id: string
          user_id: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          enrolled_at?: string | null
          enrolled_by?: string | null
          id?: string
          profile_id?: string
          status?: string
          study_id?: string
          user_id?: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_enrollments_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      survivor_self_start_events: {
        Row: {
          aphasia_type: string | null
          caregiver_present: boolean | null
          created_at: string
          day_index: number | null
          id: string
          profile_id: string | null
          severity: string | null
          started_at: string
          surface: string
          user_id: string
        }
        Insert: {
          aphasia_type?: string | null
          caregiver_present?: boolean | null
          created_at?: string
          day_index?: number | null
          id?: string
          profile_id?: string | null
          severity?: string | null
          started_at?: string
          surface?: string
          user_id: string
        }
        Update: {
          aphasia_type?: string | null
          caregiver_present?: boolean | null
          created_at?: string
          day_index?: number | null
          id?: string
          profile_id?: string | null
          severity?: string | null
          started_at?: string
          surface?: string
          user_id?: string
        }
        Relationships: []
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
      trial_runtime_config: {
        Row: {
          engine_version: string
          id: string
          notes: string | null
          pinned_at: string
          pinned_by: string | null
          runtime_config: Json
          scorer_version: string
          study_id: string
        }
        Insert: {
          engine_version: string
          id?: string
          notes?: string | null
          pinned_at?: string
          pinned_by?: string | null
          runtime_config?: Json
          scorer_version: string
          study_id: string
        }
        Update: {
          engine_version?: string
          id?: string
          notes?: string | null
          pinned_at?: string
          pinned_by?: string | null
          runtime_config?: Json
          scorer_version?: string
          study_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_runtime_config_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: true
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
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
      user_skill_mastery: {
        Row: {
          accuracy_recent: number | null
          confidence: string
          created_at: string
          cue_independence: number | null
          fatigue_adjusted_score: number | null
          id: string
          last_practiced_at: string | null
          mastery_score: number
          model_version: string
          plateau_flag: boolean
          profile_id: string
          skill_slug: string
          support_dependency_trend: string | null
          trials_recent: number
          trials_total: number
          updated_at: string
          user_id: string
          velocity_per_week: number | null
        }
        Insert: {
          accuracy_recent?: number | null
          confidence?: string
          created_at?: string
          cue_independence?: number | null
          fatigue_adjusted_score?: number | null
          id?: string
          last_practiced_at?: string | null
          mastery_score?: number
          model_version?: string
          plateau_flag?: boolean
          profile_id: string
          skill_slug: string
          support_dependency_trend?: string | null
          trials_recent?: number
          trials_total?: number
          updated_at?: string
          user_id: string
          velocity_per_week?: number | null
        }
        Update: {
          accuracy_recent?: number | null
          confidence?: string
          created_at?: string
          cue_independence?: number | null
          fatigue_adjusted_score?: number | null
          id?: string
          last_practiced_at?: string | null
          mastery_score?: number
          model_version?: string
          plateau_flag?: boolean
          profile_id?: string
          skill_slug?: string
          support_dependency_trend?: string | null
          trials_recent?: number
          trials_total?: number
          updated_at?: string
          user_id?: string
          velocity_per_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_skill_mastery_skill_slug_fkey"
            columns: ["skill_slug"]
            isOneToOne: false
            referencedRelation: "skill_nodes"
            referencedColumns: ["slug"]
          },
        ]
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
      user_ui_profile: {
        Row: {
          auto_selected: boolean
          created_at: string
          decision_cap: number
          density: string
          reading_load_cap: number
          source: string
          updated_at: string
          user_id: string
          variant: string
        }
        Insert: {
          auto_selected?: boolean
          created_at?: string
          decision_cap?: number
          density?: string
          reading_load_cap?: number
          source?: string
          updated_at?: string
          user_id: string
          variant?: string
        }
        Update: {
          auto_selected?: boolean
          created_at?: string
          decision_cap?: number
          density?: string
          reading_load_cap?: number
          source?: string
          updated_at?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
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
          profile_id: string | null
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
          profile_id?: string | null
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
          profile_id?: string | null
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
            foreignKeyName: "utterance_analyses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utterance_analyses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      validity_override_events: {
        Row: {
          attempt_id: string | null
          clinician_id: string
          created_at: string
          exercise_slug: string | null
          id: string
          new_override: string
          original_counts_toward_score: boolean | null
          original_validity_label: string | null
          patient_user_id: string | null
          profile_id: string | null
          session_id: string | null
          source_table: string
          validity_reason: string | null
        }
        Insert: {
          attempt_id?: string | null
          clinician_id: string
          created_at?: string
          exercise_slug?: string | null
          id?: string
          new_override: string
          original_counts_toward_score?: boolean | null
          original_validity_label?: string | null
          patient_user_id?: string | null
          profile_id?: string | null
          session_id?: string | null
          source_table: string
          validity_reason?: string | null
        }
        Update: {
          attempt_id?: string | null
          clinician_id?: string
          created_at?: string
          exercise_slug?: string | null
          id?: string
          new_override?: string
          original_counts_toward_score?: boolean | null
          original_validity_label?: string | null
          patient_user_id?: string | null
          profile_id?: string | null
          session_id?: string | null
          source_table?: string
          validity_reason?: string | null
        }
        Relationships: []
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
      probe_analytics: {
        Row: {
          accuracy_pct: number | null
          assessment_date: string | null
          avg_cues_needed: number | null
          avg_difficulty: number | null
          avg_reaction_time_ms: number | null
          correct_count: number | null
          neologism_errors: number | null
          no_response_count: number | null
          phonemic_errors: number | null
          profile_id: string | null
          semantic_errors: number | null
          total_probes: number | null
          unrelated_errors: number | null
          user_id: string | null
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
      v_mastery_health_24h: {
        Row: {
          metadata: Json | null
          metric_key: string | null
          metric_value: number | null
        }
        Relationships: []
      }
      v_sessions_logs_vs_mastery_24h: {
        Row: {
          metadata: Json | null
          metric_key: string | null
          metric_value: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      advance_enrollment_after_consent: {
        Args: { _enrollment_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          enrolled_at: string | null
          enrolled_by: string | null
          id: string
          profile_id: string
          status: string
          study_id: string
          user_id: string
          withdrawal_reason: string | null
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "study_enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
          care_account_id: string | null
          caregiver_mode_enabled: boolean | null
          chronicity_tag: string | null
          clinical_profile: Json | null
          consent_version: number | null
          created_at: string | null
          daily_cap_minutes: number | null
          daily_goal_minutes: number | null
          display_name: string | null
          enforce_dose_caps: boolean | null
          field_confidence: Json
          goals: string[] | null
          hand_bias: string | null
          id: string
          is_active: boolean | null
          laterality: string | null
          onboarding_completed_at: string | null
          primary_territory: string | null
          profile_created_at: string | null
          profile_kind: string
          profile_name: string
          profile_notes: string | null
          profile_source: string | null
          runtime_config: Json | null
          session_cap_minutes: number | null
          stroke_date: string | null
          stroke_mechanism_tag: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_active_study_enrollment: {
        Args: { _user_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          enrolled_at: string | null
          enrolled_by: string | null
          id: string
          profile_id: string
          status: string
          study_id: string
          user_id: string
          withdrawal_reason: string | null
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "study_enrollments"
          isOneToOne: true
          isSetofReturn: false
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
      get_exercise_stats_last7d:
        | {
            Args: { slug: string; uid: string }
            Returns: {
              avg_accuracy: number
              median_rt: number
              trial_count: number
            }[]
          }
        | {
            Args: { pid?: string; slug: string; uid: string }
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
      has_care_account_role: {
        Args: {
          _account_id: string
          _role: Database["public"]["Enums"]["care_account_member_role"]
          _user_id: string
        }
        Returns: boolean
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
      is_care_account_member: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
      is_caregiver_for: {
        Args: { _caregiver_id: string; _profile_id: string }
        Returns: boolean
      }
      is_clinician_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_study_clinician: {
        Args: { _clinician_id: string; _study_id: string }
        Returns: boolean
      }
      merge_profile_pref: {
        Args: { p_key: string; p_subkey: string; p_value: Json }
        Returns: undefined
      }
      refresh_cluster_assignments: { Args: never; Returns: undefined }
      release_stale_speech_locks: { Args: never; Returns: number }
      review_role_request: {
        Args: { p_decision: string; p_request_id: string }
        Returns: Json
      }
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
      withdraw_enrollment: {
        Args: { _enrollment_id: string; _reason: string }
        Returns: {
          completed_at: string | null
          created_at: string
          enrolled_at: string | null
          enrolled_by: string | null
          id: string
          profile_id: string
          status: string
          study_id: string
          user_id: string
          withdrawal_reason: string | null
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "study_enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "caregiver" | "clinician"
      care_account_member_role: "owner" | "caregiver" | "patient" | "clinician"
      care_account_type: "family" | "self" | "clinic"
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
      app_role: ["admin", "moderator", "user", "caregiver", "clinician"],
      care_account_member_role: ["owner", "caregiver", "patient", "clinician"],
      care_account_type: ["family", "self", "clinic"],
    },
  },
} as const
