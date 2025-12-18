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
          avatar_url: string | null
          birthdate: string | null
          capability_profile_id: string | null
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
          id: string
          is_active: boolean | null
          profile_created_at: string | null
          profile_name: string
          profile_notes: string | null
          session_cap_minutes: number | null
          stroke_date: string | null
          user_id: string
        }
        Insert: {
          accessibility_prefs?: Json | null
          avatar_url?: string | null
          birthdate?: string | null
          capability_profile_id?: string | null
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
          id?: string
          is_active?: boolean | null
          profile_created_at?: string | null
          profile_name: string
          profile_notes?: string | null
          session_cap_minutes?: number | null
          stroke_date?: string | null
          user_id: string
        }
        Update: {
          accessibility_prefs?: Json | null
          avatar_url?: string | null
          birthdate?: string | null
          capability_profile_id?: string | null
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
          id?: string
          is_active?: boolean | null
          profile_created_at?: string | null
          profile_name?: string
          profile_notes?: string | null
          session_cap_minutes?: number | null
          stroke_date?: string | null
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
      sessions: {
        Row: {
          caregiver_notes: string | null
          duration_sec: number | null
          ended_at: string | null
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
      speech_profile_snapshots: {
        Row: {
          computed_at: string
          created_at: string
          cue_efficacy_by_type: Json | null
          error_type_distribution: Json | null
          id: string
          phoneme_difficulty_map: Json | null
          phoneme_token_count: number | null
          profile_id: string | null
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
          profile_id?: string | null
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
          profile_id?: string | null
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
          profile_id: string | null
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
          profile_id?: string | null
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
          profile_id?: string | null
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
          audio_storage_path: string | null
          avg_pause_duration_ms: number | null
          category: string | null
          classification_confidence: number | null
          created_at: string | null
          cue_trigger: string | null
          cue_type_given: string | null
          cue_was_effective: boolean | null
          effortful_speech: boolean | null
          error_message: string | null
          error_type: string | null
          exercise_slug: string | null
          fluency_available: boolean | null
          fluency_unavailable_reason: string | null
          gop_data: Json | null
          human_labels: Json | null
          id: string
          is_correct: boolean | null
          latency_ms: number | null
          locked_at: string | null
          locked_by: string | null
          next_retry_at: string | null
          pause_count: number | null
          phonological_similarity: number | null
          reasoning: string | null
          recording_duration_ms: number | null
          retry_count: number | null
          review_status: string | null
          semantic_similarity: number | null
          session_id: string | null
          speech_rate_wpm: number | null
          speech_ratio: number | null
          target_word: string
          time_to_success_after_cue_ms: number | null
          total_pause_ms: number | null
          transcript: string | null
          transcript_source: string | null
          trial_index: number | null
          updated_at: string | null
          user_id: string
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
          audio_storage_path?: string | null
          avg_pause_duration_ms?: number | null
          category?: string | null
          classification_confidence?: number | null
          created_at?: string | null
          cue_trigger?: string | null
          cue_type_given?: string | null
          cue_was_effective?: boolean | null
          effortful_speech?: boolean | null
          error_message?: string | null
          error_type?: string | null
          exercise_slug?: string | null
          fluency_available?: boolean | null
          fluency_unavailable_reason?: string | null
          gop_data?: Json | null
          human_labels?: Json | null
          id?: string
          is_correct?: boolean | null
          latency_ms?: number | null
          locked_at?: string | null
          locked_by?: string | null
          next_retry_at?: string | null
          pause_count?: number | null
          phonological_similarity?: number | null
          reasoning?: string | null
          recording_duration_ms?: number | null
          retry_count?: number | null
          review_status?: string | null
          semantic_similarity?: number | null
          session_id?: string | null
          speech_rate_wpm?: number | null
          speech_ratio?: number | null
          target_word: string
          time_to_success_after_cue_ms?: number | null
          total_pause_ms?: number | null
          transcript?: string | null
          transcript_source?: string | null
          trial_index?: number | null
          updated_at?: string | null
          user_id: string
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
          audio_storage_path?: string | null
          avg_pause_duration_ms?: number | null
          category?: string | null
          classification_confidence?: number | null
          created_at?: string | null
          cue_trigger?: string | null
          cue_type_given?: string | null
          cue_was_effective?: boolean | null
          effortful_speech?: boolean | null
          error_message?: string | null
          error_type?: string | null
          exercise_slug?: string | null
          fluency_available?: boolean | null
          fluency_unavailable_reason?: string | null
          gop_data?: Json | null
          human_labels?: Json | null
          id?: string
          is_correct?: boolean | null
          latency_ms?: number | null
          locked_at?: string | null
          locked_by?: string | null
          next_retry_at?: string | null
          pause_count?: number | null
          phonological_similarity?: number | null
          reasoning?: string | null
          recording_duration_ms?: number | null
          retry_count?: number | null
          review_status?: string | null
          semantic_similarity?: number | null
          session_id?: string | null
          speech_rate_wpm?: number | null
          speech_ratio?: number | null
          target_word?: string
          time_to_success_after_cue_ms?: number | null
          total_pause_ms?: number | null
          transcript?: string | null
          transcript_source?: string | null
          trial_index?: number | null
          updated_at?: string | null
          user_id?: string
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
          avatar_url: string | null
          birthdate: string | null
          capability_profile_id: string | null
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
          id: string
          is_active: boolean | null
          profile_created_at: string | null
          profile_name: string
          profile_notes: string | null
          session_cap_minutes: number | null
          stroke_date: string | null
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
      upsert_worker_heartbeat: {
        Args: { p_meta?: Json; p_status?: string; p_worker_id: string }
        Returns: undefined
      }
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
