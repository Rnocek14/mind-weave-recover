/**
 * ExerciseLoading — shared loading state for /exercise/* routes.
 *
 * Pass B finding (CLEAN-2): direct deep-links to /exercise/* with no hydrated
 * lesson context get stuck on "Loading exercise...". After ~5s with no session
 * we treat it as a dead-link and bounce to /today with a toast.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const DEAD_LINK_TIMEOUT_MS = 5000;

export function ExerciseLoading() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => {
      toast.message('Open a session from Today to start an exercise.');
      navigate('/today', { replace: true });
    }, DEAD_LINK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading exercise...</div>
    </div>
  );
}
