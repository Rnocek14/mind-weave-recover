import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Battery, Moon, Heart, SmilePlus, X, ChevronDown, ChevronUp, Check } from "lucide-react";
import { toast } from "sonner";

interface DailyReadinessCheckinProps {
  onSubmit: (data: {
    fatigue_rating: number;
    fatigue_limited_practice?: boolean;
    sleep_quality?: number | null;
    pain_level?: number | null;
    mood_rating?: number | null;
    notes?: string | null;
  }) => Promise<any>;
  onSkip?: () => void;
  isSaving?: boolean;
}

const fatigueOptions = [
  { value: 1, emoji: "💪", label: "Fresh", color: "hover:bg-emerald-100 hover:border-emerald-300 dark:hover:bg-emerald-900/30" },
  { value: 2, emoji: "🙂", label: "Good", color: "hover:bg-green-100 hover:border-green-300 dark:hover:bg-green-900/30" },
  { value: 3, emoji: "😐", label: "Okay", color: "hover:bg-yellow-100 hover:border-yellow-300 dark:hover:bg-yellow-900/30" },
  { value: 4, emoji: "😮‍💨", label: "Tired", color: "hover:bg-orange-100 hover:border-orange-300 dark:hover:bg-orange-900/30" },
  { value: 5, emoji: "😴", label: "Exhausted", color: "hover:bg-red-100 hover:border-red-300 dark:hover:bg-red-900/30" },
];

const selectedColors: Record<number, string> = {
  1: "bg-emerald-100 border-emerald-400 dark:bg-emerald-900/40",
  2: "bg-green-100 border-green-400 dark:bg-green-900/40",
  3: "bg-yellow-100 border-yellow-400 dark:bg-yellow-900/40",
  4: "bg-orange-100 border-orange-400 dark:bg-orange-900/40",
  5: "bg-red-100 border-red-400 dark:bg-red-900/40",
};

const miniScale = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

export const DailyReadinessCheckin = ({ onSubmit, onSkip, isSaving }: DailyReadinessCheckinProps) => {
  const [fatigue, setFatigue] = useState<number | null>(null);
  const [fatigueLimited, setFatigueLimited] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [sleep, setSleep] = useState<number | null>(null);
  const [pain, setPain] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (fatigue === null) return;
    const result = await onSubmit({
      fatigue_rating: fatigue,
      fatigue_limited_practice: fatigueLimited,
      sleep_quality: sleep,
      pain_level: pain,
      mood_rating: mood,
      notes: notes.trim() || null,
    });
    if (result) {
      toast.success("Readiness check-in saved!");
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="text-center pb-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">Daily Check-in</Badge>
          {onSkip && (
            <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" /> Skip
            </Button>
          )}
        </div>
        <CardTitle className="text-xl mt-2">How's your energy today?</CardTitle>
        <CardDescription>This takes 20 seconds and helps personalize your session</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Fatigue Rating — Required */}
        <div className="grid grid-cols-5 gap-2">
          {fatigueOptions.map((opt) => (
            <Button
              key={opt.value}
              variant="outline"
              onClick={() => setFatigue(opt.value)}
              disabled={isSaving}
              className={cn(
                "flex flex-col h-auto py-3 gap-1 transition-all",
                fatigue === opt.value ? selectedColors[opt.value] : opt.color
              )}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-[10px] font-medium leading-tight">{opt.label}</span>
            </Button>
          ))}
        </div>

        {/* Fatigue limited practice? */}
        {fatigue !== null && fatigue >= 3 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 animate-fade-in">
            <Label htmlFor="fatigue-limited" className="text-sm cursor-pointer">
              Did fatigue limit your practice yesterday?
            </Label>
            <Switch
              id="fatigue-limited"
              checked={fatigueLimited}
              onCheckedChange={setFatigueLimited}
            />
          </div>
        )}

        {/* Optional fields toggle */}
        {fatigue !== null && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setShowOptional(!showOptional)}
          >
            {showOptional ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
            {showOptional ? "Hide" : "Add"} sleep, pain & mood (optional)
          </Button>
        )}

        {showOptional && (
          <div className="space-y-4 animate-fade-in">
            {/* Sleep */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Moon className="w-4 h-4 text-muted-foreground" /> Sleep quality
              </Label>
              <div className="flex gap-2">
                {miniScale.map((s) => (
                  <Button
                    key={s.value}
                    variant={sleep === s.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSleep(s.value)}
                    className="flex-1"
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Pain */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Heart className="w-4 h-4 text-muted-foreground" /> Pain level
              </Label>
              <div className="flex gap-2">
                {miniScale.map((s) => (
                  <Button
                    key={s.value}
                    variant={pain === s.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPain(s.value)}
                    className="flex-1"
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <SmilePlus className="w-4 h-4 text-muted-foreground" /> Mood
              </Label>
              <div className="flex gap-2">
                {miniScale.map((s) => (
                  <Button
                    key={s.value}
                    variant={mood === s.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMood(s.value)}
                    className="flex-1"
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm">Anything else? (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                placeholder="e.g. 'Slept badly', 'PT was tough yesterday'"
                className="resize-none h-16"
                maxLength={500}
              />
            </div>
          </div>
        )}

        {/* Submit */}
        {fatigue !== null && (
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            className="w-full h-12 text-base animate-fade-in"
          >
            <Check className="w-5 h-5 mr-2" />
            {isSaving ? "Saving..." : "Save & Continue"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
