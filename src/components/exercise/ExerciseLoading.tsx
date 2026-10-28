/**
 * Shared loading state for patient exercises.
 *
 * A session can legitimately need more than five seconds to initialize on
 * mobile networks or while patient-specific adaptation data loads. Never
 * automatically abandon the exercise because a timer expired. Give the
 * patient one clear, large escape action if initialization is slow.
 *
 * A failed session still needs its own explicit error reporting upstream;
 * this component must not turn an unknown loading state into a fake success.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SLOW_LOAD_NOTICE_MS = 5_000;

export function ExerciseLoading() {
  const navigate = useNavigate();
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_LOAD_NOTICE_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <p role="status" aria-live="polite" className="text-lg text-foreground">
        {isSlow ? 'Still loading exercise...' : 'Loading exercise...'}
      </p>
      {isSlow && (
        <div className="flex flex-col items-center gap-4">
          <p className="max-w-sm text-base text-muted-foreground">
            This is taking longer than usual.
          </p>
          <button
            type="button"
            onClick={() => navigate('/today', { replace: true })}
            className="min-h-14 min-w-52 rounded-xl bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4"
          >
            Go to Today
          </button>
        </div>
      )}
    </main>
  );
}
