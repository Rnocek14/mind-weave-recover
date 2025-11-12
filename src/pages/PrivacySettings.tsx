import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Shield, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function PrivacySettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [consentVersion, setConsentVersion] = useState<number>(1);
  const [allowAnalytics, setAllowAnalytics] = useState<boolean>(true);
  const [allowASR, setAllowASR] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadSettings();
  }, [user, navigate]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("profiles")
        .select("consent_version, accessibility_prefs")
        .eq("user_id", user.id)
        .single();
      
      setConsentVersion(data?.consent_version ?? 1);
      const prefs = data?.accessibility_prefs as any;
      setAllowAnalytics(Boolean(prefs?.allowAnalytics ?? true));
      setAllowASR(Boolean(prefs?.allowASR ?? false));
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          consent_version: consentVersion,
          accessibility_prefs: {
            allowAnalytics,
            allowASR
          }
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your privacy preferences have been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteAllData = async () => {
    if (!user) return;
    
    const confirmed = window.confirm(
      "Are you sure you want to delete all your data? This cannot be undone."
    );
    
    if (!confirmed) return;

    try {
      // Delete photos from storage and database
      const { data: photos } = await supabase
        .from("photos")
        .select("storage_path")
        .eq("user_id", user.id);

      if (photos) {
        for (const photo of photos) {
          await supabase.storage.from("photos").remove([photo.storage_path]);
        }
      }

      // Delete all user data (cascade will handle related records)
      await supabase.from("profiles").delete().eq("user_id", user.id);

      toast({
        title: "Data deleted",
        description: "All your data has been removed.",
      });

      navigate("/auth");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete data. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-2xl">
        <Button 
          variant="ghost" 
          className="mb-6"
          onClick={() => navigate("/dashboard")}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="p-6 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Privacy & Consent</h1>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                We process photos and speech <strong>on your device</strong> when possible.
                Your photos are stored privately and shared with no one. You can delete them anytime.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex-1">
                  <div className="font-medium">Anonymous Analytics</div>
                  <div className="text-sm text-muted-foreground">
                    Help us improve by sharing usage data (no photos or speech)
                  </div>
                </div>
                <Switch 
                  checked={allowAnalytics} 
                  onCheckedChange={setAllowAnalytics} 
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex-1">
                  <div className="font-medium">Speech Recognition</div>
                  <div className="text-sm text-muted-foreground">
                    Enable automatic speech detection (experimental, device-only)
                  </div>
                </div>
                <Switch 
                  checked={allowASR} 
                  onCheckedChange={setAllowASR} 
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">Consent Version</div>
                <div className="text-sm text-muted-foreground">
                  Current: v{consentVersion}
                </div>
              </div>
              <Button 
                onClick={() => setConsentVersion(v => v + 1)} 
                variant="outline"
              >
                Acknowledge Update
              </Button>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={save} 
                disabled={saving}
                className="flex-1 bg-gradient-healing"
              >
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>

            <div className="pt-6 mt-6 border-t">
              <h3 className="font-semibold mb-3 text-destructive">Danger Zone</h3>
              <Button 
                variant="destructive" 
                onClick={deleteAllData}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All My Data
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
