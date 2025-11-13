import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CorrectionData {
  field_name: string;
  original_value: any;
  corrected_value: any;
  correction_reason?: string;
  clinical_note_excerpt?: string;
  confidence_before?: string;
  corrector_role?: string;
}

export const useClinicalCorrections = () => {
  const [isLogging, setIsLogging] = useState(false);
  const { toast } = useToast();

  const logCorrection = async (correction: CorrectionData) => {
    setIsLogging(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('clinical_profile_corrections')
        .insert({
          user_id: user.id,
          field_name: correction.field_name,
          original_value: correction.original_value,
          corrected_value: correction.corrected_value,
          correction_reason: correction.correction_reason,
          clinical_note_excerpt: correction.clinical_note_excerpt,
          confidence_before: correction.confidence_before,
          corrector_role: correction.corrector_role || 'patient',
        });

      if (error) throw error;

      console.log('Correction logged:', correction.field_name);
    } catch (error: any) {
      console.error('Error logging correction:', error);
      toast({
        title: 'Failed to log correction',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLogging(false);
    }
  };

  const logBatchCorrections = async (corrections: CorrectionData[]) => {
    setIsLogging(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const records = corrections.map(correction => ({
        user_id: user.id,
        field_name: correction.field_name,
        original_value: correction.original_value,
        corrected_value: correction.corrected_value,
        correction_reason: correction.correction_reason,
        clinical_note_excerpt: correction.clinical_note_excerpt,
        confidence_before: correction.confidence_before,
        corrector_role: correction.corrector_role || 'patient',
      }));

      const { error } = await supabase
        .from('clinical_profile_corrections')
        .insert(records);

      if (error) throw error;

      console.log(`Logged ${corrections.length} corrections`);
    } catch (error: any) {
      console.error('Error logging batch corrections:', error);
      toast({
        title: 'Failed to log corrections',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLogging(false);
    }
  };

  return {
    logCorrection,
    logBatchCorrections,
    isLogging,
  };
};
