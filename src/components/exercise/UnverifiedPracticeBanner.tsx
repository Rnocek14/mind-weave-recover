import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/** Shared large-print failure state for patients who cannot troubleshoot. */
export function UnverifiedPracticeBanner() {
  const navigate = useNavigate();
  return (
    <div role="alert" aria-live="assertive" className="mx-auto my-4 w-full max-w-2xl rounded-xl border-2 border-destructive bg-background p-6 space-y-4 text-center">
      <h2 className="text-xl font-bold">Results not saved</h2>
      <p className="text-base">We couldn't save every answer. Please ask a care partner for help.</p>
      <Button size="lg" onClick={() => navigate('/today')}>Return to Today</Button>
    </div>
  );
}
