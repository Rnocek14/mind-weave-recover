import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export type AssessmentType = 'WAB-R' | 'BNT' | 'NIHSS' | 'ASHA-NOMS';

export interface StandardizedAssessment {
  id: string;
  userId: string;
  assessmentType: AssessmentType;
  assessmentDate: string;
  scores: Record<string, any>;
  notes?: string;
  assessedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const useStandardizedAssessments = (userId: string | undefined) => {
  const [assessments, setAssessments] = useState<StandardizedAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const activeProfileId = useActiveProfileId();

  const fetchAssessments = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('standardized_assessments')
        .select('*')
        .eq('user_id', userId)
        .order('assessment_date', { ascending: false });
      if (activeProfileId) query = query.eq('profile_id', activeProfileId);
      const { data, error } = await query;

      if (error) throw error;

      const mapped = (data || []).map((a: any) => ({
        id: a.id,
        userId: a.user_id,
        assessmentType: a.assessment_type,
        assessmentDate: a.assessment_date,
        scores: a.scores,
        notes: a.notes,
        assessedBy: a.assessed_by,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));

      setAssessments(mapped);
    } catch (error) {
      console.error('Error fetching assessments:', error);
      toast({
        title: 'Error loading assessments',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAssessments();
  }, [userId]);

  const addAssessment = async (
    assessmentType: AssessmentType,
    assessmentDate: string,
    scores: Record<string, any>,
    notes?: string
  ) => {
    if (!userId) return;

    try {
      const { error } = await supabase.from('standardized_assessments').insert({
        user_id: userId,
        assessment_type: assessmentType,
        assessment_date: assessmentDate,
        scores,
        notes,
        assessed_by: userId,
      });

      if (error) throw error;

      toast({
        title: 'Assessment added',
        description: `${assessmentType} scores recorded successfully`,
      });

      await fetchAssessments();
    } catch (error) {
      console.error('Error adding assessment:', error);
      toast({
        title: 'Error adding assessment',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const updateAssessment = async (
    id: string,
    assessmentDate: string,
    scores: Record<string, any>,
    notes?: string
  ) => {
    try {
      const { error } = await supabase
        .from('standardized_assessments')
        .update({
          assessment_date: assessmentDate,
          scores,
          notes,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Assessment updated',
        description: 'Scores updated successfully',
      });

      await fetchAssessments();
    } catch (error) {
      console.error('Error updating assessment:', error);
      toast({
        title: 'Error updating assessment',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const deleteAssessment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('standardized_assessments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Assessment deleted',
        description: 'Assessment removed successfully',
      });

      await fetchAssessments();
    } catch (error) {
      console.error('Error deleting assessment:', error);
      toast({
        title: 'Error deleting assessment',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return {
    assessments,
    loading,
    addAssessment,
    updateAssessment,
    deleteAssessment,
    refresh: fetchAssessments,
  };
};
