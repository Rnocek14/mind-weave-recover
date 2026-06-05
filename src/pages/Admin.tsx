import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Image as ImageIcon, Loader2, Brain, ClipboardCheck, LayoutDashboard, Users } from "lucide-react";
import ClinicalReviewDashboard from "@/components/ClinicalReviewDashboard";
import PhotoLibraryAdmin from "@/components/admin/PhotoLibraryAdmin";
import AdminTools from "@/components/admin/AdminTools";
import { AdminNavHub } from "@/components/admin/AdminNavHub";
import UserRoleManager from "@/components/admin/UserRoleManager";

const Admin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const initialTab = searchParams.get("tab") || "hub";

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) { navigate("/auth"); return; }
      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const hasAdminRole = roles?.some(r => r.role === "admin");
        if (!hasAdminRole) {
          toast({ title: "Access Denied", description: "You don't have permission to access the admin panel.", variant: "destructive" });
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
    if (!authLoading) checkAdminStatus();
  }, [user, authLoading, navigate, toast]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <RoleHelpButton role="admin" withLabel />
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">
            System oversight, analytics, content management
          </p>
        </div>

        <Tabs defaultValue={initialTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="hub" className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="review" className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Clinical Review
            </TabsTrigger>
            <TabsTrigger value="photos" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Photo Library
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Tools
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hub">
            <AdminNavHub />
          </TabsContent>

          <TabsContent value="users">
            <UserRoleManager />
          </TabsContent>


          <TabsContent value="review">
            <ClinicalReviewDashboard />
          </TabsContent>

          <TabsContent value="photos">
            <PhotoLibraryAdmin />
          </TabsContent>

          <TabsContent value="tools">
            <AdminTools />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
