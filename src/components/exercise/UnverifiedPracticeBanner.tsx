import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/** Shared large-print failure state for patients who cannot troubleshoot. */
export function UnverifiedPracticeBanner() {
  const navigate = useNavigate();
  // Cover old game controls while saving has failed. Patients must not see
  // conflicting "complete" messages or accidentally continue a lesson.
  return (
    <div role="alert" aria-live="assertive" className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border-2 border-destructive p-6 space-y-5 text-center">
        <h2 className="text-2xl font-bold">Results not saved</h2>
        <p className="text-lg">Some results could not be saved. Please ask a care partner for help.</p>
        <Button size="lg" className="min-h-14 min-w-48" onClick={() => navigate('/today')}>Return to Today</Button>
      </div>
    </div>
  );
}
