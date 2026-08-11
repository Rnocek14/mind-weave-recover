/**
 * CaregiverSetup — "Who are you helping?"
 *
 * The single, low-friction screen a family caregiver sees right after signing
 * up. It creates the recovery profile for the person they're helping (a
 * profile_kind='patient' record owned by the caregiver's account), makes it the
 * active profile, and drops them onto the caregiver home with a one-tap
 * "Start practice for [name]" launcher.
 *
 * No admin approval. No patient login. No clinician assignment. The caregiver
 * remains the account owner/member — never a patient profile.
 *
 * Optional clinical notes are skippable and never block reaching practice.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ArrowRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUiMode } from "@/hooks/useUiMode";
import { toast } from "sonner";

export default function CaregiverSetup() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { createProfile } = useProfile();
  const { setUiMode } = useUiMode();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [strokeDate, setStrokeDate] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && user) setUiMode("caregiver");
  }, [authLoading, user, setUiMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!name) return;

    setSubmitting(true);
    try {
      await createProfile({
        profile_name: name,
        stroke_date: strokeDate || undefined,
        profile_notes: notes.trim() || undefined,
        makeActive: true,
      });
      navigate("/caregiver", { replace: true });
    } catch {
      toast.error("Could not create the profile. Please try again.");
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-dvh bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-calm flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="w-7 h-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Who are you helping?</h1>
          <p className="text-muted-foreground">
            Set up the person who's recovering. You'll manage their practice from
            your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">First name</label>
            <Input
              placeholder="e.g., Bob"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Last name <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              placeholder="e.g., Smith"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Date of stroke{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              type="date"
              value={strokeDate}
              onChange={(e) => setStrokeDate(e.target.value)}
            />
          </div>

          {showNotes ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Their therapy notes{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                placeholder="Anything a therapist has shared — strengths, goals, what's hard."
                className="resize-none"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          ) : (
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setShowNotes(true)}
            >
              + Add their therapy notes
            </button>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full gap-2"
            disabled={submitting || !firstName.trim()}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Create recovery profile
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
