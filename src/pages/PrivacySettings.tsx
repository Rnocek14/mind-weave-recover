import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Shield, Trash2, Volume2 } from "lucide-react";
import { BackButton } from "@/components/layout/BackButton";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const [voicePreference, setVoicePreference] = useState<'male' | 'female' | 'neutral'>('neutral');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

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
      setVoicePreference(prefs?.voicePreference ?? 'neutral');
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
            allowASR,
            voicePreference
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

  const previewVoice = async (voiceType: 'neutral' | 'male' | 'female') => {
    const voiceMap = {
      'neutral': 'alloy',
      'male': 'onyx',
      'female': 'nova'
    };
    
    const sampleText = "Hello, I'm your speech therapy assistant. Let's practice together.";
    setPlayingVoice(voiceType);

    try {
      // The TTS endpoint requires a real user JWT — the anon key alone is
      // rejected now that the function authenticates callers.
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({
            text: sampleText,
            voiceId: 'XrExE9yKIg1WjnnlVkGX'
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate speech preview');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setPlayingVoice(null);
      };
      
      await audio.play();
    } catch (error) {
      console.error('Voice preview error:', error);
      toast({
        title: "Preview Error",
        description: "Could not play voice preview. Please try again.",
        variant: "destructive"
      });
      setPlayingVoice(null);
    }
  };

  const deleteAllData = async () => {
    if (!user) return;

    try {
      // Server-side deletion: removes storage objects, then the auth account
      // itself — every user-keyed table cascades. (The old client-side
      // version deleted profile rows but left the account and most telemetry
      // behind, which broke the Privacy Policy's deletion promise.)
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirm: "DELETE" },
      });

      if (error || !data?.ok) {
        throw new Error(error?.message ?? "Deletion failed");
      }

      toast({
        title: "Account deleted",
        description: "Your account and all your data have been removed.",
      });

      // The account no longer exists — clear the dead local session.
      await supabase.auth.signOut();
      navigate("/");
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete your account. Please try again or contact support.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-gradient-calm flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-2xl">
        <BackButton className="mb-6" />

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

              <div className="py-4 border-b">
                <div className="flex items-center gap-2 mb-3">
                  <Volume2 className="w-5 h-5 text-primary" />
                  <div className="font-medium">Voice for Audio Cues</div>
                </div>
                <div className="text-sm text-muted-foreground mb-3">
                  Choose the voice type for phrase practice audio playback
                </div>
                <RadioGroup value={voicePreference} onValueChange={(value: any) => setVoicePreference(value)}>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="neutral" id="neutral" />
                      <Label htmlFor="neutral" className="cursor-pointer">Neutral (Alloy)</Label>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => previewVoice('neutral')}
                      disabled={playingVoice === 'neutral'}
                    >
                      <Volume2 className="w-4 h-4 mr-1" />
                      {playingVoice === 'neutral' ? 'Playing...' : 'Preview'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id="male" />
                      <Label htmlFor="male" className="cursor-pointer">Male (Onyx)</Label>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => previewVoice('male')}
                      disabled={playingVoice === 'male'}
                    >
                      <Volume2 className="w-4 h-4 mr-1" />
                      {playingVoice === 'male' ? 'Playing...' : 'Preview'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id="female" />
                      <Label htmlFor="female" className="cursor-pointer">Female (Nova)</Label>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => previewVoice('female')}
                      disabled={playingVoice === 'female'}
                    >
                      <Volume2 className="w-4 h-4 mr-1" />
                      {playingVoice === 'female' ? 'Playing...' : 'Preview'}
                    </Button>
                  </div>
                </RadioGroup>
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All My Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This deletes your account, your practice history, and your
                      recordings. It cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep my account</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={deleteAllData}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
