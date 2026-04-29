/**
 * useValidationTrialCount
 *
 * Validation-only trialCount override: when the URL contains `?validation=1`
 * (or `&validation=1`), bumps the per-exercise trialCount from its production
 * default to a longer count so adaptation can show both UP and DOWN moves
 * within a single manual session. Production users are unaffected.
 *
 * Usage:
 *   const trialCount = useValidationTrialCount(5, 10);
 *   <SomeGame trialCount={trialCount} />
 */
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export function useValidationTrialCount(productionDefault: number, validationCount = 10): number {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const v = params.get('validation');
    if (v === '1' || v === 'true') return validationCount;
    return productionDefault;
  }, [location.search, productionDefault, validationCount]);
}
