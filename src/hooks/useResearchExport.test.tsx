import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), toast: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

import { useResearchExport } from './useResearchExport';
import { canExportResearchData } from '@/lib/researchExportPrivacyGate';

beforeEach(() => { mocks.from.mockReset(); mocks.toast.mockReset(); });
afterEach(cleanup);

describe('Hospital research export fail-closed protection', () => {
  it('does not advertise the existing research serializers as privacy-approved', () => {
    expect(canExportResearchData()).toBe(false);
  });

  it.each([
    'exportDemographics', 'exportSessions', 'exportTrials',
    'exportLearningRates', 'exportGoals', 'exportGoalRatings',
    'exportAssessments',
  ] as const)('%s cannot read patient rows or create a CSV before privacy approval', async action => {
    const subject = renderHook(() => useResearchExport());
    await act(async () => { await subject.result.current[action](); });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Research export unavailable',
      variant: 'destructive',
    }));
  });
});
