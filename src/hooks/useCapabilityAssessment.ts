import { useAssessmentContext } from '@/contexts/AssessmentContext';

/**
 * Thin wrapper around AssessmentContext for backward compatibility.
 * All state is now managed centrally in AssessmentContext.
 */
export const useCapabilityAssessment = (_userId?: string, _profileId?: string) => {
  return useAssessmentContext();
};
