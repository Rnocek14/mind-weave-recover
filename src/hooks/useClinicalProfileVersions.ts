import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export interface ClinicalProfileVersion {
  id: string;
  user_id: string;
  version_number: number;
  is_active: boolean;
  profile_data: any;
  source_type: 'initial_onboarding' | 'note_parsing' | 'manual_edit' | 'merge' | 'clinician_override';
  source_note_id?: string;
  created_by?: string;
  created_at: string;
  changes_from_previous?: any;
  change_reason?: string;
  overall_confidence?: 'high' | 'medium' | 'low';
  validation_status: 'pending' | 'validated' | 'needs_correction';
  validated_by?: string;
  validated_at?: string;
}

export function useClinicalProfileVersions(userId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const activeProfileId = useActiveProfileId();

  const getActiveProfile = async () => {
    if (!userId) return null;

    try {
      let q = supabase
        .from('clinical_profile_versions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      if (activeProfileId) q = q.eq('profile_id', activeProfileId);
      const { data, error } = await q.single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No active profile found
          return null;
        }
        throw error;
      }

      return data as ClinicalProfileVersion;
    } catch (error: any) {
      console.error('Error fetching active profile:', error);
      return null;
    }
  };

  const createVersion = async (
    profileData: any,
    sourceType: ClinicalProfileVersion['source_type'],
    options?: {
      sourceNoteId?: string;
      changeReason?: string;
      confidence?: 'high' | 'medium' | 'low';
    }
  ) => {
    if (!userId) throw new Error('User ID required');

    setIsLoading(true);
    try {
      // Call the database function to create a new version
      const { data, error } = await supabase.rpc('create_profile_version', {
        p_user_id: userId,
        p_profile_data: profileData,
        p_source_type: sourceType,
        p_source_note_id: options?.sourceNoteId || null,
        p_change_reason: options?.changeReason || null,
        p_created_by: userId,
      });

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Clinical profile has been updated successfully.',
      });

      return data;
    } catch (error: any) {
      console.error('Error creating profile version:', error);
      toast({
        title: 'Error updating profile',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVersionHistory = async () => {
    if (!userId) return [];

    setIsLoading(true);
    try {
      let q = supabase
        .from('clinical_profile_versions')
        .select('*')
        .eq('user_id', userId)
        .order('version_number', { ascending: false });
      if (activeProfileId) q = q.eq('profile_id', activeProfileId);
      const { data, error } = await q;

      if (error) throw error;
      return data as ClinicalProfileVersion[];
    } catch (error: any) {
      console.error('Error fetching version history:', error);
      toast({
        title: 'Error loading history',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    getActiveProfile,
    createVersion,
    fetchVersionHistory,
  };
}
