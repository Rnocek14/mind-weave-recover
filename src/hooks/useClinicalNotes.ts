import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export interface ClinicalNote {
  id: string;
  user_id: string;
  note_type: 'mri_report' | 'ct_scan' | 'discharge_summary' | 'progress_note' | 'neuropsych_eval' | 'initial_assessment' | 'other';
  document_date: string;
  uploaded_at: string;
  uploaded_by?: string;
  raw_text: string;
  document_title?: string;
  source_system?: string;
  scan_details?: any;
  parsed_at?: string;
  parser_version?: string;
  parsing_confidence?: 'high' | 'medium' | 'low';
  extracted_profile?: any;
  notes?: string;
  requires_review: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface CreateNoteParams {
  note_type: ClinicalNote['note_type'];
  document_date: string;
  raw_text: string;
  document_title?: string;
  source_system?: string;
}

export function useClinicalNotes(userId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const activeProfileId = useActiveProfileId();

  const fetchNotes = async () => {
    if (!userId) return [];
    
    setIsLoading(true);
    try {
      let q = supabase
        .from('clinical_notes')
        .select('*')
        .eq('user_id', userId)
        .order('document_date', { ascending: false });
      if (activeProfileId) q = q.eq('profile_id', activeProfileId);
      const { data, error } = await q;

      if (error) throw error;
      return data as ClinicalNote[];
    } catch (error: any) {
      console.error('Error fetching clinical notes:', error);
      toast({
        title: 'Error loading documents',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const createNote = async (params: CreateNoteParams) => {
    if (!userId) throw new Error('User ID required');

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clinical_notes')
        .insert({
          user_id: userId,
          profile_id: activeProfileId ?? null,
          ...params,
          uploaded_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      
      
      toast({
        title: 'Document saved',
        description: 'Clinical document has been stored successfully.',
      });

      return data as ClinicalNote;
    } catch (error: any) {
      console.error('Error creating clinical note:', error);
      toast({
        title: 'Error saving document',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateNoteWithParseResults = async (
    noteId: string,
    extractedProfile: any,
    parserVersion: string,
    confidence: 'high' | 'medium' | 'low'
  ) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('clinical_notes')
        .update({
          extracted_profile: extractedProfile,
          parser_version: parserVersion,
          parsing_confidence: confidence,
          parsed_at: new Date().toISOString(),
        })
        .eq('id', noteId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating note with parse results:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('clinical_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast({
        title: 'Document deleted',
        description: 'Clinical document has been removed.',
      });
    } catch (error: any) {
      console.error('Error deleting clinical note:', error);
      toast({
        title: 'Error deleting document',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    fetchNotes,
    createNote,
    updateNoteWithParseResults,
    deleteNote,
  };
}
