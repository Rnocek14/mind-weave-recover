import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Shield, ChevronLeft, Loader2, Brain, TrendingUp, Target, Users, UserCheck, AlertCircle } from "lucide-react";
import { ParserAnalyticsDashboard } from "@/components/ParserAnalyticsDashboard";
import { PatientProgressDashboard } from "@/components/PatientProgressDashboard";
import { ErrorPatternDashboard } from "@/components/ErrorPatternDashboard";
import { ClusterAnalyticsDashboard } from "@/components/ClusterAnalyticsDashboard";
import { ProfileCompletionDashboard } from "@/components/ProfileCompletionDashboard";
import { RiskScoringDashboard } from "@/components/RiskScoringDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ParserAnalytics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }

      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const hasAdminRole = roles?.some(r => r.role === "admin");
        
        if (!hasAdminRole) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to access parser analytics.",
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error("Error checking admin status:", error);
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkAdminStatus();
    }
  }, [user, authLoading, navigate, toast]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/dashboard")}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          </div>
          <p className="text-muted-foreground">
            Monitor AI parser performance and patient progress trends
          </p>
        </div>

        <Tabs defaultValue="parser" className="space-y-6">
          <TabsList className="grid w-full max-w-5xl grid-cols-6">
            <TabsTrigger value="parser" className="gap-2">
              <Brain className="w-4 h-4" />
              Parser
            </TabsTrigger>
            <TabsTrigger value="progress" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="errors" className="gap-2">
              <Target className="w-4 h-4" />
              Errors
            </TabsTrigger>
            <TabsTrigger value="clusters" className="gap-2">
              <Users className="w-4 h-4" />
              Clusters
            </TabsTrigger>
            <TabsTrigger value="profiles" className="gap-2">
              <UserCheck className="w-4 h-4" />
              Profiles
            </TabsTrigger>
            <TabsTrigger value="risk" className="gap-2">
              <AlertCircle className="w-4 h-4" />
              Risk Scoring
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parser">
            <ParserAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="progress">
            <PatientProgressDashboard userId={user?.id} />
          </TabsContent>

          <TabsContent value="errors">
            {user?.id && <ErrorPatternDashboard userId={user.id} weeksBack={12} />}
          </TabsContent>

          <TabsContent value="clusters">
            <ClusterAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="profiles">
            <ProfileCompletionDashboard />
          </TabsContent>

          <TabsContent value="risk">
            <RiskScoringDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ParserAnalytics;
