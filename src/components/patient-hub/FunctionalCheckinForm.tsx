/**
 * Functional Communication Check-in Form
 * Simple 4-question Likert (1-5) form for tracking real-world communication outcomes.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FunctionalCheckinFormProps {
  userId: string;
  profileId: string;
  onComplete?: () => void;
}

const QUESTIONS = [
  {
    key: "communication_of_needs" as const,
    label: "Communication of Basic Needs",
    description: "Can they express hunger, pain, bathroom needs, etc.?",
    anchors: ["Cannot express", "Rarely", "Sometimes", "Usually", "Independently"],
  },
  {
    key: "conversational_participation" as const,
    label: "Conversational Participation",
    description: "Can they engage in back-and-forth conversation?",
    anchors: ["No participation", "Minimal", "With support", "Mostly independent", "Full participation"],
  },
  {
    key: "independence_level" as const,
    label: "Communication Independence",
    description: "How much help do they need to communicate daily?",
    anchors: ["Fully dependent", "Mostly dependent", "Some help", "Mostly independent", "Fully independent"],
  },
  {
    key: "caregiver_burden" as const,
    label: "Caregiver Communication Burden",
    description: "How much effort does the caregiver spend facilitating communication?",
    anchors: ["Extreme burden", "High", "Moderate", "Low", "Minimal/none"],
  },
];

type RatingKey = typeof QUESTIONS[number]["key"];

export function FunctionalCheckinForm({ userId, profileId, onComplete }: FunctionalCheckinFormProps) {
  const { toast } = useToast();
  const [ratings, setRatings] = useState<Record<RatingKey, number | null>>({
    communication_of_needs: null,
    conversational_participation: null,
    independence_level: null,
    caregiver_burden: null,
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const allRated = Object.values(ratings).every((v) => v !== null);

  const handleSubmit = async () => {
    if (!allRated) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("functional_checkins").insert({
        user_id: userId,
        profile_id: profileId,
        communication_of_needs: ratings.communication_of_needs!,
        conversational_participation: ratings.conversational_participation!,
        independence_level: ratings.independence_level!,
        caregiver_burden: ratings.caregiver_burden!,
        notes: notes.trim() || null,
        rated_by: userId,
      });
      if (error) throw error;
      toast({ title: "Check-in saved", description: "Functional communication check-in recorded." });
      setShowForm(false);
      setRatings({ communication_of_needs: null, conversational_participation: null, independence_level: null, caregiver_burden: null });
      setNotes("");
      onComplete?.();
    } catch (err) {
      console.error("Failed to save functional check-in:", err);
      toast({ title: "Error", description: "Could not save check-in. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!showForm) {
    return (
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowForm(true)}>
        <ClipboardCheck className="w-4 h-4" />
        Record Functional Check-in
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          Functional Communication Check-in
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-4">
        {QUESTIONS.map((q) => (
          <div key={q.key} className="space-y-1.5">
            <div className="text-xs font-medium">{q.label}</div>
            <div className="text-xs text-muted-foreground">{q.description}</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  onClick={() => setRatings((r) => ({ ...r, [q.key]: val }))}
                  className={cn(
                    "flex-1 py-1.5 rounded text-xs border transition-colors",
                    ratings[q.key] === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 hover:bg-muted/60 border-border/50"
                  )}
                  title={q.anchors[val - 1]}
                >
                  {val}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>{q.anchors[0]}</span>
              <span>{q.anchors[4]}</span>
            </div>
          </div>
        ))}

        <Textarea
          placeholder="Optional notes (observed context, changes, concerns...)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-xs min-h-[60px]"
        />

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={!allRated || saving} className="gap-1">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Save Check-in
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
