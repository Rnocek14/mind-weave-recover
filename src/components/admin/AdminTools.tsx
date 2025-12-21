import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Brain, Loader2 } from "lucide-react";

const AdminTools = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const queryClient = useQueryClient();
  const [computingProfile, setComputingProfile] = useState(false);

  const handleComputeProfile = async () => {
    if (!user || !activeProfile) return;
    
    setComputingProfile(true);
    try {
      const { data, error } = await supabase.functions.invoke('compute-speech-profile', {
        body: { user_id: user.id, profile_id: activeProfile.id, force: true }
      });

      if (error) throw error;

      console.log('Speech profile computed:', data);
      
      // Invalidate cached profile and history data so UI refreshes
      queryClient.invalidateQueries({ queryKey: ['user-speech-profile', user.id, activeProfile.id] });
      queryClient.invalidateQueries({ queryKey: ['phoneme-history', user.id, activeProfile.id] });
      
      const processed = data.analysesProcessed ?? data.eventsProcessed ?? data.processed ?? null;
      const label = data.analysesProcessed != null ? 'analyses' : data.eventsProcessed != null ? 'events' : 'items';
      
      toast({
        title: "Profile Computed",
        description: data.skipped 
          ? `Skipped: ${data.reason}` 
          : processed != null
            ? `Processed ${processed} ${label} successfully.`
            : 'Profile recomputed successfully.',
      });
    } catch (error) {
      console.error('Error computing profile:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to compute speech profile",
        variant: "destructive",
      });
    } finally {
      setComputingProfile(false);
    }
  };

  return (
    <Card className="p-6 shadow-card">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Brain className="w-5 h-5" />
        User Speech Profile
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Compute personalized cue efficacy profile from exercise trial data. 
        This analyzes which cue types work best for the current user.
      </p>
      <Button
        onClick={handleComputeProfile}
        disabled={computingProfile || !user}
        className="bg-gradient-healing"
      >
        {computingProfile ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Computing...
          </>
        ) : (
          <>
            <Brain className="w-4 h-4 mr-2" />
            Recompute Speech Profile
          </>
        )}
      </Button>
    </Card>
  );
};

export default AdminTools;
