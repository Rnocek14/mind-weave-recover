import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClusterComparisonDashboard } from '@/components/ClusterComparisonDashboard';
import { OutcomePredictionCard } from '@/components/OutcomePredictionCard';
import { useFunctionalGoals } from '@/hooks/useFunctionalGoals';
import { ChevronLeft, BarChart3 } from 'lucide-react';

const ClusterAnalytics = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [clinicalProfile, setClinicalProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { goals } = useFunctionalGoals(user?.id);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        if (!authLoading) navigate('/auth');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('clinical_profile')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setClinicalProfile(data?.clinical_profile);
      } catch (error) {
        console.error('Error loading clinical profile:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-dvh bg-gradient-calm p-6">
        <div className="container mx-auto max-w-6xl">
          <Skeleton className="h-12 w-64 mb-6" />
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <div className="grid md:grid-cols-2 gap-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate('/dashboard')}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="w-8 h-8" />
            Cluster Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            See how your recovery compares to patients with similar stroke profiles
          </p>
        </div>

        {user && clinicalProfile && (
          <div className="space-y-6">
            <OutcomePredictionCard 
              userId={user.id}
              clinicalProfile={clinicalProfile}
              currentGoals={goals}
            />
            
            <ClusterComparisonDashboard 
              userId={user.id} 
              clinicalProfile={clinicalProfile} 
            />
          </div>
        )}

        {!clinicalProfile && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              Complete your clinical profile to see cluster comparisons
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClusterAnalytics;
