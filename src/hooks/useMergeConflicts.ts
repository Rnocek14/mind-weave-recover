import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ConflictDetectionResult } from '@/lib/profileConflictDetector';

export interface MergeConflict {
  id: string;
  user_id: string;
  existing_profile_version_id: string;
  new_note_id: string;
  new_parsed_profile: any;
  conflicts: any;
  resolution_status: 'pending' | 'auto_merged' | 'manually_resolved' | 'rejected';
  resolved_by?: string;
  resolved_at?: string;
  resolution_choice?: any;
  created_at: string;
}

export function useMergeConflicts(userId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const createConflictRecord = async (
    existingVersionId: string,
    newNoteId: string,
    newParsedProfile: any,
    detectionResult: ConflictDetectionResult
  ) => {
    if (!userId) throw new Error('User ID required');

    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('profile_merge_conflicts')
        .insert({
          user_id: userId,
          existing_profile_version_id: existingVersionId,
          new_note_id: newNoteId,
          new_parsed_profile: newParsedProfile,
          conflicts: {
            items: detectionResult.conflicts,
            summary: detectionResult.conflictSummary,
            recommendation: detectionResult.recommendation,
            safeToAutoMerge: detectionResult.safeToAutoMerge,
          },
          resolution_status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data as MergeConflict;
    } catch (error: any) {
      console.error('Error creating conflict record:', error);
      toast({
        title: 'Error logging conflict',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingConflicts = async () => {
    if (!userId) return [];

    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('profile_merge_conflicts')
        .select('*')
        .eq('user_id', userId)
        .eq('resolution_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MergeConflict[];
    } catch (error: any) {
      console.error('Error fetching conflicts:', error);
      toast({
        title: 'Error loading conflicts',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const resolveConflict = async (
    conflictId: string,
    resolutionStatus: 'auto_merged' | 'manually_resolved' | 'rejected',
    resolutionChoice?: any
  ) => {
    if (!userId) throw new Error('User ID required');

    setIsLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('profile_merge_conflicts')
        .update({
          resolution_status: resolutionStatus,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
          resolution_choice: resolutionChoice || {},
        })
        .eq('id', conflictId);

      if (error) throw error;

      toast({
        title: 'Conflict resolved',
        description: 'Profile merge conflict has been resolved',
      });
    } catch (error: any) {
      console.error('Error resolving conflict:', error);
      toast({
        title: 'Error resolving conflict',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllConflicts = async () => {
    if (!userId) return [];

    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('profile_merge_conflicts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MergeConflict[];
    } catch (error: any) {
      console.error('Error fetching all conflicts:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    createConflictRecord,
    fetchPendingConflicts,
    resolveConflict,
    fetchAllConflicts,
  };
}
